import { GoogleAuth } from 'google-auth-library';

import type {
  OtpDeliveryProvider,
  OtpDeliveryRequest,
  PushProvider,
  PushRequest,
} from './contracts.js';

export class HttpOtpDeliveryProvider implements OtpDeliveryProvider {
  constructor(
    private readonly configuration: {
      msg91AuthKey: string | undefined;
      msg91TemplateId: string | undefined;
      provider: 'msg91' | 'twilio';
      template: string;
      timeoutMs: number;
      twilioAccountSid: string | undefined;
      twilioAuthToken: string | undefined;
      twilioMessagingServiceSid: string | undefined;
    },
  ) {}

  async send(request: OtpDeliveryRequest): Promise<{ providerMessageId: string }> {
    return this.configuration.provider === 'msg91'
      ? this.sendMsg91(request)
      : this.sendTwilio(request);
  }

  private async sendMsg91(request: OtpDeliveryRequest): Promise<{ providerMessageId: string }> {
    const { msg91AuthKey, msg91TemplateId, timeoutMs } = this.configuration;
    if (!msg91AuthKey || !msg91TemplateId) throw new Error('MSG91 credentials are unavailable.');
    const response = await fetch('https://control.msg91.com/api/v5/flow', {
      body: JSON.stringify({
        recipients: [{ mobiles: request.phoneE164.slice(1), OTP: request.plaintextCode }],
        template_id: msg91TemplateId,
      }),
      headers: {
        accept: 'application/json',
        authkey: msg91AuthKey,
        'content-type': 'application/json',
      },
      method: 'POST',
      signal: AbortSignal.timeout(timeoutMs),
    });
    const result = (await response.json().catch(() => null)) as {
      request_id?: unknown;
      type?: unknown;
    } | null;
    if (!response.ok || result?.type === 'error' || typeof result?.request_id !== 'string') {
      throw new Error(`MSG91 rejected OTP delivery with HTTP ${response.status}.`);
    }
    return { providerMessageId: result.request_id };
  }

