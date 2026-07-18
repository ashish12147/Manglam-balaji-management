import 'reflect-metadata';

import { Logger } from '@nestjs/common';
import { HttpAdapterHost, NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { json, urlencoded } from 'express';
import helmet from 'helmet';

import { AppModule } from './app.module.js';
import { ApiExceptionFilter } from './common/http/api-exception.filter.js';
import {
  CORRELATION_ID_HEADER,
  correlationIdMiddleware,
} from './common/http/correlation-id.middleware.js';
import { parseEnvironment } from './config/env.schema.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    abortOnError: true,
    bodyParser: false,
    bufferLogs: true,
  });
  const environment = parseEnvironment(process.env);

  const express = app.getHttpAdapter().getInstance();
  express.set('trust proxy', environment.TRUST_PROXY ? 1 : false);

  app.enableCors({
    allowedHeaders: [
      'Authorization',
      'Content-Type',
      'Idempotency-Key',
      'If-Match',
      'X-Client',
      'X-Device-Fingerprint',
      'X-Gate-Id',
      'X-Membership-Id',
      CORRELATION_ID_HEADER,
    ],
    credentials: true,
    exposedHeaders: [CORRELATION_ID_HEADER],
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    origin: environment.CORS_ORIGINS,
  });
  app.enableShutdownHooks();
  app.setGlobalPrefix(environment.API_PREFIX.replace(/^\//, ''));
  app.use(cookieParser(environment.COOKIE_SECRET));
  app.use(correlationIdMiddleware);
  app.use(json({ limit: '1mb' }));
  app.use(urlencoded({ extended: false, limit: '64kb' }));
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'same-site' },
      hsts:
        environment.APP_ENV === 'production'
          ? { includeSubDomains: true, maxAge: 31_536_000, preload: true }
          : false,
    }),
  );
  app.useGlobalFilters(new ApiExceptionFilter(app.get(HttpAdapterHost)));

  if (environment.API_DOCS_ENABLED) {
    const openApi = new DocumentBuilder()
      .setTitle('Manglam Balaji Society API')
      .setDescription('Versioned operational API for resident, guard, and administration clients.')
      .setVersion(environment.APP_VERSION)
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, openApi);
    SwaggerModule.setup('docs', app, document, {
      jsonDocumentUrl: 'docs/openapi.json',
    });
  }

  await app.listen(environment.PORT, '0.0.0.0');
  Logger.log(
    `API listening on port ${environment.PORT} with prefix ${environment.API_PREFIX}`,
    'Bootstrap',
  );
}

void bootstrap().catch((error: unknown) => {
  Logger.error(
    error instanceof Error ? error.message : 'The API failed to start.',
    undefined,
    'Bootstrap',
  );
  process.exitCode = 1;
});
