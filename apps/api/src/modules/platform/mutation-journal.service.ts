import { randomUUID } from 'node:crypto';

import { HttpStatus, Injectable } from '@nestjs/common';
import { AuditOutcome, IdempotencyStatus, OutboxStatus, Prisma } from '@manglam/database';
import { idempotencyKeySchema } from '@manglam/validation';

import { ApiError } from '../../common/http/api-error.js';
import { canonicalJson, requestHash, sha256 } from './canonical.js';
import { assertSafeOutboxPayload } from './outbox-contracts.js';
import { SensitivePayloadCipher } from './sensitive-payload-cipher.js';

export type TransactionClient = Prisma.TransactionClient;

export interface MutationActor {
  readonly actorScopeKey: string;
  readonly deviceId?: string | null;
  readonly gateId?: string | null;
  readonly guardDeviceId?: string | null;
  readonly sessionId?: string | null;
  readonly userId?: string | null;
}

export interface BeginMutationInput {
  readonly actor: MutationActor;
  readonly idempotencyKey: string;
  readonly operation: string;
  readonly request: unknown;
  readonly societyId: string;
}

export type MutationClaim<TResponse> =
  | { readonly kind: 'execute'; readonly recordId: string; readonly requestHash: string }
  | { readonly kind: 'replay'; readonly response: TResponse };

export interface CommitMutationInput<TResponse> {
  readonly action: string;
  readonly auditOutcome?: AuditOutcome;
  readonly actor: MutationActor;
  readonly aggregateId: string;
  readonly aggregateType: string;
  readonly correlationId: string;
  readonly entityId?: string | null;
  readonly entityType: string;
  readonly eventType: string;
  readonly idempotencyRecordId: string;
  readonly metadata?: Record<string, unknown>;
  readonly outboxPayload?: Record<string, unknown>;
  readonly newValues?: Record<string, unknown>;
  readonly operationKey?: string;
  readonly previousValues?: Record<string, unknown>;
  readonly reason?: string;
  readonly response: TResponse;
  readonly responseStatus: number;
  readonly societyId: string;
}

const IDEMPOTENCY_TTL_MS = 24 * 60 * 60_000;
const CLAIM_LOCK_MS = 30_000;

@Injectable()
export class MutationJournalService {
  constructor(private readonly cipher: SensitivePayloadCipher) {}

  hashRequest(value: unknown): string {
    return requestHash(value);
  }

  async begin<TResponse>(
    transaction: TransactionClient,
    input: BeginMutationInput,
  ): Promise<MutationClaim<TResponse>> {
    const key = idempotencyKeySchema.safeParse(input.idempotencyKey);
    if (!key.success) {
      throw new ApiError({
        code: 'VALIDATION_FAILED',
        details: { field: 'idempotency-key' },
        message: 'A valid Idempotency-Key header is required.',
        status: HttpStatus.BAD_REQUEST,
      });
    }

    const now = new Date();
    const candidateId = randomUUID();
    const computedHash = this.hashRequest(input.request);
    const record = await transaction.idempotencyRecord.upsert({
      create: {
        actorScopeKey: input.actor.actorScopeKey,
        actorUserId: input.actor.userId ?? null,
        expiresAt: new Date(now.getTime() + IDEMPOTENCY_TTL_MS),
        guardDeviceId: input.actor.guardDeviceId ?? null,
        id: candidateId,
        key: key.data,
        lockedUntil: new Date(now.getTime() + CLAIM_LOCK_MS),
        operation: input.operation,
        requestHash: computedHash,
        sessionId: input.actor.sessionId ?? null,
        societyId: input.societyId,
        status: IdempotencyStatus.IN_PROGRESS,
      },
      update: {},
      where: {
        societyId_actorScopeKey_operation_key: {
          actorScopeKey: input.actor.actorScopeKey,
          key: key.data,
          operation: input.operation,
          societyId: input.societyId,
        },
      },
    });

    if (record.requestHash !== computedHash) {
      throw new ApiError({
        code: 'IDEMPOTENCY_KEY_REUSED',
        details: { operation: input.operation },
        message: 'This idempotency key was already used for a different request.',
        status: HttpStatus.CONFLICT,
      });
    }

    if (record.id === candidateId) {
      return { kind: 'execute', recordId: record.id, requestHash: computedHash };
    }

    if (record.status === IdempotencyStatus.COMPLETED && record.responseBody !== null) {
      return {
        kind: 'replay',
        response: this.cipher.decrypt<TResponse>(record.responseBody),
      };
    }

    const lockExpired = record.lockedUntil === null || record.lockedUntil <= now;
    if (record.status === IdempotencyStatus.IN_PROGRESS && !lockExpired) {
      throw new ApiError({
        code: 'IDEMPOTENCY_REQUEST_IN_PROGRESS',
        details: { operation: input.operation },
        message: 'The same request is already being processed.',
        status: HttpStatus.CONFLICT,
      });
    }

    const claimed = await transaction.idempotencyRecord.updateMany({
      data: {
        lockedUntil: new Date(now.getTime() + CLAIM_LOCK_MS),
        responseBody: Prisma.DbNull,
        responseStatus: null,
        status: IdempotencyStatus.IN_PROGRESS,
      },
      where: {
        id: record.id,
        OR: [
          { status: IdempotencyStatus.FAILED },
          { lockedUntil: null },
          { lockedUntil: { lte: now } },
        ],
      },
    });

    if (claimed.count !== 1) {
      throw new ApiError({
        code: 'IDEMPOTENCY_REQUEST_IN_PROGRESS',
        details: { operation: input.operation },
        message: 'The same request is already being processed.',
        status: HttpStatus.CONFLICT,
      });
    }

    return { kind: 'execute', recordId: record.id, requestHash: computedHash };
  }

