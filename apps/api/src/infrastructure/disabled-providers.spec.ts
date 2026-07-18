import { describe, expect, it } from 'vitest';

import { DisabledOtpProvider } from './otp/disabled-otp.provider.js';
import { DisabledPushProvider } from './push/disabled-push.provider.js';

describe('disabled delivery providers', () => {
  it('never fabricates OTP delivery success', async () => {
    await expect(
      new DisabledOtpProvider().send({
        challengeId: '019f7100-0000-7000-8000-000000000001',
        expiresAt: new Date(Date.now() + 300_000),
        phoneE164: '+919876543210',
        plaintextCode: '482193',
        purpose: 'SIGN_IN',
      }),
    ).rejects.toMatchObject({ name: 'OTP_DELIVERY_DISABLED' });
  });

  it('never fabricates push delivery success', async () => {
    await expect(
      new DisabledPushProvider().send({
        body: 'A visitor is waiting.',
        category: 'VISITOR_APPROVAL',
        data: {},
        dedupeKey: 'visitor:approval:1',
        recipientEndpoint: 'private-endpoint',
        title: 'Visitor approval',
      }),
    ).rejects.toMatchObject({ name: 'PUSH_DELIVERY_DISABLED' });
  });
});
