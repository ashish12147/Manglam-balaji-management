import type { WorkerEnvironment } from './config.js';
import type { SqlDatabase } from './outbox/repository.js';

interface ProviderRow {
  provider: string;
}

export async function validateProductionProviderTopology(
  database: SqlDatabase,
  environment: WorkerEnvironment,
): Promise<void> {
  if (environment.APP_ENV !== 'production') return;
  const rows = await database.$queryRawUnsafe<ProviderRow[]>(
    `SELECT DISTINCT provider::text AS provider
     FROM push_endpoints
     WHERE status = 'ACTIVE'
     ORDER BY provider::text`,
  );
  const configured = new Set<string>(
    environment.PUSH_PROVIDERS.map((provider) => (provider === 'expo' ? 'EXPO' : 'FCM')),
  );
  const unsupported = rows
    .map((row) => row.provider)
    .filter((provider) => !configured.has(provider));
  if (unsupported.length > 0) {
    throw new Error(
      `Active push endpoint providers are not configured for this worker: ${unsupported.join(', ')}.`,
    );
  }
}
