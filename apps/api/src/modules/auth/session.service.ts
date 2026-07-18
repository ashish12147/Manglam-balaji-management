import { randomUUID } from 'node:crypto';

import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DeviceStatus,
  Prisma,
  RecordStatus,
  SessionStatus,
  UserStatus,
} from '@manglam/database';

import { ApiError } from '../../common/http/api-error.js';
import type { AppEnvironment } from '../../config/env.schema.js';
import { DatabaseService } from '../../infrastructure/database/database.service.js';
import type { AuthenticatedPrincipal } from '../access/access.types.js';
import { decodeCursor, pageResult } from '../platform/cursor.js';
import {
  MutationJournalService,
  type MutationActor,
  type TransactionClient,
} from '../platform/mutation-journal.service.js';
import type { MutationRequestContext } from '../platform/request-context.js';
import { AccessTokenService } from '../security/access-token.service.js';
import { SecretDigestService } from '../security/secret-digest.service.js';
import { digestMatches, randomOpaqueToken } from '../security/secrets.js';
import type { AuthDeviceInput, SessionListQuery } from './auth.schemas.js';
import { CredentialAttemptService } from './credential-attempt.service.js';

export interface SessionTokenResponse {
  readonly accessToken: string;
  readonly accessTokenExpiresAt: string;
  readonly refreshToken: string;
  readonly refreshTokenExpiresAt: string;
  readonly sessionId: string;
  readonly tokenType: 'Bearer';
}

export interface SessionListItem {
  readonly absoluteExpiresAt: string;
  readonly createdAt: string;
  readonly current: boolean;
  readonly device: {
    readonly id: string;
    readonly label: string | null;
    readonly platform: string;
  } | null;
  readonly deviceName: string;
  readonly expiresAt: string;
  readonly id: string;
  readonly lastSeenAt: string;
  readonly platform: string;
  readonly status: string;
}

export interface SessionPage {
  readonly items: readonly SessionListItem[];
  readonly nextCursor: string | null;
}

interface StoredFailure {
  readonly code: string;
  readonly details: Record<string, unknown>;
  readonly message: string;
  readonly status: number;
}

type StoredOutcome<T> =
  | { readonly data: T; readonly ok: true }
  | { readonly error: StoredFailure; readonly ok: false };

export interface CreateSessionInput {
  readonly context: MutationRequestContext;
  readonly device: AuthDeviceInput;
  readonly devicePolicy?: 'ALLOW_ACTIVATION' | 'REQUIRE_ACTIVE_GUARD';
  readonly kind: 'RESIDENT' | 'GUARD' | 'PRIVILEGED';
  readonly societyId: string;
  readonly userId: string;
}

interface RotateSessionInput {
  readonly deviceFingerprint: string;
  readonly refreshToken: string;
}

const SESSION_IDLE_TTL_SECONDS = 7 * 24 * 60 * 60;

@Injectable()
export class SessionService {
  private readonly refreshTtlSeconds: number;

  constructor(
    private readonly database: DatabaseService,
    config: ConfigService<AppEnvironment, true>,
    private readonly digests: SecretDigestService,
    private readonly journal: MutationJournalService,
    private readonly accessTokens: AccessTokenService,
    private readonly attempts: CredentialAttemptService,
  ) {
    this.refreshTtlSeconds = config.get('REFRESH_TOKEN_TTL_SECONDS', {
      infer: true,
    });
  }

