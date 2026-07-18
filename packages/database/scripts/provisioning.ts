import { createCipheriv, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export type ProvisionedAdminRole = 'SOCIETY_ADMIN' | 'SUPER_ADMIN';

export interface ProvisioningConfig {
  readonly displayName: string;
  readonly email: string;
  readonly encryptionKey: Buffer;
  readonly encryptionKeyVersion: number;
  readonly passwordPepper: string;
  readonly phoneE164: string;
  readonly phoneHmacSecret: string;
  readonly role: ProvisionedAdminRole;
  readonly societyKey: string;
}

export interface ProvisioningSecrets {
  readonly password: string;
  readonly totpCode: string;
  readonly totpSecret: string;
}

export interface EncryptedTotpSecret {
  readonly authTag: Buffer;
  readonly ciphertext: Buffer;
  readonly nonce: Buffer;
}

const unsafeSecretPattern =
  /(admin(?:istrator)?123|change\s*me|example|letmein|passw(?:or)?d|qwerty|test(?:ing)?123|welcome)/i;

function required(environment: NodeJS.ProcessEnv, name: string): string {
  const value = environment[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function parsePositiveInteger(value: string, name: string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return parsed;
}

function assertStrongPassword(password: string, config: ProvisioningConfig): void {
  if (password.length < 16 || password.length > 256) {
    throw new Error('The provisioning password must contain between 16 and 256 characters.');
  }
  const lower = password.toLowerCase();
  const emailLocalPart = config.email.slice(0, config.email.indexOf('@'));
  const identityTokens = [
    emailLocalPart,
    config.phoneE164.slice(-8),
    ...config.displayName.toLowerCase().split(/\s+/),
  ].filter((token) => token.length >= 4);
  if (unsafeSecretPattern.test(password) || identityTokens.some((token) => lower.includes(token))) {
    throw new Error(
      'The provisioning password is an unsafe placeholder or contains identity data.',
    );
  }
  if (
    !/[a-z]/.test(password) ||
    !/[A-Z]/.test(password) ||
    !/\d/.test(password) ||
    !/[^A-Za-z0-9]/.test(password)
  ) {
    throw new Error(
      'The provisioning password must contain upper, lower, number, and symbol characters.',
    );
  }
}

export function parseProvisioningConfig(environment: NodeJS.ProcessEnv): ProvisioningConfig {
  if (environment.NODE_ENV !== 'production') {
    throw new Error('Production admin provisioning requires NODE_ENV=production.');
  }
  if (environment.ALLOW_PRODUCTION_ADMIN_PROVISIONING !== 'PROVISION_MANGLAM_ADMIN_V1') {
    throw new Error('The explicit production provisioning confirmation is missing.');
  }

  const societyKey = required(environment, 'PROVISION_ADMIN_SOCIETY_KEY');
  const email = required(environment, 'PROVISION_ADMIN_EMAIL').toLowerCase();
  const phoneE164 = required(environment, 'PROVISION_ADMIN_PHONE_E164');
  const displayName = required(environment, 'PROVISION_ADMIN_DISPLAY_NAME');
  const role = required(environment, 'PROVISION_ADMIN_ROLE');
  const passwordPepper = required(environment, 'ADMIN_PASSWORD_PEPPER');
  const phoneHmacSecret = required(environment, 'OTP_HMAC_SECRET');
  const encryptionKeyValue = required(environment, 'MFA_ENCRYPTION_KEY_BASE64');
  const encryptionKeyVersion = parsePositiveInteger(
    required(environment, 'MFA_ENCRYPTION_KEY_VERSION'),
    'MFA_ENCRYPTION_KEY_VERSION',
  );

  if (!/^[A-Z0-9_]{3,32}$/.test(societyKey) || /EXAMPLE|PLACEHOLDER|TEST/.test(societyKey)) {
    throw new Error('PROVISION_ADMIN_SOCIETY_KEY is unsafe or malformed.');
  }
  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    /@(example\.(com|org|net)|test|localhost|invalid)$/i.test(email)
  ) {
    throw new Error('PROVISION_ADMIN_EMAIL is unsafe or malformed.');
  }
  if (!/^\+[1-9]\d{7,14}$/.test(phoneE164)) {
    throw new Error('PROVISION_ADMIN_PHONE_E164 must be an E.164 phone number.');
  }
  if (displayName.length < 2 || displayName.length > 120 || unsafeSecretPattern.test(displayName)) {
    throw new Error('PROVISION_ADMIN_DISPLAY_NAME is unsafe or malformed.');
  }
  if (role !== 'SOCIETY_ADMIN' && role !== 'SUPER_ADMIN') {
    throw new Error('PROVISION_ADMIN_ROLE must be SOCIETY_ADMIN or SUPER_ADMIN.');
  }
  if (passwordPepper.length < 32) {
    throw new Error('ADMIN_PASSWORD_PEPPER must contain at least 32 characters.');
  }
  if (phoneHmacSecret.length < 32) {
    throw new Error('OTP_HMAC_SECRET must contain at least 32 characters.');
  }

  const encryptionKey = Buffer.from(encryptionKeyValue, 'base64');
  if (
    encryptionKey.length !== 32 ||
    encryptionKey.toString('base64').replace(/=+$/, '') !== encryptionKeyValue.replace(/=+$/, '')
  ) {
    throw new Error('MFA_ENCRYPTION_KEY_BASE64 must be canonical base64 for exactly 32 bytes.');
  }

  return {
    displayName,
    email,
    encryptionKey,
    encryptionKeyVersion,
    passwordPepper,
    phoneE164,
    phoneHmacSecret,
    role,
    societyKey,
  };
}

export function resolveProvisioningSecrets(
  environment: NodeJS.ProcessEnv,
  stdinText: string,
  config: ProvisioningConfig,
): ProvisioningSecrets {
  const fromEnvironment = {
    password: environment.PROVISION_ADMIN_PASSWORD,
    totpCode: environment.PROVISION_ADMIN_TOTP_CODE,
    totpSecret: environment.PROVISION_ADMIN_TOTP_SECRET,
  };
  const environmentCount = Object.values(fromEnvironment).filter(Boolean).length;

  let candidate: unknown;
  if (environmentCount > 0) {
    if (environmentCount !== 3 || stdinText.trim().length > 0) {
      throw new Error(
        'Provide all provisioning credentials through either environment or stdin, never both.',
      );
    }
    candidate = fromEnvironment;
  } else {
    if (!stdinText.trim()) {
      throw new Error('Provisioning credentials are required through environment or JSON stdin.');
    }
    try {
      candidate = JSON.parse(stdinText);
    } catch {
      throw new Error('Provisioning stdin must be valid JSON.');
    }
  }

  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
    throw new Error('Provisioning credentials must be an object.');
  }
  const record = candidate as Record<string, unknown>;
  if (
    typeof record.password !== 'string' ||
    typeof record.totpCode !== 'string' ||
    typeof record.totpSecret !== 'string'
  ) {
    throw new Error('Provisioning credentials require password, totpCode, and totpSecret strings.');
  }
  if (Object.keys(record).some((key) => !['password', 'totpCode', 'totpSecret'].includes(key))) {
    throw new Error('Provisioning credentials contain unsupported fields.');
  }

  const secrets = {
    password: record.password,
    totpCode: record.totpCode,
    totpSecret: record.totpSecret.toUpperCase(),
  };
  assertStrongPassword(secrets.password, config);
  if (!/^\d{6}$/.test(secrets.totpCode)) {
    throw new Error('The TOTP confirmation code must contain exactly six digits.');
  }
  decodeBase32Secret(secrets.totpSecret);
  return secrets;
}

export function digestProvisionedPhone(
  phoneE164: string,
  societyId: string,
  pepper: string,
): string {
  const hmac = createHmac('sha256', pepper);
  for (const part of ['phone', societyId]) {
    hmac.update(`${Buffer.byteLength(part, 'utf8')}:`);
    hmac.update(part, 'utf8');
  }
  hmac.update(`${Buffer.byteLength(phoneE164, 'utf8')}:`);
  hmac.update(phoneE164, 'utf8');
  return hmac.digest('hex');
}

export function decodeBase32Secret(value: string): Buffer {
  if (!/^[A-Z2-7]{32,128}$/.test(value)) {
    throw new Error('The TOTP secret must be unpadded RFC 4648 base32 with at least 160 bits.');
  }

  let bits = '';
  for (const character of value) {
    bits += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'.indexOf(character).toString(2).padStart(5, '0');
  }
  const bytes: number[] = [];
  for (let index = 0; index + 8 <= bits.length; index += 8) {
    bytes.push(Number.parseInt(bits.slice(index, index + 8), 2));
  }
  const result = Buffer.from(bytes);
  if (result.length < 20 || new Set(result).size < 8) {
    throw new Error('The TOTP secret does not contain sufficient entropy.');
  }
  return result;
}

function totpCode(secret: Buffer, timeStep: bigint): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(timeStep);
  const digest = createHmac('sha1', secret).update(counter).digest();
  const offset = digest[digest.length - 1]! & 0x0f;
  const binary =
    ((digest[offset]! & 0x7f) << 24) |
    ((digest[offset + 1]! & 0xff) << 16) |
    ((digest[offset + 2]! & 0xff) << 8) |
    (digest[offset + 3]! & 0xff);
  return String(binary % 1_000_000).padStart(6, '0');
}

