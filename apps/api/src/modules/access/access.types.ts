import type { Request } from 'express';
import type {
  AuthorizationActor,
  PermissionAction,
} from '@manglam/permissions';

export interface MembershipView {
  readonly flatId: string;
  readonly flatLabel: string;
  readonly id: string;
  readonly relationship: string;
}

export interface AuthenticatedPrincipal {
  readonly actor: AuthorizationActor;
  readonly deviceId: string;
  readonly effectivePermissions: readonly PermissionAction[];
  readonly guardDeviceId: string | null;
  readonly guardProfileId: string | null;
  readonly memberships: readonly MembershipView[];
  readonly recentlyAuthenticated: boolean;
  readonly roleCodes: readonly string[];
  readonly sessionId: string;
  readonly sessionKind: 'RESIDENT' | 'GUARD' | 'PRIVILEGED';
  readonly societyId: string;
  readonly user: {
    readonly displayName: string;
    readonly email: string | null;
    readonly id: string;
    readonly normalizedPhone: string;
    readonly preferredLocale: string;
  };
}

export interface AuthenticatedRequest extends Request {
  principal: AuthenticatedPrincipal;
}

export type PermissionResourceKind =
  | 'APPROVAL'
  | 'BODY_FLAT'
  | 'BODY_GATE'
  | 'FAMILY'
  | 'MEMBERSHIP'
  | 'PARAM_FLAT'
  | 'PARAM_GATE'
  | 'PREAPPROVAL'
  | 'SELF'
  | 'SESSION'
  | 'SOCIETY'
  | 'VISIT';

export interface PermissionRequirement {
  readonly action: PermissionAction;
  readonly parameter?: string;
  readonly resource: PermissionResourceKind;
}
