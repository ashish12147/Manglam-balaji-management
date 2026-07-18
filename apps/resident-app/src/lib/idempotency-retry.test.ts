import { beforeEach, describe, expect, it } from 'vitest';

import {
  idempotencyKeyForRetry,
  releaseIdempotencyKey,
  resetRetainedIdempotencyKeysForTests,
  retainIdempotencyKey,
} from './idempotency-retry';

describe('ambiguous idempotency retries', () => {
  beforeEach(resetRetainedIdempotencyKeysForTests);

  it('reuses the original key after an ambiguous transport failure', () => {
    retainIdempotencyKey('request-a', 'original', 1_000);
    expect(idempotencyKeyForRetry('request-a', 'new', 2_000)).toBe('original');
  });

  it('releases the key after a definitive response', () => {
    retainIdempotencyKey('request-a', 'original', 1_000);
    releaseIdempotencyKey('request-a');
    expect(idempotencyKeyForRetry('request-a', 'new', 2_000)).toBe('new');
  });

  it('expires retained keys with the server idempotency window', () => {
    retainIdempotencyKey('request-a', 'original', 1_000);
    expect(
      idempotencyKeyForRetry('request-a', 'new', 1_000 + 24 * 60 * 60_000),
    ).toBe('new');
  });
});
