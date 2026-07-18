import { argon2, randomBytes, timingSafeEqual } from 'node:crypto';

export type CredentialPurpose = 'ADMIN_PASSWORD' | 'GUARD_PIN' | 'RESIDENT_APP_PIN';

export const CREDENTIAL_PEPPER_ENVIRONMENT_VARIABLES: Readonly<Record<CredentialPurpose, string>> =
  Object.freeze({
    ADMIN_PASSWORD: 'ADMIN_PASSWORD_PEPPER',
    GUARD_PIN: 'GUARD_PIN_PEPPER',
    RESIDENT_APP_PIN: 'RESIDENT_APP_PIN_PEPPER',
  });

const ALGORITHM = 'argon2id';
const FORMAT_VERSION = 1;
const MEMORY_KIB = 65_536;
const PASSES = 3;
const PARALLELISM = 1;
const TAG_LENGTH = 32;
const NONCE_LENGTH = 16;
const PURPOSES: readonly CredentialPurpose[] = ['ADMIN_PASSWORD', 'GUARD_PIN', 'RESIDENT_APP_PIN'];

interface ParsedCredential {
  readonly digest: Buffer;
  readonly nonce: Buffer;
  readonly purpose: CredentialPurpose;
}

function assertSecret(value: string, name: string): void {
  if (value.length < 32 || value.length > 512) {
    throw new Error(`${name} length is outside the supported range.`);
  }
}

function derive(
  value: string,
  nonce: Buffer,
  purpose: CredentialPurpose,
  pepper: string,
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
        secret: Buffer.from(`${purpose}\0${pepper}`, 'utf8'),
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

function parseCredential(encoded: string): ParsedCredential | null {
  const [algorithm, version, purposeValue, parameters, nonceValue, digestValue, extra] =
    encoded.split('$');
  if (
    extra !== undefined ||
    algorithm !== ALGORITHM ||
    version !== `v=${FORMAT_VERSION}` ||
    !purposeValue?.startsWith('purpose=') ||
    parameters !== `m=${MEMORY_KIB},t=${PASSES},p=${PARALLELISM},l=${TAG_LENGTH}` ||
    !nonceValue ||
    !digestValue ||
    !/^[A-Za-z0-9_-]+$/.test(nonceValue) ||
    !/^[A-Za-z0-9_-]+$/.test(digestValue)
  ) {
    return null;
  }

  const purpose = purposeValue.slice('purpose='.length);
  if (!PURPOSES.includes(purpose as CredentialPurpose)) {
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
    return { digest, nonce, purpose: purpose as CredentialPurpose };
  } catch {
    return null;
  }
}

export async function hashCredential(
  value: string,
  purpose: CredentialPurpose,
  pepper: string,
): Promise<string> {
  if (value.length < 4 || value.length > 256) {
    throw new Error('Credential input length is outside the supported range.');
  }
  assertSecret(pepper, 'Credential pepper');

  const nonce = randomBytes(NONCE_LENGTH);
  const digest = await derive(value, nonce, purpose, pepper);
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
  expectedPurpose: CredentialPurpose,
  pepper: string,
): Promise<boolean> {
  if (value.length < 4 || value.length > 256 || pepper.length < 32 || pepper.length > 512) {
    return false;
  }

  const parsed = parseCredential(encoded);
  if (!parsed || parsed.purpose !== expectedPurpose) {
    return false;
  }

  try {
    const actual = await derive(value, parsed.nonce, expectedPurpose, pepper);
    return actual.length === parsed.digest.length && timingSafeEqual(actual, parsed.digest);
  } catch {
    return false;
  }
}
