import { randomUUID } from 'node:crypto';

import { HttpStatus, Injectable, type OnModuleInit } from '@nestjs/common';
import {
  AuditOutcome,
  Prisma,
  RecordStatus,
  UserStatus,
} from '@manglam/database';

import { ApiError } from '../../common/http/api-error.js';
import { DatabaseService } from '../../infrastructure/database/database.service.js';
import type { AuthenticatedPrincipal } from '../access/access.types.js';
import type { MutationActor, TransactionClient } from '../platform/mutation-journal.service.js';
import { MutationJournalService } from '../platform/mutation-journal.service.js';
import type { MutationRequestContext } from '../platform/request-context.js';
import { PasswordHasher } from '../security/password-hasher.js';
import { SecretDigestService } from '../security/secret-digest.service.js';
import type { PinUnlockInput, SetPinInput } from './auth.schemas.js';
import {
  failedOutcome,
  successfulOutcome,
  type StoredOutcome,
  unwrapOutcome,
} from './auth-outcome.js';
import { AuthReplayService } from './auth-replay.service.js';
import { AuthSocietyService } from './auth-society.service.js';
import {
  CredentialAttemptService,
  type CredentialAttemptKeys,
} from './credential-attempt.service.js';
import {
  principalActor,
  SessionService,
  type SessionTokenResponse,
} from './session.service.js';

export interface SetPinResponse {
  readonly updated: true;
}

@Injectable()
export class ResidentPinService implements OnModuleInit {
  private dummyHash: string | null = null;

  constructor(
    private readonly database: DatabaseService,
    private readonly society: AuthSocietyService,
    private readonly digests: SecretDigestService,
    private readonly journal: MutationJournalService,
    private readonly replay: AuthReplayService,
    private readonly attempts: CredentialAttemptService,
    private readonly passwords: PasswordHasher,
    private readonly sessions: SessionService,
  ) {}

  async onModuleInit(): Promise<void> {
    this.dummyHash = await this.passwords.hash(
      `invalid-resident-${randomUUID()}`,
      'RESIDENT_APP_PIN',
    );
  }

