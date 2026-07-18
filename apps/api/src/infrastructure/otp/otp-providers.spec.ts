import { describe, expect, it, vi } from 'vitest';

import type { OtpDeliveryRequest } from '../../common/providers/otp-delivery.provider.js';
import { DisabledOtpProvider } from './disabled-otp.provider.js';
import { Msg91OtpProvider } from './msg91-otp.provider.js';
import { TwilioOtpProvider } from './twilio-otp.provider.js';

const request: OtpDeliveryRequest = {
  challengeId: '019f7100-0000-7000-8000-000000000001',
  expiresAt: new Date(Date.now() + 300_000),
  phoneE164: '+919876543210',
  plaintextCode: '482193',
  purpose: 'SIGN_IN',
};

function config(values: Record<string, unknown>) {
  return { get: vi.fn((key: string) => values[key]) };
}

describe('OTP delivery providers', () => {
  it('never fabricates success when OTP delivery is disabled', async () => {
    await expect(new DisabledOtpProvider().send(request)).rejects.toMatchObject({
      name: 'OTP_DELIVERY_DISABLED',
    });
  });

  it('sends server-generated codes through the documented MSG91 flow endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: vi.fn().mockResolvedValue({ request_id: 'msg91-request', type: 'success' }),
      ok: true,
      status: 200,
    });
    vi.stubGlobal('fetch', fetchMock);
    const provider = new Msg91OtpProvider(
      config({
        MSG91_AUTH_KEY: 'auth-key-with-enough-characters',
        MSG91_TEMPLATE_ID: 'template-id',
        OTP_HTTP_TIMEOUT_MS: 5_000,
      }) as never,
    );

    await expect(provider.send(request)).resolves.toMatchObject({
      providerMessageId: 'msg91-request',
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://control.msg91.com/api/v5/flow',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('fails closed when Twilio returns a malformed success response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        json: vi.fn().mockResolvedValue({ status: 'queued' }),
        ok: true,
        status: 201,
      }),
    );
    const provider = new TwilioOtpProvider(
      config({
        OTP_HTTP_TIMEOUT_MS: 5_000,
        OTP_MESSAGE_TEMPLATE: 'Code {{code}} expires in {{minutes}} minutes.',
        TWILIO_ACCOUNT_SID: `AC${'a'.repeat(32)}`,
        TWILIO_AUTH_TOKEN: 'a-secure-auth-token-value',
        TWILIO_MESSAGING_SERVICE_SID: `MG${'b'.repeat(32)}`,
      }) as never,
    );

    await expect(provider.send(request)).rejects.toThrow(/malformed|rejected/i);
  });
});
