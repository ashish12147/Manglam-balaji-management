import { describe, expect, it } from 'vitest';

import type { WorkerEnvironment } from './config.js';
import type { SqlDatabase } from './outbox/repository.js';
import { validateProductionProviderTopology } from './startup-validation.js';

function database(providers: string[]): SqlDatabase {
  return {
    $executeRawUnsafe: async () => 0,
    $queryRawUnsafe: async <T>() => providers.map((provider) => ({ provider })) as T,
  };
}

describe('validateProductionProviderTopology', () => {
  it('rejects an active endpoint provider that is not configured', async () => {
    await expect(
      validateProductionProviderTopology(database(['EXPO', 'FCM']), {
        APP_ENV: 'production',
        PUSH_PROVIDERS: ['expo'],
      } as unknown as WorkerEnvironment),
    ).rejects.toThrow('FCM');
  });

  it('allows disabled provider lists outside production', async () => {
    await expect(
      validateProductionProviderTopology(database(['EXPO']), {
        APP_ENV: 'test',
        PUSH_PROVIDERS: [],
      } as unknown as WorkerEnvironment),
    ).resolves.toBeUndefined();
  });
});
