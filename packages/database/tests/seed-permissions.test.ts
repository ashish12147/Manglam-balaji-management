import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  PERMISSION_ACTIONS,
  ROLE_NAMES,
  ROLE_POLICIES,
  type PermissionAction,
} from '@manglam/permissions';
import { describe, expect, it } from 'vitest';

import {
  seedPermissionDefinitions,
  seedRoleDefinitions,
  seedRolePermissionActions,
} from '../prisma/seed-catalog.js';

const directory = dirname(fileURLToPath(import.meta.url));
const seedSource = readFileSync(resolve(directory, '..', 'prisma', 'seed.ts'), 'utf8');

describe('development seed permission contract', () => {
  it('persists the complete canonical permission catalog exactly once', () => {
    const actions = seedPermissionDefinitions.map(({ action }) => action);
    expect(new Set(actions).size).toBe(actions.length);
    expect([...actions].sort()).toEqual([...PERMISSION_ACTIONS].sort());
  });

  it('links every canonical role to exactly its policy actions', () => {
    expect(seedRoleDefinitions.map(({ code }) => code)).toEqual(ROLE_NAMES);
    for (const role of ROLE_NAMES) {
      const expected = (Object.keys(ROLE_POLICIES[role]) as PermissionAction[]).sort();
      expect(seedRolePermissionActions[role]).toEqual(expected);
      expect(new Set(seedRolePermissionActions[role]).size).toBe(expected.length);
    }
  });

  it('keeps identity credentials outside the development seed', () => {
    expect(seedSource).not.toMatch(
      /tx\.(user|userSession|refreshToken|mfaCredential)\.(create|upsert)/,
    );
    expect(seedSource).toContain('ALLOW_DEVELOPMENT_SEED');
    expect(seedSource).toContain('rolePermission.createMany');
  });
});
