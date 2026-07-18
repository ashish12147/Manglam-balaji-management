import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type {
  OtpDeliveryProvider,
  OtpDeliveryReceipt,
  OtpDeliveryRequest,
} from '../../common/providers/otp-delivery.provider.js';
import type { AppEnvironment } from '../../config/env.schema.js';

interface Msg91Response {
  request_id?: unknown;
  type?: unknown;
}

@Injectable()
export class Msg91OtpProvider implements OtpDeliveryProvider {
  private readonly authKey: string;
  private readonly templateId: string;
  private readonly timeoutMs: number;

  constructor(config: ConfigService<AppEnvironment, true>) {
    this.authKey = config.get('MSG91_AUTH_KEY', { infer: true }) ?? '';
    this.templateId = config.get('MSG91_TEMPLATE_ID', { infer: true }) ?? '';
    this.timeoutMs = config.get('OTP_HTTP_TIMEOUT_MS', { infer: true });
  }

  async send(request: OtpDeliveryRequest): Promise<OtpDeliveryReceipt> {
    if (this.authKey.length < 16 || this.templateId.length < 4) {
      throw new Error('MSG91 OTP delivery is not configured.');
    }

    const response = await fetch('https://control.msg91.com/api/v5/flow', {
      body: JSON.stringify({
        recipients: [
          {
            mobiles: request.phoneE164.replace(/^\+/, ''),
            OTP: request.plaintextCode,
          },
        ],
        template_id: this.templateId,
      }),
      headers: {
        accept: 'application/json',
        authkey: this.authKey,
        'content-type': 'application/json',
      },
      method: 'POST',
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    const result = (await response.json().catch(() => ({}))) as Msg91Response;

    if (!response.ok || result.type === 'error' || typeof result.request_id !== 'string') {
      throw new Error(`MSG91 rejected the OTP delivery request with HTTP ${response.status}.`);
    }

    return {
      providerMessageId: result.request_id,
      queuedAt: new Date(),
    };
  }
}
