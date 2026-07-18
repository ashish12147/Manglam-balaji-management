import { createHmac, timingSafeEqual } from 'node:crypto';

const TOTP_DIGITS = 6;
const TOTP_PERIOD_SECONDS = 30;
const CLOCK_SKEW_STEPS = [0n, -1n, 1n] as const;

export function verifyTotpCode(input: {
  readonly candidate: string;
  readonly lastUsedStep: bigint | null;
  readonly now: Date;
  readonly secret: Buffer;
}): bigint | null {
  if (
    !/^\d{6}$/.test(input.candidate) ||
    input.secret.length < 20 ||
    input.secret.length > 128
  ) {
    return null;
  }

  const candidate = Buffer.from(input.candidate, 'ascii');
  const currentStep = BigInt(
    Math.floor(input.now.getTime() / 1_000 / TOTP_PERIOD_SECONDS),
  );
  for (const offset of CLOCK_SKEW_STEPS) {
    const step = currentStep + offset;
    if (step < 0n || (input.lastUsedStep !== null && step <= input.lastUsedStep)) {
      continue;
    }
    const expected = Buffer.from(totpAt(input.secret, step), 'ascii');
    if (
      candidate.length === expected.length &&
      timingSafeEqual(candidate, expected)
    ) {
      return step;
    }
  }
  return null;
}

function totpAt(secret: Buffer, step: bigint): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(step);
  const digest = createHmac('sha1', secret).update(counter).digest();
  const offset = digest[digest.length - 1]! & 0x0f;
  const binary =
    ((digest[offset]! & 0x7f) << 24) |
    ((digest[offset + 1]! & 0xff) << 16) |
    ((digest[offset + 2]! & 0xff) << 8) |
    (digest[offset + 3]! & 0xff);
  return String(binary % 10 ** TOTP_DIGITS).padStart(TOTP_DIGITS, '0');
}
