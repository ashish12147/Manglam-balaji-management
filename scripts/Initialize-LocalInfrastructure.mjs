import { generateKeyPairSync, randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = resolve(root, 'infrastructure', '.env.local');
const force = process.argv.includes('--force');

if (existsSync(output) && !force) {
  throw new Error(`${output} already exists. Pass --force to rotate all local credentials.`);
}

const secret = (bytes = 48) => randomBytes(bytes).toString('base64url');
const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 3072,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
});

const values = {
  POSTGRES_DB: 'manglam',
  POSTGRES_USER: 'manglam',
  POSTGRES_PASSWORD: secret(32),
  REDIS_PASSWORD: secret(32),
  MINIO_ROOT_USER: `root-${secret(12)}`,
  MINIO_ROOT_PASSWORD: secret(32),
  MINIO_APP_ACCESS_KEY: `app-${secret(12)}`,
  MINIO_APP_SECRET_KEY: secret(32),
  S3_BUCKET: 'manglam-private',
  S3_REGION: 'ap-south-1',
  ADMIN_PASSWORD_PEPPER: secret(),
  GUARD_PIN_PEPPER: secret(),
  RESIDENT_APP_PIN_PEPPER: secret(),
  COOKIE_SECRET: secret(),
  ENCRYPTION_KEY: secret(),
  MFA_ENCRYPTION_KEY_BASE64: randomBytes(32).toString('base64'),
  MFA_ENCRYPTION_KEY_VERSION: '1',
  OTP_HMAC_SECRET: secret(),
  REFRESH_TOKEN_PEPPER: secret(),
  VISITOR_CODE_HMAC_SECRET: secret(),
  JWT_PRIVATE_KEY: privateKey,
  JWT_PUBLIC_KEY: publicKey,
};

const lines = [
  '# Generated local-only credentials. Never commit this file.',
  '# Set a real OTP provider (msg91 or twilio) and push provider (expo or fcm) before using --profile app.',
  ...Object.entries(values).map(([key, value]) => `${key}=${JSON.stringify(value)}`),
  'OTP_PROVIDER=',
  'PUSH_PROVIDER=',
  'MSG91_AUTH_KEY=',
  'MSG91_TEMPLATE_ID=',
  'TWILIO_ACCOUNT_SID=',
  'TWILIO_AUTH_TOKEN=',
  'TWILIO_MESSAGING_SERVICE_SID=',
  'EXPO_ACCESS_TOKEN=',
  'FCM_CLIENT_EMAIL=',
  'FCM_PRIVATE_KEY=',
  'FCM_PROJECT_ID=',
  '',
];

mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, lines.join('\n'), { encoding: 'utf8', mode: 0o600, flag: 'w' });
console.log(`Created ${output}`);