  private async sendTwilio(request: OtpDeliveryRequest): Promise<{ providerMessageId: string }> {
    const { template, timeoutMs, twilioAccountSid, twilioAuthToken, twilioMessagingServiceSid } =
      this.configuration;
    if (!twilioAccountSid || !twilioAuthToken || !twilioMessagingServiceSid) {
      throw new Error('Twilio credentials are unavailable.');
    }
    const minutes = Math.max(1, Math.ceil((request.expiresAt.getTime() - Date.now()) / 60000));
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(twilioAccountSid)}/Messages.json`,
      {
        body: new URLSearchParams({
          Body: template
            .replaceAll('{{code}}', request.plaintextCode)
            .replaceAll('{{minutes}}', String(minutes)),
          MessagingServiceSid: twilioMessagingServiceSid,
          To: request.phoneE164,
        }),
        headers: {
          Authorization: `Basic ${Buffer.from(`${twilioAccountSid}:${twilioAuthToken}`).toString('base64')}`,
          'content-type': 'application/x-www-form-urlencoded',
        },
        method: 'POST',
        signal: AbortSignal.timeout(timeoutMs),
      },
    );
    const result = (await response.json().catch(() => null)) as { sid?: unknown } | null;
    if (!response.ok || typeof result?.sid !== 'string') {
      throw new Error(`Twilio rejected OTP delivery with HTTP ${response.status}.`);
    }
    return { providerMessageId: result.sid };
  }
}

export class HttpPushProvider implements PushProvider {
  private readonly enabledProviders: ReadonlySet<'EXPO' | 'FCM'>;
  private readonly googleAuth: GoogleAuth | undefined;

  constructor(
    private readonly configuration: {
      enabledProviders: ReadonlyArray<'EXPO' | 'FCM'>;
      expoAccessToken: string | undefined;
      fcmClientEmail: string | undefined;
      fcmPrivateKey: string | undefined;
      fcmProjectId: string | undefined;
      timeoutMs: number;
    },
  ) {
    this.enabledProviders = new Set(configuration.enabledProviders);
    if (configuration.fcmClientEmail && configuration.fcmPrivateKey) {
      this.googleAuth = new GoogleAuth({
        credentials: {
          client_email: configuration.fcmClientEmail,
          private_key: configuration.fcmPrivateKey.replaceAll('\\n', '\n'),
        },
        scopes: ['https://www.googleapis.com/auth/firebase.messaging'],
      });
    }
  }

  async send(request: PushRequest): Promise<{
    accepted: boolean;
    providerMessageId?: string;
    terminalFailureReason?: 'ENDPOINT_EXPIRED' | 'ENDPOINT_INVALID';
  }> {
    if (!this.enabledProviders.has(request.provider)) {
      throw new Error(`Push provider ${request.provider} is not enabled.`);
    }
    return request.provider === 'EXPO' ? this.sendExpo(request) : this.sendFcm(request);
  }

  private async sendExpo(request: PushRequest): Promise<{
    accepted: boolean;
    providerMessageId?: string;
    terminalFailureReason?: 'ENDPOINT_EXPIRED' | 'ENDPOINT_INVALID';
  }> {
    if (!this.configuration.expoAccessToken) throw new Error('Expo credentials are unavailable.');
    if (!/^(Expo|Exponent)PushToken\[[^\]]+\]$/.test(request.recipientEndpoint)) {
      return { accepted: false, terminalFailureReason: 'ENDPOINT_INVALID' };
    }
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      body: JSON.stringify({
        body: request.body,
        data: request.data,
        title: request.title,
        to: request.recipientEndpoint,
      }),
      headers: {
        accept: 'application/json',
        authorization: `Bearer ${this.configuration.expoAccessToken}`,
        'content-type': 'application/json',
      },
      method: 'POST',
      signal: AbortSignal.timeout(this.configuration.timeoutMs),
    });
    const responseBody = (await response.json().catch(() => null)) as {
      data?:
        | { details?: { error?: unknown }; id?: unknown; status?: unknown }
        | Array<{ details?: { error?: unknown }; id?: unknown; status?: unknown }>;
    } | null;
    const ticket = Array.isArray(responseBody?.data) ? responseBody.data[0] : responseBody?.data;
    if (!response.ok || !ticket)
      throw new Error(`Expo rejected push with HTTP ${response.status}.`);
    if (ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered') {
      return { accepted: false, terminalFailureReason: 'ENDPOINT_EXPIRED' };
    }
    if (ticket.status !== 'ok' || typeof ticket.id !== 'string') {
      throw new Error('Expo returned a non-terminal push error.');
    }
    return { accepted: true, providerMessageId: ticket.id };
  }

  private async sendFcm(request: PushRequest): Promise<{
    accepted: boolean;
    providerMessageId?: string;
    terminalFailureReason?: 'ENDPOINT_EXPIRED' | 'ENDPOINT_INVALID';
  }> {
    if (!this.googleAuth || !this.configuration.fcmProjectId) {
      throw new Error('FCM credentials are unavailable.');
    }
    const token = await this.googleAuth.getAccessToken();
    if (!token) throw new Error('FCM did not issue an access token.');
    const response = await fetch(
      `https://fcm.googleapis.com/v1/projects/${encodeURIComponent(this.configuration.fcmProjectId)}/messages:send`,
      {
        body: JSON.stringify({
          message: {
            data: request.data,
            notification: { body: request.body, title: request.title },
            token: request.recipientEndpoint,
          },
        }),
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        method: 'POST',
        signal: AbortSignal.timeout(this.configuration.timeoutMs),
      },
    );
    const result = (await response.json().catch(() => null)) as {
      error?: { details?: Array<{ errorCode?: unknown }>; status?: unknown };
      name?: unknown;
    } | null;
    const code = result?.error?.details?.find(
      (detail) => typeof detail.errorCode === 'string',
    )?.errorCode;
    if (!response.ok && code === 'UNREGISTERED') {
      return { accepted: false, terminalFailureReason: 'ENDPOINT_EXPIRED' };
    }
    if (!response.ok && result?.error?.status === 'INVALID_ARGUMENT') {
      return { accepted: false, terminalFailureReason: 'ENDPOINT_INVALID' };
    }
    if (!response.ok || typeof result?.name !== 'string') {
      throw new Error(`FCM rejected push with HTTP ${response.status}.`);
    }
    return { accepted: true, providerMessageId: result.name };
  }
}