  async createWithinTransaction(
    transaction: TransactionClient,
    input: CreateSessionInput,
  ): Promise<SessionTokenResponse> {
    const now = new Date();
    const fingerprintDigest = this.digests.deviceFingerprint(
      input.device.fingerprint,
      input.societyId,
    );
    const existingDevice = await transaction.device.findFirst({
      include: { guardDevice: true },
      where: { fingerprintDigest, societyId: input.societyId },
    });
    if (
      existingDevice &&
      (existingDevice.userId !== null && existingDevice.userId !== input.userId)
    ) {
      throw authenticationFailure();
    }
    if (
      existingDevice &&
      [DeviceStatus.REVOKED, DeviceStatus.LOST].includes(existingDevice.status)
    ) {
      throw authenticationFailure();
    }

    const guardPolicy =
      input.devicePolicy === 'REQUIRE_ACTIVE_GUARD' || input.kind === 'GUARD';
    if (
      guardPolicy &&
      (!existingDevice ||
        existingDevice.status !== DeviceStatus.ACTIVE ||
        existingDevice.userId !== input.userId ||
        existingDevice.guardDevice?.status !== DeviceStatus.ACTIVE)
    ) {
      throw enrollmentRequired();
    }

    const device = existingDevice
      ? await transaction.device.update({
          data: {
            appVersion: input.device.appVersion ?? null,
            label: input.device.label ?? existingDevice.label,
            lastSeenAt: now,
            operatingSystem: input.device.operatingSystem ?? null,
            platform: input.device.platform,
            ...(guardPolicy
              ? {}
              : { status: DeviceStatus.ACTIVE, userId: input.userId }),
            version: { increment: 1 },
          },
          where: { id: existingDevice.id },
        })
      : await transaction.device.create({
          data: {
            appVersion: input.device.appVersion ?? null,
            fingerprintDigest,
            label: input.device.label ?? null,
            lastSeenAt: now,
            operatingSystem: input.device.operatingSystem ?? null,
            platform: input.device.platform,
            societyId: input.societyId,
            status: DeviceStatus.ACTIVE,
            userId: input.userId,
          },
        });

    const familyId = randomUUID();
    const sessionId = randomUUID();
    const refreshToken = `${familyId}.${randomOpaqueToken(48)}`;
    const refreshExpiresAt = new Date(
      now.getTime() + this.refreshTtlSeconds * 1_000,
    );
    const idleExpiresAt = new Date(
      now.getTime() +
        Math.min(this.refreshTtlSeconds, SESSION_IDLE_TTL_SECONDS) * 1_000,
    );
    await transaction.userSession.create({
      data: {
        absoluteExpiresAt: refreshExpiresAt,
        deviceId: device.id,
        id: sessionId,
        idleExpiresAt,
        ipAddress: input.context.ipAddress,
        kind: input.kind,
        refreshTokenFamilyId: familyId,
        societyId: input.societyId,
        status: SessionStatus.ACTIVE,
        userAgentHash: input.context.userAgent
          ? this.journal.hashRequest(input.context.userAgent)
          : null,
        userId: input.userId,
      },
    });
    await transaction.refreshToken.create({
      data: {
        expiresAt: refreshExpiresAt,
        familyId,
        sessionId,
        societyId: input.societyId,
        status: SessionStatus.ACTIVE,
        tokenDigest: this.digests.refreshToken(refreshToken, familyId),
      },
    });
    await transaction.user.update({
      data: { lastAuthenticatedAt: now, version: { increment: 1 } },
      where: { id: input.userId },
    });

    const accessToken = await this.accessTokens.issue({
      deviceId: device.id,
      kind: input.kind,
      sessionId,
      societyId: input.societyId,
      userId: input.userId,
    });
    return {
      accessToken: accessToken.token,
      accessTokenExpiresAt: accessToken.expiresAt.toISOString(),
      refreshToken,
      refreshTokenExpiresAt: refreshExpiresAt.toISOString(),
      sessionId,
      tokenType: 'Bearer',
    };
  }

