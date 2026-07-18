import { describe, expect, it } from 'vitest';

import { parseWorkerEnvironment } from './config.js';

function environment(overrides: Record<string, string | undefined> = {}): NodeJS.ProcessEnv {
  return {
    APP_ENV: 'test',
    CLAMAV_HOST: 'clamav',
    DATABASE_URL: 'postgresql://worker:password@localhost:5432/manglam',
    ENCRYPTION_KEY: 'test-encryption-key-at-least-32-characters',
    EXPO_ACCESS_TOKEN: 'expo-access-token-at-least-twenty',
    MSG91_AUTH_KEY: 'msg91-auth-key-long-enough',
    MSG91_TEMPLATE_ID: 'template-1',
    OTP_PROVIDER: 'msg91',
    PUSH_PROVIDERS: 'expo',
    REDIS_PREFIX: 'manglam',
    REDIS_URL: 'redis://localhost:6379',
    S3_ACCESS_KEY_ID: 'access',
    S3_BUCKET: 'private-files',
    S3_ENDPOINT: 'http://localhost:9000',
    S3_REGION: 'ap-south-1',
    S3_SECRET_ACCESS_KEY: 'secret-access-key',
    UPLOAD_ALLOWED_MIME_TYPES: 'image/jpeg,application/pdf',
    WORKER_ID: 'worker-test',
    ...overrides,
  };
}

describe('parseWorkerEnvironment', () => {
  it('validates selected OTP credentials in test environments', () => {
    expect(() => parseWorkerEnvironment(environment({ MSG91_AUTH_KEY: undefined }))).toThrow(
      'MSG91 requires',
    );
    expect(() =>
      parseWorkerEnvironment(
        environment({
          MSG91_AUTH_KEY: undefined,
          MSG91_TEMPLATE_ID: undefined,
          OTP_PROVIDER: 'twilio',
        }),
      ),
    ).toThrow('Twilio requires');
  });

  it('validates credentials for every explicitly configured push provider', () => {
    expect(() => parseWorkerEnvironment(environment({ EXPO_ACCESS_TOKEN: undefined }))).toThrow(
      'Expo push delivery',
    );
    expect(() => parseWorkerEnvironment(environment({ PUSH_PROVIDERS: 'fcm' }))).toThrow(
      'FCM push delivery',
    );
  });

  it('accepts complete MSG91 and Expo configuration', () => {
    const parsed = parseWorkerEnvironment(environment());
    expect(parsed.OTP_PROVIDER).toBe('msg91');
    expect(parsed.PUSH_PROVIDERS).toEqual(['expo']);
  });

  it('requires an explicit unambiguous PostgreSQL TLS mode in production', () => {
    const production = {
      APP_ENV: 'production',
      REDIS_URL: 'rediss://redis.internal:6379',
      S3_ENDPOINT: 'https://objects.internal',
    };
    expect(() =>
      parseWorkerEnvironment(
        environment({
          ...production,
          DATABASE_URL:
            'postgresql://worker:password@db.internal:5432/manglam?options=sslmode=require',
        }),
      ),
    ).toThrow('Production PostgreSQL must require TLS');
    expect(() =>
      parseWorkerEnvironment(
        environment({
          ...production,
          DATABASE_URL:
            'postgresql://worker:password@db.internal:5432/manglam?sslmode=require&sslmode=disable',
        }),
      ),
    ).toThrow('Production PostgreSQL must require TLS');
    expect(() =>
      parseWorkerEnvironment(
        environment({
          ...production,
          DATABASE_URL: 'postgresql://worker:password@db.internal:5432/manglam?sslmode=verify-full',
        }),
      ),
    ).not.toThrow();
  });
});
