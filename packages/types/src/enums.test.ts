import { describe, expect, it } from 'vitest';

import * as contracts from './enums.js';

const statusCollections = Object.entries(contracts)
  .filter(([name, value]) => name.endsWith('_STATUSES') && Array.isArray(value))
  .map(([name, value]) => [name, value as readonly string[]] as const);

describe('runtime enum contracts', () => {
  it('keeps every status collection non-empty, unique, and frozen', () => {
    expect(statusCollections.length).toBeGreaterThanOrEqual(15);

    for (const [name, values] of statusCollections) {
      expect(values.length, name).toBeGreaterThan(0);
      expect(new Set(values).size, name).toBe(values.length);
      expect(Object.isFrozen(values), name).toBe(true);
    }
  });

  it('exposes enum objects whose keys and values exactly match their status arrays', () => {
    for (const [arrayName, values] of statusCollections) {
      const enumName =
        arrayName
          .replace(/_STATUSES$/, '')
          .toLowerCase()
          .split('_')
          .map((part) => part[0]?.toUpperCase() + part.slice(1))
          .join('') + 'Status';
      const enumValue = contracts[enumName as keyof typeof contracts];

      expect(enumValue, `${enumName} for ${arrayName}`).toBeDefined();
      expect(Object.keys(enumValue as object).sort()).toEqual([...values].sort());
      expect(Object.values(enumValue as object).sort()).toEqual([...values].sort());
    }
  });
});