  async commit<TResponse>(
    transaction: TransactionClient,
    input: CommitMutationInput<TResponse>,
  ): Promise<void> {
    const outboxPayload = {
      aggregateId: input.aggregateId,
      correlationId: input.correlationId,
      societyId: input.societyId,
      ...(input.outboxPayload ?? {}),
    };
    assertSafeOutboxPayload(input.eventType, outboxPayload);

    await this.appendAudit(transaction, input);

    await transaction.outboxEvent.create({
      data: {
        aggregateId: input.aggregateId,
        aggregateType: input.aggregateType,
        correlationId: input.correlationId,
        dedupeKey: `${input.operationKey ?? input.eventType}:${input.idempotencyRecordId}`.slice(
          0,
          200,
        ),
        eventType: input.eventType,
        payload: outboxPayload as Prisma.InputJsonValue,
        societyId: input.societyId,
        status: OutboxStatus.PENDING,
      },
    });

    await transaction.idempotencyRecord.update({
      data: {
        lockedUntil: null,
        responseBody: this.cipher.encrypt(input.response) as unknown as Prisma.InputJsonValue,
        responseStatus: input.responseStatus,
        status: IdempotencyStatus.COMPLETED,
      },
      where: { id: input.idempotencyRecordId },
    });
  }

  private async appendAudit<TResponse>(
    transaction: TransactionClient,
    input: CommitMutationInput<TResponse>,
  ): Promise<void> {
    await transaction.$queryRaw(
      Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${input.societyId}, 0))`,
    );
    const previous = await transaction.auditLog.findFirst({
      orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
      select: { entryHash: true },
      where: { societyId: input.societyId },
    });

    const occurredAt = new Date();
    const auditMaterial = {
      action: input.action,
      actor: input.actor,
      correlationId: input.correlationId,
      entityId: input.entityId ?? null,
      entityType: input.entityType,
      metadata: input.metadata ?? null,
      newValues: input.newValues ?? null,
      occurredAt,
      previousHash: previous?.entryHash ?? null,
      previousValues: input.previousValues ?? null,
      reason: input.reason ?? null,
      societyId: input.societyId,
    };
    const entryHash = sha256(canonicalJson(auditMaterial));

    await transaction.auditLog.create({
      data: {
        action: input.action,
        actorUserId: input.actor.userId ?? null,
        correlationId: input.correlationId,
        deviceId: input.actor.deviceId ?? null,
        entityId: input.entityId ?? null,
        entityType: input.entityType,
        entryHash,
        gateId: input.actor.gateId ?? null,
        ipAddress: typeof input.metadata?.ipAddress === 'string' ? input.metadata.ipAddress : null,
        metadata: input.metadata ? (input.metadata as Prisma.InputJsonValue) : Prisma.JsonNull,
        newValues: input.newValues ? (input.newValues as Prisma.InputJsonValue) : Prisma.JsonNull,
        occurredAt,
        outcome: input.auditOutcome ?? AuditOutcome.SUCCESS,
        previousHash: previous?.entryHash ?? null,
        previousValues: input.previousValues
          ? (input.previousValues as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        reason: input.reason?.trim() || null,
        sessionId: input.actor.sessionId ?? null,
        societyId: input.societyId,
      },
    });
  }
}
