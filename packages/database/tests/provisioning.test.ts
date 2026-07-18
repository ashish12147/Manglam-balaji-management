import { createDecipheriv } from 'node:crypto';
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import {
  CREDENTIAL_PEPPER_ENVIRONMENT_VARIABLES,
  hashCredential,
  verifyCredential,
} from '../src/security/credential-hasher.js';
import {
  encryptTotpSecret,
  parseProvisioningConfig,
  resolveProvisioningSecrets,
  verifyCurrentTotp,
} from '../scripts/provisioning.js';

const totpSecret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';

function environment(): NodeJS.ProcessEnv {
  return {
    ADMIN_PASSWORD_PEPPER: 'admin-password-pepper-with-more-than-32-characters',
    ALLOW_PRODUCTION_ADMIN_PROVISIONING: 'PROVISION_MANGLAM_ADMIN_V1',
    MFA_ENCRYPTION_KEY_BASE64: Buffer.alloc(32, 7).toString('base64'),
    MFA_ENCRYPTION_KEY_VERSION: '3',
    NODE_ENV: 'production',
    OTP_HMAC_SECRET: 'phone-digest-secret-with-more-than-32-characters',
    PROVISION_ADMIN_DISPLAY_NAME: 'Security Administrator',
    PROVISION_ADMIN_EMAIL: 'security@acme.in',
    PROVISION_ADMIN_PHONE_E164: '+919876543210',
    PROVISION_ADMIN_ROLE: 'SUPER_ADMIN',
    PROVISION_ADMIN_SOCIETY_KEY: 'MANGLAM_BALAJI',
  };
}

describe('production admin provisioning security', () => {
  it('keeps the CLI on the admin-purpose contract and consumes the confirming TOTP step', () => {
    const source = readFileSync(new URL('../scripts/provision-admin.ts', import.meta.url), 'utf8');

    expect(source).toMatch(/hashCredential\(\s*secrets\.password,\s*'ADMIN_PASSWORD'/);
    expect(source).toContain('lastUsedTimeStep: confirmedTimeStep');
    expect(source).not.toMatch(/['"]APP_PIN['"]|\bAPP_PIN_PEPPER\b/);
  });

  it('requires the production gate and rejects placeholder identity data', () => {
    expect(() => parseProvisioningConfig(environment())).not.toThrow();
    expect(() =>
      parseProvisioningConfig({
        ...environment(),
        PROVISION_ADMIN_EMAIL: 'admin@example.com',
      }),
    ).toThrow(/unsafe or malformed/);
    expect(() =>
      parseProvisioningConfig({
        ...environment(),
        ALLOW_PRODUCTION_ADMIN_PROVISIONING: undefined,
      }),
    ).toThrow(/confirmation/);
  });

  it('accepts credentials from one protected channel and rejects weak passwords', () => {
    const config = parseProvisioningConfig(environment());
    const stdin = JSON.stringify({
      password: 'S7rong!Provision-Only#2026',
      totpCode: '287082',
      totpSecret,
    });
    expect(resolveProvisioningSecrets(environment(), stdin, config)).toEqual({
      password: 'S7rong!Provision-Only#2026',
      totpCode: '287082',
      totpSecret,
    });
    expect(() =>
      resolveProvisioningSecrets(
        { ...environment(), PROVISION_ADMIN_PASSWORD: 'Password123!' },
        stdin,
        config,
      ),
    ).toThrow(/either environment or stdin/);
  });

  it('verifies TOTP and encrypts its secret with bound AES-256-GCM metadata', () => {
    expect(verifyCurrentTotp(totpSecret, '287082', new Date(59_000))).toBe(1n);
    expect(() => verifyCurrentTotp(totpSecret, '000000', new Date(59_000))).toThrow();

    const key = Buffer.alloc(32, 9);
    const aad = 'society:user:TOTP:v3';
    const encrypted = encryptTotpSecret(totpSecret, key, aad);
    expect(encrypted.nonce).toHaveLength(12);
    expect(encrypted.authTag).toHaveLength(16);

    const decipher = createDecipheriv('aes-256-gcm', key, encrypted.nonce);
    decipher.setAAD(Buffer.from(aad));
    decipher.setAuthTag(encrypted.authTag);
    const plaintext = Buffer.concat([decipher.update(encrypted.ciphertext), decipher.final()]);
    expect(plaintext.toString('utf8')).toBe('12345678901234567890');
  });

  it('emits purpose-bound ADMIN_PASSWORD Argon2id credentials', async () => {
    expect(CREDENTIAL_PEPPER_ENVIRONMENT_VARIABLES).toEqual({
      ADMIN_PASSWORD: 'ADMIN_PASSWORD_PEPPER',
      GUARD_PIN: 'GUARD_PIN_PEPPER',
      RESIDENT_APP_PIN: 'RESIDENT_APP_PIN_PEPPER',
    });
    const pepper = 'admin-password-pepper-with-more-than-32-characters';
    const encoded = await hashCredential('S7rong!Provision-Only#2026', 'ADMIN_PASSWORD', pepper);

    expect(encoded).toMatch(/^argon2id\$v=1\$purpose=ADMIN_PASSWORD\$m=65536,t=3,p=1,l=32\$/);
    await expect(
      verifyCredential('S7rong!Provision-Only#2026', encoded, 'ADMIN_PASSWORD', pepper),
    ).resolves.toBe(true);
    await expect(
      verifyCredential('S7rong!Provision-Only#2026', encoded, 'RESIDENT_APP_PIN', pepper),
    ).resolves.toBe(false);
  });
});
