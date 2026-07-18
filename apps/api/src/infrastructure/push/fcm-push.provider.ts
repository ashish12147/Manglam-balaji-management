import { GoogleAuth } from 'google-auth-library';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type {
  PushDeliveryReceipt,
  PushNotificationMessage,
  PushNotificationProvider,
} from '../../common/providers/notification.provider.js';
import type { AppEnvironment } from '../../config/env.schema.js';

interface FcmResponse {
  error?: {
    details?: Array<{ errorCode?: unknown }>;
    status?: unknown;
  };
  name?: unknown;
}

@Injectable()
export class FcmPushProvider implements PushNotificationProvider {
  private readonly auth: GoogleAuth;
  private readonly projectId: string;
  private readonly timeoutMs: number;

  constructor(config: ConfigService<AppEnvironment, true>) {
    const clientEmail = config.get('FCM_CLIENT_EMAIL', { infer: true });
    const privateKey = config.get('FCM_PRIVATE_KEY', { infer: true });
    this.projectId = config.get('FCM_PROJECT_ID', { infer: true }) ?? '';
    this.timeoutMs = config.get('PUSH_HTTP_TIMEOUT_MS', { infer: true });
    this.auth = new GoogleAuth({
      credentials:
        clientEmail && privateKey
          ? {
              client_email: clientEmail,
              private_key: privateKey.replaceAll('\\n', '\n'),
            }
          : undefined,
      scopes: ['https://www.googleapis.com/auth/firebase.messaging'],
    });
  }

  async send(message: PushNotificationMessage): Promise<PushDeliveryReceipt> {
    if (this.projectId.length < 4 || message.recipientEndpoint.length < 16) {
      return {
        accepted: false,
        terminalFailureReason: 'ENDPOINT_INVALID',
      };
    }

    const token = await this.auth.getAccessToken();
    if (!token) {
      throw new Error('FCM authentication did not return an access token.');
    }

    const response = await fetch(
      `https://fcm.googleapis.com/v1/projects/${encodeURIComponent(this.projectId)}/messages:send`,
      {
        body: JSON.stringify({
          message: {
            android: {
              priority:
                message.category === 'SECURITY_CRITICAL' || message.category === 'EMERGENCY'
                  ? 'high'
                  : 'normal',
            },
            data: message.data,
            notification: {
              body: message.body,
              title: message.title,
            },
            token: message.recipientEndpoint,
          },
        }),
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
        },
        method: 'POST',
        signal: AbortSignal.timeout(this.timeoutMs),
      },
    );
    const payload = (await response.json().catch(() => ({}))) as FcmResponse;

    if (!response.ok) {
      const errorCode = payload.error?.details?.find(
        (detail) => typeof detail.errorCode === 'string',
      )?.errorCode;
      if (errorCode === 'UNREGISTERED') {
        return {
          accepted: false,
          terminalFailureReason: 'ENDPOINT_EXPIRED',
        };
      }
      if (payload.error?.status === 'INVALID_ARGUMENT') {
        return {
          accepted: false,
          terminalFailureReason: 'ENDPOINT_INVALID',
        };
      }
      throw new Error(`FCM rejected the push request with HTTP ${response.status}.`);
    }
    if (typeof payload.name !== 'string') {
      throw new Error('FCM returned a malformed success response.');
    }

    return {
      accepted: true,
      providerMessageId: payload.name,
    };
  }
}
