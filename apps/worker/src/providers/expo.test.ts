import { describe, expect, it } from 'vitest';

import { classifyExpoReceipt } from './expo.js';

describe('classifyExpoReceipt', () => {
  it('classifies delivery and expired endpoints', () => {
    expect(classifyExpoReceipt({ status: 'ok' })).toBe('DELIVERED');
    expect(
      classifyExpoReceipt({ status: 'error', details: { error: 'DeviceNotRegistered' } }),
    ).toBe('ENDPOINT_EXPIRED');
  });

  it('keeps unknown provider outcomes retryable', () => {
    expect(
      classifyExpoReceipt({ status: 'error', details: { error: 'MessageRateExceeded' } }),
    ).toBe('RETRY');
  });
});
