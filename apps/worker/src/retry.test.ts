import { describe, expect, it } from 'vitest';

import { errorCode, errorDetail, retryDelayMs } from './retry.js';

describe('retry policy', () => {
  it('applies bounded exponential backoff with jitter', () => {
    expect(retryDelayMs(1, () => 0)).toBe(500);
    expect(retryDelayMs(2, () => 0.5)).toBe(2000);
    expect(retryDelayMs(30, () => 1)).toBe(3_600_000);
    expect(() => retryDelayMs(0)).toThrow();
    expect(() => retryDelayMs(1, () => 2)).toThrow();
  });

  it('persists only sanitized error classification and generic detail', () => {
    expect(errorCode({ code: 'provider.timeout' })).toBe('PROVIDER_TIMEOUT');
    expect(errorCode(new Error('plaintextCode=123456'))).toBe('WORKER_FAILURE');
    expect(errorDetail(new Error('plaintextCode=123456'))).not.toContain('123456');
  });
});
