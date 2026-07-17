import { generateKeyPairSync, randomUUID } from 'node:crypto';

import { SignJWT, importPKCS8 } from 'jose';
import { beforeAll, describe, expect, it } from 'vitest';

import { AccessTokenService } from './access-token.service.js';

const ISSUER = 'https://api.manglam-balaji.test';
const AUDIENCE = 'manglam-clients';
const TTL_SECONDS = 600;

interface PemPair {
  readonly privateKey: string;
  readonly publicKey: string;
}

let pair: PemPair;
let otherPair: PemPair;

beforeAll(() => {
  pair = generatePemPair();
  otherPair = generatePemPair();
});

describe('AccessTokenService', () => {
  it('issues and verifies a pinned RS256 access token', async () => {
    const service = createService(pair);
    await service.onModuleInit();
    const input = tokenIdentity();

    const issued = await service.issue(input);

    await expect(service.verify(issued.token)).resolves.toMatchObject({
      did: input.deviceId,
      kind: input.kind,
      sid: input.sessionId,
      soc: input.societyId,
      sub: input.userId,
    });
  });

  it('fails startup for a mismatched key pair', async () => {
    const service = createService({
      privateKey: pair.privateKey,
      publicKey: otherPair.publicKey,
    });

    await expect(service.onModuleInit()).rejects.toThrow(/matching RSA/i);
  });

  it('rejects algorithm confusion', async () => {
    const service = createService(pair);
    await service.onModuleInit();
    const token = await signedToken(pair.privateKey, { algorithm: 'PS256' });

    await expect(service.verify(token)).rejects.toThrow();
  });

  it.each(['malformed', `${'a'.repeat(4_097)}.b.c`])(
    'rejects malformed or oversized token input',
    async (token) => {
      const service = createService(pair);
      await service.onModuleInit();
      await expect(service.verify(token)).rejects.toThrow();
    },
  );

  it('rejects a token issued too far in the future', async () => {
    const service = createService(pair);
    await service.onModuleInit();
    const now = Math.floor(Date.now() / 1_000);
    const token = await signedToken(pair.privateKey, {
      expiresAt: now + TTL_SECONDS,
      issuedAt: now + 31,
    });

    await expect(service.verify(token)).rejects.toThrow(/timestamps/i);
  });

  it('rejects an expired token', async () => {
    const service = createService(pair);
    await service.onModuleInit();
    const now = Math.floor(Date.now() / 1_000);
    const token = await signedToken(pair.privateKey, {
      expiresAt: now - 1,
      issuedAt: now - TTL_SECONDS,
    });

    await expect(service.verify(token)).rejects.toThrow();
  });

  it.each([{ audience: 'other-clients' }, { issuer: 'https://other.example.test' }])(
    'rejects issuer or audience mismatch',
    async (overrides) => {
      const service = createService(pair);
      await service.onModuleInit();
      const token = await signedToken(pair.privateKey, overrides);

      await expect(service.verify(token)).rejects.toThrow();
    },
  );

  it('rejects an invalid signature', async () => {
    const service = createService(pair);
    await service.onModuleInit();
    const token = await signedToken(otherPair.privateKey);

    await expect(service.verify(token)).rejects.toThrow();
  });
});

function createService(keys: PemPair): AccessTokenService {
  const values: Record<string, unknown> = {
    ACCESS_TOKEN_TTL_SECONDS: TTL_SECONDS,
    JWT_AUDIENCE: AUDIENCE,
    JWT_ISSUER: ISSUER,
    JWT_PRIVATE_KEY: keys.privateKey,
    JWT_PUBLIC_KEY: keys.publicKey,
  };
  return new AccessTokenService({
    get: (key: string) => values[key],
  } as never);
}

function generatePemPair(): PemPair {
  const generated = generateKeyPairSync('rsa', {
    modulusLength: 2_048,
    privateKeyEncoding: { format: 'pem', type: 'pkcs8' },
    publicKeyEncoding: { format: 'pem', type: 'spki' },
  });
  return generated;
}

function tokenIdentity() {
  return {
    deviceId: randomUUID(),
    kind: 'RESIDENT' as const,
    sessionId: randomUUID(),
    societyId: randomUUID(),
    userId: randomUUID(),
  };
}

async function signedToken(
  privateKeyPem: string,
  overrides: {
    readonly algorithm?: 'PS256' | 'RS256';
    readonly audience?: string;
    readonly expiresAt?: number;
    readonly issuedAt?: number;
    readonly issuer?: string;
  } = {},
): Promise<string> {
  const identity = tokenIdentity();
  const now = Math.floor(Date.now() / 1_000);
  const algorithm = overrides.algorithm ?? 'RS256';
  const key = await importPKCS8(privateKeyPem, algorithm);
  return new SignJWT({
    did: identity.deviceId,
    kind: identity.kind,
    sid: identity.sessionId,
    soc: identity.societyId,
  })
    .setProtectedHeader({ alg: algorithm, typ: 'JWT' })
    .setAudience(overrides.audience ?? AUDIENCE)
    .setExpirationTime(overrides.expiresAt ?? now + TTL_SECONDS)
    .setIssuedAt(overrides.issuedAt ?? now)
    .setIssuer(overrides.issuer ?? ISSUER)
    .setJti(randomUUID())
    .setSubject(identity.userId)
    .sign(key);
}
