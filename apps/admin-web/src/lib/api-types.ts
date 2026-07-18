export interface AuthDevice {
  fingerprint: string;
  label: string;
  operatingSystem: string;
  platform: 'WEB';
}

export interface AdminCredentials {
  email: string;
  password: string;
}

export interface AdminSignInInput extends AdminCredentials {
  device: AuthDevice;
  mfaCode?: string;
}

export interface AuthSessionResponse {
  accessToken: string;
  accessTokenExpiresAt: string;
  sessionId: string;
  tokenType: 'Bearer';
}

export interface CurrentUserAccount {
  displayName: string;
  email: string | null;
  id: string;
  normalizedPhone: string;
  preferredLocale: string;
}

export interface MembershipView {
  flatId: string;
  flatLabel: string;
  id: string;
  relationship: string;
}

export interface CurrentUserResponse {
  deviceId: string;
  effectivePermissions: string[];
  memberships: MembershipView[];
  roleCodes: string[];
  sessionId: string;
  sessionKind: 'GUARD' | 'PRIVILEGED' | 'RESIDENT';
  societyId: string;
  user: CurrentUserAccount;
}

export interface CurrentUser extends CurrentUserAccount {
  deviceId: string;
  memberships: MembershipView[];
  permissions: string[];
  roles: string[];
  sessionId: string;
  sessionKind: 'GUARD' | 'PRIVILEGED' | 'RESIDENT';
  societyId: string;
}

export interface ApiRecord {
  id: string;
  [key: string]: unknown;
}

export interface SessionRecord extends ApiRecord {
  absoluteExpiresAt?: string;
  createdAt?: string;
  current?: boolean;
  device?: {
    id?: string;
    label?: string | null;
    platform?: string;
  } | null;
  lastSeenAt?: string;
  status?: string;
}

export interface DashboardSummary {
  activeEmergencies?: number;
  activeGateActivity?: number;
  auditAlerts?: number;
  openComplaints?: number;
  pendingResidentApprovals?: number;
  recentGateActivity?: ApiRecord[];
  recentVisitorActivity?: number;
  unpaidMaintenanceAmount?: number | string;
  unpaidMaintenanceDues?: number;
}
