import { createPrivateKey, createPublicKey, sign, verify } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const supportedOptions = new Set(['--require-providers']);
const unknownOption = args.find(
  (argument) => argument.startsWith('--') && !supportedOptions.has(argument),
);
if (unknownOption) throw new Error(`Unknown option: ${unknownOption}`);

const paths = args.filter((argument) => !argument.startsWith('--'));
if (paths.length > 1) {
  throw new Error(
    'Usage: node scripts/Validate-Infrastructure.mjs [env-file] [--require-providers]',
  );
}

const requireProviders = args.includes('--require-providers');
const envPath = resolve(root, paths[0] ?? 'infrastructure/.env.local');

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
  if (!/^[A-Z][A-Z0-9_]*$/.test(key)) throw new Error(`Malformed environment key: ${key}`);
  if (values.has(key)) throw new Error(`Duplicate environment key: ${key}`);

  const rawValue = line.slice(separator + 1);
  let value = rawValue;
  if (rawValue.startsWith('"')) {
    value = JSON.parse(rawValue);
    if (typeof value !== 'string') throw new Error(`${key} must be a string.`);
  }
  values.set(key, value);
}

const requiredValue = (key) => {
  const value = values.get(key);
  if (!value) throw new Error(`${key} is required.`);
  return value;
};

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
  const value = requiredValue(key);
  if (value.length < 32) throw new Error(`${key} must contain at least 32 characters.`);
  if (/change-?me|replace|password|secret/i.test(value)) {
    throw new Error(`${key} appears to contain a placeholder.`);
  }
}

const secretOwners = new Map();
for (const key of requiredSecrets) {
  const value = values.get(key);
  const previousOwner = secretOwners.get(value);
  if (previousOwner) throw new Error(`${key} must be distinct from ${previousOwner}.`);
  secretOwners.set(value, key);
}

const postgresDatabase = requiredValue('POSTGRES_DB');
const postgresUser = requiredValue('POSTGRES_USER');
const postgresPassword = requiredValue('POSTGRES_PASSWORD');
const redisPassword = requiredValue('REDIS_PASSWORD');
if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,62}$/.test(postgresDatabase)) {
  throw new Error('POSTGRES_DB must be safe for the unescaped local connection URL.');
}
if (!/^[A-Za-z0-9][A-Za-z0-9._~-]{0,62}$/.test(postgresUser)) {
  throw new Error('POSTGRES_USER must be safe for the unescaped local connection URL.');
}
for (const [key, value] of [
  ['POSTGRES_PASSWORD', postgresPassword],
  ['REDIS_PASSWORD', redisPassword],
]) {
  if (!/^[A-Za-z0-9._~-]+$/.test(value)) {
    throw new Error(`${key} must use URI-unreserved characters for the local connection URL.`);
  }
}

const minioRootUser = requiredValue('MINIO_ROOT_USER');
const minioAppAccessKey = requiredValue('MINIO_APP_ACCESS_KEY');
for (const [key, value] of [
  ['MINIO_ROOT_USER', minioRootUser],
  ['MINIO_APP_ACCESS_KEY', minioAppAccessKey],
]) {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{2,63}$/.test(value)) {
    throw new Error(`${key} must be a 3-64 character MinIO-compatible access key.`);
  }
}
if (minioRootUser === minioAppAccessKey) {
  throw new Error('MINIO_ROOT_USER and MINIO_APP_ACCESS_KEY must identify different users.');
}

const bucket = requiredValue('S3_BUCKET');
const bucketLabels = bucket.split('.');
const bucketIsIpv4 = /^(?:\d{1,3}\.){3}\d{1,3}$/.test(bucket);
if (
  bucket.length < 3 ||
  bucket.length > 63 ||
  bucketIsIpv4 ||
  bucketLabels.some((label) => !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label))
) {
  throw new Error('S3_BUCKET must be a DNS-compatible bucket name.');
}

requiredValue('S3_REGION');