  async rotate(
    input: RotateSessionInput,
    context: MutationRequestContext,
  ): Promise<SessionTokenResponse> {
    const societyId = await this.activeSocietyId();
    const familyId = parseRefreshFamily(input.refreshToken);
    const rawTokenDigest = this.journal.hashRequest(input.refreshToken);
    const attemptKeys = this.attempts.keys({
      deviceFingerprint: input.deviceFingerprint,
      identifier: familyId ?? rawTokenDigest,
      ipAddress: context.ipAddress,
      method: 'REFRESH_TOKEN',
      societyId,
    });
    const tokenDigest = familyId
      ? this.digests.refreshToken(input.refreshToken, familyId)
      : null;
    const located = tokenDigest
      ? await this.database.client.refreshToken.findFirst({
          include: { session: { include: { device: true } } },
          where: { societyId, tokenDigest },
        })
      : null;
    const operationId = located?.sessionId ?? randomUUID();
    const actor: MutationActor = located
      ? {
          actorScopeKey: `session:${located.sessionId}`,
          deviceId: located.session.device?.id ?? null,
          sessionId: located.sessionId,
          userId: located.session.userId,
        }
      : { actorScopeKey: `refresh:${attemptKeys.subjectDigest}` };

    const outcome = await this.database.client.$transaction(
      async (transaction) => {
        const claim = await this.journal.begin<StoredOutcome<SessionTokenResponse>>(
          transaction,
          {
            actor,
            idempotencyKey: context.idempotencyKey,
            operation: 'auth.session.rotate',
            request: {
              deviceFingerprintDigest: this.digests.deviceFingerprint(
                input.deviceFingerprint,
                societyId,
              ),
              refreshTokenDigest: rawTokenDigest,
            },
            societyId,
          },
        );
        if (claim.kind === 'replay') return claim.response;

        const allowed = await this.attempts.allowed(transaction, {
          ...attemptKeys,
          method: 'REFRESH_TOKEN',
          societyId,
        });
        if (!allowed) {
          return this.commitRefreshFailure(transaction, {
            actor,
            attemptKeys,
            claimId: claim.recordId,
            context,
            failureCode: 'AUTHENTICATION_RATE_LIMITED',
            operationId,
            outcome: 'BLOCKED',
            societyId,
          });
        }

        const token = tokenDigest
          ? await transaction.refreshToken.findFirst({
              include: { session: { include: { device: true, user: true } } },
              where: { societyId, tokenDigest },
            })
          : null;
        if (!token?.session.device) {
          return this.commitRefreshFailure(transaction, {
            actor,
            attemptKeys,
            claimId: claim.recordId,
            context,
            failureCode: 'SESSION_EXPIRED',
            operationId,
            outcome: 'FAILURE',
            societyId,
          });
        }

        const now = new Date();
        const fingerprintDigest = this.digests.deviceFingerprint(
          input.deviceFingerprint,
          societyId,
        );
        const fingerprintMatches = digestMatches(
          fingerprintDigest,
          token.session.device.fingerprintDigest,
        );
        const replayed =
          token.status !== SessionStatus.ACTIVE || token.consumedAt !== null;
        const active =
          token.expiresAt > now &&
          token.session.status === SessionStatus.ACTIVE &&
          token.session.absoluteExpiresAt > now &&
          token.session.idleExpiresAt > now &&
          token.session.device.status === DeviceStatus.ACTIVE &&
          token.session.user.status === UserStatus.ACTIVE;
        if (replayed || !fingerprintMatches || !active) {
          return this.commitRefreshFailure(transaction, {
            actor,
            attemptKeys,
            claimId: claim.recordId,
            compromise: replayed || !fingerprintMatches,
            context,
            failureCode: replayed || !fingerprintMatches ? 'SESSION_COMPROMISED' : 'SESSION_EXPIRED',
            familyId: token.familyId,
            operationId: token.sessionId,
            outcome: 'FAILURE',
            sessionId: token.sessionId,
            societyId,
          });
        }

        const consumed = await transaction.refreshToken.updateMany({
          data: { consumedAt: now, status: SessionStatus.REVOKED },
          where: {
            consumedAt: null,
            id: token.id,
            status: SessionStatus.ACTIVE,
          },
        });
        if (consumed.count !== 1) {
          return this.commitRefreshFailure(transaction, {
            actor,
            attemptKeys,
            claimId: claim.recordId,
            compromise: true,
            context,
            failureCode: 'SESSION_COMPROMISED',
            familyId: token.familyId,
            operationId: token.sessionId,
            outcome: 'FAILURE',
            sessionId: token.sessionId,
            societyId,
          });
        }

        const newRawToken = `${token.familyId}.${randomOpaqueToken(48)}`;
        const refreshExpiresAt = new Date(
          Math.min(
            token.session.absoluteExpiresAt.getTime(),
            now.getTime() + this.refreshTtlSeconds * 1_000,
          ),
        );
        await transaction.refreshToken.create({
          data: {
            expiresAt: refreshExpiresAt,
            familyId: token.familyId,
            parentTokenId: token.id,
            sessionId: token.sessionId,
            societyId,
            status: SessionStatus.ACTIVE,
            tokenDigest: this.digests.refreshToken(newRawToken, token.familyId),
          },
        });
        await transaction.userSession.update({
          data: {
            idleExpiresAt: new Date(
              Math.min(
                token.session.absoluteExpiresAt.getTime(),
                now.getTime() + SESSION_IDLE_TTL_SECONDS * 1_000,
              ),
            ),
            lastSeenAt: now,
          },
          where: { id: token.sessionId },
        });
        const accessToken = await this.accessTokens.issue({
          deviceId: token.session.device.id,
          kind: token.session.kind,
          sessionId: token.sessionId,
          societyId,
          userId: token.session.userId,
        });
        const response: SessionTokenResponse = {
          accessToken: accessToken.token,
          accessTokenExpiresAt: accessToken.expiresAt.toISOString(),
          refreshToken: newRawToken,
          refreshTokenExpiresAt: refreshExpiresAt.toISOString(),
          sessionId: token.sessionId,
          tokenType: 'Bearer',
        };
        const stored: StoredOutcome<SessionTokenResponse> = {
          data: response,
          ok: true,
        };
        await this.attempts.record(transaction, {
          ...attemptKeys,
          method: 'REFRESH_TOKEN',
          outcome: 'SUCCESS',
          societyId,
        });
        await this.journal.commit(transaction, {
          action: 'auth.session.rotate',
          actor,
          aggregateId: token.sessionId,
          aggregateType: 'UserSession',
          correlationId: context.databaseCorrelationId,
          entityId: token.sessionId,
          entityType: 'UserSession',
          eventType: 'auth.session.rotated',
          idempotencyRecordId: claim.recordId,
          metadata: { ipAddress: context.ipAddress },
          newValues: { refreshTokenIdRotatedFrom: token.id },
          response: stored,
          responseStatus: HttpStatus.OK,
          societyId,
        });
        return stored;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    return unwrapOutcome(outcome);
  }

  logout(
    principal: AuthenticatedPrincipal,
    context: MutationRequestContext,
  ): Promise<{ readonly revoked: true }> {
    return this.revokeSession(
      principal,
      principal.sessionId,
      'User logout',
      context,
    );
  }

  async revokeSession(
    principal: AuthenticatedPrincipal,
    sessionId: string,
    reason: string,
    context: MutationRequestContext,
  ): Promise<{ readonly revoked: true }> {
    const actor = principalActor(principal);
    return this.database.client.$transaction(
      async (transaction) => {
        const claim = await this.journal.begin<{ readonly revoked: true }>(
          transaction,
          {
            actor,
            idempotencyKey: context.idempotencyKey,
            operation: 'auth.session.revoke',
            request: { reason, sessionId },
            societyId: principal.societyId,
          },
        );
        if (claim.kind === 'replay') return claim.response;

        const session = await transaction.userSession.findFirst({
          where: {
            id: sessionId,
            societyId: principal.societyId,
            userId: principal.user.id,
          },
        });
        if (!session) throw resourceNotFound();

        const now = new Date();
        await transaction.userSession.updateMany({
          data: {
            revokedAt: now,
            revocationReason: reason,
            status: SessionStatus.REVOKED,
          },
          where: { id: session.id, status: SessionStatus.ACTIVE },
        });
        await transaction.refreshToken.updateMany({
          data: { revokedAt: now, status: SessionStatus.REVOKED },
          where: { sessionId: session.id, status: SessionStatus.ACTIVE },
        });
        const response = { revoked: true as const };
        await this.journal.commit(transaction, {
          action: 'auth.session.revoke',
          actor,
          aggregateId: session.id,
          aggregateType: 'UserSession',
          correlationId: context.databaseCorrelationId,
          entityId: session.id,
          entityType: 'UserSession',
          eventType: 'auth.session.revoked',
          idempotencyRecordId: claim.recordId,
          metadata: { ipAddress: context.ipAddress },
          newValues: { status: SessionStatus.REVOKED },
          previousValues: { status: session.status },
          reason,
          response,
          responseStatus: HttpStatus.OK,
          societyId: principal.societyId,
        });
        return response;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async list(
    principal: AuthenticatedPrincipal,
    query: SessionListQuery,
  ): Promise<SessionPage> {
    const cursor = decodeCursor(query.cursor);
    const cursorWhere: Prisma.UserSessionWhereInput | undefined = cursor
      ? {
          OR: [
            { createdAt: { lt: new Date(cursor.at) } },
            { createdAt: new Date(cursor.at), id: { lt: cursor.id } },
          ],
        }
      : undefined;
    const rows = await this.database.client.userSession.findMany({
      include: { device: true },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      where: {
        societyId: principal.societyId,
        userId: principal.user.id,
        ...(cursorWhere ?? {}),
      },
    });
    const page = pageResult(rows, query.limit);
    return {
      items: page.items.map((session) => {
        const platform = session.device?.platform ?? 'UNKNOWN';
        const deviceName = session.device?.label ?? `${platform} device`;
        return {
          absoluteExpiresAt: session.absoluteExpiresAt.toISOString(),
          createdAt: session.createdAt.toISOString(),
          current: session.id === principal.sessionId,
          device: session.device
            ? {
                id: session.device.id,
                label: session.device.label,
                platform,
              }
            : null,
          deviceName,
          expiresAt: session.absoluteExpiresAt.toISOString(),
          id: session.id,
          lastSeenAt: session.lastSeenAt.toISOString(),
          platform,
          status: session.status,
        };
      }),
      nextCursor: page.nextCursor,
    };
  }

  private async activeSocietyId(): Promise<string> {
    const society = await this.database.client.society.findFirst({
      select: { id: true },
      where: { singletonKey: 'MANGLAM_BALAJI', status: RecordStatus.ACTIVE },
    });
    if (!society) {
      throw new ApiError({
        code: 'SERVICE_UNAVAILABLE',
        details: {},
        message: 'Authentication is not available.',
        status: HttpStatus.SERVICE_UNAVAILABLE,
      });
    }
    return society.id;
  }

  private async commitRefreshFailure(
    transaction: TransactionClient,
    input: {
      readonly actor: MutationActor;
      readonly attemptKeys: {
        readonly originDigest: string | null;
        readonly subjectDigest: string;
      };
      readonly claimId: string;
      readonly compromise?: boolean;
      readonly context: MutationRequestContext;
      readonly failureCode: string;
      readonly familyId?: string;
      readonly operationId: string;
      readonly outcome: 'BLOCKED' | 'FAILURE';
      readonly sessionId?: string;
      readonly societyId: string;
    },
  ): Promise<StoredOutcome<SessionTokenResponse>> {
    const now = new Date();
    if (input.sessionId && input.familyId) {
      const status = input.compromise
        ? SessionStatus.COMPROMISED
        : SessionStatus.EXPIRED;
      await transaction.userSession.updateMany({
        data: {
          revokedAt: now,
          revocationReason: input.compromise
            ? 'Refresh token reuse or device mismatch detected'
            : 'Session expired',
          status,
        },
        where: { id: input.sessionId, societyId: input.societyId },
      });
      await transaction.refreshToken.updateMany({
        data: { revokedAt: now, status },
        where: { familyId: input.familyId, societyId: input.societyId },
      });
    }

    await this.attempts.record(transaction, {
      ...input.attemptKeys,
      failureCode: input.failureCode,
      method: 'REFRESH_TOKEN',
      outcome: input.outcome,
      societyId: input.societyId,
    });
    const stored: StoredOutcome<SessionTokenResponse> = {
      error: {
        code:
          input.outcome === 'BLOCKED'
            ? 'AUTHENTICATION_RATE_LIMITED'
            : 'SESSION_EXPIRED',
        details: {},
        message:
          input.outcome === 'BLOCKED'
            ? 'Too many authentication attempts. Try again later.'
            : 'The session is no longer valid.',
        status:
          input.outcome === 'BLOCKED'
            ? HttpStatus.TOO_MANY_REQUESTS
            : HttpStatus.UNAUTHORIZED,
      },
      ok: false,
    };
    await this.journal.commit(transaction, {
      action: input.compromise
        ? 'auth.session.compromise'
        : 'auth.session.rotate_failed',
      actor: input.actor,
      aggregateId: input.operationId,
      aggregateType: 'UserSession',
      auditOutcome: 'FAILURE',
      correlationId: input.context.databaseCorrelationId,
      entityId: input.sessionId ?? null,
      entityType: 'UserSession',
      eventType: input.compromise
        ? 'auth.session.compromised'
        : 'auth.session.rotation_failed',
      idempotencyRecordId: input.claimId,
      metadata: {
        failureCode: input.failureCode,
        ipAddress: input.context.ipAddress,
      },
      newValues: input.sessionId
        ? {
            status: input.compromise
              ? SessionStatus.COMPROMISED
              : SessionStatus.EXPIRED,
          }
        : undefined,
      reason: input.failureCode,
      response: stored,
      responseStatus: stored.error.status,
      societyId: input.societyId,
    });
    return stored;
  }
}

export function principalActor(principal: AuthenticatedPrincipal): MutationActor {
  return {
    actorScopeKey: `session:${principal.sessionId}`,
    deviceId: principal.deviceId,
    guardDeviceId: principal.guardDeviceId,
    sessionId: principal.sessionId,
    userId: principal.user.id,
  };
}

function parseRefreshFamily(token: string): string | null {
  if (token.length < 64 || token.length > 512) return null;
  const separator = token.indexOf('.');
  if (separator !== 36 || token.indexOf('.', separator + 1) !== -1) return null;
  const familyId = token.slice(0, separator);
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    familyId,
  )
    ? familyId
    : null;
}

function unwrapOutcome<T>(outcome: StoredOutcome<T>): T {
  if (outcome.ok) return outcome.data;
  throw new ApiError(outcome.error);
}

function authenticationFailure(): ApiError {
  return new ApiError({
    code: 'AUTHENTICATION_REQUIRED',
    details: {},
    message: 'The supplied credentials or session are invalid.',
    status: HttpStatus.UNAUTHORIZED,
  });
}

function enrollmentRequired(): ApiError {
  return new ApiError({
    code: 'DEVICE_ENROLLMENT_REQUIRED',
    details: {},
    message: 'This guard device must be enrolled before it can sign in.',
    status: HttpStatus.FORBIDDEN,
  });
}

function resourceNotFound(): ApiError {
  return new ApiError({
    code: 'RESOURCE_NOT_FOUND',
    details: {},
    message: 'The requested resource was not found.',
    status: HttpStatus.NOT_FOUND,
  });
}
