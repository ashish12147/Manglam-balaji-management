import { describe, expect, it } from 'vitest';

import { normalizeCorrelationId } from './correlation-id.middleware.js';

describe('normalizeCorrelationId', () => {
  it('preserves a valid caller correlation id', () => {
    expect(normalizeCorrelationId('request-019f70d1')).toBe('request-019f70d1');
  });

  it('replaces malformed values with a UUID', () => {
    expect(normalizeCorrelationId('bad value')).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it('uses the first value when a proxy provides multiple ids', () => {
    expect(normalizeCorrelationId(['first-request-id', 'second-request-id'])).toBe(
      'first-request-id',
    );
  });
});
