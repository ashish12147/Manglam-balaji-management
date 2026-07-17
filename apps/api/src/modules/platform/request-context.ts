import { randomUUID } from 'node:crypto';

import type { Request } from 'express';

import type { RequestWithCorrelationId } from '../../common/http/correlation-id.middleware.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface MutationRequestContext {
  readonly correlationId: string;
  readonly databaseCorrelationId: string;
  readonly idempotencyKey: string;
  readonly ipAddress: string | null;
  readonly userAgent: string | null;
}

export function requestCorrelationId(request: Request): string {
  return (request as RequestWithCorrelationId).correlationId ?? randomUUID();
}

export function databaseCorrelationId(correlationId: string): string {
  return UUID_PATTERN.test(correlationId) ? correlationId : randomUUID();
}

export function mutationRequestContext(request: Request): MutationRequestContext {
  const correlationId = requestCorrelationId(request);
  const idempotencyHeader = request.headers['idempotency-key'];
  const idempotencyKey = Array.isArray(idempotencyHeader)
    ? idempotencyHeader[0]
    : idempotencyHeader;

  return {
    correlationId,
    databaseCorrelationId: databaseCorrelationId(correlationId),
    idempotencyKey: idempotencyKey ?? '',
    ipAddress: request.ip || null,
    userAgent: request.get('user-agent') ?? null,
  };
}
