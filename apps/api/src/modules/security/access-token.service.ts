import { randomUUID } from 'node:crypto';

import { Injectable, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SignJWT, compactVerify, importPKCS8, importSPKI, jwtVerify, type KeyLike } from 'jose';
import { z } from 'zod';

import type { AppEnvironment } from '../../config/env.schema.js';

const ACCESS_TOKEN_ALGORITHM = 'RS256' as const;
const ACCESS_TOKEN_TYPE = 'JWT' as const;
const MAX_ACCESS_TOKEN_BYTES = 4_096;
const MAX_FUTURE_IAT_SECONDS = 30;

const tokenClaimsSchema = z
  .object({
    aud: z.union([z.string().min(1), z.array(z.string().min(1)).min(1)]),
    did: z.string().uuid(),
    exp: z.number().int().positive(),
    iat: z.number().int().positive(),
    iss: z.string().min(1),
    jti: z.string().uuid(),
    kind: z.enum(['RESIDENT', 'GUARD', 'PRIVILEGED']),
    sid: z.string().uuid(),
    soc: z.string().uuid(),
    sub: z.string().uuid(),
  })
  .strict();

export type AccessTokenClaims = z.infer<typeof tokenClaimsSchema>;

function normalizePem(value: string): string {
  return value.replace(/\\n/g, '\n');
}

@Injectable()
export class AccessTokenService implements OnModuleInit {
  private readonly audience: string;
  private readonly issuer: string;
  private readonly privateKey: Promise<KeyLike>;
  private readonly publicKey: Promise<KeyLike>;
  private readonly ttlSeconds: number;

  constructor(config: ConfigService<AppEnvironment, true>) {
    this.audience = config.get('JWT_AUDIENCE', { infer: true });
    this.issuer = config.get('JWT_ISSUER', { infer: true });
    this.ttlSeconds = config.get('ACCESS_TOKEN_TTL_SECONDS', { infer: true });
    this.privateKey = importPKCS8(
      normalizePem(config.get('JWT_PRIVATE_KEY', { infer: true })),
      ACCESS_TOKEN_ALGORITHM,
    );
    this.publicKey = importSPKI(
      normalizePem(config.get('JWT_PUBLIC_KEY', { infer: true })),
      ACCESS_TOKEN_ALGORITHM,
    );
  }

  async onModuleInit(): Promise<void> {
    try {
      const [privateKey, publicKey] = await Promise.all([this.privateKey, this.publicKey]);
      assertRsaKey(privateKey);
      assertRsaKey(publicKey);

      const probe = await new SignJWT({ probe: true })
        .setProtectedHeader({ alg: ACCESS_TOKEN_ALGORITHM, typ: ACCESS_TOKEN_TYPE })
        .sign(privateKey);
      await compactVerify(probe, publicKey, {
        algorithms: [ACCESS_TOKEN_ALGORITHM],
      });
    } catch {
      throw new Error(
        'JWT_PRIVATE_KEY and JWT_PUBLIC_KEY must be a matching RSA PKCS#8/SPKI key pair of at least 2048 bits.',
      );
    }
  }

  async issue(input: {
    readonly deviceId: string;
    readonly kind: AccessTokenClaims['kind'];
    readonly sessionId: string;
    readonly societyId: string;
    readonly userId: string;
  }): Promise<{ readonly expiresAt: Date; readonly token: string }> {
    const issuedAt = Math.floor(Date.now() / 1_000);
    const expiresAt = issuedAt + this.ttlSeconds;
    const token = await new SignJWT({
      did: input.deviceId,
      kind: input.kind,
      sid: input.sessionId,
      soc: input.societyId,
    })
      .setProtectedHeader({ alg: ACCESS_TOKEN_ALGORITHM, typ: ACCESS_TOKEN_TYPE })
      .setAudience(this.audience)
      .setExpirationTime(expiresAt)
      .setIssuedAt(issuedAt)
      .setIssuer(this.issuer)
      .setJti(randomUUID())
      .setSubject(input.userId)
      .sign(await this.privateKey);

    if (Buffer.byteLength(token, 'ascii') > MAX_ACCESS_TOKEN_BYTES) {
      throw new Error('Generated access token exceeds the configured security limit.');
    }
    return { expiresAt: new Date(expiresAt * 1_000), token };
  }

  async verify(token: string): Promise<AccessTokenClaims> {
    if (token.length === 0 || Buffer.byteLength(token, 'utf8') > MAX_ACCESS_TOKEN_BYTES) {
      throw new Error('Access token is malformed or oversized.');
    }

    const { payload, protectedHeader } = await jwtVerify(token, await this.publicKey, {
      algorithms: [ACCESS_TOKEN_ALGORITHM],
      audience: this.audience,
      issuer: this.issuer,
      typ: ACCESS_TOKEN_TYPE,
    });
    if (
      protectedHeader.alg !== ACCESS_TOKEN_ALGORITHM ||
      protectedHeader.typ !== ACCESS_TOKEN_TYPE
    ) {
      throw new Error('Access token header is invalid.');
    }

    const claims = tokenClaimsSchema.parse(payload);
    const now = Math.floor(Date.now() / 1_000);
    if (
      claims.iat > now + MAX_FUTURE_IAT_SECONDS ||
      claims.exp <= now ||
      claims.exp > claims.iat + this.ttlSeconds
    ) {
      throw new Error('Access token timestamps are invalid.');
    }
    return claims;
  }
}

function assertRsaKey(key: KeyLike): void {
  const algorithm = key.algorithm as RsaHashedKeyAlgorithm;
  if (
    algorithm.name !== 'RSASSA-PKCS1-v1_5' ||
    typeof algorithm.modulusLength !== 'number' ||
    algorithm.modulusLength < 2_048
  ) {
    throw new Error('Access token key does not meet RSA requirements.');
  }
}
