import type { UUID } from '@manglam/types';

import {
  PERMISSION_BY_ACTION,
  type PermissionAction,
  type PermissionScopeKind,
  type RoleName,
} from './catalog.js';
import { ROLE_POLICIES } from './policies.js';

export interface DirectPermissionGrant {
  readonly action: PermissionAction;
  readonly scopes: readonly PermissionScopeKind[];
}

export interface AuthorizationActor {
  readonly userId: UUID;
  readonly societyId: UUID;
  readonly active: boolean;
  readonly roles: readonly RoleName[];
  readonly activeFlatIds: readonly UUID[];
  readonly assignedGateIds: readonly UUID[];
  readonly assignedComplaintIds: readonly UUID[];
  readonly directGrants?: readonly DirectPermissionGrant[];
  readonly deniedActions?: readonly PermissionAction[];
}

export interface AuthorizationResource {
  readonly societyId: UUID;
  readonly ownerUserId?: UUID;
  readonly flatId?: UUID;
  readonly gateId?: UUID;
  readonly complaintId?: UUID;
  readonly assignedToUserId?: UUID;
  readonly targetUserIds?: readonly UUID[];
  readonly targetFlatIds?: readonly UUID[];
}

export type AuthorizationDenialReason =
  | 'ACTOR_INACTIVE'
  | 'SOCIETY_MISMATCH'
  | 'ACTION_NOT_GRANTED'
  | 'SCOPE_MISMATCH'
  | 'RECENT_AUTHENTICATION_REQUIRED'
  | 'REASON_REQUIRED';

export type AuthorizationDecision =
  | {
      readonly allowed: true;
      readonly action: PermissionAction;
      readonly matchedScope: PermissionScopeKind;
    }
  | {
      readonly allowed: false;
      readonly action: PermissionAction;
      readonly reason: AuthorizationDenialReason;
    };

export interface AuthorizationRequest {
  readonly actor: AuthorizationActor;
  readonly action: PermissionAction;
  readonly resource: AuthorizationResource;
  readonly recentlyAuthenticated?: boolean;
  readonly reason?: string;
}

const scopeMatches = (
  scope: PermissionScopeKind,
  actor: AuthorizationActor,
  resource: AuthorizationResource,
): boolean => {
  switch (scope) {
    case 'SELF':
      return resource.ownerUserId === actor.userId;
    case 'ACTIVE_FLAT':
      return resource.flatId !== undefined && actor.activeFlatIds.includes(resource.flatId);
    case 'ASSIGNED_GATE':
      return resource.gateId !== undefined && actor.assignedGateIds.includes(resource.gateId);
    case 'ASSIGNED_COMPLAINT':
      return (
        (resource.complaintId !== undefined &&
          actor.assignedComplaintIds.includes(resource.complaintId)) ||
        resource.assignedToUserId === actor.userId
      );
    case 'TARGETED':
      return (
        resource.targetUserIds?.includes(actor.userId) === true ||
        resource.targetFlatIds?.some((flatId) => actor.activeFlatIds.includes(flatId)) === true
      );
    case 'SOCIETY':
      return resource.societyId === actor.societyId;
  }
};

const effectiveScopes = (
  actor: AuthorizationActor,
  action: PermissionAction,
): readonly PermissionScopeKind[] => {
  const scopes = new Set<PermissionScopeKind>();

  for (const role of actor.roles) {
    for (const scope of ROLE_POLICIES[role][action] ?? []) {
      scopes.add(scope);
    }
  }

  for (const grant of actor.directGrants ?? []) {
    if (grant.action === action) {
      for (const scope of grant.scopes) {
        if (PERMISSION_BY_ACTION[action].scopes.includes(scope as never)) {
          scopes.add(scope);
        }
      }
    }
  }

  return [...scopes];
};

export const authorize = (request: AuthorizationRequest): AuthorizationDecision => {
  const { action, actor, resource } = request;

  if (!actor.active) {
    return { allowed: false, action, reason: 'ACTOR_INACTIVE' };
  }
  if (resource.societyId !== actor.societyId) {
    return { allowed: false, action, reason: 'SOCIETY_MISMATCH' };
  }
  if (actor.deniedActions?.includes(action) === true) {
    return { allowed: false, action, reason: 'ACTION_NOT_GRANTED' };
  }

  const scopes = effectiveScopes(actor, action);
  if (scopes.length === 0) {
    return { allowed: false, action, reason: 'ACTION_NOT_GRANTED' };
  }

  const definition = PERMISSION_BY_ACTION[action];
  if (
    'requiresRecentAuthentication' in definition &&
    definition.requiresRecentAuthentication === true &&
    request.recentlyAuthenticated !== true
  ) {
    return { allowed: false, action, reason: 'RECENT_AUTHENTICATION_REQUIRED' };
  }
  if (
    'requiresReason' in definition &&
    definition.requiresReason === true &&
    (request.reason?.trim().length ?? 0) < 3
  ) {
    return { allowed: false, action, reason: 'REASON_REQUIRED' };
  }

  const matchedScope = scopes.find((scope) => scopeMatches(scope, actor, resource));
  return matchedScope === undefined
    ? { allowed: false, action, reason: 'SCOPE_MISMATCH' }
    : { allowed: true, action, matchedScope };
};

export const effectiveActions = (actor: AuthorizationActor): readonly PermissionAction[] => {
  const actions = new Set<PermissionAction>();

  for (const role of actor.roles) {
    for (const action of Object.keys(ROLE_POLICIES[role]) as PermissionAction[]) {
      actions.add(action);
    }
  }
  for (const grant of actor.directGrants ?? []) {
    actions.add(grant.action);
  }
  for (const denied of actor.deniedActions ?? []) {
    actions.delete(denied);
  }

  return [...actions].sort();
};

export const canAssignRole = (
  actor: AuthorizationActor,
  targetRole: RoleName,
  reason: string,
  recentlyAuthenticated: boolean,
): AuthorizationDecision => {
  const decision = authorize({
    actor,
    action: 'role.manage',
    resource: { societyId: actor.societyId },
    reason,
    recentlyAuthenticated,
  });
  if (!decision.allowed) {
    return decision;
  }

  const isSuperAdmin = actor.roles.includes('SUPER_ADMIN');
  if (!isSuperAdmin && (targetRole === 'SOCIETY_ADMIN' || targetRole === 'SUPER_ADMIN')) {
    return { allowed: false, action: 'role.manage', reason: 'ACTION_NOT_GRANTED' };
  }

  return decision;
};
