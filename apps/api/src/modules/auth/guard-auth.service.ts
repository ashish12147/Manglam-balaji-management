import { randomUUID } from 'node:crypto';

import { HttpStatus, Injectable, type OnModuleInit } from '@nestjs/common';
import {
  AuditOutcome,
  DeviceStatus,
  GuardStatus,
  Prisma,
  UserStatus,
} from '@manglam/database';

import { DatabaseService } from '../../infrastructure/database/database.service.js';
import type { MutationActor, TransactionClient } from '../platform/mutation-journal.service.js';
import { MutationJournalService } from '../platform/mutation-journal.service.js';
import type { MutationRequestContext } from '../platform/request-context.js';
import { PasswordHasher } from '../security/password-hasher.js';
import { SecretDigestService } from '../security/secret-digest.service.js';
import { digestMatches } from '../security/secrets.js';
import type { GuardEnrollInput, GuardSignInInput } from './auth.schemas.js';
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
import { SessionService, type SessionTokenResponse } from './session.service.js';

@Injectable()
export class GuardAuthService implements OnModuleInit {
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
      `invalid-guard-${randomUUID()}`,
      'GUARD_PIN',
    );
  }

  signIn(
    input: GuardSignInInput,
    context: MutationRequestContext,
  ): Promise<SessionTokenResponse> {
    return this.authenticate(input, context, null);
  }

  enroll(
    input: GuardEnrollInput,
    context: MutationRequestContext,
  ): Promise<SessionTokenResponse> {
    return this.authenticate(input, context, input.enrollmentToken);
  }

  private async authenticate(
    input: GuardSignInInput,
    context: MutationRequestContext,
    enrollmentToken: string | null,
  ): Promise<SessionTokenResponse> {
    const societyId = await this.society.activeId();
    const employeeCode = input.employeeCode.trim().toUpperCase();
    const operation = enrollmentToken
      ? 'auth.guard.enroll'
      : 'auth.guard.sign_in';
    const attemptKeys = this.attempts.keys({
      deviceFingerprint: input.device.fingerprint,
      identifier: employeeCode,
      ipAddress: context.ipAddress,
      method: 'GUARD_PIN',
      societyId,
    });
    const deviceDigest = this.digests.deviceFingerprint(
      input.device.fingerprint,
      societyId,
    );
    const actor: MutationActor = {
      actorScopeKey: `guard:${attemptKeys.subjectDigest}:${deviceDigest}`.slice(0, 200),
    };
    const requestContract = {
      device: { ...input.device, fingerprint: deviceDigest },
      employeeCodeDigest: attemptKeys.subjectDigest,
      enrollmentTokenProof: enrollmentToken
        ? this.digests.credentialProof(
            enrollmentToken,
            'GUARD_ENROLLMENT_TOKEN',
            societyId,
          )
        : null,
      pinProof: this.digests.credentialProof(
        input.pin,
        'GUARD_PIN',
        societyId,
      ),
    };
    const prior = await this.replay.find<StoredOutcome<SessionTokenResponse>>({
      actor,
      idempotencyKey: context.idempotencyKey,
      operation,
      request: requestContract,
      societyId,
    });
    if (prior.found) return unwrapOutcome(prior.value);

    const candidate = await this.database.client.guardProfile.findFirst({
      include: { user: true },
      where: {
        employeeCode,
        societyId,
        status: GuardStatus.ACTIVE,
        user: { status: UserStatus.ACTIVE },
      },
    });
    const pinValid = await this.passwords.verify(
      input.pin,
      candidate?.pinHash ?? (await this.getDummyHash()),
      'GUARD_PIN',
    );
    const operationId = candidate?.userId ?? randomUUID();

    const outcome = await this.database.client.$transaction(
      async (transaction) => {
        const claim = await this.journal.begin<StoredOutcome<SessionTokenResponse>>(
          transaction,
          {
            actor: { ...actor, userId: candidate?.userId ?? null },
            idempotencyKey: context.idempotencyKey,
            operation,
            request: requestContract,
            societyId,
          },
        );
        if (claim.kind === 'replay') return claim.response;

        const allowed = await this.attempts.allowed(transaction, {
          ...attemptKeys,
          method: 'GUARD_PIN',
          societyId,
        });
        if (!allowed) {
          return this.commitFailure(transaction, {
            actor,
            attemptKeys,
            attemptOutcome: 'BLOCKED',
            claimId: claim.recordId,
            code: 'AUTHENTICATION_RATE_LIMITED',
            context,
            operation,
            operationId,
            societyId,
            status: HttpStatus.TOO_MANY_REQUESTS,
          });
        }

        const current = candidate
          ? await transaction.guardProfile.findFirst({
              include: { user: true },
              where: {
                id: candidate.id,
                pinHash: candidate.pinHash,
                societyId,
                status: GuardStatus.ACTIVE,
                user: { status: UserStatus.ACTIVE },
              },
            })
          : null;
        if (!pinValid || !current) {
          return this.commitFailure(transaction, {
            actor,
            attemptKeys,
            attemptOutcome: 'FAILURE',
            claimId: claim.recordId,
            code: 'AUTHENTICATION_REQUIRED',
            context,
            operation,
            operationId,
            societyId,
          });
        }

        const device = await transaction.device.findFirst({
          include: { guardDevice: true },
          where: { fingerprintDigest: deviceDigest, societyId },
        });
        if (
          device &&
          ((device.userId !== null && device.userId !== current.userId) ||
            [DeviceStatus.LOST, DeviceStatus.REVOKED].includes(device.status))
        ) {
          return this.commitFailure(transaction, {
            actor: { ...actor, userId: current.userId },
            attemptKeys,
            attemptOutcome: 'FAILURE',
            claimId: claim.recordId,
            code: 'AUTHENTICATION_REQUIRED',
            context,
            operation,
            operationId,
            societyId,
          });
        }

        if (enrollmentToken) {
          return this.completeEnrollment(transaction, {
            actor,
            attemptKeys,
            claimId: claim.recordId,
            context,
            current,
            device,
            enrollmentToken,
            input,
            operationId,
            societyId,
          });
        }

        if (
          !device ||
          device.status !== DeviceStatus.ACTIVE ||
          device.guardDevice?.status !== DeviceStatus.ACTIVE
        ) {
          return this.requireEnrollment(transaction, {
            actor,
            attemptKeys,
            claimId: claim.recordId,
            context,
            current,
            device,
            input,
            societyId,
          });
        }

        const tokens = await this.sessions.createWithinTransaction(transaction, {
          context,
          device: input.device,
          devicePolicy: 'REQUIRE_ACTIVE_GUARD',
          kind: 'GUARD',
          societyId,
          userId: current.userId,
        });
        await this.attempts.record(transaction, {
          ...attemptKeys,
          method: 'GUARD_PIN',
          outcome: 'SUCCESS',
          societyId,
        });
        const stored = successfulOutcome(tokens);
        await this.commitSuccess(transaction, {
          actor,
          claimId: claim.recordId,
          context,
          current,
          eventType: 'auth.session.created',
          societyId,
          stored,
          tokens,
        });
        return stored;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    return unwrapOutcome(outcome);
  }

  private async completeEnrollment(
    transaction: TransactionClient,
    input: {
      readonly actor: MutationActor;
      readonly attemptKeys: CredentialAttemptKeys;
      readonly claimId: string;
      readonly context: MutationRequestContext;
      readonly current: { readonly id: string; readonly userId: string };
      readonly device: {
        readonly guardDevice: {
          readonly enrollmentExpiresAt: Date | null;
          readonly enrollmentTokenDigest: string | null;
          readonly id: string;
          readonly keyId: string | null;
          readonly status: DeviceStatus;
        } | null;
        readonly id: string;
        readonly status: DeviceStatus;
      } | null;
      readonly enrollmentToken: string;
      readonly input: GuardSignInInput;
      readonly operationId: string;
      readonly societyId: string;
    },
  ): Promise<StoredOutcome<SessionTokenResponse>> {
    const guardDevice = input.device?.guardDevice;
    const tokenDigest = guardDevice
      ? this.digests.guardEnrollmentToken(
          input.enrollmentToken,
          input.societyId,
          guardDevice.id,
        )
      : null;
    const now = new Date();
    const tokenValid =
      input.device?.status === DeviceStatus.PENDING &&
      guardDevice?.status === DeviceStatus.PENDING &&
      guardDevice.enrollmentExpiresAt !== null &&
      guardDevice.enrollmentExpiresAt > now &&
      guardDevice.enrollmentTokenDigest !== null &&
      tokenDigest !== null &&
      digestMatches(tokenDigest, guardDevice.enrollmentTokenDigest);
    if (!tokenValid || !input.device || !guardDevice || !tokenDigest) {
      return this.commitFailure(transaction, {
        actor: { ...input.actor, userId: input.current.userId },
        attemptKeys: input.attemptKeys,
        attemptOutcome: 'FAILURE',
        claimId: input.claimId,
        code: 'AUTHENTICATION_REQUIRED',
        context: input.context,
        operation: 'auth.guard.enroll',
        operationId: input.operationId,
        societyId: input.societyId,
      });
    }

    const activated = await transaction.guardDevice.updateMany({
      data: {
        enrollmentExpiresAt: null,
        enrollmentTokenDigest: null,
        keyId: guardDevice.keyId ?? randomUUID(),
        status: DeviceStatus.ACTIVE,
        version: { increment: 1 },
      },
      where: {
        enrollmentExpiresAt: { gt: now },
        enrollmentTokenDigest: tokenDigest,
        id: guardDevice.id,
        societyId: input.societyId,
        status: DeviceStatus.PENDING,
      },
    });
    if (activated.count !== 1) {
      return this.commitFailure(transaction, {
        actor: { ...input.actor, userId: input.current.userId },
        attemptKeys: input.attemptKeys,
        attemptOutcome: 'FAILURE',
        claimId: input.claimId,
        code: 'AUTHENTICATION_REQUIRED',
        context: input.context,
        operation: 'auth.guard.enroll',
        operationId: input.operationId,
        societyId: input.societyId,
      });
    }
    await transaction.device.update({
      data: {
        appVersion: input.input.device.appVersion ?? null,
        label: input.input.device.label ?? null,
        lastSeenAt: now,
        operatingSystem: input.input.device.operatingSystem ?? null,
        platform: input.input.device.platform,
        status: DeviceStatus.ACTIVE,
        userId: input.current.userId,
        version: { increment: 1 },
      },
      where: { id: input.device.id },
    });

    const tokens = await this.sessions.createWithinTransaction(transaction, {
      context: input.context,
      device: input.input.device,
      devicePolicy: 'REQUIRE_ACTIVE_GUARD',
      kind: 'GUARD',
      societyId: input.societyId,
      userId: input.current.userId,
    });
    await this.attempts.record(transaction, {
      ...input.attemptKeys,
      method: 'GUARD_PIN',
      outcome: 'SUCCESS',
      societyId: input.societyId,
    });
    const stored = successfulOutcome(tokens);
    await this.commitSuccess(transaction, {
      actor: { ...input.actor, deviceId: input.device.id },
      claimId: input.claimId,
      context: input.context,
      current: input.current,
      eventType: 'guard.device.enrolled',
      societyId: input.societyId,
      stored,
      tokens,
    });
    return stored;
  }

  private async requireEnrollment(
    transaction: TransactionClient,
    input: {
      readonly actor: MutationActor;
      readonly attemptKeys: CredentialAttemptKeys;
      readonly claimId: string;
      readonly context: MutationRequestContext;
      readonly current: { readonly id: string; readonly userId: string };
      readonly device: {
        readonly guardDevice: { readonly id: string } | null;
        readonly id: string;
      } | null;
      readonly input: GuardSignInInput;
      readonly societyId: string;
    },
  ): Promise<StoredOutcome<SessionTokenResponse>> {
    const now = new Date();
    const device = input.device
      ? await transaction.device.update({
          data: {
            appVersion: input.input.device.appVersion ?? null,
            label: input.input.device.label ?? null,
            lastSeenAt: now,
            operatingSystem: input.input.device.operatingSystem ?? null,
            platform: input.input.device.platform,
            status: DeviceStatus.PENDING,
            userId: input.current.userId,
            version: { increment: 1 },
          },
          where: { id: input.device.id },
        })
      : await transaction.device.create({
          data: {
            appVersion: input.input.device.appVersion ?? null,
            fingerprintDigest: this.digests.deviceFingerprint(
              input.input.device.fingerprint,
              input.societyId,
            ),
            label: input.input.device.label ?? null,
            lastSeenAt: now,
            operatingSystem: input.input.device.operatingSystem ?? null,
            platform: input.input.device.platform,
            societyId: input.societyId,
            status: DeviceStatus.PENDING,
            userId: input.current.userId,
          },
        });
    const guardDevice = input.device?.guardDevice
      ? await transaction.guardDevice.update({
          data: { status: DeviceStatus.PENDING, version: { increment: 1 } },
          where: { id: input.device.guardDevice.id },
        })
      : await transaction.guardDevice.create({
          data: {
            deviceId: device.id,
            societyId: input.societyId,
            status: DeviceStatus.PENDING,
          },
        });

    await this.attempts.record(transaction, {
      ...input.attemptKeys,
      method: 'GUARD_PIN',
      outcome: 'SUCCESS',
      societyId: input.societyId,
    });
    const stored = failedOutcome<SessionTokenResponse>({
      code: 'DEVICE_ENROLLMENT_REQUIRED',
      details: { deviceId: device.id },
      message: 'This guard device must be enrolled before it can sign in.',
      status: HttpStatus.FORBIDDEN,
    });
    await this.journal.commit(transaction, {
      action: 'guard.device.enrollment_required',
      actor: {
        ...input.actor,
        deviceId: device.id,
        guardDeviceId: guardDevice.id,
        userId: input.current.userId,
      },
      aggregateId: guardDevice.id,
      aggregateType: 'GuardDevice',
      correlationId: input.context.databaseCorrelationId,
      entityId: guardDevice.id,
      entityType: 'GuardDevice',
      eventType: 'guard.device.enrollment_required',
      idempotencyRecordId: input.claimId,
      metadata: { ipAddress: input.context.ipAddress },
      newValues: { deviceStatus: DeviceStatus.PENDING },
      response: stored,
      responseStatus: stored.error.status,
      societyId: input.societyId,
    });
    return stored;
  }

  private async commitSuccess(
    transaction: TransactionClient,
    input: {
      readonly actor: MutationActor;
      readonly claimId: string;
      readonly context: MutationRequestContext;
      readonly current: { readonly id: string; readonly userId: string };
      readonly eventType: string;
      readonly societyId: string;
      readonly stored: StoredOutcome<SessionTokenResponse>;
      readonly tokens: SessionTokenResponse;
    },
  ): Promise<void> {
    await this.journal.commit(transaction, {
      action: input.eventType,
      actor: {
        ...input.actor,
        actorScopeKey: `session:${input.tokens.sessionId}`,
        sessionId: input.tokens.sessionId,
        userId: input.current.userId,
      },
      aggregateId: input.tokens.sessionId,
      aggregateType: 'UserSession',
      correlationId: input.context.databaseCorrelationId,
      entityId: input.current.userId,
      entityType: 'User',
      eventType: input.eventType,
      idempotencyRecordId: input.claimId,
      metadata: { ipAddress: input.context.ipAddress, method: 'GUARD_PIN' },
      newValues: { sessionId: input.tokens.sessionId },
      response: input.stored,
      responseStatus: HttpStatus.CREATED,
      societyId: input.societyId,
    });
  }

  private async commitFailure(
    transaction: TransactionClient,
    input: {
      readonly actor: MutationActor;
      readonly attemptKeys: CredentialAttemptKeys;
      readonly attemptOutcome: 'BLOCKED' | 'FAILURE';
      readonly claimId: string;
      readonly code: string;
      readonly context: MutationRequestContext;
      readonly operation: string;
      readonly operationId: string;
      readonly societyId: string;
      readonly status?: number;
    },
  ): Promise<StoredOutcome<SessionTokenResponse>> {
    await this.attempts.record(transaction, {
      ...input.attemptKeys,
      failureCode: input.code,
      method: 'GUARD_PIN',
      outcome: input.attemptOutcome,
      societyId: input.societyId,
    });
    const stored = failedOutcome<SessionTokenResponse>({
      code: input.code,
      status: input.status,
    });
    await this.journal.commit(transaction, {
      action: `${input.operation}_failed`,
      actor: input.actor,
      aggregateId: input.operationId,
      aggregateType: 'GuardProfile',
      auditOutcome: AuditOutcome.FAILURE,
      correlationId: input.context.databaseCorrelationId,
      entityId: input.actor.userId ?? null,
      entityType: 'GuardProfile',
      eventType: `${input.operation}_failed`,
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
      `invalid-guard-${randomUUID()}`,
      'GUARD_PIN',
    );
    return this.dummyHash;
  }
}
