import { createCipheriv, createHash, randomBytes } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { SensitivePayloadCipher, type EncryptedPayload } from './sensitive-payload-cipher.js';

const secret = 'worker-test-encryption-key-with-32-characters';

function encrypt(value: unknown): EncryptedPayload {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', createHash('sha256').update(secret).digest(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(Buffer.from(JSON.stringify(value), 'utf8')),
    cipher.final(),
  ]);
  return {
    ciphertext: ciphertext.toString('base64url'),
    iv: iv.toString('base64url'),
    tag: cipher.getAuthTag().toString('base64url'),
    version: 1,
  };
}

describe('SensitivePayloadCipher', () => {
  it('decrypts the exact API AES-256-GCM envelope', () => {
    const value = { challengeId: 'challenge', plaintextCode: '123456' };
    expect(new SensitivePayloadCipher(secret).decrypt(encrypt(value))).toEqual(value);
  });

  it('accepts a serialized envelope for encrypted database text columns', () => {
    expect(
      new SensitivePayloadCipher(secret).decrypt(JSON.stringify(encrypt('ExpoPushToken[x]'))),
    ).toBe('ExpoPushToken[x]');
  });

  it('fails closed for tampered or malformed envelopes', () => {
    const envelope = encrypt({ plaintextCode: '123456' });
    expect(() =>
      new SensitivePayloadCipher(secret).decrypt({
        ...envelope,
        ciphertext: `${envelope.ciphertext}A`,
      }),
    ).toThrow('authentication failed');
    expect(() => new SensitivePayloadCipher(secret).decrypt({ plaintextCode: '123456' })).toThrow();
  });
});
