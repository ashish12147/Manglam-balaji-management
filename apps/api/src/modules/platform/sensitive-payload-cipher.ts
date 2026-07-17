import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'node:crypto';

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { AppEnvironment } from '../../config/env.schema.js';

interface EncryptedPayload {
  readonly ciphertext: string;
  readonly iv: string;
  readonly tag: string;
  readonly version: 1;
}

function isEncryptedPayload(value: unknown): value is EncryptedPayload {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const item = value as Partial<EncryptedPayload>;
  return (
    item.version === 1 &&
    typeof item.ciphertext === 'string' &&
    typeof item.iv === 'string' &&
    typeof item.tag === 'string'
  );
}

@Injectable()
export class SensitivePayloadCipher {
  private readonly key: Buffer;

  constructor(config: ConfigService<AppEnvironment, true>) {
    this.key = createHash('sha256')
      .update(config.get('ENCRYPTION_KEY', { infer: true }), 'utf8')
      .digest();
  }

  encrypt(value: unknown): EncryptedPayload {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const plaintext = Buffer.from(JSON.stringify(value), 'utf8');
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);

    return {
      ciphertext: ciphertext.toString('base64url'),
      iv: iv.toString('base64url'),
      tag: cipher.getAuthTag().toString('base64url'),
      version: 1,
    };
  }

  decrypt<T>(value: unknown): T {
    if (!isEncryptedPayload(value)) {
      throw new Error('Stored idempotency response is not a supported encrypted payload.');
    }

    const decipher = createDecipheriv(
      'aes-256-gcm',
      this.key,
      Buffer.from(value.iv, 'base64url'),
    );
    decipher.setAuthTag(Buffer.from(value.tag, 'base64url'));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(value.ciphertext, 'base64url')),
      decipher.final(),
    ]);

    return JSON.parse(plaintext.toString('utf8')) as T;
  }
}