  async setPin(
    principal: AuthenticatedPrincipal,
    input: SetPinInput,
    context: MutationRequestContext,
  ): Promise<SetPinResponse> {
    if (
      principal.sessionKind !== 'RESIDENT' ||
      !principal.recentlyAuthenticated
    ) {
      throw new ApiError({
        code: 'STEP_UP_REQUIRED',
        details: {},
        message: 'Recent authentication is required to change the app PIN.',
        status: HttpStatus.UNAUTHORIZED,
      });
    }

    const actor = principalActor(principal);
    const requestContract = {
      pinProof: this.digests.credentialProof(
        input.pin,
        'RESIDENT_APP_PIN',
        principal.societyId,
      ),
    };
    const prior = await this.replay.find<SetPinResponse>({
      actor,
      idempotencyKey: context.idempotencyKey,
      operation: 'auth.pin.set',
      request: requestContract,
      societyId: principal.societyId,
    });
    if (prior.found) return prior.value;

    const encoded = await this.passwords.hash(input.pin, 'RESIDENT_APP_PIN');
    return this.database.client.$transaction(
      async (transaction) => {
        const claim = await this.journal.begin<SetPinResponse>(transaction, {
          actor,
          idempotencyKey: context.idempotencyKey,
          operation: 'auth.pin.set',
          request: requestContract,
          societyId: principal.societyId,
        });
        if (claim.kind === 'replay') return claim.response;

        const user = await transaction.user.findFirst({
          where: {
            id: principal.user.id,
            societyId: principal.societyId,
            status: UserStatus.ACTIVE,
          },
        });
        if (!user) throw resourceNotFound();

        await transaction.user.update({
          data: { appPinHash: encoded, version: { increment: 1 } },
          where: { id: user.id },
        });
        const response = { updated: true as const };
        await this.journal.commit(transaction, {
          action: 'auth.pin.set',
          actor,
          aggregateId: user.id,
          aggregateType: 'User',
          correlationId: context.databaseCorrelationId,
          entityId: user.id,
          entityType: 'User',
          eventType: 'auth.pin.updated',
          idempotencyRecordId: claim.recordId,
          metadata: { ipAddress: context.ipAddress },
          newValues: { pinConfigured: true },
          previousValues: { pinConfigured: user.appPinHash !== null },
          response,
          responseStatus: HttpStatus.OK,
          societyId: principal.societyId,
        });
        return response;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async unlock(
    input: PinUnlockInput,
    context: MutationRequestContext,
  ): Promise<SessionTokenResponse> {
    const societyId = await this.society.activeId();
    const attemptKeys = this.attempts.keys({
      deviceFingerprint: input.device.fingerprint,
      identifier: input.phone,
      ipAddress: context.ipAddress,
      method: 'RESIDENT_APP_PIN',
      societyId,
    });
    const deviceDigest = this.digests.deviceFingerprint(
      input.device.fingerprint,
      societyId,
    );
    const actor: MutationActor = {
      actorScopeKey: `resident-pin:${attemptKeys.subjectDigest}:${deviceDigest}`.slice(
        0,
        200,
      ),
    };
    const requestContract = {
      device: { ...input.device, fingerprint: deviceDigest },
      phoneDigest: attemptKeys.subjectDigest,
      pinProof: this.digests.credentialProof(
        input.pin,
        'RESIDENT_APP_PIN',
        societyId,
      ),
    };
    const prior = await this.replay.find<StoredOutcome<SessionTokenResponse>>({
      actor,
      idempotencyKey: context.idempotencyKey,
      operation: 'auth.pin.unlock',
      request: requestContract,
      societyId,
    });
    if (prior.found) return unwrapOutcome(prior.value);

    const now = new Date();
    const candidate = await this.database.client.user.findFirst({
      include: {
        guardProfile: true,
        roleAssignments: {
          include: { role: true },
          where: {
            startsAt: { lte: now },
            revokedAt: null,
            OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
            role: {
              code: { in: ['SOCIETY_ADMIN', 'SUPER_ADMIN'] },
              status: RecordStatus.ACTIVE,
            },
          },
        },
      },
      where: {
        normalizedPhone: input.phone,
        societyId,
        status: UserStatus.ACTIVE,
      },
    });
    const pinValid = await this.passwords.verify(
      input.pin,
      candidate?.appPinHash ?? (await this.getDummyHash()),
      'RESIDENT_APP_PIN',
    );
    const eligible =
      Boolean(candidate?.appPinHash) &&
      candidate?.guardProfile === null &&
      candidate.roleAssignments.length === 0 &&
      pinValid;
    const operationId = candidate?.id ?? randomUUID();

    const outcome = await this.database.client.$transaction(
      async (transaction) => {
        const claim = await this.journal.begin<StoredOutcome<SessionTokenResponse>>(
          transaction,
          {
            actor: { ...actor, userId: candidate?.id ?? null },
            idempotencyKey: context.idempotencyKey,
            operation: 'auth.pin.unlock',
            request: requestContract,
            societyId,
          },
        );
        if (claim.kind === 'replay') return claim.response;

        const allowed = await this.attempts.allowed(transaction, {
          ...attemptKeys,
          method: 'RESIDENT_APP_PIN',
          societyId,
        });
        if (!allowed) {
          return this.commitUnlockFailure(transaction, {
            actor,
            attemptKeys,
            attemptOutcome: 'BLOCKED',
            claimId: claim.recordId,
            code: 'AUTHENTICATION_RATE_LIMITED',
            context,
            operationId,
            societyId,
            status: HttpStatus.TOO_MANY_REQUESTS,
          });
        }

        const current = candidate
          ? await transaction.user.findFirst({
              include: {
                guardProfile: true,
                roleAssignments: {
                  include: { role: true },
                  where: {
                    startsAt: { lte: new Date() },
                    revokedAt: null,
                    OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
                    role: {
                      code: { in: ['SOCIETY_ADMIN', 'SUPER_ADMIN'] },
                      status: RecordStatus.ACTIVE,
                    },
                  },
                },
              },
              where: {
                appPinHash: candidate.appPinHash,
                id: candidate.id,
                societyId,
                status: UserStatus.ACTIVE,
              },
            })
          : null;
        if (
          !eligible ||
          !current ||
          current.guardProfile !== null ||
          current.roleAssignments.length > 0
        ) {
          return this.commitUnlockFailure(transaction, {
            actor,
            attemptKeys,
            attemptOutcome: 'FAILURE',
            claimId: claim.recordId,
            code: 'AUTHENTICATION_REQUIRED',
            context,
            operationId,
            societyId,
          });
        }

        const tokens = await this.sessions.createWithinTransaction(transaction, {
          context,
          device: input.device,
          kind: 'RESIDENT',
          societyId,
          userId: current.id,
        });
        await this.attempts.record(transaction, {
          ...attemptKeys,
          method: 'RESIDENT_APP_PIN',
          outcome: 'SUCCESS',
          societyId,
        });
        const stored = successfulOutcome(tokens);
        await this.journal.commit(transaction, {
          action: 'auth.pin.unlock',
          actor: {
            ...actor,
            actorScopeKey: `session:${tokens.sessionId}`,
            sessionId: tokens.sessionId,
            userId: current.id,
          },
          aggregateId: tokens.sessionId,
          aggregateType: 'UserSession',
          correlationId: context.databaseCorrelationId,
          entityId: current.id,
          entityType: 'User',
          eventType: 'auth.session.created',
          idempotencyRecordId: claim.recordId,
          metadata: {
            ipAddress: context.ipAddress,
            method: 'RESIDENT_APP_PIN',
          },
          newValues: { sessionId: tokens.sessionId },
          response: stored,
          responseStatus: HttpStatus.CREATED,
          societyId,
        });
        return stored;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    return unwrapOutcome(outcome);
  }

  private async commitUnlockFailure(
    transaction: TransactionClient,
    input: {
      readonly actor: MutationActor;
      readonly attemptKeys: CredentialAttemptKeys;
      readonly attemptOutcome: 'BLOCKED' | 'FAILURE';
      readonly claimId: string;
      readonly code: string;
      readonly context: MutationRequestContext;
      readonly operationId: string;
      readonly societyId: string;
      readonly status?: number;
    },
  ): Promise<StoredOutcome<SessionTokenResponse>> {
    await this.attempts.record(transaction, {
      ...input.attemptKeys,
      failureCode: input.code,
      method: 'RESIDENT_APP_PIN',
      outcome: input.attemptOutcome,
      societyId: input.societyId,
    });
    const stored = failedOutcome<SessionTokenResponse>({
      code: input.code,
      status: input.status,
    });
    await this.journal.commit(transaction, {
      action: 'auth.pin.unlock_failed',
      actor: input.actor,
      aggregateId: input.operationId,
      aggregateType: 'User',
      auditOutcome: AuditOutcome.FAILURE,
      correlationId: input.context.databaseCorrelationId,
      entityId: input.actor.userId ?? null,
      entityType: 'User',
      eventType: 'auth.pin.unlock_failed',
      idempotencyRecordId: input.claimId,
      metadata: {
        failureCode: input.code,
        ipAddress: input.context.ipAddress,
      },
      reason: input.code,
      response: stored,
      responseStatus: stored.error.status,
      societyId: input.societyId,
    });
    return stored;
  }

  private async getDummyHash(): Promise<string> {
    this.dummyHash ??= await this.passwords.hash(
      `invalid-resident-${randomUUID()}`,
      'RESIDENT_APP_PIN',
    );
    return this.dummyHash;
  }
}

function resourceNotFound(): ApiError {
  return new ApiError({
    code: 'RESOURCE_NOT_FOUND',
    details: {},
    message: 'The requested resource was not found.',
    status: HttpStatus.NOT_FOUND,
  });
}
