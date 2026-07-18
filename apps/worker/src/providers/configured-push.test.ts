import { describe, expect, it } from 'vitest';

import { WorkerConfigurationError } from '../errors.js';
import type { PushProvider, PushRequest } from './contracts.js';
import { ConfiguredPushProvider } from './configured-push.js';

const request: PushRequest = {
  body: 'Body',
  category: 'GENERAL',
  data: {},
  dedupeKey: 'delivery-id',
  provider: 'EXPO',
  recipientEndpoint: 'ExponentPushToken[test-token]',
  title: 'Title',
};

describe('ConfiguredPushProvider', () => {
  it('throws a configuration failure when an unavailable provider receives an event', async () => {
    let delegated = false;
    const delegate: PushProvider = {
      send: async () => {
        delegated = true;
        return { accepted: true, providerMessageId: 'unexpected' };
      },
    };
    const provider = new ConfiguredPushProvider([], delegate);

    await expect(provider.send(request)).rejects.toBeInstanceOf(WorkerConfigurationError);
    expect(delegated).toBe(false);
  });

  it('delegates only explicitly enabled providers', async () => {
    const delegate: PushProvider = {
      send: async () => ({ accepted: true, providerMessageId: 'receipt-id' }),
    };
    const provider = new ConfiguredPushProvider(['EXPO'], delegate);

    await expect(provider.send(request)).resolves.toEqual({
      accepted: true,
      providerMessageId: 'receipt-id',
    });
  });
});
