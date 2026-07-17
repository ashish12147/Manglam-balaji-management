import { createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';

const MANUAL_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export const generateNumericCode = (length: number): string => {
  if (!Number.isSafeInteger(length) || length < 4 || length > 12) {
    throw new RangeError('Numeric code length must be between 4 and 12.');
  }

  let code = '';
  for (let index = 0; index < length; index += 1) {
    code += randomInt(0, 10).toString();
  }
  return code;
};

export const generateManualVisitorCode = (length = 10): string => {
  if (!Number.isSafeInteger(length) || length < 8 || length > 32) {
    throw new RangeError('Manual visitor code length must be between 8 and 32.');
  }

  let code = '';
  for (let index = 0; index < length; index += 1) {
    code += MANUAL_CODE_ALPHABET[randomInt(0, MANUAL_CODE_ALPHABET.length)];
  }
  return code;
};

export const generateQrToken = (bytes = 16): string => {
  if (!Number.isSafeInteger(bytes) || bytes < 16 || bytes > 64) {
    throw new RangeError('QR tokens require between 16 and 64 random bytes.');
  }
  return randomBytes(bytes).toString('base64url');
};

const lengthPrefix = (value: string): string => `${Buffer.byteLength(value, 'utf8')}:${value}`;

export const digestSecret = (
  secret: string,
  contextParts: readonly string[],
  pepper: string,
): string => {
  if (pepper.length < 32) {
    throw new Error('Secret pepper must contain at least 32 characters.');
  }
  const context = contextParts.map(lengthPrefix).join('|');
  return createHmac('sha256', pepper)
    .update(lengthPrefix(context))
    .update(lengthPrefix(secret))
    .digest('hex');
};

export const constantTimeDigestEqual = (left: string, right: string): boolean => {
  if (!/^[a-f0-9]{64}$/i.test(left) || !/^[a-f0-9]{64}$/i.test(right)) return false;
  return timingSafeEqual(Buffer.from(left, 'hex'), Buffer.from(right, 'hex'));
};

export const verifySecret = (
  candidate: string,
  expectedDigest: string,
  contextParts: readonly string[],
  pepper: string,
): boolean =>
  constantTimeDigestEqual(digestSecret(candidate, contextParts, pepper), expectedDigest);
