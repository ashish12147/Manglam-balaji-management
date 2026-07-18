import { randomUUID } from 'node:crypto';

import { HttpStatus, Injectable, type OnModuleInit } from '@nestjs/common';
import {
  AuditOutcome,
  Prisma,
  RecordStatus,
  UserStatus,
} from '@manglam/database';

import { DatabaseService } from '../../infrastructure/database/database.service.js';
import type { MutationActor, TransactionClient } from '../platform/mutation-journal.service.js';
import { MutationJournalService } from '../platform/mutation-journal.service.js';
import type { MutationRequestContext } from '../platform/request-context.js';
import { PasswordHasher } from '../security/password-hasher.js';
import { SecretDigestService } from '../security/secret-digest.service.js';
import type { AdminSignInInput } from './auth.schemas.js';
import {
  failedOutcome,
  successfulOutcome,
  type StoredOutcome,
  unwrapOutcome,
} from './auth-outcome.js';
import { AuthReplayService } from './auth-replay.service.js';
import { AuthSocietyService } from './auth-society.service.js';
import { CredentialAttemptService, type CredentialAttemptKeys } from './credential-attempt.service.js';
import { DatabaseTotpMfaVerifier, type MfaVerificationResult } from './mfa-verifier.js';
import { SessionService, type SessionTokenResponse } from './session.service.js';

type AdminMfaDecision =
  | 'INVALID'
  | 'MISSING'
  | 'NOT_REQUIRED'
  | 'UNAVAILABLE'
  | 'VERIFIED';

@Injectable()
export class AdminAuthService implements OnModuleInit {
  private dummyHash: string | null = null;

  constructor(
    private readonly database: DatabaseService,
    private readonly society: AuthSocietyService,
    private readonly digests: SecretDigestService,
    private readonly journal: MutationJournalService,
    private readonly replay: AuthReplayService,
    private readonly attempts: CredentialAttemptService,
    private readonly passwords: PasswordHasher,
    private readonly mfa: DatabaseTotpMfaVerifier,
    private readonly sessions: SessionService,
  ) {}

  async onModuleInit(): Promise<void> {
    this.dummyHash = await this.passwords.hash(
      `invalid-admin-${randomUUID()}`,
      'ADMIN_PASSWORD',
    );
  }

  async signIn(
    input: AdminSignInInput,
    context: MutationRequestContext,
  ): Promise<SessionTokenResponse> {
    const societyId = await this.society.activeId();
    const attemptKeys = this.attempts.keys({
      deviceFingerprint: input.device.fingerprint,
      identifier: input.email,
      ipAddress: context.ipAddress,
      method: 'ADMIN_PASSWORD',
      societyId,
    });
    const totpAttemptKeys = this.attempts.keys({
      deviceFingerprint: input.device.fingerprint,
      identifier: input.email,
      ipAddress: context.ipAddress,
      method: 'TOTP',
      societyId,
    });
    const deviceDigest = this.digests.deviceFingerprint(
      input.device.fingerprint,
      societyId,
    );
    const actor: MutationActor = {
      actorScopeKey: `admin:${attemptKeys.subjectDigest}:${deviceDigest}`.slice(0, 200),
    };
    const requestContract = {
      device: { ...input.device, fingerprint: deviceDigest },
      emailDigest: attemptKeys.subjectDigest,
      mfaCodeDigest: input.mfaCode
        ? this.journal.hashRequest(input.mfaCode)
        : null,
      passwordProof: this.digests.credentialProof(
        input.password,
        'ADMIN_PASSWORD',
        societyId,
      ),
    };
    const prior = await this.replay.find<StoredOutcome<SessionTokenResponse>>({
      actor,
      idempotencyKey: context.idempotencyKey,
      operation: 'auth.admin.sign_in',
      request: requestContract,
      societyId,
    });
    if (prior.found) return unwrapOutcome(prior.value);

    const now = new Date();
    const candidate = await this.database.client.user.findFirst({
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
        societyId,
        status: UserStatus.ACTIVE,
      },
    });
    const passwordValid = await this.passwords.verify(
      input.password,
      candidate?.passwordHash ?? (await this.getDummyHash()),
      'ADMIN_PASSWORD',
    );
    const eligiblePassword =
      Boolean(candidate?.passwordHash) &&
      candidate!.roleAssignments.length > 0 &&
      passwordValid;

    let mfaDecision: AdminMfaDecision = 'NOT_REQUIRED';
    if (eligiblePassword && candidate?.mfaEnabled) {
      if (!input.mfaCode) {
        mfaDecision = 'MISSING';
      } else {
        const result = await this.mfa.verify({
          code: input.mfaCode,
          societyId,
          userId: candidate.id,
        });
        mfaDecision = result;
      }
    }

