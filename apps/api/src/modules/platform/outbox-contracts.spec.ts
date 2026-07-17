import { describe, expect, it } from 'vitest';

import {
  NOTIFICATION_DISPATCH_EVENT,
  OTP_DELIVER_EVENT,
  assertSafeOutboxPayload,
  notificationDispatchPayloadSchema,
  otpDeliverPayloadSchema,
} from './outbox-contracts.js';

const base = {
  aggregateId: '6af8885f-e1ce-4b87-9b2c-7b0a6211798a',
  correlationId: '8bf8e289-64dd-4a7d-bf1d-cad5db5708b0',
  societyId: 'e169de7b-834c-43f0-9626-8f5cbbe9f30f',
};

describe('outbox security contracts', () => {
  it('accepts OTP delivery only as an encrypted delivery envelope', () => {
    const payload = {
      ...base,
      delivery: {
        ciphertext: 'x'.repeat(32),
        iv: 'a'.repeat(16),
        tag: 'b'.repeat(22),
        version: 1 as const,
      },
    };

    expect(otpDeliverPayloadSchema.parse(payload)).toEqual(payload);
    expect(() => assertSafeOutboxPayload(OTP_DELIVER_EVENT, payload)).not.toThrow();
  });

  it.each(['plaintextCode', 'phoneE164', 'providerToken', 'apiKey'])(
    'rejects OTP top-level field %s',
    (field) => {
      expect(() =>
        assertSafeOutboxPayload(OTP_DELIVER_EVENT, {
          ...base,
          delivery: {
            ciphertext: 'x'.repeat(32),
            iv: 'a'.repeat(16),
            tag: 'b'.repeat(22),
            version: 1,
          },
          [field]: 'must-not-leak',
        }),
      ).toThrow();
    },
  );

  it('accepts a society-bound notification dispatch without an endpoint token', () => {
    const payload = {
      ...base,
      body: 'A visitor is waiting at the main gate.',
      category: 'VISITOR_APPROVAL',
      deliveryId: 'b3eab864-4fef-49f0-9ee3-d8f9508fc96e',
      endpointId: 'd5088b54-d6f8-4f38-917d-25912aa20934',
      notificationId: 'e4a06621-5874-4e6a-9147-a2d45cc3675a',
      title: 'Visitor approval',
    };

    expect(notificationDispatchPayloadSchema.parse(payload)).toEqual(payload);
    expect(() => assertSafeOutboxPayload(NOTIFICATION_DISPATCH_EVENT, payload)).not.toThrow();
  });

  it.each(['pushToken', 'providerToken', 'encryptedToken', 'secret'])(
    'rejects notification credential field %s',
    (field) => {
      expect(() =>
        assertSafeOutboxPayload(NOTIFICATION_DISPATCH_EVENT, {
          ...base,
          body: 'Body',
          category: 'GENERAL',
          deliveryId: 'b3eab864-4fef-49f0-9ee3-d8f9508fc96e',
          endpointId: 'd5088b54-d6f8-4f38-917d-25912aa20934',
          notificationId: 'e4a06621-5874-4e6a-9147-a2d45cc3675a',
          title: 'Title',
          [field]: 'must-not-leak',
        }),
      ).toThrow();
    },
  );
});
