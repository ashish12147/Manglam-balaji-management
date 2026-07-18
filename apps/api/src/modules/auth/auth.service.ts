import { randomUUID } from 'node:crypto';

import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AuditOutcome,
  OtpChallengeStatus,
  OtpPurpose as DatabaseOtpPurpose,
  OutboxStatus,
  Prisma,
  RecordStatus,
  UserStatus,
} from '@manglam/database';
import {
  OTP_POLICY,
  createOtpChallenge,
  evaluateOtpResend,
  verifyOtpChallenge,
} from '@manglam/domain';

import { ApiError } from '../../common/http/api-error.js';
import {
  OTP_DELIVERY_PROVIDER,
  type OtpDeliveryProvider,
  type OtpDeliveryRequest,
} from '../../common/providers/otp-delivery.provider.js';
import type { AppEnvironment } from '../../config/env.schema.js';
import { DatabaseService } from '../../infrastructure/database/database.service.js';
import { MutationJournalService } from '../platform/mutation-journal.service.js';
import { OTP_DELIVER_EVENT } from '../platform/outbox-contracts.js';
import type { MutationRequestContext } from '../platform/request-context.js';
import { SensitivePayloadCipher } from '../platform/sensitive-payload-cipher.js';
import { SecretDigestService } from '../security/secret-digest.service.js';
import { digestMatches } from '../security/secrets.js';
import type {
  AdminSignInInput,
  GuardSignInInput,
  OtpRequestInput,
  OtpVerifyInput,
} from './auth.schemas.js';
import { AdminAuthService } from './admin-auth.service.js';
import {
  CredentialAttemptService,
  type CredentialAttemptKeys,
} from './credential-attempt.service.js';
import { GuardAuthService } from './guard-auth.service.js';
import { SessionService, type SessionTokenResponse } from './session.service.js';

export interface OtpRequestResponse {
  readonly challengeId: string;
  readonly expiresAt: string;
  readonly resendAfterSeconds: number;
  readonly status: 'QUEUED';
}

interface StoredFailure {
  readonly code: string;
  readonly details: Record<string, unknown>;
  readonly message: string;
  readonly status: HttpStatus;
}

type StoredOutcome<T> =
  | { readonly data: T; readonly ok: true }
  | { readonly error: StoredFailure; readonly ok: false };

const OTP_PURPOSE_MAP = {
  LOGIN: DatabaseOtpPurpose.SIGN_IN,
  PHONE_CHANGE: DatabaseOtpPurpose.PHONE_CHANGE,
  STEP_UP: DatabaseOtpPurpose.STEP_UP,
} as const;

@Injectable()
export class AuthService {
  private readonly otpMaxAttempts: number;
  private readonly otpPepper: string;
  private readonly otpResendCooldownSeconds: number;
  private readonly otpTtlSeconds: number;

  constructor(
    private readonly database: DatabaseService,
    private readonly config: ConfigService<AppEnvironment, true>,
    private readonly digests: SecretDigestService,
    private readonly journal: MutationJournalService,
    private readonly payloadCipher: SensitivePayloadCipher,
    private readonly sessions: SessionService,
    private readonly adminAuth: AdminAuthService,
    private readonly attempts: CredentialAttemptService,
    private readonly guardAuth: GuardAuthService,
    @Inject(OTP_DELIVERY_PROVIDER)
    private readonly otpDelivery: OtpDeliveryProvider,
  ) {
    this.otpMaxAttempts = config.get('OTP_MAX_ATTEMPTS', { infer: true });
    this.otpPepper = config.get('OTP_HMAC_SECRET', { infer: true });
    this.otpResendCooldownSeconds = config.get('OTP_RESEND_COOLDOWN_SECONDS', {
      infer: true,
    });
    this.otpTtlSeconds = config.get('OTP_TTL_SECONDS', { infer: true });
  }

