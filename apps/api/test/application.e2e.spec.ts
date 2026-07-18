import type { INestApplication } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { ApiExceptionFilter } from '../src/common/http/api-exception.filter.js';
import { correlationIdMiddleware } from '../src/common/http/correlation-id.middleware.js';

const secret = 'a-very-long-development-secret-value-123456789';

describe('API platform', () => {
  let app: INestApplication;

  beforeAll(async () => {
    Object.assign(process.env, {
      ADMIN_WEB_URL: 'http://127.0.0.1:3000',
      APP_ENV: 'test',
      ADMIN_PASSWORD_PEPPER: `admin-${secret}`,
      GUARD_PIN_PEPPER: `guard-${secret}`,
      RESIDENT_APP_PIN_PEPPER: `resident-${secret}`,
      APP_VERSION: 'test',
      COOKIE_SECRET: secret,
      CORS_ORIGINS: 'http://127.0.0.1:3000',
      DATABASE_URL: 'postgresql://test:test@127.0.0.1:5432/manglam_test',
      DB_CONNECTION_TIMEOUT_MS: '100',
      ENCRYPTION_KEY: secret,
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
      REDIS_CONNECT_TIMEOUT_MS: '100',
      REDIS_URL: 'redis://127.0.0.1:6379/15',
      REFRESH_TOKEN_PEPPER: secret,
      S3_ACCESS_KEY_ID: 'test-access-key',
      S3_BUCKET: 'manglam-test',
      S3_ENDPOINT: 'http://127.0.0.1:9000',
      S3_REGION: 'ap-south-1',
      S3_SECRET_ACCESS_KEY: 'test-secret-key',
      VISITOR_CODE_HMAC_SECRET: secret,
      WS_ORIGINS: 'http://127.0.0.1:3000',
    });

    const { AppModule } = await import('../src/app.module.js');
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.use(correlationIdMiddleware);
    app.useGlobalFilters(new ApiExceptionFilter(app.get(HttpAdapterHost)));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('serves a live process probe', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/health/live').expect(200);

    expect(response.body).toMatchObject({
      status: 'ok',
      version: 'test',
    });
    expect(response.headers['x-correlation-id']).toMatch(/^[0-9a-f-]{36}$/i);
  });

  it('fails readiness closed until real database and Redis checks register', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/health/ready')
      .set('x-correlation-id', 'readiness-test-request')
      .expect(503);

    expect(response.body).toEqual({
      error: {
        code: 'SERVICE_NOT_READY',
        correlationId: 'readiness-test-request',
        details: {
          checks: [
            {
              details: { reason: 'connection_unavailable' },
              healthy: false,
              name: 'database',
            },
            {
              details: { reason: 'connection_unavailable' },
              healthy: false,
              name: 'redis',
            },
          ],
        },
        message: 'Required dependencies are unavailable.',
      },
    });
  });
});
