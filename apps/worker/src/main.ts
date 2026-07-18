import { createDatabaseClient } from '@manglam/database';

import { parseWorkerEnvironment } from './config.js';
import { startHealthServer } from './health.js';
import { JobHandler } from './jobs/handler.js';
import { createLogger, type Logger } from './logging.js';
import { ClamAvInstreamScanner } from './providers/clamav.js';
import { ConfiguredPushProvider } from './providers/configured-push.js';
import {
  DisabledExpoReceiptProvider,
  DisabledOtpDeliveryProvider,
} from './providers/disabled-delivery.js';
import { ExpoReceiptProvider } from './providers/expo.js';
import { HttpOtpDeliveryProvider, HttpPushProvider } from './providers/network-delivery.js';
import { S3PrivateObjectStore } from './providers/s3-private-store.js';
import { RedisAccelerator } from './redis-accelerator.js';
import { errorCode } from './retry.js';
import { WorkerRuntime } from './runtime.js';
import { SensitivePayloadCipher } from './security/sensitive-payload-cipher.js';
import { validateProductionProviderTopology } from './startup-validation.js';

type HealthServer = Awaited<ReturnType<typeof startHealthServer>>;

async function attemptCleanup(
  operation: string,
  action: () => Promise<void>,
  logger: Logger,
  failures: string[],
): Promise<void> {
  try {
    await action();
  } catch (error) {
    failures.push(operation);
    logger.error('worker.cleanup_failed', {
      errorCode: errorCode(error),
      operation,
    });
  }
}

function closeServer(server: HealthServer): Promise<void> {
  return new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
}

async function bootstrap(): Promise<void> {
  const environment = parseWorkerEnvironment();
  const logger = createLogger(environment.WORKER_ID);
  const database = createDatabaseClient({
    applicationName: `manglam-worker:${environment.WORKER_ID}`,
    connectionString: environment.DATABASE_URL,
  });
  const redis = new RedisAccelerator(environment.REDIS_URL, environment.REDIS_PREFIX);
  let connected = false;
  let runtime: WorkerRuntime | undefined;
  let server: HealthServer | undefined;

  try {
    await database.$connect();
    connected = true;
    await validateProductionProviderTopology(database, environment);

    const objectStore = new S3PrivateObjectStore(environment.S3_BUCKET, {
      accessKeyId: environment.S3_ACCESS_KEY_ID,
      endpoint: environment.S3_ENDPOINT,
      forcePathStyle: environment.S3_FORCE_PATH_STYLE,
      region: environment.S3_REGION,
      secretAccessKey: environment.S3_SECRET_ACCESS_KEY,
    });
    const cipher = new SensitivePayloadCipher(environment.ENCRYPTION_KEY);
    const otp =
      environment.OTP_PROVIDER === 'disabled'
        ? new DisabledOtpDeliveryProvider()
        : new HttpOtpDeliveryProvider({
            msg91AuthKey: environment.MSG91_AUTH_KEY,
            msg91TemplateId: environment.MSG91_TEMPLATE_ID,
            provider: environment.OTP_PROVIDER,
            template: environment.OTP_MESSAGE_TEMPLATE,
            timeoutMs: environment.OTP_HTTP_TIMEOUT_MS,
            twilioAccountSid: environment.TWILIO_ACCOUNT_SID,
            twilioAuthToken: environment.TWILIO_AUTH_TOKEN,
            twilioMessagingServiceSid: environment.TWILIO_MESSAGING_SERVICE_SID,
          });
    const expoReceipts = environment.PUSH_PROVIDERS.includes('expo')
      ? new ExpoReceiptProvider(
          environment.EXPO_ACCESS_TOKEN ?? '',
          environment.PUSH_HTTP_TIMEOUT_MS,
        )
      : new DisabledExpoReceiptProvider();
    const enabledPushProviders = environment.PUSH_PROVIDERS.map((provider) =>
      provider === 'expo' ? ('EXPO' as const) : ('FCM' as const),
    );
    const push = new ConfiguredPushProvider(
      enabledPushProviders,
      new HttpPushProvider({
        enabledProviders: enabledPushProviders,
        expoAccessToken: environment.EXPO_ACCESS_TOKEN,
        fcmClientEmail: environment.FCM_CLIENT_EMAIL,
        fcmPrivateKey: environment.FCM_PRIVATE_KEY,
        fcmProjectId: environment.FCM_PROJECT_ID,
        timeoutMs: environment.PUSH_HTTP_TIMEOUT_MS,
      }),
    );
    const jobs = new JobHandler(
      database,
      {
        cipher,
        expoReceipts,
        objectStore,
        otp,
        push,
        scanner: new ClamAvInstreamScanner(
          environment.CLAMAV_HOST,
          environment.CLAMAV_PORT,
          environment.CLAMAV_TIMEOUT_MS,
        ),
      },
      environment,
    );
    runtime = new WorkerRuntime(database, environment, jobs, logger, redis);
    await runtime.start();
    server = await startHealthServer(environment.WORKER_HEALTH_PORT, runtime);
    logger.info('worker.started', {
      healthPort: environment.WORKER_HEALTH_PORT,
    });
  } catch (error) {
    logger.error('worker.start_failed', { errorCode: errorCode(error) });
    const cleanupFailures: string[] = [];
    if (runtime) {
      await attemptCleanup(
        'runtime.stop',
        () => runtime?.stop() ?? Promise.resolve(),
        logger,
        cleanupFailures,
      );
    } else {
      await attemptCleanup('redis.close', () => redis.close(), logger, cleanupFailures);
    }
    if (server) {
      await attemptCleanup(
        'health.close',
        () => closeServer(server as HealthServer),
        logger,
        cleanupFailures,
      );
    }
    if (connected) {
      await attemptCleanup(
        'database.disconnect',
        () => database.$disconnect(),
        logger,
        cleanupFailures,
      );
    }
    throw error;
  }

  const activeRuntime = runtime;
  const activeServer = server;
  if (!activeRuntime || !activeServer) {
    throw new Error('Worker bootstrap completed without active runtime resources.');
  }

  let stopping = false;
  const shutdown = async (signal: string): Promise<void> => {
    if (stopping) return;
    stopping = true;
    logger.info('worker.stopping', { signal });
    const failures: string[] = [];
    await attemptCleanup('runtime.stop', () => activeRuntime.stop(), logger, failures);
    await attemptCleanup('health.close', () => closeServer(activeServer), logger, failures);
    await attemptCleanup('database.disconnect', () => database.$disconnect(), logger, failures);
    if (failures.length > 0) {
      logger.error('worker.shutdown_incomplete', {
        failureCount: failures.length,
      });
      process.exitCode = 1;
      return;
    }
    logger.info('worker.stopped');
  };
  process.once('SIGINT', () => void shutdown('SIGINT'));
  process.once('SIGTERM', () => void shutdown('SIGTERM'));
}

void bootstrap().catch((error: unknown) => {
  process.stderr.write(
    `${JSON.stringify({ event: 'worker.bootstrap_failed', errorCode: errorCode(error) })}\n`,
  );
  process.exitCode = 1;
});
