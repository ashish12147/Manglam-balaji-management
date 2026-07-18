import { createDecipheriv, createHash } from 'node:crypto';

import { z } from 'zod';

export const encryptedPayloadSchema = z
  .object({
    ciphertext: z.string().min(1).max(32768),
    iv: z.string().min(16).max(32),
    tag: z.string().min(16).max(32),
    version: z.literal(1),
  })
  .strict();

export type EncryptedPayload = z.infer<typeof encryptedPayloadSchema>;

export class SensitivePayloadCipher {
  private readonly key: Buffer;

  constructor(secret: string) {
    if (secret.length < 32) throw new Error('ENCRYPTION_KEY must contain at least 32 characters.');
    this.key = createHash('sha256').update(secret, 'utf8').digest();
  }

  decrypt<T>(input: unknown): T {
    const envelope = encryptedPayloadSchema.parse(
      typeof input === 'string' ? this.parseEnvelope(input) : input,
    );
    try {
      const decipher = createDecipheriv(
        'aes-256-gcm',
        this.key,
        Buffer.from(envelope.iv, 'base64url'),
      );
      decipher.setAuthTag(Buffer.from(envelope.tag, 'base64url'));
      const plaintext = Buffer.concat([
        decipher.update(Buffer.from(envelope.ciphertext, 'base64url')),
        decipher.final(),
      ]);
      return JSON.parse(plaintext.toString('utf8')) as T;
    } catch {
      throw new Error('Encrypted payload authentication failed.');
    }
  }

  private parseEnvelope(value: string): unknown {
    try {
      return JSON.parse(value) as unknown;
    } catch {
      throw new Error('Encrypted payload is not valid JSON.');
    }
  }
}
