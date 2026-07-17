import { describe, expect, it } from 'vitest';

import { countdownLabel, formatCurrency, formatDate, formatDateTime } from '@/lib/format';

describe('resident presentation helpers', () => {
  it('returns an honest unavailable label for absent or invalid date values', () => {
    expect(formatDate(null)).toBe('Not available');
    expect(formatDateTime('not-a-date')).toBe('Not available');
  });

  it('formats known monetary values as INR', () => {
    expect(formatCurrency('1250.5')).toContain('1,250.50');
  });

  it('does not present expired approval windows as active', () => {
    expect(countdownLabel(new Date(Date.now() - 1000).toISOString())).toBe('Expired');
  });
});
