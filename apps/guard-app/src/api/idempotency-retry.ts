interface RetainedKey {
  key: string;
  retainedAt: number;
}

const RETENTION_MS = 24 * 60 * 60_000;
const MAX_RETAINED_KEYS = 100;
const retainedKeys = new Map<string, RetainedKey>();

function prune(now: number): void {
  for (const [fingerprint, retained] of retainedKeys) {
    if (now - retained.retainedAt >= RETENTION_MS) retainedKeys.delete(fingerprint);
  }
  while (retainedKeys.size > MAX_RETAINED_KEYS) {
    const oldest = retainedKeys.keys().next().value;
    if (typeof oldest !== 'string') break;
    retainedKeys.delete(oldest);
  }
}

export function idempotencyKeyForRetry(
  fingerprint: string,
  proposedKey: string,
  now: number = Date.now(),
): string {
  prune(now);
  return retainedKeys.get(fingerprint)?.key ?? proposedKey;
}

export function retainIdempotencyKey(
  fingerprint: string,
  key: string,
  now: number = Date.now(),
): void {
  retainedKeys.delete(fingerprint);
  retainedKeys.set(fingerprint, { key, retainedAt: now });
  prune(now);
}

export function releaseIdempotencyKey(fingerprint: string): void {
  retainedKeys.delete(fingerprint);
}

export function resetRetainedIdempotencyKeysForTests(): void {
  retainedKeys.clear();
}
