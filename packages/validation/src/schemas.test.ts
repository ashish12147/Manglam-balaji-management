import { describe, expect, it } from 'vitest';

import {
  apiErrorSchema,
  e164PhoneSchema,
  notificationPreferenceSchema,
  offlineMutationSchema,
  otpVerifySchema,
  paymentTransitionCommandSchema,
  visitStatusSchema,
  visitTransitionCommandSchema,
} from './index.js';

const id = '019f7097-2547-7e61-9c4b-0373af2333a5';
const occurredAt = '2026-07-17T10:30:00.000Z';

describe('shared validation', () => {
  it('accepts only E.164 phone numbers and exact enum values', () => {
    expect(e164PhoneSchema.safeParse('+919876543210').success).toBe(true);
    expect(e164PhoneSchema.safeParse('9876543210').success).toBe(false);
    expect(visitStatusSchema.safeParse('CHECKED_IN').success).toBe(true);
    expect(visitStatusSchema.safeParse('checked_in').success).toBe(false);
  });

  it('rejects unknown OTP fields to block mass assignment', () => {
    const parsed = otpVerifySchema.safeParse({
      challengeId: id,
      phone: '+919876543210',
      purpose: 'LOGIN',
      deviceNonce: 'device-nonce-with-entropy',
      code: '123456',
      role: 'SUPER_ADMIN',
    });

    expect(parsed.success).toBe(false);
  });

  it('requires a reason for visitor overrides', () => {
    const parsed = visitTransitionCommandSchema.safeParse({
      current: 'REJECTED',
      target: 'APPROVED',
      mode: 'OVERRIDE',
      actorId: id,
      hasOverridePermission: true,
      recentAuthentication: true,
      occurredAt,
      expectedVersion: 3,
      idempotencyKey: 'visit:override:019f7097',
    });

    expect(parsed.success).toBe(false);
  });

  it('requires payment references for traceable non-cash methods', () => {
    const parsed = paymentTransitionCommandSchema.safeParse({
      current: 'PENDING_VERIFICATION',
      target: 'CONFIRMED',
      method: 'UPI',
      source: 'MANUAL',
      amountMinor: 50_000,
      occurredAt,
    });

    expect(parsed.success).toBe(false);
  });

  it('rejects duplicate notification channels', () => {
    expect(
      notificationPreferenceSchema.safeParse({
        category: 'NOTICE',
        enabledChannels: ['IN_APP', 'IN_APP'],
      }).success,
    ).toBe(false);
  });

  it('validates signed offline mutation envelopes without deciding policy', () => {
    const parsed = offlineMutationSchema.safeParse({
      clientMutationId: id,
      deviceId: '019f7097-2547-7e61-9c4b-0373af2333a6',
      gateId: '019f7097-2547-7e61-9c4b-0373af2333a7',
      operation: 'RESIDENT_VISITOR_APPROVAL',
      aggregateId: '019f7097-2547-7e61-9c4b-0373af2333a8',
      localSequence: 12,
      baseVersion: 2,
      clientOccurredAt: occurredAt,
      payload: { decision: 'APPROVED' },
      payloadHash: 'a'.repeat(64),
      signature: 'b'.repeat(64),
    });

    expect(parsed.success).toBe(true);
  });

  it('matches the public API error envelope and rejects leaked fields', () => {
    const valid = {
      error: {
        code: 'PERMISSION_DENIED',
        message: 'You do not have access to this resource.',
        details: {},
        correlationId: id,
        retryable: false,
      },
    };

    expect(apiErrorSchema.safeParse(valid).success).toBe(true);
    expect(
      apiErrorSchema.safeParse({
        ...valid,
        error: { ...valid.error, stack: 'database internals' },
      }).success,
    ).toBe(false);
  });
});
