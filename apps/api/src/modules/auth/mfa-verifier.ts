import { createDecipheriv, timingSafeEqual } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import { Prisma } from '@manglam/database';

import { DatabaseService } from '../../infrastructure/database/database.service.js';
import { verifyTotpCode } from './totp.js';

export interface MfaVerificationRequest {
  readonly code: string;
  readonly societyId: string;
  readonly userId: string;
}

export type MfaVerificationResult = 'INVALID' | 'UNAVAILABLE' | 'VERIFIED';

export interface MfaVerifier {
  verify(request: MfaVerificationRequest): Promise<MfaVerificationResult>;
}

interface MfaCredentialRow {
  readonly encryptionAlgorithm: string;
  readonly id: string;
  readonly keyVersion: number;
  readonly lastUsedTimeStep: bigint | null;
  readonly secretAuthTag: Buffer;
  readonly secretCiphertext: Buffer;
  readonly secretNonce: Buffer;
}

@Injectable()
export class DatabaseTotpMfaVerifier implements MfaVerifier {
  private readonly key: Buffer | null;
  private readonly keyVersion: number | null;

  constructor(private readonly database: DatabaseService) {
    const configuredKey = process.env.MFA_ENCRYPTION_KEY_BASE64;
    const configuredVersion = Number(process.env.MFA_ENCRYPTION_KEY_VERSION);
    this.key = decodeEncryptionKey(configuredKey);
    this.keyVersion =
      Number.isSafeInteger(configuredVersion) && configuredVersion > 0
        ? configuredVersion
        : null;
  }

  async verify(
    request: MfaVerificationRequest,
  ): Promise<MfaVerificationResult> {
    if (!/^\d{6}$/.test(request.code) || !this.key || !this.keyVersion) {
      return 'UNAVAILABLE';
    }

    try {
      return await this.database.client.$transaction(
        async (transaction) => {
          const rows = await transaction.$queryRaw<MfaCredentialRow[]>(
            Prisma.sql`
              SELECT
                id,
                encryption_algorithm AS "encryptionAlgorithm",
                key_version AS "keyVersion",
                last_used_time_step AS "lastUsedTimeStep",
                secret_auth_tag AS "secretAuthTag",
                secret_ciphertext AS "secretCiphertext",
                secret_nonce AS "secretNonce"
              FROM mfa_credentials
              WHERE society_id = ${request.societyId}::uuid
                AND user_id = ${request.userId}::uuid
                AND type = 'TOTP'
                AND status = 'ACTIVE'
              ORDER BY confirmed_at DESC NULLS LAST, created_at DESC
              LIMIT 1
              FOR UPDATE
            `,
          );
          const credential = rows[0];
          if (!credential) {
            return 'UNAVAILABLE';
          }
          const secret = this.decryptCredential(
            credential,
            request.societyId,
            request.userId,
          );
          if (!secret) {
            return 'UNAVAILABLE';
          }
          const acceptedStep = verifyTotpCode({
            candidate: request.code,
            lastUsedStep: credential.lastUsedTimeStep,
            now: new Date(),
            secret,
          });
          secret.fill(0);
          if (acceptedStep === null) {
            return 'INVALID';
          }

          const updated = await transaction.$executeRaw(
            Prisma.sql`
              UPDATE mfa_credentials
              SET last_used_time_step = ${acceptedStep},
                  version = version + 1,
                  updated_at = now()
              WHERE id = ${credential.id}::uuid
                AND society_id = ${request.societyId}::uuid
                AND status = 'ACTIVE'
                AND (
                  last_used_time_step IS NULL
                  OR last_used_time_step < ${acceptedStep}
                )
            `,
          );
          return updated === 1 ? 'VERIFIED' : 'INVALID';
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch {
      return 'UNAVAILABLE';
    }
  }

  private decryptCredential(
    credential: MfaCredentialRow,
    societyId: string,
    userId: string,
  ): Buffer | null {
    if (
      !this.key ||
      credential.encryptionAlgorithm !== 'AES-256-GCM' ||
      credential.keyVersion !== this.keyVersion ||
      credential.secretNonce.length !== 12 ||
      credential.secretAuthTag.length !== 16
    ) {
      return null;
    }

    try {
      const aad = `${societyId}:${userId}:TOTP:v${credential.keyVersion}`;
      const decipher = createDecipheriv(
        'aes-256-gcm',
        this.key,
        credential.secretNonce,
      );
      decipher.setAAD(Buffer.from(aad, 'utf8'));
      decipher.setAuthTag(credential.secretAuthTag);
      return Buffer.concat([
        decipher.update(credential.secretCiphertext),
        decipher.final(),
      ]);
    } catch {
      return null;
    }
  }
}

function decodeEncryptionKey(value: string | undefined): Buffer | null {
  if (!value || !/^[A-Za-z0-9+/]+={0,2}$/.test(value)) {
    return null;
  }
  try {
    const key = Buffer.from(value, 'base64');
    const canonical = key.toString('base64');
    return key.length === 32 && timingSafeEqual(Buffer.from(canonical), Buffer.from(value))
      ? key
      : null;
  } catch {
    return null;
  }
}