const mfaEncryptionKey = requiredValue('MFA_ENCRYPTION_KEY_BASE64');
const decodedMfaEncryptionKey = Buffer.from(mfaEncryptionKey, 'base64');
if (
  !/^[A-Za-z0-9+/]+={0,2}$/.test(mfaEncryptionKey) ||
  decodedMfaEncryptionKey.length !== 32 ||
  decodedMfaEncryptionKey.toString('base64') !== mfaEncryptionKey
) {
  throw new Error('MFA_ENCRYPTION_KEY_BASE64 must be canonical base64 for exactly 32 bytes.');
}
const mfaEncryptionKeyVersionValue = requiredValue('MFA_ENCRYPTION_KEY_VERSION');
const mfaEncryptionKeyVersion = Number(mfaEncryptionKeyVersionValue);
if (
  !Number.isSafeInteger(mfaEncryptionKeyVersion) ||
  mfaEncryptionKeyVersion < 1 ||
  String(mfaEncryptionKeyVersion) !== mfaEncryptionKeyVersionValue
) {
  throw new Error('MFA_ENCRYPTION_KEY_VERSION must be a canonical positive integer.');
}

const privateKeyPem = requiredValue('JWT_PRIVATE_KEY');
const publicKeyPem = requiredValue('JWT_PUBLIC_KEY');
if (!privateKeyPem.includes('-----BEGIN PRIVATE KEY-----')) {
  throw new Error('JWT_PRIVATE_KEY must be a PKCS#8 private key.');
}
if (!publicKeyPem.includes('-----BEGIN PUBLIC KEY-----')) {
  throw new Error('JWT_PUBLIC_KEY must contain only a public key.');
}

const privateKey = createPrivateKey(privateKeyPem);
const publicKey = createPublicKey(publicKeyPem);
if (privateKey.asymmetricKeyType !== 'rsa' || publicKey.asymmetricKeyType !== 'rsa') {
  throw new Error('JWT keys must be RSA keys.');
}
if (
  (privateKey.asymmetricKeyDetails?.modulusLength ?? 0) < 3072 ||
  (publicKey.asymmetricKeyDetails?.modulusLength ?? 0) < 3072
) {
  throw new Error('JWT RSA keys must have a modulus of at least 3072 bits.');
}

const validationPayload = Buffer.from('manglam-jwt-key-pair-validation');
const validationSignature = sign('RSA-SHA256', validationPayload, privateKey);
if (!verify('RSA-SHA256', validationPayload, publicKey, validationSignature)) {
  throw new Error('JWT_PRIVATE_KEY and JWT_PUBLIC_KEY do not form a key pair.');
}

const otpProvider = values.get('OTP_PROVIDER');
const pushProvider = values.get('PUSH_PROVIDER');
if (requireProviders && (!otpProvider || !pushProvider)) {
  throw new Error('OTP_PROVIDER and PUSH_PROVIDER are required for the app profile.');
}
if (otpProvider && !['msg91', 'twilio'].includes(otpProvider)) {
  throw new Error('OTP_PROVIDER must be msg91 or twilio.');
}
if (
  otpProvider === 'msg91' &&
  ((values.get('MSG91_AUTH_KEY')?.length ?? 0) < 16 ||
    (values.get('MSG91_TEMPLATE_ID')?.length ?? 0) < 4)
) {
  throw new Error('MSG91 credentials are incomplete.');
}
if (
  otpProvider === 'twilio' &&
  (!/^AC[0-9a-f]{32}$/i.test(values.get('TWILIO_ACCOUNT_SID') ?? '') ||
    (values.get('TWILIO_AUTH_TOKEN')?.length ?? 0) < 20 ||
    !/^MG[0-9a-f]{32}$/i.test(values.get('TWILIO_MESSAGING_SERVICE_SID') ?? ''))
) {
  throw new Error('Twilio credentials are incomplete.');
}

if (pushProvider && !['expo', 'fcm'].includes(pushProvider)) {
  throw new Error('PUSH_PROVIDER must be expo or fcm.');
}
if (pushProvider === 'expo' && (values.get('EXPO_ACCESS_TOKEN')?.length ?? 0) < 20) {
  throw new Error('Expo push credentials are incomplete.');
}
if (
  pushProvider === 'fcm' &&
  ((values.get('FCM_PROJECT_ID')?.length ?? 0) < 4 ||
    !values.get('FCM_CLIENT_EMAIL')?.includes('@') ||
    (values.get('FCM_PRIVATE_KEY')?.length ?? 0) < 64)
) {
  throw new Error('FCM credentials are incomplete.');
}

const validationScope = requireProviders ? ' for the app profile' : '';
console.log(`Validated ${envPath}${validationScope}`);
