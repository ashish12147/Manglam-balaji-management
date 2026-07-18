export type DeviceStatus = "PENDING" | "ACTIVE" | "REVOKED" | "LOST" | "UNREGISTERED";

export type SyncStatus = "LOCAL_PENDING" | "SYNCING" | "SYNCED" | "CONFLICT" | "FAILED";

export type VisitStatus =
  | "DRAFT"
  | "EXPECTED"
  | "ARRIVED_AT_GATE"
  | "AWAITING_APPROVAL"
  | "APPROVED"
  | "REJECTED"
  | "APPROVAL_TIMED_OUT"
  | "CHECKED_IN"
  | "CHECKED_OUT"
  | "CANCELLED"
  | "EXPIRED";

export type VisitorCategory = "GUEST" | "DELIVERY" | "CAB" | "SERVICE_PROVIDER" | "OTHER";

export type DailyHelpType =
  | "MAID"
  | "COOK"
  | "DRIVER"
  | "CLEANER"
  | "NANNY"
  | "DELIVERY_STAFF"
  | "REGULAR_SERVICE_PROVIDER"
  | "OTHER";

export type ParcelStatus =
  | "EXPECTED"
  | "ARRIVED"
  | "HELD_AT_GATE"
  | "COLLECTED"
  | "RETURNED"
  | "CANCELLED";

export type EmergencyStatus = "ACTIVE" | "ACKNOWLEDGED" | "RESPONDING" | "RESOLVED" | "FALSE_ALARM";

export interface GuardIdentity {
  id: string;
  displayName: string;
  employeeCode?: string | null;
  permissions: string[];
}

export interface DeviceIdentity {
  clientDeviceId: string;
  installationSecret: string;
  label: string;
}

export interface RegisteredDevice {
  id: string;
  clientDeviceId?: string;
  label: string;
  status: DeviceStatus;
  lastSeenAt?: string | null;
}

export interface Gate {
  id: string;
  code: string;
  name: string;
}

export interface GuardSessionMetadata {
  guard: GuardIdentity;
  device: RegisteredDevice;
  gates: Gate[];
  activeGate: Gate | null;
  sessionId: string;
  accessTokenExpiresAt: string;
}

export interface GuardContextResponse {
  activeGate: Gate | null;
  device: RegisteredDevice;
  gates: Gate[];
  guard: Omit<GuardIdentity, "permissions"> & { permissions?: string[] };
  permissions: string[];
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: string;
}

export interface GuardSignInResponse extends AuthTokens {
  refreshTokenExpiresAt: string;
  sessionId: string;
  tokenType: "Bearer";
}

export interface FlatDirectoryItem {
  id: string;
  blockCode: string;
  flatNumber: string;
  displayLabel: string;
  residentDisplayName?: string | null;
  snapshotExpiresAt?: string | null;
}

export interface DailyHelpDirectoryItem {
  id: string;
  name: string;
  type: DailyHelpType;
  photoFileId?: string | null;
  allowedFlatLabels: string[];
  accessWindow?: string | null;
  status: "ACTIVE" | "SUSPENDED" | "INACTIVE";
  version: number;
  snapshotExpiresAt?: string | null;
}

export interface OfflineDeviceSnapshot {
  id: string;
  status: DeviceStatus;
  assignedGateIds: string[];
  leaseIssuedAt: string;
  leaseExpiresAt: string;
  lastAcceptedSequence: number;
}

export interface DirectorySnapshot {
  snapshotId: string;
  generatedAt: string;
  expiresAt: string;
  device: OfflineDeviceSnapshot;
  flats: FlatDirectoryItem[];
  dailyHelp: DailyHelpDirectoryItem[];
}

export interface VisitSummary {
  id: string;
  visitorName: string;
  category: VisitorCategory;
  flat: Pick<FlatDirectoryItem, "id" | "displayLabel">;
  status: VisitStatus;
  createdAt: string;
  arrivedAt?: string | null;
  checkedInAt?: string | null;
  checkedOutAt?: string | null;
  approvalExpiresAt?: string | null;
  approvalSource?: string | null;
  vehicleNumber?: string | null;
  purpose?: string | null;
  version: number;
}

export interface VisitDetail extends VisitSummary {
  phoneMasked?: string | null;
  photoFileId?: string | null;
  rejectionReason?: string | null;
  overrideReason?: string | null;
  events: {
    id: string;
    type: string;
    occurredAt: string;
    actorDisplayName?: string | null;
    note?: string | null;
  }[];
}

export interface DailyHelpAttendance {
  id: string;
  dailyHelpId: string;
  checkedInAt: string;
  checkedOutAt?: string | null;
  status: "CHECKED_IN" | "CHECKED_OUT" | "VOIDED";
}

export interface DailyHelpDetail extends DailyHelpDirectoryItem {
  recentAttendance: DailyHelpAttendance[];
}

export interface ParcelSummary {
  id: string;
  flat: Pick<FlatDirectoryItem, "id" | "displayLabel">;
  courierName?: string | null;
  description?: string | null;
  status: ParcelStatus;
  createdAt: string;
  heldAt?: string | null;
  collectedAt?: string | null;
  version: number;
}

export interface EmergencyAlert {
  id: string;
  category: "MEDICAL" | "FIRE" | "SECURITY_THREAT" | "LIFT" | "OTHER";
  flat: Pick<FlatDirectoryItem, "id" | "displayLabel">;
  residentDisplayName: string;
  status: EmergencyStatus;
  createdAt: string;
  acknowledgedAt?: string | null;
  resolutionInformation?: string | null;
  version: number;
  events?: {
    id: string;
    type: string;
    occurredAt: string;
    actorDisplayName?: string | null;
    note?: string | null;
  }[];
}

export interface ActivityEvent {
  id: string;
  category: "VISITOR" | "DAILY_HELP" | "PARCEL" | "EMERGENCY" | "DEVICE" | "SYNC";
  title: string;
  detail: string;
  status: string;
  occurredAt: string;
  entityId?: string | null;
}

export interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
}

export interface UploadIntent {
  fileId: string;
  uploadUrl: string;
  headers?: Record<string, string>;
  expiresAt: string;
}
