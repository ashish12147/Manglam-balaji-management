import { createHmac, timingSafeEqual } from 'node:crypto';

const COOKIE_FORMAT_VERSION = 'v1';

export function signRefreshCookie(token: string, secret: string): string {
  if (token.length < 64 || token.length > 512 || secret.length < 32) {
    throw new Error('Refresh cookie input is outside the supported contract.');
  }
  const payload = Buffer.from(token, 'utf8').toString('base64url');
  const unsigned = `${COOKIE_FORMAT_VERSION}.${payload}`;
  const signature = createHmac('sha256', secret)
    .update(unsigned, 'ascii')
    .digest('base64url');
  return `${unsigned}.${signature}`;
}

export function verifyRefreshCookie(
  value: string,
  secret: string,
): string | null {
  if (value.length > 1_024 || secret.length < 32) {
    return null;
  }
  const [version, payload, signature, extra] = value.split('.');
  if (
    extra !== undefined ||
    version !== COOKIE_FORMAT_VERSION ||
    !payload ||
    !signature ||
    !/^[A-Za-z0-9_-]+$/.test(payload) ||
    !/^[A-Za-z0-9_-]+$/.test(signature)
  ) {
    return null;
  }
  const expected = createHmac('sha256', secret)
    .update(`${version}.${payload}`, 'ascii')
    .digest();
  let actual: Buffer;
  try {
    actual = Buffer.from(signature, 'base64url');
  } catch {
    return null;
  }
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    return null;
  }

  try {
    const token = Buffer.from(payload, 'base64url').toString('utf8');
    return token.length >= 64 &&
      token.length <= 512 &&
      Buffer.from(token, 'utf8').toString('base64url') === payload
      ? token
      : null;
  } catch {
    return null;
  }
}
