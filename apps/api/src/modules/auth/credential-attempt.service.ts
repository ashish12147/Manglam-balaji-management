import { Injectable } from '@nestjs/common';
import { Prisma } from '@manglam/database';

import type { TransactionClient } from '../platform/mutation-journal.service.js';
import { SecretDigestService } from '../security/secret-digest.service.js';

export type AuthenticationMethodContract =
  | 'ADMIN_PASSWORD'
  | 'GUARD_PIN'
  | 'OTP'
  | 'REFRESH_TOKEN'
  | 'RESIDENT_APP_PIN'
  | 'TOTP';

export type AuthenticationAttemptOutcomeContract =
  | 'BLOCKED'
  | 'FAILURE'
  | 'SUCCESS';

export interface CredentialAttemptKeys {
  readonly originDigest: string | null;
  readonly subjectDigest: string;
}

interface AttemptCounts {
  readonly originRecent: bigint;
  readonly subjectDay: bigint;
  readonly subjectRecent: bigint;
}

const SUBJECT_ATTEMPTS_PER_15_MINUTES = 5n;
const SUBJECT_ATTEMPTS_PER_DAY = 20n;
const ORIGIN_ATTEMPTS_PER_15_MINUTES = 30n;
const ATTEMPT_RETENTION_MS = 30 * 24 * 60 * 60_000;

@Injectable()
export class CredentialAttemptService {
  constructor(private readonly digests: SecretDigestService) {}

  keys(input: {
    readonly deviceFingerprint: string;
    readonly identifier: string;
    readonly ipAddress: string | null;
    readonly method: AuthenticationMethodContract;
    readonly societyId: string;
  }): CredentialAttemptKeys {
    return {
      originDigest: this.digests.authenticationOrigin(
        input.deviceFingerprint,
        input.ipAddress,
        input.societyId,
      ),
      subjectDigest: this.digests.authenticationSubject(
        input.identifier,
        input.method,
        input.societyId,
      ),
    };
  }

  async allowed(
    transaction: TransactionClient,
    input: CredentialAttemptKeys & {
      readonly method: AuthenticationMethodContract;
      readonly societyId: string;
    },
  ): Promise<boolean> {
    await transaction.$queryRaw(
      Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${`${input.societyId}:${input.method}:${input.subjectDigest}`}, 0))`,
    );
    const rows = await transaction.$queryRaw<AttemptCounts[]>(
      Prisma.sql`
        SELECT
          COUNT(*) FILTER (
            WHERE subject_digest = ${input.subjectDigest}
              AND occurred_at >= now() - interval '15 minutes'
          )::bigint AS "subjectRecent",
          COUNT(*) FILTER (
            WHERE subject_digest = ${input.subjectDigest}
              AND occurred_at >= now() - interval '24 hours'
          )::bigint AS "subjectDay",
          COUNT(*) FILTER (
            WHERE ${input.originDigest}::text IS NOT NULL
              AND origin_digest = ${input.originDigest}
              AND occurred_at >= now() - interval '15 minutes'
          )::bigint AS "originRecent"
        FROM authentication_attempts
        WHERE society_id = ${input.societyId}::uuid
          AND method::text = ${input.method}
          AND outcome IN ('FAILURE', 'BLOCKED')
          AND occurred_at >= now() - interval '24 hours'
      `,
    );
    const counts = rows[0] ?? {
      originRecent: 0n,
      subjectDay: 0n,
      subjectRecent: 0n,
    };
    return (
      counts.subjectRecent < SUBJECT_ATTEMPTS_PER_15_MINUTES &&
      counts.subjectDay < SUBJECT_ATTEMPTS_PER_DAY &&
      counts.originRecent < ORIGIN_ATTEMPTS_PER_15_MINUTES
    );
  }

  async record(
    transaction: TransactionClient,
    input: CredentialAttemptKeys & {
      readonly failureCode?: string;
      readonly method: AuthenticationMethodContract;
      readonly outcome: AuthenticationAttemptOutcomeContract;
      readonly societyId: string;
    },
  ): Promise<void> {
    const retentionUntil = new Date(Date.now() + ATTEMPT_RETENTION_MS);
    await transaction.$executeRaw(
      Prisma.sql`
        INSERT INTO authentication_attempts (
          id,
          society_id,
          subject_digest,
          origin_digest,
          method,
          outcome,
          failure_code,
          retention_until
        ) VALUES (
          gen_random_uuid(),
          ${input.societyId}::uuid,
          ${input.subjectDigest},
          ${input.originDigest},
          CAST(${input.method} AS "AuthenticationMethod"),
          CAST(${input.outcome} AS "AuthenticationAttemptOutcome"),
          ${input.failureCode ?? null},
          ${retentionUntil}
        )
      `,
    );
  }
}
