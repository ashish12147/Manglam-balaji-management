import { describe, expect, it } from 'vitest';

import { WorkerConfigurationError } from '../errors.js';
import { errorCode } from '../retry.js';
import { DisabledExpoReceiptProvider, DisabledOtpDeliveryProvider } from './disabled-delivery.js';

describe('disabled delivery adapters', () => {
  it('never fabricates OTP delivery success', async () => {
    const failure = new DisabledOtpDeliveryProvider().send({
      challengeId: '00000000-0000-4000-8000-000000000001',
      expiresAt: new Date('2030-01-01T00:00:00Z'),
      phoneE164: '+919876543210',
      plaintextCode: '123456',
      purpose: 'SIGN_IN',
    });

    await expect(failure).rejects.toBeInstanceOf(WorkerConfigurationError);
    await expect(failure).rejects.toMatchObject({
      code: 'WORKER_CONFIGURATION_ERROR',
    });
  });

  it('never fabricates Expo receipt success', async () => {
    const failure = new DisabledExpoReceiptProvider().get('ticket-12345');

    await expect(failure).rejects.toBeInstanceOf(WorkerConfigurationError);
    await expect(failure).rejects.toSatisfy(
      (error: unknown) => errorCode(error) === 'WORKER_CONFIGURATION_ERROR',
    );
  });
});
