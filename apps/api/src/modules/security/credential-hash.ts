import { argon2, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const ALGORITHM = 'argon2id';
const FORMAT_VERSION = 1;
const MEMORY_KIB = 65_536;
const PASSES = 3;
const PARALLELISM = 1;
const TAG_LENGTH = 32;
const NONCE_LENGTH = 16;

export const CREDENTIAL_PURPOSES = ['ADMIN_PASSWORD', 'GUARD_PIN', 'RESIDENT_APP_PIN'] as const;

export type CredentialPurpose = (typeof CREDENTIAL_PURPOSES)[number];

interface EncodedCredential {
  readonly digest: Buffer;
  readonly nonce: Buffer;
}

export async function hashCredential(
  value: string,
  purpose: CredentialPurpose,
  pepper: string,
): Promise<string> {
  assertInput(value);
  const nonce = randomBytes(NONCE_LENGTH);
  const digest = await derive(value, nonce, pepper, purpose);
  return [
    ALGORITHM,
    `v=${FORMAT_VERSION}`,
    `purpose=${purpose}`,
    `m=${MEMORY_KIB},t=${PASSES},p=${PARALLELISM},l=${TAG_LENGTH}`,
    nonce.toString('base64url'),
    digest.toString('base64url'),
  ].join('$');
}

export async function verifyCredential(
  value: string,
  encoded: string,
  purpose: CredentialPurpose,
  pepper: string,
): Promise<boolean> {
  if (value.length < 4 || value.length > 256) {
    return false;
  }
  const parsed = parseCredential(encoded, purpose);
  if (!parsed) {
    return false;
  }

  try {
    const actual = await derive(value, parsed.nonce, pepper, purpose);
    return actual.length === parsed.digest.length && timingSafeEqual(actual, parsed.digest);
  } catch {
    return false;
  }
}

function purposeSecret(pepper: string, purpose: CredentialPurpose): Buffer {
  return createHmac('sha256', pepper)
    .update(`manglam-balaji:credential:${purpose}:v1`, 'utf8')
    .digest();
}

function derive(
  value: string,
  nonce: Buffer,
  pepper: string,
  purpose: CredentialPurpose,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    argon2(
      ALGORITHM,
      {
        memory: MEMORY_KIB,
        message: Buffer.from(value, 'utf8'),
        nonce,
        parallelism: PARALLELISM,
        passes: PASSES,
        secret: purposeSecret(pepper, purpose),
        tagLength: TAG_LENGTH,
      },
      (error, derivedKey) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(derivedKey);
      },
    );
  });
}

function parseCredential(
  encoded: string,
  expectedPurpose: CredentialPurpose,
): EncodedCredential | null {
  const [algorithm, version, purposeValue, parameters, nonceValue, digestValue, extra] =
    encoded.split('$');
  if (
    extra !== undefined ||
    algorithm !== ALGORITHM ||
    version !== `v=${FORMAT_VERSION}` ||
    purposeValue !== `purpose=${expectedPurpose}` ||
    parameters !== `m=${MEMORY_KIB},t=${PASSES},p=${PARALLELISM},l=${TAG_LENGTH}` ||
    !nonceValue ||
    !digestValue ||
    !/^[A-Za-z0-9_-]+$/.test(nonceValue) ||
    !/^[A-Za-z0-9_-]+$/.test(digestValue)
  ) {
    return null;
  }

  try {
    const nonce = Buffer.from(nonceValue, 'base64url');
    const digest = Buffer.from(digestValue, 'base64url');
    if (
      nonce.length !== NONCE_LENGTH ||
      digest.length !== TAG_LENGTH ||
      nonce.toString('base64url') !== nonceValue ||
      digest.toString('base64url') !== digestValue
    ) {
      return null;
    }
    return { digest, nonce };
  } catch {
    return null;
  }
}

function assertInput(value: string): void {
  if (value.length < 4 || value.length > 256) {
    throw new Error('Credential input length is outside the supported range.');
  }
}
