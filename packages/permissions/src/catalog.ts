const values = <const T extends readonly [string, ...string[]]>(...items: T): Readonly<T> =>
  Object.freeze(items);

export const ROLE_NAMES = values(
  'RESIDENT_OWNER',
  'RESIDENT_TENANT',
  'RESIDENT_FAMILY',
  'GUARD',
  'SECURITY_SUPERVISOR',
  'COMPLAINT_STAFF',
  'ACCOUNTANT',
  'SOCIETY_ADMIN',
  'SUPER_ADMIN',
);
export type RoleName = (typeof ROLE_NAMES)[number];

export const RoleName = Object.freeze(
  Object.fromEntries(ROLE_NAMES.map((role) => [role, role])) as {
    readonly [K in RoleName]: K;
  },
);

export const PERMISSION_SCOPE_KINDS = values(
  'SELF',
  'ACTIVE_FLAT',
  'ASSIGNED_GATE',
  'ASSIGNED_COMPLAINT',
  'TARGETED',
  'SOCIETY',
);
export type PermissionScopeKind = (typeof PERMISSION_SCOPE_KINDS)[number];

interface PermissionDefinitionInput {
  readonly action: string;
  readonly scopes: readonly PermissionScopeKind[];
  readonly requiresRecentAuthentication?: boolean;
  readonly requiresReason?: boolean;
}

const permission = <const T extends PermissionDefinitionInput>(definition: T): Readonly<T> =>
  Object.freeze(definition);

