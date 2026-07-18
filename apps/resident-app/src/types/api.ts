export type MembershipStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED' | 'ENDED';
export type Relationship = 'OWNER' | 'TENANT' | 'ADULT_FAMILY';
export type VisitorCategory = 'GUEST' | 'DELIVERY' | 'CAB' | 'SERVICE_PROVIDER' | 'OTHER';
export type VisitStatus =
  | 'DRAFT'
  | 'EXPECTED'
  | 'ARRIVED_AT_GATE'
  | 'AWAITING_APPROVAL'
  | 'APPROVED'
  | 'REJECTED'
  | 'APPROVAL_TIMED_OUT'
  | 'CHECKED_IN'
  | 'CHECKED_OUT'
  | 'CANCELLED'
  | 'EXPIRED';

export interface ApiPage<T> {
  items: T[];
  nextCursor: string | null;
  total?: number;
}

export interface FlatSummary {
  id: string;
  number: string;
  block: { id: string; name: string; code: string };
  floor?: { id: string; label: string };
}

export interface Membership {
  id: string;
  status: MembershipStatus;
  relationship: Relationship;
  occupancyType: string;
  startAt: string;
  endAt: string | null;
  flat: FlatSummary;
}

export interface ResidentProfile {
  id: string;
  displayName: string;
  phoneMasked: string;
  email: string | null;
  status: 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED';
  permissions: string[];
  memberships: Membership[];
}

export interface AuthSessionPayload {
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken: string;
  refreshTokenExpiresAt: string;
  sessionId: string;
  tokenType: 'Bearer';
}

export interface OtpChallenge {
  challengeId: string;
  expiresAt: string;
  resendAfterSeconds: number;
  status: 'QUEUED';
}

export interface VisitEvent {
  id: string;
  type: string;
  occurredAt: string;
  actorLabel: string | null;
  detail: string | null;
}

export interface Visit {
  id: string;
  category: VisitorCategory;
  visitorName: string;
  visitorPhoneMasked: string | null;
  vehicleNumber: string | null;
  purpose: string | null;
  status: VisitStatus;
  expectedAt: string | null;
  arrivedAt: string | null;
  checkedInAt: string | null;
  checkedOutAt: string | null;
  approvalExpiresAt: string | null;
  flat: FlatSummary;
  gateName: string | null;
  events?: VisitEvent[];
}

export interface VisitorPreApproval extends Visit {
  code: string;
  validUntil: string;
}

export interface FamilyMember {
  id: string;
  name: string;
  relationship: string;
  dateOfBirth: string | null;
  phoneMasked: string | null;
  status: 'ACTIVE' | 'INACTIVE';
}

export interface DailyHelpAttendance {
  id: string;
  checkedInAt: string;
  checkedOutAt: string | null;
  gateName: string;
}

export interface DailyHelp {
  id: string;
  name: string;
  type: string;
  phoneMasked: string | null;
  photoUrl: string | null;
  status: 'ACTIVE' | 'SUSPENDED' | 'INACTIVE';
  allowedDays: string[];
  accessWindow: string | null;
  attendance: DailyHelpAttendance[];
}

export interface Parcel {
  id: string;
  status: 'EXPECTED' | 'ARRIVED' | 'HELD_AT_GATE' | 'COLLECTED' | 'RETURNED' | 'CANCELLED';
  carrierName: string | null;
  description: string | null;
  arrivedAt: string;
  collectedAt: string | null;
  collectionCode: string | null;
  gateName: string;
  photoFileId: string | null;
}

export interface Notice {
  id: string;
  title: string;
  body: string;
  category: string;
  priority: 'NORMAL' | 'IMPORTANT' | 'URGENT';
  publishedAt: string;
  expiresAt: string | null;
  isRead: boolean;
  acknowledgedAt: string | null;
  requiresAcknowledgement: boolean;
  attachments: { id: string; fileName: string; mimeType: string }[];
}

export type ComplaintStatus =
  | 'OPEN'
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'RESOLVED'
  | 'CLOSED'
  | 'REOPENED'
  | 'CANCELLED';

export interface ComplaintComment {
  id: string;
  body: string;
  authorLabel: string;
  createdAt: string;
}

export interface Complaint {
  id: string;
  referenceNumber: string;
  category: { id: string; name: string };
  subject: string;
  description: string;
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  status: ComplaintStatus;
  createdAt: string;
  updatedAt: string;
  resolutionNote: string | null;
  comments: ComplaintComment[];
  history: { id: string; status: ComplaintStatus; occurredAt: string; note: string | null }[];
  attachments: { id: string; fileName: string; mimeType: string }[];
}

export interface ComplaintCategory {
  id: string;
  name: string;
  isActive: boolean;
}

export interface MaintenanceCharge {
  id: string;
  periodLabel: string;
  amount: string;
  previousBalance: string;
  lateCharge: string;
  paidAmount: string;
  balance: string;
  currency: string;
  dueDate: string;
  status: 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' | 'WAIVED' | 'CANCELLED';
}

export interface Payment {
  id: string;
  amount: string;
  currency: string;
  method: 'CASH' | 'UPI' | 'BANK_TRANSFER' | 'CHEQUE' | 'OTHER';
  reference: string | null;
  receivedAt: string;
  status: 'PENDING_VERIFICATION' | 'CONFIRMED' | 'REVERSED' | 'FAILED';
  receipt: { id: string; number: string } | null;
}

export interface EmergencyEvent {
  id: string;
  type: string;
  occurredAt: string;
  actorLabel: string | null;
  note: string | null;
}

export interface EmergencyAlert {
  id: string;
  category: 'MEDICAL' | 'FIRE' | 'SECURITY_THREAT' | 'LIFT' | 'OTHER';
  details: string | null;
  status: 'ACTIVE' | 'ACKNOWLEDGED' | 'RESPONDING' | 'RESOLVED' | 'FALSE_ALARM';
  createdAt: string;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
  events: EmergencyEvent[];
}

export interface InAppNotification {
  id: string;
  category:
    | 'SECURITY_CRITICAL'
    | 'VISITOR_APPROVAL'
    | 'VISITOR_ACTIVITY'
    | 'EMERGENCY'
    | 'NOTICE'
    | 'COMPLAINT'
    | 'PAYMENT'
    | 'GENERAL';
  title: string;
  body: string;
  createdAt: string;
  readAt: string | null;
  deepLink: string | null;
}

export interface NotificationPreferences {
  visitorActivity: boolean;
  notices: boolean;
  complaints: boolean;
  payments: boolean;
  general: boolean;
  securityCritical: true;
  emergency: true;
}

export interface UserSession {
  id: string;
  deviceName: string;
  platform: string;
  current: boolean;
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string;
}
