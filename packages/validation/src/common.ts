import { z } from 'zod';

import { apiErrorCodeSchema } from './enums.js';

export const uuidSchema = z.string().uuid();
export const correlationIdSchema = uuidSchema;
export const isoDateTimeSchema = z.string().datetime({ offset: true });
export const e164PhoneSchema = z.string().regex(/^\+[1-9]\d{7,14}$/, 'Use an E.164 phone number.');
export const deviceNonceSchema = z.string().min(16).max(128);
export const idempotencyKeySchema = z
  .string()
  .min(16)
  .max(128)
  .regex(/^[A-Za-z0-9._:-]+$/, 'Idempotency keys may contain only safe visible characters.');
export const secureDigestSchema = z.string().regex(/^[a-f0-9]{64}$/i);
export const shortCodeSchema = z.string().regex(/^[A-HJ-NP-Z2-9]{10}$/);
export const otpCodeSchema = z.string().regex(/^\d{6}$/);
export const reasonSchema = z.string().trim().min(3).max(500);
export const shortTextSchema = z.string().trim().min(1).max(160);
export const longTextSchema = z.string().trim().min(1).max(5_000);
export const versionSchema = z.number().int().nonnegative();
export const sequenceSchema = z.number().int().positive().safe();
export const minorMoneySchema = z.number().int().nonnegative().safe();

export const cursorQuerySchema = z
  .object({
    cursor: z.string().min(1).max(512).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(25),
    search: z.string().trim().min(1).max(100).optional(),
    sortDirection: z.enum(['asc', 'desc']).default('desc'),
  })
  .strict();

export const apiErrorSchema = z
  .object({
    error: z
      .object({
        code: apiErrorCodeSchema,
        message: z.string().min(1).max(500),
        details: z.record(z.string(), z.unknown()),
        correlationId: correlationIdSchema,
        retryable: z.boolean(),
      })
      .strict(),
  })
  .strict();
