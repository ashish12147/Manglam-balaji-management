import { describe, expect, it } from 'vitest';

import { parseEnvironment } from './env.schema.js';

const secret = 'a-very-long-development-secret-value-123456789';

function validEnvironment(overrides: Record<string, string> = {}): NodeJS.ProcessEnv {
  return {
    ADMIN_PASSWORD_PEPPER: `admin-${secret}`,
    ADMIN_WEB_URL: 'http://127.0.0.1:3000',
    APP_ENV: 'test',
    COOKIE_SECRET: secret,
    CORS_ORIGINS: 'http://127.0.0.1:3000',
    DATABASE_URL: 'postgresql://test:test@127.0.0.1:5432/manglam_test',
    ENCRYPTION_KEY: secret,
    GUARD_PIN_PEPPER: `guard-${secret}`,
    JWT_AUDIENCE: 'manglam-clients',
    JWT_ISSUER: 'manglam-api',
    JWT_PRIVATE_KEY: secret,
    JWT_PUBLIC_KEY: secret,
    NODE_ENV: 'test',
    OTP_HMAC_SECRET: secret,
    OTP_PROVIDER: 'disabled',
    PUBLIC_API_URL: 'http://127.0.0.1:4000/api/v1',
    PUSH_PROVIDER: 'disabled',
    REDIS_PREFIX: 'manglam:test',
    REDIS_URL: 'redis://127.0.0.1:6379/15',
    REFRESH_TOKEN_PEPPER: secret,
    RESIDENT_APP_PIN_PEPPER: `resident-${secret}`,
    S3_ACCESS_KEY_ID: 'test-access-key',
    S3_BUCKET: 'manglam-test',
    S3_ENDPOINT: 'http://127.0.0.1:9000',
    S3_REGION: 'ap-south-1',
    S3_SECRET_ACCESS_KEY: 'test-secret-key',
    VISITOR_CODE_HMAC_SECRET: secret,
    WS_ORIGINS: 'http://127.0.0.1:3000',
    ...overrides,
  };
}

describe('parseEnvironment', () => {
  it('normalizes typed configuration values', () => {
    const environment = parseEnvironment(
      validEnvironment({
        CORS_ORIGINS: 'http://127.0.0.1:3000, http://localhost:3000',
        PORT: '4100',
        TRUST_PROXY: 'true',
      }),
    );

    expect(environment.PORT).toBe(4100);
    expect(environment.TRUST_PROXY).toBe(true);
    expect(environment.CORS_ORIGINS).toEqual(['http://127.0.0.1:3000', 'http://localhost:3000']);
  });

  it('requires credentials for every selected delivery provider', () => {
    expect(() => parseEnvironment(validEnvironment({ OTP_PROVIDER: 'msg91' }))).toThrow(/MSG91/);
    expect(() => parseEnvironment(validEnvironment({ PUSH_PROVIDER: 'expo' }))).toThrow(/Expo/);
    expect(() => parseEnvironment(validEnvironment({ OTP_PROVIDER: 'twilio' }))).toThrow(/Twilio/);
    expect(() => parseEnvironment(validEnvironment({ PUSH_PROVIDER: 'fcm' }))).toThrow(/FCM/);
  });

  it('rejects reused credential peppers', () => {
    const same = 'same-purpose-pepper-material-1234567890';
    expect(() =>
      parseEnvironment(
        validEnvironment({
          ADMIN_PASSWORD_PEPPER: same,
          GUARD_PIN_PEPPER: same,
        }),
      ),
    ).toThrow(/distinct/);
  });

  it('rejects disabled delivery providers in production', () => {
    expect(() =>
      parseEnvironment(
        validEnvironment({
          ADMIN_WEB_URL: 'https://admin.example.com',
          APP_ENV: 'production',
          CORS_ORIGINS: 'https://admin.example.com',
          NODE_ENV: 'production',
          PUBLIC_API_URL: 'https://api.example.com/api/v1',
          WS_ORIGINS: 'https://admin.example.com',
        }),
      ),
    ).toThrow(/OTP_PROVIDER/);
  });

  it('rejects public docs and plaintext dependencies in production', () => {
    const production = {
      ADMIN_WEB_URL: 'https://admin.example.com',
      APP_ENV: 'production',
      CORS_ORIGINS: 'https://admin.example.com',
      DATABASE_URL: 'postgresql://app:secret@database.example.com:5432/manglam?sslmode=require',
      EXPO_ACCESS_TOKEN: 'a-secure-expo-access-token',
      MSG91_AUTH_KEY: 'a-secure-msg91-auth-key',
      MSG91_TEMPLATE_ID: 'approved-template',
      NODE_ENV: 'production',
      OTP_PROVIDER: 'msg91',
      PUBLIC_API_URL: 'https://api.example.com/api/v1',
      PUSH_PROVIDER: 'expo',
      REDIS_URL: 'rediss://redis.example.com:6380/0',
      S3_ENDPOINT: 'https://storage.example.com',
      WS_ORIGINS: 'https://admin.example.com',
    };

    expect(() =>
      parseEnvironment(validEnvironment({ ...production, API_DOCS_ENABLED: 'true' })),
    ).toThrow(/API_DOCS_ENABLED/);
    expect(() =>
      parseEnvironment(
        validEnvironment({
          ...production,
          REDIS_URL: 'redis://redis.example.com:6379/0',
        }),
      ),
    ).toThrow(/REDIS_URL/);
  });

  it('reports invalid secret fields without echoing their values', () => {
    const unsafeValue = 'short-secret';
    expect(() => parseEnvironment(validEnvironment({ COOKIE_SECRET: unsafeValue }))).toThrow(
      /COOKIE_SECRET/,
    );

    try {
      parseEnvironment(validEnvironment({ COOKIE_SECRET: unsafeValue }));
    } catch (error) {
      expect(String(error)).not.toContain(unsafeValue);
    }
  });
});
