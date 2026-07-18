import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type {
  PushDeliveryReceipt,
  PushNotificationMessage,
  PushNotificationProvider,
} from '../../common/providers/notification.provider.js';
import type { AppEnvironment } from '../../config/env.schema.js';

interface ExpoTicket {
  details?: {
    error?: unknown;
  };
  id?: unknown;
  status?: unknown;
}

interface ExpoResponse {
  data?: ExpoTicket | ExpoTicket[];
}

@Injectable()
export class ExpoPushProvider implements PushNotificationProvider {
  private readonly accessToken: string;
  private readonly timeoutMs: number;

  constructor(config: ConfigService<AppEnvironment, true>) {
    this.accessToken = config.get('EXPO_ACCESS_TOKEN', { infer: true }) ?? '';
    this.timeoutMs = config.get('PUSH_HTTP_TIMEOUT_MS', { infer: true });
  }

  async send(message: PushNotificationMessage): Promise<PushDeliveryReceipt> {
    if (this.accessToken.length < 20) {
      throw new Error('Expo push security is not configured.');
    }
    if (!/^(Expo|Exponent)PushToken\[[^\]]+\]$/.test(message.recipientEndpoint)) {
      return {
        accepted: false,
        terminalFailureReason: 'ENDPOINT_INVALID',
      };
    }

    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      body: JSON.stringify({
        body: message.body,
        data: message.data,
        priority:
          message.category === 'SECURITY_CRITICAL' || message.category === 'EMERGENCY'
            ? 'high'
            : 'default',
        title: message.title,
        to: message.recipientEndpoint,
      }),
      headers: {
        accept: 'application/json',
        authorization: `Bearer ${this.accessToken}`,
        'content-type': 'application/json',
      },
      method: 'POST',
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    const payload = (await response.json().catch(() => ({}))) as ExpoResponse;
    const ticket = Array.isArray(payload.data) ? payload.data[0] : payload.data;

    if (!response.ok || !ticket) {
      throw new Error(`Expo rejected the push request with HTTP ${response.status}.`);
    }
    if (ticket.status === 'error') {
      if (ticket.details?.error === 'DeviceNotRegistered') {
        return {
          accepted: false,
          terminalFailureReason: 'ENDPOINT_EXPIRED',
        };
      }
      throw new Error('Expo returned a non-terminal push ticket error.');
    }
    if (ticket.status !== 'ok' || typeof ticket.id !== 'string') {
      throw new Error('Expo returned a malformed push ticket.');
    }

    return {
      accepted: true,
      providerMessageId: ticket.id,
    };
  }
}
