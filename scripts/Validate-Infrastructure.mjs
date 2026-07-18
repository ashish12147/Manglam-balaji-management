import { createPrivateKey, createPublicKey, sign, verify } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const envPath = resolve(root, process.argv[2] ?? 'infrastructure/.env.local');

if (!existsSync(envPath)) {
  throw new Error(`Missing ${envPath}. Run node scripts/Initialize-LocalInfrastructure.mjs first.`);
}

const values = new Map();
for (const rawLine of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
  const line = rawLine.trim();
  if (!line || line.startsWith('#')) continue;
  const separator = line.indexOf('=');
  if (separator < 1) throw new Error(`Malformed environment line: ${rawLine}`);
  const key = line.slice(0, separator);
  const rawValue = line.slice(separator + 1);
  let value = rawValue;
  if (rawValue.startsWith('"')) value = JSON.parse(rawValue);
  values.set(key, value);
}

const requiredSecrets = [
  'POSTGRES_PASSWORD',
  'REDIS_PASSWORD',
  'MINIO_ROOT_PASSWORD',
  'MINIO_APP_SECRET_KEY',
  'ADMIN_PASSWORD_PEPPER',
  'GUARD_PIN_PEPPER',
  'RESIDENT_APP_PIN_PEPPER',
  'COOKIE_SECRET',
  'ENCRYPTION_KEY',
  'OTP_HMAC_SECRET',
  'REFRESH_TOKEN_PEPPER',
  'VISITOR_CODE_HMAC_SECRET',
];

for (const key of requiredSecrets) {
  const value = values.get(key);
  if (!value || value.length < 32) throw new Error(`${key} must contain at least 32 characters.`);
  if (/change-?me|replace|password|secret/i.test(value)) {
    throw new Error(`${key} appears to contain a placeholder.`);
  }
}

const credentialPeppers = [
  values.get('ADMIN_PASSWORD_PEPPER'),
  values.get('GUARD_PIN_PEPPER'),
  values.get('RESIDENT_APP_PIN_PEPPER'),
];
if (new Set(credentialPeppers).size !== credentialPeppers.length) {
  throw new Error('Credential peppers must be distinct for every credential purpose.');

}
const bucket = values.get('S3_BUCKET');
if (!bucket || !/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(bucket)) {
  throw new Error('S3_BUCKET must be a DNS-compatible bucket name.');
}

const privateKey = createPrivateKey(values.get('JWT_PRIVATE_KEY'));
const publicKey = createPublicKey(values.get('JWT_PUBLIC_KEY'));
if (privateKey.asymmetricKeyType !== 'rsa' || publicKey.asymmetricKeyType !== 'rsa') {
  throw new Error('JWT keys must be RSA keys.');
}

const validationPayload = Buffer.from('manglam-jwt-key-pair-validation');
const validationSignature = sign('RSA-SHA256', validationPayload, privateKey);
if (!verify('RSA-SHA256', validationPayload, publicKey, validationSignature)) {
  throw new Error('JWT_PRIVATE_KEY and JWT_PUBLIC_KEY do not form a key pair.');
}

const otpProvider = values.get('OTP_PROVIDER');
if (otpProvider && !['msg91', 'twilio'].includes(otpProvider)) {
  throw new Error('OTP_PROVIDER must be msg91 or twilio.');
}
if (
  otpProvider === 'msg91' &&
  (!values.get('MSG91_AUTH_KEY') || !values.get('MSG91_TEMPLATE_ID'))
) {
  throw new Error('MSG91 credentials are incomplete.');
}
if (
  otpProvider === 'twilio' &&
  (!values.get('TWILIO_ACCOUNT_SID') ||
    !values.get('TWILIO_AUTH_TOKEN') ||
    !values.get('TWILIO_MESSAGING_SERVICE_SID'))
) {
  throw new Error('Twilio credentials are incomplete.');
}

const pushProvider = values.get('PUSH_PROVIDER');
if (pushProvider && !['expo', 'fcm'].includes(pushProvider)) {
  throw new Error('PUSH_PROVIDER must be expo or fcm.');
}
if (pushProvider === 'expo' && !values.get('EXPO_ACCESS_TOKEN')) {
  throw new Error('Expo push credentials are incomplete.');
}
if (
  pushProvider === 'fcm' &&
  (!values.get('FCM_PROJECT_ID') ||
    !values.get('FCM_CLIENT_EMAIL') ||
    !values.get('FCM_PRIVATE_KEY'))
) {
  throw new Error('FCM credentials are incomplete.');
}

console.log(`Validated ${envPath}`);
