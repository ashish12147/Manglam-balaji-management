import { randomUUID } from 'node:crypto';

import type { NextFunction, Request, Response } from 'express';

export const CORRELATION_ID_HEADER = 'x-correlation-id';
const correlationIdPattern = /^[A-Za-z0-9._:-]{8,128}$/;

export interface RequestWithCorrelationId extends Request {
  correlationId: string;
}

export function normalizeCorrelationId(value: string | string[] | undefined): string {
  const candidate = Array.isArray(value) ? value[0] : value;
  return candidate && correlationIdPattern.test(candidate) ? candidate : randomUUID();
}

export function correlationIdMiddleware(
  request: Request,
  response: Response,
  next: NextFunction,
): void {
  const correlationId = normalizeCorrelationId(request.headers[CORRELATION_ID_HEADER]);
  (request as RequestWithCorrelationId).correlationId = correlationId;
  response.setHeader(CORRELATION_ID_HEADER, correlationId);
  next();
}
