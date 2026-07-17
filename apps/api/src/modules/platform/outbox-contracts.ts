import { z } from 'zod';

export const OTP_DELIVER_EVENT = 'otp.deliver' as const;
export const NOTIFICATION_DISPATCH_EVENT = 'notification.dispatch' as const;

const base64UrlSchema = z
  .string()
  .min(16)
  .max(32_768)
  .regex(/^[A-Za-z0-9_-]+$/);

export const encryptedPayloadSchema = z
  .object({
    ciphertext: base64UrlSchema,
    iv: base64UrlSchema.max(32),
    tag: base64UrlSchema.max(32),
    version: z.literal(1),
  })
  .strict();

const durableEventBaseSchema = z
  .object({
    aggregateId: z.string().uuid(),
    correlationId: z.string().uuid(),
    societyId: z.string().uuid(),
  })
  .strict();

export const otpDeliverPayloadSchema = durableEventBaseSchema
  .extend({ delivery: encryptedPayloadSchema })
  .strict();

export const notificationDispatchPayloadSchema = durableEventBaseSchema
  .extend({
    body: z.string().trim().min(1).max(4_000),
    category: z.string().trim().min(1).max(80),
    deliveryId: z.string().uuid(),
    endpointId: z.string().uuid(),
    notificationId: z.string().uuid(),
    title: z.string().trim().min(1).max(200),
  })
  .strict();

const FORBIDDEN_OUTBOX_KEYS = new Set([
  'apikey',
  'authorization',
  'endpointtoken',
  'password',
  'pin',
  'plaintextcode',
  'providertoken',
  'pushtoken',
  'refreshtoken',
  'secret',
]);

export function assertSafeOutboxPayload(eventType: string, payload: Record<string, unknown>): void {
  assertNoForbiddenKeys(payload);

  if (eventType === OTP_DELIVER_EVENT) {
    otpDeliverPayloadSchema.parse(payload);
  } else if (eventType === NOTIFICATION_DISPATCH_EVENT) {
    notificationDispatchPayloadSchema.parse(payload);
  }
}

function assertNoForbiddenKeys(value: unknown): void {
  if (Array.isArray(value)) {
    value.forEach(assertNoForbiddenKeys);
    return;
  }
  if (!value || typeof value !== 'object') {
    return;
  }

  for (const [key, nested] of Object.entries(value)) {
    const normalized = key.replace(/[^A-Za-z0-9]/g, '').toLowerCase();
    if (FORBIDDEN_OUTBOX_KEYS.has(normalized)) {
      throw new Error(`Outbox payload contains forbidden sensitive field: ${key}`);
    }
    assertNoForbiddenKeys(nested);
  }
}
