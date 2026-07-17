import type { PermissionAction, PermissionScopeKind, RoleName } from './catalog.js';

export type RolePolicy = Readonly<
  Partial<Record<PermissionAction, readonly PermissionScopeKind[]>>
>;

const grant = (scope: PermissionScopeKind, ...actions: readonly PermissionAction[]): RolePolicy =>
  Object.fromEntries(actions.map((action) => [action, Object.freeze([scope])])) as Record<
    PermissionAction,
    readonly PermissionScopeKind[]
  >;

const merge = (...policies: readonly RolePolicy[]): RolePolicy => {
  const merged: Partial<Record<PermissionAction, readonly PermissionScopeKind[]>> = {};
  for (const policy of policies) {
    for (const [action, scopes] of Object.entries(policy) as [
      PermissionAction,
      readonly PermissionScopeKind[],
    ][]) {
      merged[action] = Object.freeze([...new Set([...(merged[action] ?? []), ...scopes])]);
    }
  }
  return Object.freeze(merged);
};

const SELF_POLICY = grant(
  'SELF',
  'account.read_self',
  'account.manage_self',
  'session.read_self',
  'session.revoke_self',
  'membership.request',
  'notification.read_self',
  'notification.manage_preferences',
);

const RESIDENT_READ_POLICY = merge(
  grant(
    'ACTIVE_FLAT',
    'membership.read_flat',
    'visitor.preapprove',
    'visitor.cancel_preapproval',
    'visitor.read_flat',
    'visitor.approve',
    'visitor.reject',
    'daily_help.read_flat',
    'parcel.read_flat',
    'parcel.decide',
    'complaint.create',
    'complaint.read_flat',
    'complaint.comment',
    'complaint.reopen',
    'complaint.cancel',
    'dues.read_flat',
    'payment.read_flat',
    'receipt.read_flat',
    'emergency.create',
    'file.upload',
    'file.download',
  ),
  grant('TARGETED', 'notice.read', 'notice.acknowledge', 'file.download'),
);

const RESIDENT_MANAGER_POLICY = grant(
  'ACTIVE_FLAT',
  'membership.manage_flat',
  'membership.end',
  'daily_help.manage_assignment',
);

const GUARD_POLICY = merge(
  SELF_POLICY,
  grant(
    'ASSIGNED_GATE',
    'resident.directory_gate',
    'guard.read_gate',
    'visitor.create_request',
    'visitor.read_gate',
    'visitor.check_in',
    'visitor.check_out',
    'daily_help.read_gate',
    'daily_help.attendance',
    'parcel.read_gate',
    'parcel.record',
    'parcel.collect',
    'parcel.return',
    'emergency.read_active',
    'emergency.acknowledge',
    'emergency.respond',
    'file.upload',
    'file.download',
  ),
);

const SOCIETY_ADMIN_ACTIONS: readonly PermissionAction[] = [
  'society.read',
  'society.manage',
  'membership.read_flat',
  'membership.manage_flat',
  'membership.approve',
  'membership.reject',
  'membership.suspend',
  'membership.end',
  'resident.directory_gate',
  'resident.read_all',
  'guard.read_gate',
  'guard.manage',
  'guard.device_enroll',
  'guard.device_revoke',
  'visitor.read_all',
  'visitor.check_in',
  'visitor.check_out',
  'visitor.override',
  'daily_help.manage_assignment',
  'daily_help.manage',
  'daily_help.attendance',
  'parcel.record',
  'parcel.collect',
  'parcel.return',
  'parcel.read_all',
  'notice.read',
  'notice.create',
  'notice.publish',
  'notice.manage',
  'complaint.read_all',
  'complaint.comment',
  'complaint.assign',
  'complaint.update',
  'complaint.internal_note',
  'complaint.resolve',
  'complaint.cancel',
  'dues.read_all',
  'dues.manage',
  'payment.record',
  'payment.read_all',
  'payment.reverse',
  'receipt.generate',
  'receipt.read_all',
  'receipt.void',
  'emergency.read_active',
  'emergency.acknowledge',
  'emergency.respond',
  'emergency.resolve',
  'notification.diagnostics',
  'file.upload',
  'file.download',
  'role.read',
  'role.manage',
  'audit.read',
  'report.export',
];

export const ROLE_POLICIES: Readonly<Record<RoleName, RolePolicy>> = Object.freeze({
  RESIDENT_OWNER: merge(SELF_POLICY, RESIDENT_READ_POLICY, RESIDENT_MANAGER_POLICY),
  RESIDENT_TENANT: merge(SELF_POLICY, RESIDENT_READ_POLICY, RESIDENT_MANAGER_POLICY),
  RESIDENT_FAMILY: merge(SELF_POLICY, RESIDENT_READ_POLICY),
  GUARD: GUARD_POLICY,
  SECURITY_SUPERVISOR: merge(
    GUARD_POLICY,
    grant(
      'ASSIGNED_GATE',
      'visitor.override',
      'guard.device_enroll',
      'guard.device_revoke',
      'emergency.resolve',
      'audit.read',
      'report.export',
    ),
  ),
  COMPLAINT_STAFF: merge(
    SELF_POLICY,
    grant(
      'ASSIGNED_COMPLAINT',
      'complaint.read_assigned',
      'complaint.comment',
      'complaint.update',
      'complaint.internal_note',
      'complaint.resolve',
      'file.upload',
      'file.download',
    ),
  ),
  ACCOUNTANT: merge(
    SELF_POLICY,
    grant(
      'SOCIETY',
      'society.read',
      'dues.read_all',
      'dues.manage',
      'payment.record',
      'payment.read_all',
      'receipt.generate',
      'receipt.read_all',
      'report.export',
    ),
  ),
  SOCIETY_ADMIN: merge(SELF_POLICY, grant('SOCIETY', ...SOCIETY_ADMIN_ACTIONS)),
  SUPER_ADMIN: merge(SELF_POLICY, grant('SOCIETY', ...SOCIETY_ADMIN_ACTIONS)),
});
