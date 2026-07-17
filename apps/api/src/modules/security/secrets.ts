import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export function secretDigest(
  value: string,
  context: readonly string[],
  secret: string,
): string {
  const hmac = createHmac('sha256', secret);
  for (const part of context) {
    hmac.update(`${Buffer.byteLength(part, 'utf8')}:`);
    hmac.update(part, 'utf8');
  }
  hmac.update(`${Buffer.byteLength(value, 'utf8')}:`);
  hmac.update(value, 'utf8');
  return hmac.digest('hex');
}

export function digestMatches(left: string, right: string): boolean {
  if (!/^[a-f0-9]{64}$/i.test(left) || !/^[a-f0-9]{64}$/i.test(right)) {
    return false;
  }
  return timingSafeEqual(Buffer.from(left, 'hex'), Buffer.from(right, 'hex'));
}

export function randomOpaqueToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}
