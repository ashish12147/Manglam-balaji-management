import { randomUUID } from 'node:crypto';

import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DeviceStatus, IdempotencyStatus, Prisma, SessionStatus } from '@manglam/database';

import { ApiError } from '../../common/http/api-error.js';
import type { AppEnvironment } from '../../config/env.schema.js';
import { DatabaseService } from '../../infrastructure/database/database.service.js';
import type { AuthenticatedPrincipal } from '../access/access.types.js';
import {
  MutationJournalService,
  type MutationActor,
  type TransactionClient,
} from '../platform/mutation-journal.service.js';
import type { MutationRequestContext } from '../platform/request-context.js';
import { AccessTokenService } from '../security/access-token.service.js';
import { SecretDigestService } from '../security/secret-digest.service.js';
import { digestMatches, randomOpaqueToken } from '../security/secrets.js';
import type { AuthDeviceInput, RefreshInput } from './auth.schemas.js';

export interface SessionTokenResponse {
  readonly accessToken: string;
  readonly accessTokenExpiresAt: string;
  readonly refreshToken: string;
  readonly refreshTokenExpiresAt: string;
  readonly sessionId: string;
  readonly tokenType: 'Bearer';
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

interface CreateSessionInput {
  readonly context: MutationRequestContext;
  readonly device: AuthDeviceInput;
  readonly kind: 'RESIDENT' | 'GUARD' | 'PRIVILEGED';
  readonly societyId: string;
  readonly userId: string;
}

@Injectable()
export class SessionService {
  private readonly refreshTtlSeconds: number;

  constructor(
    private readonly database: DatabaseService,
    private readonly config: ConfigService<AppEnvironment, true>,
    private readonly digests: SecretDigestService,
    private readonly journal: MutationJournalService,
    private readonly accessTokens: AccessTokenService,
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
      where: { fingerprintDigest, societyId: input.societyId },
    });
    if (
      existingDevice &&
      ((existingDevice.userId !== null && existingDevice.userId !== input.userId) ||
        [DeviceStatus.REVOKED, DeviceStatus.LOST].includes(existingDevice.status))
    ) {
      throw authenticationFailure();
    }

