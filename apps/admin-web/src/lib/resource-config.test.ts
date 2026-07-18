import { describe, expect, it } from 'vitest';

import { ADMIN_PATHS, RESOURCE_CONFIGS } from './resource-config';

describe('admin route inventory', () => {
  it('contains unique route paths and resource keys', () => {
    expect(new Set(RESOURCE_CONFIGS.map((config) => config.path)).size).toBe(
      RESOURCE_CONFIGS.length,
    );
    expect(new Set(RESOURCE_CONFIGS.map((config) => config.key)).size).toBe(
      RESOURCE_CONFIGS.length,
    );
  });

  it('defines a permission and endpoint-shaped API contract for every resource', () => {
    RESOURCE_CONFIGS.forEach((config) => {
      expect(config.permission).not.toBe('');
      expect(config.endpoint.startsWith('/')).toBe(true);
      expect(config.columns.length).toBeGreaterThan(0);
    });
  });

  it('covers the required custom routes', () => {
    expect(ADMIN_PATHS).toEqual(
      expect.objectContaining({
        has: expect.any(Function),
      }),
    );
    expect(ADMIN_PATHS.has('dashboard')).toBe(true);
    expect(ADMIN_PATHS.has('society/settings')).toBe(true);
    expect(ADMIN_PATHS.has('communication/notices/new')).toBe(true);
    expect(ADMIN_PATHS.has('account/sessions')).toBe(true);
  });
});
