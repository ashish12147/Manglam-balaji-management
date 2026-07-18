import { describe, expect, it } from 'vitest';

import { hasPermission } from './permissions';

describe('hasPermission', () => {
  it('matches exact and module wildcard permissions', () => {
    expect(hasPermission({ permissions: ['visitor.read_all'] }, 'visitor.read_all')).toBe(true);
    expect(hasPermission({ permissions: ['visitor.*'] }, 'visitor.override.read')).toBe(true);
  });

  it('does not infer access from a related permission', () => {
    expect(hasPermission({ permissions: ['visitor.read_all'] }, 'visitor.override')).toBe(false);
  });

  it('recognises the server-assigned super admin role', () => {
    expect(hasPermission({ roles: [{ code: 'SUPER_ADMIN' }] }, 'audit.read')).toBe(true);
  });

  it('denies unauthenticated subjects', () => {
    expect(hasPermission(null, 'society.read')).toBe(false);
  });
});