    const device = existingDevice
      ? await transaction.device.update({
          data: {
            appVersion: input.device.appVersion ?? null,
            label: input.device.label ?? existingDevice.label,
            lastSeenAt: now,
            operatingSystem: input.device.operatingSystem ?? null,
            platform: input.device.platform,
            status: DeviceStatus.ACTIVE,
            userId: input.userId,
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
    const refreshExpiresAt = new Date(now.getTime() + this.refreshTtlSeconds * 1_000);
    const idleExpiresAt = new Date(
      now.getTime() + Math.min(this.refreshTtlSeconds, 7 * 24 * 60 * 60) * 1_000,
    );
    await transaction.userSession.create({
      data: {
        absoluteExpiresAt: refreshExpiresAt,
        deviceId: device.id,
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
        id: sessionId,
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
    input: RefreshInput,
    context: MutationRequestContext,
  ): Promise<SessionTokenResponse> {
    const familyId = input.refreshToken.split('.', 1)[0];
    if (!familyId || !/^[0-9a-f-]{36}$/i.test(familyId)) {
      throw authenticationFailure();
    }
    const digest = this.digests.refreshToken(input.refreshToken, familyId);
    const located = await this.database.client.refreshToken.findUnique({
      include: { session: { include: { device: true, user: true } } },
      where: { tokenDigest: digest },
    });
    if (!located?.session.device) {
      throw authenticationFailure();
    }

    const actor: MutationActor = {
      actorScopeKey: `session:${located.sessionId}`,
      deviceId: located.session.device.id,
      sessionId: located.sessionId,
      userId: located.session.userId,
    };
    const outcome = await this.database.client.$transaction(
      async (transaction) => {
        const claim = await this.journal.begin<StoredOutcome<SessionTokenResponse>>(transaction, {
          actor,
          idempotencyKey: context.idempotencyKey,
          operation: 'auth.session.rotate',
          request: {
            deviceFingerprintDigest: this.digests.deviceFingerprint(
              input.deviceFingerprint,
              located.societyId,
            ),
            refreshTokenDigest: digest,
          },
          societyId: located.societyId,
        });
        if (claim.kind === 'replay') {
          return claim.response;
        }

        const token = await transaction.refreshToken.findUnique({
          include: { session: { include: { device: true, user: true } } },
          where: { tokenDigest: digest },
        });
        if (!token?.session.device) {
          return this.commitFailure(transaction, {
            actor,
            claimId: claim.recordId,
            context,
            familyId,
            societyId: located.societyId,
            sessionId: located.sessionId,
          });
        }

        const fingerprint = this.digests.deviceFingerprint(
          input.deviceFingerprint,
          token.societyId,
        );
        const validDevice = digestMatches(fingerprint, token.session.device.fingerprintDigest);
        const active =
          token.status === SessionStatus.ACTIVE &&
          token.consumedAt === null &&
          token.expiresAt > new Date() &&
          token.session.status === SessionStatus.ACTIVE &&
          token.session.absoluteExpiresAt > new Date() &&
          token.session.idleExpiresAt > new Date() &&
          token.session.device.status === DeviceStatus.ACTIVE;
        if (!active || !validDevice) {
          return this.commitFailure(transaction, {
            actor,
            claimId: claim.recordId,
            context,
            familyId: token.familyId,
            societyId: token.societyId,
            sessionId: token.sessionId,
          });
        }

        const consumed = await transaction.refreshToken.updateMany({
          data: { consumedAt: new Date(), status: SessionStatus.REVOKED },
          where: {
            consumedAt: null,
            id: token.id,
            status: SessionStatus.ACTIVE,
          },
        });
        if (consumed.count !== 1) {
          return this.commitFailure(transaction, {
            actor,
            claimId: claim.recordId,
            context,
            familyId: token.familyId,
            societyId: token.societyId,
            sessionId: token.sessionId,
          });
        }

        const newRawToken = `${token.familyId}.${randomOpaqueToken(48)}`;
        const refreshExpiresAt = new Date(
          Math.min(
            token.session.absoluteExpiresAt.getTime(),
            Date.now() + this.refreshTtlSeconds * 1_000,
          ),
        );
        await transaction.refreshToken.create({
          data: {
            expiresAt: refreshExpiresAt,
            familyId: token.familyId,
            parentTokenId: token.id,
            sessionId: token.sessionId,
            societyId: token.societyId,
            status: SessionStatus.ACTIVE,
            tokenDigest: this.digests.refreshToken(newRawToken, token.familyId),
          },
        });
        await transaction.userSession.update({
          data: {
            idleExpiresAt: new Date(
              Math.min(
                token.session.absoluteExpiresAt.getTime(),
                Date.now() + 7 * 24 * 60 * 60_000,
              ),
            ),
            lastSeenAt: new Date(),
          },
          where: { id: token.sessionId },
        });
        const accessToken = await this.accessTokens.issue({
          deviceId: token.session.device.id,
          kind: token.session.kind,
          sessionId: token.sessionId,
          societyId: token.societyId,
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
        const stored: StoredOutcome<SessionTokenResponse> = { data: response, ok: true };
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
          societyId: token.societyId,
        });
        return stored;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    return unwrapOutcome(outcome);
  }

  async logout(
    principal: AuthenticatedPrincipal,
    context: MutationRequestContext,
  ): Promise<{ readonly revoked: true }> {
    return this.revokeSession(principal, principal.sessionId, 'User logout', context);
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
        const claim = await this.journal.begin<{ readonly revoked: true }>(transaction, {
          actor,
          idempotencyKey: context.idempotencyKey,
          operation: 'auth.session.revoke',
          request: { reason, sessionId },
          societyId: principal.societyId,
        });
        if (claim.kind === 'replay') {
          return claim.response;
        }

        const session = await transaction.userSession.findFirst({
          where: {
            id: sessionId,
            societyId: principal.societyId,
            userId: principal.user.id,
          },
        });
        if (!session) {
          throw resourceNotFound();
        }
        await transaction.userSession.updateMany({
          data: {
            revokedAt: new Date(),
            revocationReason: reason,
            status: SessionStatus.REVOKED,
          },
          where: { id: session.id, status: SessionStatus.ACTIVE },
        });
        await transaction.refreshToken.updateMany({
          data: { revokedAt: new Date(), status: SessionStatus.REVOKED },
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

  async list(principal: AuthenticatedPrincipal): Promise<readonly object[]> {
    const sessions = await this.database.client.userSession.findMany({
      include: { device: true },
      orderBy: { createdAt: 'desc' },
      where: { societyId: principal.societyId, userId: principal.user.id },
    });
    return sessions.map((session) => ({
      absoluteExpiresAt: session.absoluteExpiresAt.toISOString(),
      createdAt: session.createdAt.toISOString(),
      current: session.id === principal.sessionId,
      device: session.device
        ? {
            id: session.device.id,
            label: session.device.label,
            platform: session.device.platform,
          }
        : null,
      id: session.id,
      lastSeenAt: session.lastSeenAt.toISOString(),
      status: session.status,
    }));
  }

  private async commitFailure(
    transaction: TransactionClient,
    input: {
      readonly actor: MutationActor;
      readonly claimId: string;
      readonly context: MutationRequestContext;
      readonly familyId: string;
      readonly sessionId: string;
      readonly societyId: string;
    },
  ): Promise<StoredOutcome<SessionTokenResponse>> {
    await transaction.userSession.updateMany({
      data: {
        revokedAt: new Date(),
        revocationReason: 'Refresh token reuse or device mismatch detected',
        status: SessionStatus.COMPROMISED,
      },
      where: { id: input.sessionId },
    });
    await transaction.refreshToken.updateMany({
      data: { revokedAt: new Date(), status: SessionStatus.COMPROMISED },
      where: { familyId: input.familyId },
    });
    const stored: StoredOutcome<SessionTokenResponse> = {
      error: {
        code: 'SESSION_EXPIRED',
        details: {},
        message: 'The session is no longer valid.',
        status: HttpStatus.UNAUTHORIZED,
      },
      ok: false,
    };
    await this.journal.commit(transaction, {
      action: 'auth.session.compromise',
      actor: input.actor,
      aggregateId: input.sessionId,
      aggregateType: 'UserSession',
      correlationId: input.context.databaseCorrelationId,
      entityId: input.sessionId,
      entityType: 'UserSession',
      eventType: 'auth.session.compromised',
      idempotencyRecordId: input.claimId,
      metadata: { ipAddress: input.context.ipAddress },
      newValues: { status: SessionStatus.COMPROMISED },
      reason: 'Refresh token reuse or device mismatch detected',
      response: stored,
      responseStatus: HttpStatus.UNAUTHORIZED,
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

function unwrapOutcome<T>(outcome: StoredOutcome<T>): T {
  if (outcome.ok) {
    return outcome.data;
  }
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

function resourceNotFound(): ApiError {
  return new ApiError({
    code: 'RESOURCE_NOT_FOUND',
    details: {},
    message: 'The requested resource was not found.',
    status: HttpStatus.NOT_FOUND,
  });
}
