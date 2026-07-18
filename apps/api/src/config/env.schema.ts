import { z } from 'zod';

const booleanString = z.enum(['true', 'false']).transform((value) => value === 'true');

const commaSeparatedUrls = z
  .string()
  .min(1)
  .transform((value) =>
    value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean),
  )
  .pipe(z.array(z.url()).min(1));

const secret = z.string().min(32, 'must contain at least 32 characters').max(512);

const uploadMimeTypes = z
  .string()
  .default('image/jpeg,image/png,image/webp,application/pdf')
  .transform((value) =>
    value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean),
  )
  .pipe(z.array(z.enum(['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])).min(1))
  .refine((items) => new Set(items).size === items.length, 'must not contain duplicates');

export const environmentSchema = z
  .object({
    ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().min(60).max(3_600).default(600),
    ADMIN_PASSWORD_PEPPER: secret,
    ADMIN_WEB_URL: z.url(),
    API_DOCS_ENABLED: booleanString.default(false),
    API_PREFIX: z
      .string()
      .regex(/^\/[a-z0-9/-]+$/)
      .default('/api/v1'),
    APP_ENV: z.enum(['development', 'test', 'staging', 'production']),
    APP_VERSION: z.string().min(1).default('0.1.0'),
    COOKIE_SECRET: secret,
    CORS_ORIGINS: commaSeparatedUrls,
    DATABASE_URL: z
      .url()
      .refine((value) => value.startsWith('postgresql://') || value.startsWith('postgres://'), {
        message: 'must use the PostgreSQL protocol',
      }),
    DB_CONNECTION_TIMEOUT_MS: z.coerce.number().int().min(100).max(30_000).default(5_000),
    DB_POOL_MAX: z.coerce.number().int().min(1).max(100).default(20),
    DB_STATEMENT_TIMEOUT_MS: z.coerce.number().int().min(100).max(120_000).default(5_000),
    ENCRYPTION_KEY: secret,
    EXPO_ACCESS_TOKEN: z.string().min(20).optional(),
    FCM_CLIENT_EMAIL: z.email().optional(),
    FCM_PRIVATE_KEY: z.string().min(64).optional(),
    FCM_PROJECT_ID: z.string().min(4).optional(),
    GUARD_PIN_PEPPER: secret,
    JWT_AUDIENCE: z.string().min(3),
    JWT_ISSUER: z.string().min(3),
    JWT_PRIVATE_KEY: secret,
    JWT_PUBLIC_KEY: secret,
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
    MFA_ENCRYPTION_KEY_BASE64: z.string().min(43).max(44).optional(),
    MFA_ENCRYPTION_KEY_VERSION: z.coerce.number().int().positive().optional(),
    MSG91_AUTH_KEY: z.string().min(16).optional(),
    MSG91_TEMPLATE_ID: z.string().min(4).optional(),
    NODE_ENV: z.enum(['development', 'test', 'production']),
    OTP_HMAC_SECRET: secret,
    OTP_HTTP_TIMEOUT_MS: z.coerce.number().int().min(500).max(30_000).default(5_000),
    OTP_MAX_ATTEMPTS: z.coerce.number().int().min(3).max(10).default(5),
    OTP_MESSAGE_TEMPLATE: z
      .string()
      .min(20)
      .default('Your Manglam Balaji code is {{code}}. It expires in {{minutes}} minutes.'),
    OTP_PROVIDER: z.enum(['disabled', 'msg91', 'twilio']),
    OTP_RESEND_COOLDOWN_SECONDS: z.coerce.number().int().min(30).max(600).default(60),
    OTP_TTL_SECONDS: z.coerce.number().int().min(60).max(600).default(300),
    PORT: z.coerce.number().int().min(1_024).max(65_535).default(4_000),
    PUBLIC_API_URL: z.url(),
    PUSH_HTTP_TIMEOUT_MS: z.coerce.number().int().min(500).max(30_000).default(5_000),
    PUSH_PROVIDER: z.enum(['disabled', 'fcm', 'expo']),
    REDIS_CONNECT_TIMEOUT_MS: z.coerce.number().int().min(100).max(30_000).default(2_000),
    REDIS_PREFIX: z.string().min(3).max(80),
    REDIS_URL: z
      .url()
      .refine((value) => value.startsWith('redis://') || value.startsWith('rediss://'), {
        message: 'must use the Redis protocol',
      }),
    REFRESH_TOKEN_PEPPER: secret,
    REFRESH_TOKEN_TTL_SECONDS: z.coerce
      .number()
      .int()
      .min(3_600)
      .max(31_536_000)
      .default(2_592_000),
    RESIDENT_APP_PIN_PEPPER: secret,
    S3_ACCESS_KEY_ID: z.string().min(1),
    S3_BUCKET: z.string().min(3),
    S3_ENDPOINT: z.url(),
    S3_FORCE_PATH_STYLE: booleanString.default(false),
    S3_REGION: z.string().min(3),
    S3_SECRET_ACCESS_KEY: z.string().min(8),
    SIGNED_URL_TTL_SECONDS: z.coerce.number().int().min(15).max(300).default(60),
    TRUST_PROXY: booleanString.default(false),
    TWILIO_ACCOUNT_SID: z
      .string()
      .regex(/^AC[0-9a-f]{32}$/i)
      .optional(),
    TWILIO_AUTH_TOKEN: z.string().min(20).optional(),
    TWILIO_MESSAGING_SERVICE_SID: z
      .string()
      .regex(/^MG[0-9a-f]{32}$/i)
      .optional(),
    UPLOAD_ALLOWED_MIME_TYPES: uploadMimeTypes,
    UPLOAD_MAX_BYTES: z.coerce.number().int().min(1_024).max(10_485_760).default(10_485_760),
    VISITOR_CODE_HMAC_SECRET: secret,
    WS_ORIGINS: commaSeparatedUrls,
  })
  .superRefine((environment, context) => {
    const credentialPeppers = [
      environment.ADMIN_PASSWORD_PEPPER,
      environment.GUARD_PIN_PEPPER,
      environment.RESIDENT_APP_PIN_PEPPER,
    ];
    if (new Set(credentialPeppers).size !== credentialPeppers.length) {
      context.addIssue({
        code: 'custom',
        message: 'Credential peppers must be distinct for every credential purpose.',
        path: ['ADMIN_PASSWORD_PEPPER'],
      });
    }

    if (
      environment.OTP_PROVIDER === 'msg91' &&
      (!environment.MSG91_AUTH_KEY || !environment.MSG91_TEMPLATE_ID)
    ) {
      context.addIssue({
        code: 'custom',
        message: 'MSG91 requires both an auth key and an approved flow template.',
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
    if (environment.PUSH_PROVIDER === 'expo' && !environment.EXPO_ACCESS_TOKEN) {
      context.addIssue({
        code: 'custom',
        message: 'Expo push delivery requires enhanced push security and an access token.',
        path: ['PUSH_PROVIDER'],
      });
    }
    if (
      environment.PUSH_PROVIDER === 'fcm' &&
      (!environment.FCM_PROJECT_ID || !environment.FCM_CLIENT_EMAIL || !environment.FCM_PRIVATE_KEY)
    ) {
      context.addIssue({
        code: 'custom',
        message: 'FCM delivery requires a project and service-account credentials.',
        path: ['PUSH_PROVIDER'],
      });
    }

    if (environment.APP_ENV !== 'production') return;

    if (environment.OTP_PROVIDER === 'disabled') {
      context.addIssue({
        code: 'custom',
        message: 'OTP delivery cannot be disabled in production.',
        path: ['OTP_PROVIDER'],
      });
    }
    if (environment.PUSH_PROVIDER === 'disabled') {
      context.addIssue({
        code: 'custom',
        message: 'Push delivery cannot be disabled in production.',
        path: ['PUSH_PROVIDER'],
      });
    }
    if (environment.API_DOCS_ENABLED) {
      context.addIssue({
        code: 'custom',
        message: 'Public API documentation is forbidden in production.',
        path: ['API_DOCS_ENABLED'],
      });
    }
    if (!environment.REDIS_URL.startsWith('rediss://')) {
      context.addIssue({
        code: 'custom',
        message: 'Production Redis connections must use TLS.',
        path: ['REDIS_URL'],
      });
    }
    if (!environment.S3_ENDPOINT.startsWith('https://')) {
      context.addIssue({
        code: 'custom',
        message: 'Production object storage must use HTTPS.',
        path: ['S3_ENDPOINT'],
      });
    }

    const databaseSslMode = new URL(environment.DATABASE_URL).searchParams.get('sslmode');
    if (!databaseSslMode || ['disable', 'allow', 'prefer'].includes(databaseSslMode)) {
      context.addIssue({
        code: 'custom',
        message: 'Production PostgreSQL connections must require verified TLS.',
        path: ['DATABASE_URL'],
      });
    }

    const productionSecrets = [
      ['ADMIN_PASSWORD_PEPPER', environment.ADMIN_PASSWORD_PEPPER],
      ['COOKIE_SECRET', environment.COOKIE_SECRET],
      ['ENCRYPTION_KEY', environment.ENCRYPTION_KEY],
      ['GUARD_PIN_PEPPER', environment.GUARD_PIN_PEPPER],
      ['JWT_PRIVATE_KEY', environment.JWT_PRIVATE_KEY],
      ['OTP_HMAC_SECRET', environment.OTP_HMAC_SECRET],
      ['REFRESH_TOKEN_PEPPER', environment.REFRESH_TOKEN_PEPPER],
      ['RESIDENT_APP_PIN_PEPPER', environment.RESIDENT_APP_PIN_PEPPER],
      ['S3_ACCESS_KEY_ID', environment.S3_ACCESS_KEY_ID],
      ['S3_SECRET_ACCESS_KEY', environment.S3_SECRET_ACCESS_KEY],
      ['VISITOR_CODE_HMAC_SECRET', environment.VISITOR_CODE_HMAC_SECRET],
    ] as const;
    for (const [field, value] of productionSecrets) {
      if (/replace-with|change-?me|development-secret/i.test(value)) {
        context.addIssue({
          code: 'custom',
          message: 'A development placeholder cannot be used as a production secret.',
          path: [field],
        });
      }
    }

    const publicUrls = [
      environment.ADMIN_WEB_URL,
      environment.PUBLIC_API_URL,
      ...environment.CORS_ORIGINS,
      ...environment.WS_ORIGINS,
    ];
    if (publicUrls.some((url) => !url.startsWith('https://'))) {
      context.addIssue({
        code: 'custom',
        message: 'Production public URLs must use HTTPS.',
        path: ['PUBLIC_API_URL'],
      });
    }
  });

export type AppEnvironment = z.infer<typeof environmentSchema>;

export function parseEnvironment(input: NodeJS.ProcessEnv): AppEnvironment {
  const result = environmentSchema.safeParse(input);
  if (result.success) return result.data;

  const issues = result.error.issues
    .map((issue) => `${issue.path.join('.') || 'environment'}: ${issue.message}`)
    .join('; ');
  throw new Error(`Invalid application configuration: ${issues}`);
}