  async requestOtp(
    input: OtpRequestInput,
    context: MutationRequestContext,
  ): Promise<OtpRequestResponse> {
    const society = await this.activeSociety();
    const phoneDigest = this.digests.phone(input.phone, society.id);
    const deviceNonceDigest = this.digests.deviceNonce(input.deviceNonce, society.id);
    const requestIpHash = context.ipAddress ? this.digests.requestIp(context.ipAddress) : null;
    const actor = {
      actorScopeKey: `otp:${phoneDigest}:${deviceNonceDigest}`.slice(0, 200),
    };
    const challengeId = randomUUID();
    const now = new Date();
    const issued = createOtpChallenge({
      deviceNonce: input.deviceNonce,
      id: challengeId,
      now: now.toISOString(),
      pepper: this.otpPepper,
      phoneE164: input.phone,
      purpose: input.purpose,
    });
    const expiresAt = new Date(now.getTime() + this.otpTtlSeconds * 1_000);

    const transactionResult = await this.database.client.$transaction(
      async (transaction) => {
        const claim = await this.journal.begin<OtpRequestResponse>(transaction, {
          actor,
          idempotencyKey: context.idempotencyKey,
          operation: 'auth.otp.request',
          request: input,
          societyId: society.id,
        });
        if (claim.kind === 'replay') {
          return { delivery: null, response: claim.response, recordId: null };
        }

        const latest = await transaction.otpChallenge.findFirst({
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          where: {
            phoneDigest,
            purpose: OTP_PURPOSE_MAP[input.purpose],
            societyId: society.id,
          },
        });
        const cooldown = latest
          ? evaluateOtpResend(latest.createdAt.toISOString(), now.toISOString())
          : { allowed: true as const };
        const configuredRemaining = latest
          ? this.otpResendCooldownSeconds * 1_000 - (now.getTime() - latest.createdAt.getTime())
          : 0;
        if (!cooldown.allowed || configuredRemaining > 0) {
          const retryAfterMs = Math.max(
            cooldown.allowed ? 0 : cooldown.retryAfterMs,
            configuredRemaining,
          );
          throw new ApiError({
            code: 'OTP_RESEND_TOO_SOON',
            details: { retryAfterSeconds: Math.ceil(retryAfterMs / 1_000) },
            message: 'Please wait before requesting another OTP.',
            status: HttpStatus.TOO_MANY_REQUESTS,
          });
        }

        await this.enforceOtpRateLimits(transaction, {
          deviceNonceDigest,
          now,
          phoneDigest,
          requestIpHash,
          societyId: society.id,
        });
        const user = await transaction.user.findFirst({
          select: { id: true },
          where: { normalizedPhone: input.phone, societyId: society.id },
        });
        await transaction.otpChallenge.updateMany({
          data: {
            status: OtpChallengeStatus.SUPERSEDED,
            supersededAt: now,
          },
          where: {
            phoneDigest,
            purpose: OTP_PURPOSE_MAP[input.purpose],
            societyId: society.id,
            status: OtpChallengeStatus.PENDING,
          },
        });
        await transaction.otpChallenge.create({
          data: {
            codeDigest: issued.challenge.digest,
            deviceNonceDigest,
            expiresAt,
            id: challengeId,
            maxAttempts: this.otpMaxAttempts,
            normalizedPhone: input.phone,
            phoneDigest,
            purpose: OTP_PURPOSE_MAP[input.purpose],
            requestIpHash,
            societyId: society.id,
            status: OtpChallengeStatus.PENDING,
            userId: user?.id ?? null,
          },
        });
        const response: OtpRequestResponse = {
          challengeId,
          expiresAt: expiresAt.toISOString(),
          resendAfterSeconds: this.otpResendCooldownSeconds,
          status: 'QUEUED',
        };
        await this.journal.commit(transaction, {
          action: 'auth.otp.request',
          actor: { ...actor, userId: user?.id ?? null },
          aggregateId: challengeId,
          aggregateType: 'OtpChallenge',
          correlationId: context.databaseCorrelationId,
          entityId: challengeId,
          entityType: 'OtpChallenge',
          eventType: OTP_DELIVER_EVENT,
          idempotencyRecordId: claim.recordId,
          metadata: { ipAddress: context.ipAddress, purpose: input.purpose },
          newValues: { expiresAt: expiresAt.toISOString(), status: 'PENDING' },
          outboxPayload: {
            delivery: this.payloadCipher.encrypt({
              challengeId,
              expiresAt: expiresAt.toISOString(),
              phoneE164: input.phone,
              plaintextCode: issued.deliveryCode,
              purpose: 'SIGN_IN',
            }),
          },
          response,
          responseStatus: HttpStatus.ACCEPTED,
          societyId: society.id,
        });
        return {
          delivery: {
            challengeId,
            expiresAt,
            phoneE164: input.phone,
            plaintextCode: issued.deliveryCode,
            purpose: 'SIGN_IN',
          },
          recordId: claim.recordId,
          response,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    if (transactionResult.delivery && transactionResult.recordId) {
      await this.attemptOtpDelivery(
        transactionResult.delivery,
        transactionResult.recordId,
        society.id,
      );
    }
    return transactionResult.response;
  }

  async verifyOtp(
    input: OtpVerifyInput,
    context: MutationRequestContext,
  ): Promise<SessionTokenResponse> {
    if (input.purpose !== 'LOGIN') {
      throw new ApiError({
        code: 'PERMISSION_DENIED',
        details: {},
        message: 'Step-up and phone-change OTPs require an active authenticated session.',
        status: HttpStatus.FORBIDDEN,
      });
    }
    const society = await this.activeSociety();
    const phoneDigest = this.digests.phone(input.phone, society.id);
    const actor = {
      actorScopeKey: `otp-verify:${phoneDigest}:${input.challengeId}`.slice(0, 200),
    };

    const attemptKeys = this.attempts.keys({
      deviceFingerprint: input.device.fingerprint,
      identifier: input.phone,
      ipAddress: context.ipAddress,
      method: 'OTP',
      societyId: society.id,
    });
    const outcome = await this.database.client.$transaction(
      async (transaction) => {
        const claim = await this.journal.begin<StoredOutcome<SessionTokenResponse>>(transaction, {
          actor,
          idempotencyKey: context.idempotencyKey,
          operation: 'auth.otp.verify',
          request: {
            challengeId: input.challengeId,
            codeDigest: this.journal.hashRequest(input.code),
            device: input.device,
            deviceNonceDigest: this.digests.deviceNonce(input.deviceNonce, society.id),
            phone: input.phone,
            purpose: input.purpose,
          },
          societyId: society.id,
        });
        if (claim.kind === 'replay') {
          return claim.response;
        }

        const attemptsAllowed = await this.attempts.allowed(transaction, {
          ...attemptKeys,
          method: 'OTP',
          societyId: society.id,
        });
        if (!attemptsAllowed) {
          return this.commitOtpAttemptFailure(transaction, {
            actor,
            attemptKeys,
            attemptOutcome: 'BLOCKED',
            claimId: claim.recordId,
            challengeId: input.challengeId,
            code: 'AUTHENTICATION_RATE_LIMITED',
            context,
            societyId: society.id,
            status: HttpStatus.TOO_MANY_REQUESTS,
          });
        }
        const challenge = await transaction.otpChallenge.findFirst({
          where: {
            id: input.challengeId,
            normalizedPhone: input.phone,
            phoneDigest,
            purpose: DatabaseOtpPurpose.SIGN_IN,
            societyId: society.id,
          },
        });
        const latest = await transaction.otpChallenge.findFirst({
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          select: { id: true },
          where: {
            phoneDigest,
            purpose: DatabaseOtpPurpose.SIGN_IN,
            societyId: society.id,
          },
        });
        if (!challenge || latest?.id !== challenge.id) {
          return this.commitOtpAttemptFailure(transaction, {
            actor,
            attemptKeys,
            attemptOutcome: 'FAILURE',
            claimId: claim.recordId,
            challengeId: input.challengeId,
            code: 'OTP_SUPERSEDED',
            context,
            societyId: society.id,
          });
        }

        const nonceDigest = this.digests.deviceNonce(input.deviceNonce, society.id);
        if (!digestMatches(nonceDigest, challenge.deviceNonceDigest)) {
          return this.commitOtpAttemptFailure(transaction, {
            actor,
            attemptKeys,
            attemptOutcome: 'FAILURE',
            claimId: claim.recordId,
            challengeId: input.challengeId,
            code: 'OTP_INVALID',
            context,
            societyId: society.id,
          });
        }

        const decision = verifyOtpChallenge({
          candidate: input.code,
          challenge: {
            attempts: challenge.attemptCount,
            consumedAt:
              challenge.status === OtpChallengeStatus.VERIFIED
                ? (challenge.verifiedAt?.toISOString() ?? challenge.updatedAt.toISOString())
                : null,
            createdAt: challenge.createdAt.toISOString(),
            deviceNonce: input.deviceNonce,
            digest: challenge.codeDigest,
            expiresAt: challenge.expiresAt.toISOString(),
            id: challenge.id,
            maxAttempts: challenge.maxAttempts,
            phoneE164: challenge.normalizedPhone,
            purpose: input.purpose,
            supersededAt: challenge.supersededAt?.toISOString() ?? null,
          },
          now: new Date().toISOString(),
          pepper: this.otpPepper,
        });

        if (!decision.accepted) {
          const status =
            decision.reason === 'ATTEMPTS_EXCEEDED'
              ? OtpChallengeStatus.LOCKED
              : decision.reason === 'EXPIRED'
                ? OtpChallengeStatus.EXPIRED
                : decision.reason === 'SUPERSEDED'
                  ? OtpChallengeStatus.SUPERSEDED
                  : challenge.status;
          await transaction.otpChallenge.update({
            data: {
              attemptCount: decision.challenge.attempts,
              status,
            },
            where: { id: challenge.id },
          });
          const stored: StoredOutcome<SessionTokenResponse> = {
            error: {
              code: decision.error.code,
              details: { ...decision.error.details },
              message: decision.error.message,
              status:
                decision.reason === 'ATTEMPTS_EXCEEDED'
                  ? HttpStatus.TOO_MANY_REQUESTS
                  : HttpStatus.UNAUTHORIZED,
            },
            ok: false,
          };
          await this.attempts.record(transaction, {
            ...attemptKeys,
            failureCode: decision.error.code,
            method: 'OTP',
            outcome: 'FAILURE',
            societyId: society.id,
          });
          await this.journal.commit(transaction, {
            action: 'auth.otp.verify_failed',
            actor: { ...actor, userId: challenge.userId },
            aggregateId: challenge.id,
            aggregateType: 'OtpChallenge',
            correlationId: context.databaseCorrelationId,
            entityId: challenge.id,
            entityType: 'OtpChallenge',
            eventType: 'auth.otp.verification_failed',
            idempotencyRecordId: claim.recordId,
            metadata: { ipAddress: context.ipAddress, reason: decision.reason },
            newValues: { attemptCount: decision.challenge.attempts, status },
            previousValues: {
              attemptCount: challenge.attemptCount,
              status: challenge.status,
            },
            response: stored,
            responseStatus: stored.error.status,
            societyId: society.id,
          });
          return stored;
        }

        const user = challenge.userId
          ? await transaction.user.findFirst({
              include: {
                guardProfile: true,
                roleAssignments: {
                  include: { role: true },
                  where: {
                    revokedAt: null,
                    role: { status: RecordStatus.ACTIVE },
                  },
                },
              },
              where: {
                id: challenge.userId,
                societyId: society.id,
                status: UserStatus.ACTIVE,
              },
            })
          : null;
        const isAdministrator =
          user?.roleAssignments.some((assignment) =>
            ['SOCIETY_ADMIN', 'SUPER_ADMIN'].includes(assignment.role.code),
          ) ?? false;
        if (!user || isAdministrator || user.guardProfile) {
          await transaction.otpChallenge.update({
            data: {
              attemptCount: decision.challenge.attempts,
              status: OtpChallengeStatus.VERIFIED,
              verifiedAt: new Date(),
            },
            where: { id: challenge.id },
          });
          const stored: StoredOutcome<SessionTokenResponse> = {
            error: {
              code: 'AUTHENTICATION_REQUIRED',
              details: {},
              message: 'The supplied credentials are invalid for this sign-in method.',
              status: HttpStatus.UNAUTHORIZED,
            },
            ok: false,
          };
          await this.attempts.record(transaction, {
            ...attemptKeys,
            failureCode: 'AUTHENTICATION_REQUIRED',
            method: 'OTP',
            outcome: 'FAILURE',
            societyId: society.id,
          });
          await this.journal.commit(transaction, {
            action: 'auth.otp.verify_denied',
            actor: { ...actor, userId: user?.id ?? null },
            aggregateId: challenge.id,
            aggregateType: 'OtpChallenge',
            correlationId: context.databaseCorrelationId,
            entityId: challenge.id,
            entityType: 'OtpChallenge',
            eventType: 'auth.otp.sign_in_denied',
            idempotencyRecordId: claim.recordId,
            metadata: { ipAddress: context.ipAddress },
            response: stored,
            responseStatus: HttpStatus.UNAUTHORIZED,
            societyId: society.id,
          });
          return stored;
        }

        await transaction.otpChallenge.update({
          data: {
            attemptCount: decision.challenge.attempts,
            status: OtpChallengeStatus.VERIFIED,
            verifiedAt: new Date(),
          },
          where: { id: challenge.id },
        });
        const tokens = await this.sessions.createWithinTransaction(transaction, {
          context,
          device: input.device,
          kind: 'RESIDENT',
          societyId: society.id,
          userId: user.id,
        });
        const stored: StoredOutcome<SessionTokenResponse> = {
          data: tokens,
          ok: true,
        };
        await this.attempts.record(transaction, {
          ...attemptKeys,
          method: 'OTP',
          outcome: 'SUCCESS',
          societyId: society.id,
        });
        await this.journal.commit(transaction, {
          action: 'auth.otp.verify',
          actor: {
            actorScopeKey: `session:${tokens.sessionId}`,
            sessionId: tokens.sessionId,
            userId: user.id,
          },
          aggregateId: tokens.sessionId,
          aggregateType: 'UserSession',
          correlationId: context.databaseCorrelationId,
          entityId: user.id,
          entityType: 'User',
          eventType: 'auth.session.created',
          idempotencyRecordId: claim.recordId,
          metadata: { ipAddress: context.ipAddress, method: 'OTP' },
          newValues: { sessionId: tokens.sessionId },
          response: stored,
          responseStatus: HttpStatus.CREATED,
          societyId: society.id,
        });
        return stored;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    return unwrapOutcome(outcome);
  }

  async signInGuard(
    input: GuardSignInInput,
    context: MutationRequestContext,
  ): Promise<SessionTokenResponse> {
    return this.guardAuth.signIn(input, context);
  }

  async signInAdmin(
    input: AdminSignInInput,
    context: MutationRequestContext,
  ): Promise<SessionTokenResponse> {
    return this.adminAuth.signIn(input, context);
  }

  private async commitOtpAttemptFailure(
    transaction: Prisma.TransactionClient,
    input: {
      readonly actor: { readonly actorScopeKey: string };
      readonly attemptKeys: CredentialAttemptKeys;
      readonly attemptOutcome: 'BLOCKED' | 'FAILURE';
      readonly challengeId: string;
      readonly claimId: string;
      readonly code: string;
      readonly context: MutationRequestContext;
      readonly societyId: string;
      readonly status?: HttpStatus;
    },
  ): Promise<StoredOutcome<SessionTokenResponse>> {
    await this.attempts.record(transaction, {
      ...input.attemptKeys,
      failureCode: input.code,
      method: 'OTP',
      outcome: input.attemptOutcome,
      societyId: input.societyId,
    });
    const status = input.status ?? HttpStatus.UNAUTHORIZED;
    const message =
      input.code === 'AUTHENTICATION_RATE_LIMITED'
        ? 'Too many authentication attempts. Try again later.'
        : input.code === 'OTP_SUPERSEDED'
          ? 'A newer OTP challenge has replaced this one.'
          : 'The OTP is invalid.';
    const stored: StoredOutcome<SessionTokenResponse> = {
      error: { code: input.code, details: {}, message, status },
      ok: false,
    };
    await this.journal.commit(transaction, {
      action: 'auth.otp.verify_failed',
      actor: input.actor,
      aggregateId: input.challengeId,
      aggregateType: 'OtpChallenge',
      auditOutcome: AuditOutcome.FAILURE,
      correlationId: input.context.databaseCorrelationId,
      entityId: input.challengeId,
      entityType: 'OtpChallenge',
      eventType: 'auth.otp.verification_failed',
      idempotencyRecordId: input.claimId,
      metadata: { failureCode: input.code, ipAddress: input.context.ipAddress },
      reason: input.code,
      response: stored,
      responseStatus: status,
      societyId: input.societyId,
    });
    return stored;
  }

  private async enforceOtpRateLimits(
    transaction: Prisma.TransactionClient,
    input: {
      readonly deviceNonceDigest: string;
      readonly now: Date;
      readonly phoneDigest: string;
      readonly requestIpHash: string | null;
      readonly societyId: string;
    },
  ): Promise<void> {
    const fifteenMinutesAgo = new Date(input.now.getTime() - 15 * 60_000);
    const hourAgo = new Date(input.now.getTime() - 60 * 60_000);
    const dayAgo = new Date(input.now.getTime() - 24 * 60 * 60_000);
    const [phone15m, phoneHour, phoneDay, origin15m] = await Promise.all([
      transaction.otpChallenge.count({
        where: {
          createdAt: { gte: fifteenMinutesAgo },
          phoneDigest: input.phoneDigest,
          societyId: input.societyId,
        },
      }),
      transaction.otpChallenge.count({
        where: {
          createdAt: { gte: hourAgo },
          phoneDigest: input.phoneDigest,
          societyId: input.societyId,
        },
      }),
      transaction.otpChallenge.count({
        where: {
          createdAt: { gte: dayAgo },
          phoneDigest: input.phoneDigest,
          societyId: input.societyId,
        },
      }),
      transaction.otpChallenge.count({
        where: {
          createdAt: { gte: fifteenMinutesAgo },
          societyId: input.societyId,
          OR: [
            { deviceNonceDigest: input.deviceNonceDigest },
            ...(input.requestIpHash ? [{ requestIpHash: input.requestIpHash }] : []),
          ],
        },
      }),
    ]);
    if (
      phone15m >= OTP_POLICY.phoneRequestsPer15Minutes ||
      phoneHour >= OTP_POLICY.phoneRequestsPerHour ||
      phoneDay >= OTP_POLICY.phoneRequestsPerDay ||
      origin15m >= OTP_POLICY.ipOrDeviceRequestsPer15Minutes
    ) {
      throw new ApiError({
        code: 'RATE_LIMITED',
        details: {},
        message: 'Too many OTP requests. Please try again later.',
        status: HttpStatus.TOO_MANY_REQUESTS,
      });
    }
  }

  private async attemptOtpDelivery(
    delivery: OtpDeliveryRequest,
    idempotencyRecordId: string,
    societyId: string,
  ): Promise<void> {
    const dedupeKey = [OTP_DELIVER_EVENT, idempotencyRecordId].join(':');
    let claim: {
      readonly attempt: number;
      readonly eventId: string;
    } | null = null;

    try {
      claim = await this.database.client.$transaction(async (transaction) => {
        const event = await transaction.outboxEvent.findFirst({
          select: { attemptCount: true, id: true },
          where: {
            availableAt: { lte: new Date() },
            dedupeKey,
            societyId,
            status: { in: [OutboxStatus.PENDING, OutboxStatus.RETRY] },
          },
        });
        if (!event) return null;

        const updated = await transaction.outboxEvent.updateMany({
          data: { claimedAt: new Date(), status: OutboxStatus.PROCESSING },
          where: {
            id: event.id,
            status: { in: [OutboxStatus.PENDING, OutboxStatus.RETRY] },
          },
        });
        return updated.count === 1
          ? {
              attempt: event.attemptCount + 1,
              eventId: event.id,
            }
          : null;
      });
    } catch {
      // The durable PENDING event remains available for the outbox worker.
      return;
    }

    if (!claim) return;

    try {
      await this.otpDelivery.send(delivery);
      await this.database.client.$transaction(async (transaction) => {
        const updated = await transaction.outboxEvent.updateMany({
          data: {
            attemptCount: claim.attempt,
            lastErrorCode: null,
            publishedAt: new Date(),
            status: OutboxStatus.PUBLISHED,
          },
          where: { id: claim.eventId, status: OutboxStatus.PROCESSING },
        });
        if (updated.count === 1) {
          await transaction.outboxAttempt.create({
            data: {
              attempt: claim.attempt,
              outboxEventId: claim.eventId,
              societyId,
              status: OutboxStatus.PUBLISHED,
            },
          });
        }
      });
    } catch (error) {
      const rawCode = error instanceof Error ? error.name : 'OTP_PROVIDER_ERROR';
      const errorCode =
        rawCode
          .replace(/[^A-Za-z0-9_]/g, '_')
          .toUpperCase()
          .slice(0, 80) || 'OTP_PROVIDER_ERROR';
      const retryDelayMs = Math.min(15 * 60_000, 30_000 * 2 ** Math.max(0, claim.attempt - 1));

      try {
        await this.database.client.$transaction(async (transaction) => {
          const updated = await transaction.outboxEvent.updateMany({
            data: {
              attemptCount: claim.attempt,
              availableAt: new Date(Date.now() + retryDelayMs),
              claimedAt: null,
              lastErrorCode: errorCode,
              status: OutboxStatus.RETRY,
            },
            where: { id: claim.eventId, status: OutboxStatus.PROCESSING },
          });
          if (updated.count === 1) {
            await transaction.outboxAttempt.create({
              data: {
                attempt: claim.attempt,
                errorCode,
                errorDetail: 'OTP provider delivery failed; retry scheduled.',
                outboxEventId: claim.eventId,
                societyId,
                status: OutboxStatus.RETRY,
              },
            });
          }
        });
      } catch {
        // A stale PROCESSING claim is recovered by the outbox worker lease.
      }
    }
  }

  private async activeSociety(): Promise<{ readonly id: string }> {
    const society = await this.database.client.society.findFirst({
      orderBy: { createdAt: 'asc' },
      select: { id: true },
      where: {
        singletonKey: 'MANGLAM_BALAJI',
        status: RecordStatus.ACTIVE,
      },
    });
    if (!society) {
      throw new ApiError({
        code: 'SERVICE_NOT_CONFIGURED',
        details: {},
        message: 'No active society is configured.',
        status: HttpStatus.SERVICE_UNAVAILABLE,
      });
    }
    return society;
  }
}

function unwrapOutcome<T>(outcome: StoredOutcome<T>): T {
  if (outcome.ok) {
    return outcome.data;
  }
  throw new ApiError(outcome.error);
}


