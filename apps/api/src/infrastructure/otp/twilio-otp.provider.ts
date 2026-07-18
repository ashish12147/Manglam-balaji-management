import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type {
  OtpDeliveryProvider,
  OtpDeliveryReceipt,
  OtpDeliveryRequest,
} from '../../common/providers/otp-delivery.provider.js';
import type { AppEnvironment } from '../../config/env.schema.js';

interface TwilioMessageResponse {
  sid?: unknown;
  status?: unknown;
}

@Injectable()
export class TwilioOtpProvider implements OtpDeliveryProvider {
  private readonly accountSid: string;
  private readonly authToken: string;
  private readonly messageTemplate: string;
  private readonly messagingServiceSid: string;
  private readonly timeoutMs: number;

  constructor(config: ConfigService<AppEnvironment, true>) {
    this.accountSid = config.get('TWILIO_ACCOUNT_SID', { infer: true }) ?? '';
    this.authToken = config.get('TWILIO_AUTH_TOKEN', { infer: true }) ?? '';
    this.messagingServiceSid = config.get('TWILIO_MESSAGING_SERVICE_SID', { infer: true }) ?? '';
    this.messageTemplate = config.get('OTP_MESSAGE_TEMPLATE', { infer: true });
    this.timeoutMs = config.get('OTP_HTTP_TIMEOUT_MS', { infer: true });
  }

  async send(request: OtpDeliveryRequest): Promise<OtpDeliveryReceipt> {
    this.requireConfiguration();

    const minutes = Math.max(1, Math.ceil((request.expiresAt.getTime() - Date.now()) / 60_000));
    const body = this.messageTemplate
      .replaceAll('{{code}}', request.plaintextCode)
      .replaceAll('{{minutes}}', String(minutes));
    const payload = new URLSearchParams({
      Body: body,
      MessagingServiceSid: this.messagingServiceSid,
      To: request.phoneE164,
    });
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(this.accountSid)}/Messages.json`,
      {
        body: payload,
        headers: {
          Authorization: `Basic ${Buffer.from(`${this.accountSid}:${this.authToken}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        method: 'POST',
        signal: AbortSignal.timeout(this.timeoutMs),
      },
    );
    const result = (await response.json().catch(() => ({}))) as TwilioMessageResponse;

    if (!response.ok || typeof result.sid !== 'string') {
      throw new Error(`Twilio rejected the OTP delivery request with HTTP ${response.status}.`);
    }

    return {
      providerMessageId: result.sid,
      queuedAt: new Date(),
    };
  }

  private requireConfiguration(): void {
    if (
      !/^AC[0-9a-f]{32}$/i.test(this.accountSid) ||
      this.authToken.length < 20 ||
      !/^MG[0-9a-f]{32}$/i.test(this.messagingServiceSid)
    ) {
      throw new Error('Twilio OTP delivery is not configured.');
    }
  }
}
