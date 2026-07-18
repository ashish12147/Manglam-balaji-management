import {
  PERMISSION_CATALOG,
  ROLE_NAMES,
  ROLE_POLICIES,
  type PermissionAction,
  type RoleName,
} from '@manglam/permissions';

interface SeedRoleDefinition {
  readonly code: RoleName;
  readonly name: string;
  readonly privilegeLevel: number;
}

const ROLE_METADATA: Readonly<Record<RoleName, Omit<SeedRoleDefinition, 'code'>>> = {
  RESIDENT_OWNER: { name: 'Resident owner', privilegeLevel: 10 },
  RESIDENT_TENANT: { name: 'Resident tenant', privilegeLevel: 10 },
  RESIDENT_FAMILY: { name: 'Resident family member', privilegeLevel: 5 },
  GUARD: { name: 'Security guard', privilegeLevel: 20 },
  SECURITY_SUPERVISOR: { name: 'Security supervisor', privilegeLevel: 30 },
  COMPLAINT_STAFF: { name: 'Complaint staff', privilegeLevel: 30 },
  ACCOUNTANT: { name: 'Society accountant', privilegeLevel: 35 },
  SOCIETY_ADMIN: { name: 'Society administrator', privilegeLevel: 50 },
  SUPER_ADMIN: { name: 'Society super administrator', privilegeLevel: 60 },
};

function permissionRiskLevel(definition: object): number {
  if (
    'requiresRecentAuthentication' in definition &&
    definition.requiresRecentAuthentication === true
  ) {
    return 80;
  }
  if ('requiresReason' in definition && definition.requiresReason === true) return 50;
  return 20;
}

export const seedPermissionDefinitions = Object.freeze(
  PERMISSION_CATALOG.map((definition) =>
    Object.freeze({
      action: definition.action,
      description: `Allowed scopes: ${definition.scopes.join(', ')}`,
      riskLevel: permissionRiskLevel(definition),
    }),
  ),
);

export const seedRoleDefinitions: readonly SeedRoleDefinition[] = Object.freeze(
  ROLE_NAMES.map((code) => Object.freeze({ code, ...ROLE_METADATA[code] })),
);

export const seedRolePermissionActions: Readonly<Record<RoleName, readonly PermissionAction[]>> =
  Object.freeze(
    Object.fromEntries(
      ROLE_NAMES.map((role) => [
        role,
        Object.freeze((Object.keys(ROLE_POLICIES[role]) as PermissionAction[]).sort()),
      ]),
    ) as Record<RoleName, readonly PermissionAction[]>,
  );
