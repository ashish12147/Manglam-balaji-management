import { randomUUID } from 'node:crypto';

import { HttpStatus, Inject, Injectable, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  GuardStatus,
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
import { PasswordHasher } from '../security/password-hasher.js';
import { SecretDigestService } from '../security/secret-digest.service.js';
import { digestMatches } from '../security/secrets.js';
import type {
  AdminSignInInput,
  AuthDeviceInput,
  GuardSignInInput,
  OtpRequestInput,
  OtpVerifyInput,
} from './auth.schemas.js';
import { MFA_VERIFIER, type MfaVerifier } from './mfa-verifier.js';
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
    private readonly passwordHasher: PasswordHasher,
    private readonly sessions: SessionService,
    @Inject(OTP_DELIVERY_PROVIDER)
    private readonly otpDelivery: OtpDeliveryProvider,
    @Optional()
    @Inject(MFA_VERIFIER)
    private readonly mfaVerifier: MfaVerifier | undefined,
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
          throw otpFailure('OTP_SUPERSEDED', 'A newer OTP challenge has replaced this one.');
        }

        const nonceDigest = this.digests.deviceNonce(input.deviceNonce, society.id);
        if (!digestMatches(nonceDigest, challenge.deviceNonceDigest)) {
          throw otpFailure('OTP_INVALID', 'The OTP is invalid.');
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
        if (!user || isAdministrator) {
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
          kind: user.guardProfile ? 'GUARD' : 'RESIDENT',
          societyId: society.id,
          userId: user.id,
        });
        const stored: StoredOutcome<SessionTokenResponse> = {
          data: tokens,
          ok: true,
        };
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
    const society = await this.activeSociety();
    const guard = await this.database.client.guardProfile.findFirst({
      include: { user: true },
      where: {
        employeeCode: input.employeeCode,
        societyId: society.id,
        status: GuardStatus.ACTIVE,
        user: { status: UserStatus.ACTIVE },
      },
    });
    if (!guard || !(await this.passwordHasher.verify(input.pin, guard.pinHash, 'GUARD_PIN'))) {
      throw authenticationFailure();
    }
    return this.createCredentialSession({
      context,
      device: input.device,
      kind: 'GUARD',
      method: 'GUARD_PIN',
      societyId: society.id,
      userId: guard.userId,
    });
  }

  async signInAdmin(
    input: AdminSignInInput,
    context: MutationRequestContext,
  ): Promise<SessionTokenResponse> {
    const society = await this.activeSociety();
    const now = new Date();
    const user = await this.database.client.user.findFirst({
      include: {
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
        email: { equals: input.email, mode: 'insensitive' },
        societyId: society.id,
        status: UserStatus.ACTIVE,
      },
    });
    if (
      !user?.passwordHash ||
      user.roleAssignments.length === 0 ||
      !(await this.passwordHasher.verify(input.password, user.passwordHash, 'ADMIN_PASSWORD'))
    ) {
      throw authenticationFailure();
    }
    if (user.mfaEnabled) {
      if (!input.mfaCode || !this.mfaVerifier) {
        throw new ApiError({
          code: 'MFA_PROVIDER_UNAVAILABLE',
          details: {},
          message: 'Multi-factor verification is required but unavailable.',
          status: HttpStatus.SERVICE_UNAVAILABLE,
        });
      }
      const verified = await this.mfaVerifier.verify({
        code: input.mfaCode,
        userId: user.id,
      });
      if (!verified) {
        throw authenticationFailure();
      }
    }
    return this.createCredentialSession({
      context,
      device: input.device,
      kind: 'PRIVILEGED',
      method: 'ADMIN_PASSWORD_MFA',
      societyId: society.id,
      userId: user.id,
    });
  }

  private async createCredentialSession(input: {
    readonly context: MutationRequestContext;
    readonly device: AuthDeviceInput;
    readonly kind: 'GUARD' | 'PRIVILEGED';
    readonly method: string;
    readonly societyId: string;
    readonly userId: string;
  }): Promise<SessionTokenResponse> {
    const deviceDigest = this.digests.deviceFingerprint(input.device.fingerprint, input.societyId);
    const actor = {
      actorScopeKey: `credential:${input.userId}:${deviceDigest}`.slice(0, 200),
      userId: input.userId,
    };
    const outcome = await this.database.client.$transaction(
      async (transaction) => {
        const claim = await this.journal.begin<StoredOutcome<SessionTokenResponse>>(transaction, {
          actor,
          idempotencyKey: input.context.idempotencyKey,
          operation: 'auth.credential.sign_in',
          request: { deviceDigest, method: input.method, userId: input.userId },
          societyId: input.societyId,
        });
        if (claim.kind === 'replay') {
          return claim.response;
        }
        const tokens = await this.sessions.createWithinTransaction(transaction, {
          context: input.context,
          device: input.device,
          kind: input.kind,
          societyId: input.societyId,
          userId: input.userId,
        });
        const stored: StoredOutcome<SessionTokenResponse> = {
          data: tokens,
          ok: true,
        };
        await this.journal.commit(transaction, {
          action: 'auth.credential.sign_in',
          actor: {
            ...actor,
            actorScopeKey: `session:${tokens.sessionId}`,
            sessionId: tokens.sessionId,
          },
          aggregateId: tokens.sessionId,
          aggregateType: 'UserSession',
          correlationId: input.context.databaseCorrelationId,
          entityId: input.userId,
          entityType: 'User',
          eventType: 'auth.session.created',
          idempotencyRecordId: claim.recordId,
          metadata: { ipAddress: input.context.ipAddress, method: input.method },
          newValues: { sessionId: tokens.sessionId },
          response: stored,
          responseStatus: HttpStatus.CREATED,
          societyId: input.societyId,
        });
        return stored;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    return unwrapOutcome(outcome);
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
      readonly payload: Prisma.JsonValue;
    } | null = null;

    try {
      claim = await this.database.client.$transaction(async (transaction) => {
        const event = await transaction.outboxEvent.findFirst({
          select: { attemptCount: true, id: true, payload: true },
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
              payload: event.payload,
            }
          : null;
      });
    } catch {
      // The durable PENDING event remains available for the outbox worker.
      return;
    }

    if (!claim) return;

    try {
      const receipt = await this.otpDelivery.send(delivery);
      await this.database.client.$transaction(async (transaction) => {
        const updated = await transaction.outboxEvent.updateMany({
          data: {
            attemptCount: claim.attempt,
            lastErrorCode: null,
            payload: {
              ...(claim.payload as Record<string, Prisma.JsonValue>),
              deliveryReceipt: {
                providerMessageId: receipt.providerMessageId,
                queuedAt: receipt.queuedAt.toISOString(),
              },
            },
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
      where: { status: RecordStatus.ACTIVE },
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

function otpFailure(code: string, message: string): ApiError {
  return new ApiError({
    code,
    details: {},
    message,
    status: HttpStatus.UNAUTHORIZED,
  });
}

function authenticationFailure(): ApiError {
  return new ApiError({
    code: 'AUTHENTICATION_REQUIRED',
    details: {},
    message: 'The supplied credentials are invalid.',
    status: HttpStatus.UNAUTHORIZED,
  });
}
