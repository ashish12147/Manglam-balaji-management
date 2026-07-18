import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { PushNotificationMessage } from '../../common/providers/notification.provider.js';
import { DisabledPushProvider } from './disabled-push.provider.js';
import { ExpoPushProvider } from './expo-push.provider.js';

const message: PushNotificationMessage = {
  body: 'A visitor is waiting.',
  category: 'VISITOR_APPROVAL',
  data: { entityId: '019f7100-0000-7000-8000-000000000001' },
  dedupeKey: 'visitor:approval:1',
  recipientEndpoint: 'ExponentPushToken[abcdefghijklmnopqrstuv]',
  title: 'Visitor approval',
};

function config(values: Record<string, unknown>) {
  return { get: vi.fn((key: string) => values[key]) };
}

describe('push providers', () => {
  beforeEach(() => vi.unstubAllGlobals());

  it('never fabricates an accepted delivery when push is disabled', async () => {
    await expect(new DisabledPushProvider().send(message)).rejects.toMatchObject({
      name: 'PUSH_DELIVERY_DISABLED',
    });
  });

  it('returns the real Expo receipt id for accepted tickets', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        json: vi.fn().mockResolvedValue({
          data: { id: 'expo-receipt-id', status: 'ok' },
        }),
        ok: true,
        status: 200,
      }),
    );
    const provider = new ExpoPushProvider(
      config({
        EXPO_ACCESS_TOKEN: 'a-secure-expo-access-token',
        PUSH_HTTP_TIMEOUT_MS: 5_000,
      }) as never,
    );

    await expect(provider.send(message)).resolves.toEqual({
      accepted: true,
      providerMessageId: 'expo-receipt-id',
    });
  });

  it('classifies unregistered Expo endpoints as terminal', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        json: vi.fn().mockResolvedValue({
          data: {
            details: { error: 'DeviceNotRegistered' },
            status: 'error',
          },
        }),
        ok: true,
        status: 200,
      }),
    );
    const provider = new ExpoPushProvider(
      config({
        EXPO_ACCESS_TOKEN: 'a-secure-expo-access-token',
        PUSH_HTTP_TIMEOUT_MS: 5_000,
      }) as never,
    );

    await expect(provider.send(message)).resolves.toEqual({
      accepted: false,
      terminalFailureReason: 'ENDPOINT_EXPIRED',
    });
  });
});