export function verifyCurrentTotp(
  base32Secret: string,
  candidate: string,
  now = new Date(),
): bigint {
  const secret = decodeBase32Secret(base32Secret);
  const currentStep = BigInt(Math.floor(now.getTime() / 30_000));
  const candidateBuffer = Buffer.from(candidate, 'utf8');

  for (const offset of [-1n, 0n, 1n]) {
    const step = currentStep + offset;
    const expected = Buffer.from(totpCode(secret, step), 'utf8');
    if (candidateBuffer.length === expected.length && timingSafeEqual(candidateBuffer, expected)) {
      return step;
    }
  }
  throw new Error('The supplied TOTP confirmation code is invalid or outside the allowed window.');
}

export function encryptTotpSecret(
  base32Secret: string,
  key: Buffer,
  additionalAuthenticatedData: string,
): EncryptedTotpSecret {
  if (key.length !== 32) throw new Error('The MFA encryption key must contain exactly 32 bytes.');
  const nonce = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, nonce);
  cipher.setAAD(Buffer.from(additionalAuthenticatedData, 'utf8'));
  const ciphertext = Buffer.concat([
    cipher.update(decodeBase32Secret(base32Secret)),
    cipher.final(),
  ]);
  return { authTag: cipher.getAuthTag(), ciphertext, nonce };
}
