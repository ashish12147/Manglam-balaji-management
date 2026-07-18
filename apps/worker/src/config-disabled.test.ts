import { describe, expect, it } from 'vitest';

import { parseWorkerEnvironment } from './config.js';

const base = {
  APP_ENV: 'test',
  CLAMAV_HOST: 'clamav',
  DATABASE_URL: 'postgresql://worker:password@localhost:5432/manglam',
  ENCRYPTION_KEY: 'test-encryption-key-at-least-32-characters',
  OTP_PROVIDER: 'disabled',
  PUSH_PROVIDERS: '',
  REDIS_PREFIX: 'manglam',
  REDIS_URL: 'redis://localhost:6379',
  S3_ACCESS_KEY_ID: 'access',
  S3_BUCKET: 'private-files',
  S3_ENDPOINT: 'http://localhost:9000',
  S3_REGION: 'ap-south-1',
  S3_SECRET_ACCESS_KEY: 'secret-access-key',
  UPLOAD_ALLOWED_MIME_TYPES: 'image/jpeg',
  WORKER_ID: 'worker-test',
};

describe('disabled non-production delivery configuration', () => {
  it('permits file and scheduled workers with no SMS or push credentials', () => {
    const parsed = parseWorkerEnvironment(base);
    expect(parsed.OTP_PROVIDER).toBe('disabled');
    expect(parsed.PUSH_PROVIDERS).toEqual([]);
  });

  it('forbids disabled delivery configuration in production', () => {
    expect(() =>
      parseWorkerEnvironment({
        ...base,
        APP_ENV: 'production',
        DATABASE_URL: 'postgresql://worker:password@db:5432/manglam?sslmode=require',
        REDIS_URL: 'rediss://redis:6379',
        S3_ENDPOINT: 'https://objects.example.test',
      }),
    ).toThrow('Production requires');
  });
});
