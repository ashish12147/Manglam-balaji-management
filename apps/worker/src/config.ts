import { z } from 'zod';

const boolean = z.enum(['true', 'false']).transform((value) => value === 'true');

const pushProviders = z
  .string()
  .default('')
  .transform((value) =>
    value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean),
  )
  .pipe(z.array(z.enum(['expo', 'fcm'])))
  .refine((items) => new Set(items).size === items.length, 'must not contain duplicates');

export const workerEnvironmentSchema = z
  .object({
    APP_ENV: z.enum(['development', 'test', 'staging', 'production']),
    DATABASE_URL: z
      .url()
      .refine((value) => value.startsWith('postgres://') || value.startsWith('postgresql://')),
    ENCRYPTION_KEY: z.string().min(32),
    REDIS_URL: z
      .url()
      .refine((value) => value.startsWith('redis://') || value.startsWith('rediss://')),
    REDIS_PREFIX: z.string().min(3).max(80),
    WORKER_ID: z.string().min(3).max(120),
    WORKER_HEALTH_PORT: z.coerce.number().int().min(1024).max(65535).default(4010),
    WORKER_POLL_INTERVAL_MS: z.coerce.number().int().min(250).max(60000).default(1000),
    WORKER_BATCH_SIZE: z.coerce.number().int().min(1).max(100).default(25),
    WORKER_LEASE_SECONDS: z.coerce.number().int().min(10).max(900).default(90),
    WORKER_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(30).default(8),
    WORKER_HEARTBEAT_SECONDS: z.coerce.number().int().min(5).max(300).default(30),
    PUSH_PROVIDERS: pushProviders,
    EXPO_ACCESS_TOKEN: z.string().min(20).optional(),
    FCM_CLIENT_EMAIL: z.email().optional(),
    FCM_PRIVATE_KEY: z.string().min(64).optional(),
    FCM_PROJECT_ID: z.string().min(4).optional(),
    OTP_HTTP_TIMEOUT_MS: z.coerce.number().int().min(500).max(30000).default(5000),
    OTP_MESSAGE_TEMPLATE: z
      .string()
      .min(20)
      .default('Your Manglam Balaji code is {{code}}. It expires in {{minutes}} minutes.'),
    OTP_PROVIDER: z.enum(['disabled', 'msg91', 'twilio']),
    MSG91_AUTH_KEY: z.string().min(16).optional(),
    MSG91_TEMPLATE_ID: z.string().min(4).optional(),
    TWILIO_ACCOUNT_SID: z
      .string()
      .regex(/^AC[0-9a-f]{32}$/i)
      .optional(),
    TWILIO_AUTH_TOKEN: z.string().min(20).optional(),
    TWILIO_MESSAGING_SERVICE_SID: z
      .string()
      .regex(/^MG[0-9a-f]{32}$/i)
      .optional(),
    EXPO_RECEIPT_DELAY_SECONDS: z.coerce.number().int().min(60).max(86400).default(900),
    PUSH_HTTP_TIMEOUT_MS: z.coerce.number().int().min(500).max(30000).default(5000),
    S3_BUCKET: z.string().min(3),
    S3_ENDPOINT: z.url(),
    S3_REGION: z.string().min(3),
    S3_ACCESS_KEY_ID: z.string().min(1),
    S3_SECRET_ACCESS_KEY: z.string().min(8),
    S3_FORCE_PATH_STYLE: boolean.default(false),
    UPLOAD_ALLOWED_MIME_TYPES: z
      .string()
      .min(1)
      .transform((value) =>
        value
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
      ),
    UPLOAD_MAX_BYTES: z.coerce.number().int().min(1024).max(10485760).default(10485760),
    CLAMAV_HOST: z.string().min(1),
    CLAMAV_PORT: z.coerce.number().int().min(1).max(65535).default(3310),
    CLAMAV_TIMEOUT_MS: z.coerce.number().int().min(1000).max(120000).default(30000),
    RETENTION_BATCH_SIZE: z.coerce.number().int().min(1).max(500).default(100),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug']).default('info'),
  })
  .superRefine((environment, context) => {
    if (
      environment.OTP_PROVIDER === 'msg91' &&
      (!environment.MSG91_AUTH_KEY || !environment.MSG91_TEMPLATE_ID)
    ) {
      context.addIssue({
        code: 'custom',
        message: 'MSG91 requires both an auth key and template id.',
        path: ['OTP_PROVIDER'],
      });
    }
    if (
      environment.OTP_PROVIDER === 'twilio' &&
      (!environment.TWILIO_ACCOUNT_SID ||
        !environment.TWILIO_AUTH_TOKEN ||
        !environment.TWILIO_MESSAGING_SERVICE_SID ||
        !environment.OTP_MESSAGE_TEMPLATE.includes('{{code}}'))
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Twilio requires account, token, messaging service, and a code template.',
        path: ['OTP_PROVIDER'],
      });
    }
    if (environment.PUSH_PROVIDERS.includes('expo') && !environment.EXPO_ACCESS_TOKEN) {
      context.addIssue({
        code: 'custom',
        message: 'Expo push delivery requires an access token.',
        path: ['PUSH_PROVIDERS'],
      });
    }
    if (
      environment.PUSH_PROVIDERS.includes('fcm') &&
      (!environment.FCM_PROJECT_ID || !environment.FCM_CLIENT_EMAIL || !environment.FCM_PRIVATE_KEY)
    ) {
      context.addIssue({
        code: 'custom',
        message: 'FCM push delivery requires project and service-account credentials.',
        path: ['PUSH_PROVIDERS'],
      });
    }
    if (environment.APP_ENV !== 'production') return;
    if (environment.OTP_PROVIDER === 'disabled') {
      context.addIssue({
        code: 'custom',
        message: 'Production requires a real OTP provider.',
        path: ['OTP_PROVIDER'],
      });
    }
    if (environment.PUSH_PROVIDERS.length === 0) {
      context.addIssue({
        code: 'custom',
        message: 'Production requires at least one real push provider.',
        path: ['PUSH_PROVIDERS'],
      });
    }
    const sslModes = new URL(environment.DATABASE_URL).searchParams.getAll('sslmode');
    const sslMode = sslModes[0]?.toLowerCase() ?? '';
    if (sslModes.length !== 1 || !['require', 'verify-ca', 'verify-full'].includes(sslMode)) {
      context.addIssue({
        code: 'custom',
        path: ['DATABASE_URL'],
        message: 'Production PostgreSQL must require TLS.',
      });
    }
    if (!environment.REDIS_URL.startsWith('rediss://')) {
      context.addIssue({
        code: 'custom',
        path: ['REDIS_URL'],
        message: 'Production Redis must use TLS.',
      });
    }
    if (!environment.S3_ENDPOINT.startsWith('https://')) {
      context.addIssue({
        code: 'custom',
        path: ['S3_ENDPOINT'],
        message: 'Production storage must use HTTPS.',
      });
    }
  });

export type WorkerEnvironment = z.infer<typeof workerEnvironmentSchema>;

export function parseWorkerEnvironment(input: NodeJS.ProcessEnv = process.env): WorkerEnvironment {
  return workerEnvironmentSchema.parse(input);
}