    const operationId = candidate?.id ?? randomUUID();
    const outcome = await this.database.client.$transaction(
      async (transaction) => {
        const claim = await this.journal.begin<StoredOutcome<SessionTokenResponse>>(
          transaction,
          {
            actor: { ...actor, userId: candidate?.id ?? null },
            idempotencyKey: context.idempotencyKey,
            operation: 'auth.admin.sign_in',
            request: requestContract,
            societyId,
          },
        );
        if (claim.kind === 'replay') return claim.response;

        const passwordAttemptsAllowed = await this.attempts.allowed(transaction, {
          ...attemptKeys,
          method: 'ADMIN_PASSWORD',
          societyId,
        });
        if (!passwordAttemptsAllowed) {
          return this.commitFailure(transaction, {
            actor,
            adminAttemptKeys: attemptKeys,
            adminOutcome: 'BLOCKED',
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
                id: candidate.id,
                passwordHash: candidate.passwordHash,
                societyId,
                status: UserStatus.ACTIVE,
              },
            })
          : null;
        const credentialsValid =
          eligiblePassword && Boolean(current) && current!.roleAssignments.length > 0;
        if (!credentialsValid) {
          return this.commitFailure(transaction, {
            actor,
            adminAttemptKeys: attemptKeys,
            adminOutcome: 'FAILURE',
            claimId: claim.recordId,
            code: 'AUTHENTICATION_REQUIRED',
            context,
            operationId,
            societyId,
          });
        }

        if (current!.mfaEnabled && !input.mfaCode) {
          return this.commitFailure(transaction, {
            actor: { ...actor, userId: current!.id },
            adminAttemptKeys: attemptKeys,
            adminOutcome: 'SUCCESS',
            claimId: claim.recordId,
            code: 'MFA_REQUIRED',
            context,
            message: 'Additional verification is required.',
            operationId,
            societyId,
          });
        }

        if (current!.mfaEnabled) {
          const totpAllowed = await this.attempts.allowed(transaction, {
            ...totpAttemptKeys,
            method: 'TOTP',
            societyId,
          });
          if (!totpAllowed) {
            return this.commitFailure(transaction, {
              actor: { ...actor, userId: current!.id },
              adminAttemptKeys: attemptKeys,
              adminOutcome: 'SUCCESS',
              claimId: claim.recordId,
              code: 'AUTHENTICATION_RATE_LIMITED',
              context,
              operationId,
              societyId,
              status: HttpStatus.TOO_MANY_REQUESTS,
              totpAttemptKeys,
              totpOutcome: 'BLOCKED',
            });
          }
          if (mfaDecision !== 'VERIFIED') {
            return this.commitFailure(transaction, {
              actor: { ...actor, userId: current!.id },
              adminAttemptKeys: attemptKeys,
              adminOutcome: 'SUCCESS',
              claimId: claim.recordId,
              code: 'AUTHENTICATION_REQUIRED',
              context,
              operationId,
              societyId,
              totpAttemptKeys,
              totpOutcome: 'FAILURE',
            });
          }
        }

        const tokens = await this.sessions.createWithinTransaction(transaction, {
          context,
          device: input.device,
          kind: 'PRIVILEGED',
          societyId,
          userId: current!.id,
        });
        await this.attempts.record(transaction, {
          ...attemptKeys,
          method: 'ADMIN_PASSWORD',
          outcome: 'SUCCESS',
          societyId,
        });
        if (current!.mfaEnabled) {
          await this.attempts.record(transaction, {
            ...totpAttemptKeys,
            method: 'TOTP',
            outcome: 'SUCCESS',
            societyId,
          });
        }
        const stored = successfulOutcome(tokens);
        await this.journal.commit(transaction, {
          action: 'auth.admin.sign_in',
          actor: {
            ...actor,
            actorScopeKey: `session:${tokens.sessionId}`,
            sessionId: tokens.sessionId,
            userId: current!.id,
          },
          aggregateId: tokens.sessionId,
          aggregateType: 'UserSession',
          correlationId: context.databaseCorrelationId,
          entityId: current!.id,
          entityType: 'User',
          eventType: 'auth.session.created',
          idempotencyRecordId: claim.recordId,
          metadata: {
            ipAddress: context.ipAddress,
            method: current!.mfaEnabled ? 'ADMIN_PASSWORD_TOTP' : 'ADMIN_PASSWORD',
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

  private async commitFailure(
    transaction: TransactionClient,
    input: {
      readonly actor: MutationActor;
      readonly adminAttemptKeys: CredentialAttemptKeys;
      readonly adminOutcome: 'BLOCKED' | 'FAILURE' | 'SUCCESS';
      readonly claimId: string;
      readonly code: string;
      readonly context: MutationRequestContext;
      readonly message?: string;
      readonly operationId: string;
      readonly societyId: string;
      readonly status?: number;
      readonly totpAttemptKeys?: CredentialAttemptKeys;
      readonly totpOutcome?: 'BLOCKED' | 'FAILURE';
    },
  ): Promise<StoredOutcome<SessionTokenResponse>> {
    await this.attempts.record(transaction, {
      ...input.adminAttemptKeys,
      failureCode: input.adminOutcome === 'SUCCESS' ? undefined : input.code,
      method: 'ADMIN_PASSWORD',
      outcome: input.adminOutcome,
      societyId: input.societyId,
    });
    if (input.totpAttemptKeys && input.totpOutcome) {
      await this.attempts.record(transaction, {
        ...input.totpAttemptKeys,
        failureCode: input.code,
        method: 'TOTP',
        outcome: input.totpOutcome,
        societyId: input.societyId,
      });
    }
    const stored = failedOutcome<SessionTokenResponse>({
      code: input.code,
      message: input.message,
      status: input.status,
    });
    await this.journal.commit(transaction, {
      action: 'auth.admin.sign_in_failed',
      actor: input.actor,
      aggregateId: input.operationId,
      aggregateType: 'User',
      auditOutcome: AuditOutcome.FAILURE,
      correlationId: input.context.databaseCorrelationId,
      entityId: input.actor.userId ?? null,
      entityType: 'User',
      eventType: 'auth.admin.sign_in_failed',
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
      `invalid-admin-${randomUUID()}`,
      'ADMIN_PASSWORD',
    );
    return this.dummyHash;
  }
}

function normalizeMfaResult(result: MfaVerificationResult): AdminMfaDecision {
  return result;
}