export const PERMISSION_CATALOG = Object.freeze([
  permission({ action: 'account.read_self', scopes: ['SELF'] }),
  permission({ action: 'account.manage_self', scopes: ['SELF'] }),
  permission({ action: 'session.read_self', scopes: ['SELF'] }),
  permission({ action: 'session.revoke_self', scopes: ['SELF'] }),
  permission({ action: 'society.read', scopes: ['SOCIETY'] }),
  permission({ action: 'society.manage', scopes: ['SOCIETY'] }),
  permission({ action: 'membership.request', scopes: ['SELF'] }),
  permission({ action: 'membership.read_flat', scopes: ['ACTIVE_FLAT', 'SOCIETY'] }),
  permission({ action: 'membership.manage_flat', scopes: ['ACTIVE_FLAT', 'SOCIETY'] }),
  permission({ action: 'membership.approve', scopes: ['SOCIETY'] }),
  permission({ action: 'membership.reject', scopes: ['SOCIETY'], requiresReason: true }),
  permission({ action: 'membership.suspend', scopes: ['SOCIETY'], requiresReason: true }),
  permission({
    action: 'membership.end',
    scopes: ['ACTIVE_FLAT', 'SOCIETY'],
    requiresReason: true,
  }),
  permission({ action: 'resident.directory_gate', scopes: ['ASSIGNED_GATE', 'SOCIETY'] }),
  permission({ action: 'resident.read_all', scopes: ['SOCIETY'] }),
  permission({ action: 'guard.read_gate', scopes: ['ASSIGNED_GATE', 'SOCIETY'] }),
  permission({ action: 'guard.manage', scopes: ['SOCIETY'] }),
  permission({ action: 'guard.device_enroll', scopes: ['ASSIGNED_GATE', 'SOCIETY'] }),
  permission({
    action: 'guard.device_revoke',
    scopes: ['ASSIGNED_GATE', 'SOCIETY'],
    requiresReason: true,
  }),
  permission({ action: 'visitor.preapprove', scopes: ['ACTIVE_FLAT'] }),
  permission({ action: 'visitor.cancel_preapproval', scopes: ['ACTIVE_FLAT'] }),
  permission({ action: 'visitor.create_request', scopes: ['ASSIGNED_GATE'] }),
  permission({ action: 'visitor.read_flat', scopes: ['ACTIVE_FLAT'] }),
  permission({ action: 'visitor.read_gate', scopes: ['ASSIGNED_GATE'] }),
  permission({ action: 'visitor.read_all', scopes: ['SOCIETY'] }),
  permission({ action: 'visitor.approve', scopes: ['ACTIVE_FLAT'] }),
  permission({ action: 'visitor.reject', scopes: ['ACTIVE_FLAT'] }),
  permission({ action: 'visitor.check_in', scopes: ['ASSIGNED_GATE', 'SOCIETY'] }),
  permission({ action: 'visitor.check_out', scopes: ['ASSIGNED_GATE', 'SOCIETY'] }),
  permission({
    action: 'visitor.override',
    scopes: ['ASSIGNED_GATE', 'SOCIETY'],
    requiresRecentAuthentication: true,
    requiresReason: true,
  }),
  permission({ action: 'daily_help.read_flat', scopes: ['ACTIVE_FLAT'] }),
  permission({ action: 'daily_help.manage_assignment', scopes: ['ACTIVE_FLAT', 'SOCIETY'] }),
  permission({ action: 'daily_help.read_gate', scopes: ['ASSIGNED_GATE'] }),
  permission({ action: 'daily_help.manage', scopes: ['SOCIETY'] }),
  permission({ action: 'daily_help.attendance', scopes: ['ASSIGNED_GATE', 'SOCIETY'] }),
  permission({ action: 'parcel.read_flat', scopes: ['ACTIVE_FLAT'] }),
  permission({ action: 'parcel.decide', scopes: ['ACTIVE_FLAT'] }),
  permission({ action: 'parcel.read_gate', scopes: ['ASSIGNED_GATE'] }),
  permission({ action: 'parcel.record', scopes: ['ASSIGNED_GATE', 'SOCIETY'] }),
  permission({ action: 'parcel.collect', scopes: ['ASSIGNED_GATE', 'SOCIETY'] }),
  permission({
    action: 'parcel.return',
    scopes: ['ASSIGNED_GATE', 'SOCIETY'],
    requiresReason: true,
  }),
  permission({ action: 'parcel.read_all', scopes: ['SOCIETY'] }),
  permission({ action: 'notice.read', scopes: ['TARGETED', 'SOCIETY'] }),
  permission({ action: 'notice.acknowledge', scopes: ['TARGETED'] }),
  permission({ action: 'notice.create', scopes: ['SOCIETY'] }),
  permission({ action: 'notice.publish', scopes: ['SOCIETY'] }),
  permission({ action: 'notice.manage', scopes: ['SOCIETY'] }),
  permission({ action: 'complaint.create', scopes: ['ACTIVE_FLAT'] }),
  permission({ action: 'complaint.read_flat', scopes: ['ACTIVE_FLAT'] }),
  permission({ action: 'complaint.read_assigned', scopes: ['ASSIGNED_COMPLAINT'] }),
  permission({ action: 'complaint.read_all', scopes: ['SOCIETY'] }),
  permission({
    action: 'complaint.comment',
    scopes: ['ACTIVE_FLAT', 'ASSIGNED_COMPLAINT', 'SOCIETY'],
  }),
  permission({ action: 'complaint.assign', scopes: ['SOCIETY'] }),
  permission({ action: 'complaint.update', scopes: ['ASSIGNED_COMPLAINT', 'SOCIETY'] }),
  permission({ action: 'complaint.internal_note', scopes: ['ASSIGNED_COMPLAINT', 'SOCIETY'] }),
  permission({ action: 'complaint.resolve', scopes: ['ASSIGNED_COMPLAINT', 'SOCIETY'] }),
  permission({ action: 'complaint.reopen', scopes: ['ACTIVE_FLAT'] }),
  permission({
    action: 'complaint.cancel',
    scopes: ['ACTIVE_FLAT', 'SOCIETY'],
    requiresReason: true,
  }),
  permission({ action: 'dues.read_flat', scopes: ['ACTIVE_FLAT'] }),
  permission({ action: 'dues.read_all', scopes: ['SOCIETY'] }),
  permission({ action: 'dues.manage', scopes: ['SOCIETY'] }),
  permission({ action: 'payment.record', scopes: ['SOCIETY'] }),
  permission({ action: 'payment.read_flat', scopes: ['ACTIVE_FLAT'] }),
  permission({ action: 'payment.read_all', scopes: ['SOCIETY'] }),
  permission({
    action: 'payment.reverse',
    scopes: ['SOCIETY'],
    requiresRecentAuthentication: true,
    requiresReason: true,
  }),
  permission({ action: 'receipt.generate', scopes: ['SOCIETY'] }),
  permission({ action: 'receipt.read_flat', scopes: ['ACTIVE_FLAT'] }),
  permission({ action: 'receipt.read_all', scopes: ['SOCIETY'] }),
  permission({
    action: 'receipt.void',
    scopes: ['SOCIETY'],
    requiresRecentAuthentication: true,
    requiresReason: true,
  }),
  permission({ action: 'emergency.create', scopes: ['ACTIVE_FLAT'] }),
  permission({ action: 'emergency.read_active', scopes: ['ASSIGNED_GATE', 'SOCIETY'] }),
  permission({ action: 'emergency.acknowledge', scopes: ['ASSIGNED_GATE', 'SOCIETY'] }),
  permission({ action: 'emergency.respond', scopes: ['ASSIGNED_GATE', 'SOCIETY'] }),
  permission({
    action: 'emergency.resolve',
    scopes: ['ASSIGNED_GATE', 'SOCIETY'],
    requiresReason: true,
  }),
  permission({ action: 'notification.read_self', scopes: ['SELF'] }),
  permission({ action: 'notification.manage_preferences', scopes: ['SELF'] }),
  permission({ action: 'notification.diagnostics', scopes: ['SOCIETY'] }),
  permission({
    action: 'file.upload',
    scopes: ['ACTIVE_FLAT', 'ASSIGNED_GATE', 'ASSIGNED_COMPLAINT', 'SOCIETY'],
  }),
  permission({
    action: 'file.download',
    scopes: ['ACTIVE_FLAT', 'ASSIGNED_GATE', 'ASSIGNED_COMPLAINT', 'TARGETED', 'SOCIETY'],
  }),
  permission({ action: 'role.read', scopes: ['SOCIETY'] }),
  permission({
    action: 'role.manage',
    scopes: ['SOCIETY'],
    requiresRecentAuthentication: true,
    requiresReason: true,
  }),
  permission({ action: 'audit.read', scopes: ['ASSIGNED_GATE', 'SOCIETY'] }),
  permission({ action: 'report.export', scopes: ['ASSIGNED_GATE', 'SOCIETY'] }),
] as const);

export type PermissionAction = (typeof PERMISSION_CATALOG)[number]['action'];
export type PermissionDefinition = (typeof PERMISSION_CATALOG)[number];

export const PERMISSION_ACTIONS: readonly PermissionAction[] = Object.freeze(
  PERMISSION_CATALOG.map(({ action }) => action),
);

export const PERMISSION_BY_ACTION: Readonly<Record<PermissionAction, PermissionDefinition>> =
  Object.freeze(
    Object.fromEntries(
      PERMISSION_CATALOG.map((definition) => [definition.action, definition]),
    ) as Record<PermissionAction, PermissionDefinition>,
  );
