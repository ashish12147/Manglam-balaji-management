type NonEmptyStrings = readonly [string, ...string[]];

const values = <const T extends NonEmptyStrings>(...items: T): Readonly<T> => Object.freeze(items);

const enumObject = <const T extends NonEmptyStrings>(items: T) =>
  Object.freeze(
    Object.fromEntries(items.map((item) => [item, item])) as {
      readonly [K in T[number]]: K;
    },
  );

export const USER_STATUSES = values('PENDING', 'ACTIVE', 'SUSPENDED', 'DEACTIVATED');
export type UserStatus = (typeof USER_STATUSES)[number];
export const UserStatus = enumObject(USER_STATUSES);

export const SESSION_STATUSES = values('ACTIVE', 'REVOKED', 'EXPIRED', 'COMPROMISED');
export type SessionStatus = (typeof SESSION_STATUSES)[number];
export const SessionStatus = enumObject(SESSION_STATUSES);

export const DEVICE_STATUSES = values('PENDING', 'ACTIVE', 'REVOKED', 'LOST');
export type DeviceStatus = (typeof DEVICE_STATUSES)[number];
export const DeviceStatus = enumObject(DEVICE_STATUSES);

export const MEMBERSHIP_RELATIONSHIPS = values('OWNER', 'TENANT', 'ADULT_FAMILY');
export type MembershipRelationship = (typeof MEMBERSHIP_RELATIONSHIPS)[number];
export const MembershipRelationship = enumObject(MEMBERSHIP_RELATIONSHIPS);

export const OCCUPANCY_TYPES = values('OWNER_OCCUPIED', 'RENTED', 'FAMILY_OCCUPIED', 'OTHER');
export type OccupancyType = (typeof OCCUPANCY_TYPES)[number];
export const OccupancyType = enumObject(OCCUPANCY_TYPES);

export const MEMBERSHIP_STATUSES = values('PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED', 'ENDED');
export type MembershipStatus = (typeof MEMBERSHIP_STATUSES)[number];
export const MembershipStatus = enumObject(MEMBERSHIP_STATUSES);

export const VISITOR_CATEGORIES = values('GUEST', 'DELIVERY', 'CAB', 'SERVICE_PROVIDER', 'OTHER');
export type VisitorCategory = (typeof VISITOR_CATEGORIES)[number];
export const VisitorCategory = enumObject(VISITOR_CATEGORIES);

export const VISIT_SOURCES = values('PRE_APPROVAL', 'WALK_IN', 'OFFLINE_MANUAL');
export type VisitSource = (typeof VISIT_SOURCES)[number];
export const VisitSource = enumObject(VISIT_SOURCES);

export const VISIT_STATUSES = values(
  'DRAFT',
  'EXPECTED',
  'ARRIVED_AT_GATE',
  'AWAITING_APPROVAL',
  'APPROVED',
  'REJECTED',
  'APPROVAL_TIMED_OUT',
  'CHECKED_IN',
  'CHECKED_OUT',
  'CANCELLED',
  'EXPIRED',
);
export type VisitStatus = (typeof VISIT_STATUSES)[number];
export const VisitStatus = enumObject(VISIT_STATUSES);

export const VISIT_APPROVAL_STATUSES = values(
  'PENDING',
  'APPROVED',
  'REJECTED',
  'TIMED_OUT',
  'CANCELLED',
  'OVERRIDDEN',
);
export type VisitApprovalStatus = (typeof VISIT_APPROVAL_STATUSES)[number];
export const VisitApprovalStatus = enumObject(VISIT_APPROVAL_STATUSES);

export const APPROVAL_SOURCES = values('RESIDENT_APP', 'PRE_APPROVAL', 'GUARD_OVERRIDE', 'SYSTEM');
export type ApprovalSource = (typeof APPROVAL_SOURCES)[number];
export const ApprovalSource = enumObject(APPROVAL_SOURCES);

export const ACCESS_TYPES = values('ONE_TIME', 'RECURRING');
export type AccessType = (typeof ACCESS_TYPES)[number];
export const AccessType = enumObject(ACCESS_TYPES);

export const PRE_APPROVAL_STATUSES = values(
  'ACTIVE',
  'CONSUMED',
  'CANCELLED',
  'EXPIRED',
  'SUSPENDED',
);
export type PreApprovalStatus = (typeof PRE_APPROVAL_STATUSES)[number];
export const PreApprovalStatus = enumObject(PRE_APPROVAL_STATUSES);

export const DAILY_HELP_TYPES = values(
  'MAID',
  'COOK',
  'DRIVER',
  'CLEANER',
  'NANNY',
  'DELIVERY_STAFF',
  'REGULAR_SERVICE_PROVIDER',
  'OTHER',
);
export type DailyHelpType = (typeof DAILY_HELP_TYPES)[number];
export const DailyHelpType = enumObject(DAILY_HELP_TYPES);

export const DAILY_HELP_STATUSES = values('ACTIVE', 'SUSPENDED', 'INACTIVE');
export type DailyHelpStatus = (typeof DAILY_HELP_STATUSES)[number];
export const DailyHelpStatus = enumObject(DAILY_HELP_STATUSES);

export const ATTENDANCE_STATUSES = values('CHECKED_IN', 'CHECKED_OUT', 'VOIDED');
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];
export const AttendanceStatus = enumObject(ATTENDANCE_STATUSES);

export const PARCEL_STATUSES = values(
  'EXPECTED',
  'ARRIVED',
  'HELD_AT_GATE',
  'COLLECTED',
  'RETURNED',
  'CANCELLED',
);
export type ParcelStatus = (typeof PARCEL_STATUSES)[number];
export const ParcelStatus = enumObject(PARCEL_STATUSES);

export const PARCEL_DECISIONS = values('ALLOW_ENTRY', 'REJECT', 'LEAVE_AT_GATE');
export type ParcelDecision = (typeof PARCEL_DECISIONS)[number];
export const ParcelDecision = enumObject(PARCEL_DECISIONS);

export const NOTICE_CATEGORIES = values(
  'GENERAL',
  'URGENT',
  'MAINTENANCE',
  'WATER',
  'ELECTRICITY',
  'MEETING',
  'OTHER',
);
export type NoticeCategory = (typeof NOTICE_CATEGORIES)[number];
export const NoticeCategory = enumObject(NOTICE_CATEGORIES);

export const NOTICE_PRIORITIES = values('NORMAL', 'IMPORTANT', 'URGENT');
export type NoticePriority = (typeof NOTICE_PRIORITIES)[number];
export const NoticePriority = enumObject(NOTICE_PRIORITIES);

export const NOTICE_STATUSES = values('DRAFT', 'SCHEDULED', 'PUBLISHED', 'EXPIRED', 'ARCHIVED');
export type NoticeStatus = (typeof NOTICE_STATUSES)[number];
export const NoticeStatus = enumObject(NOTICE_STATUSES);

export const AUDIENCE_TYPES = values('ALL_RESIDENTS', 'ROLE', 'BLOCK', 'FLAT');
export type AudienceType = (typeof AUDIENCE_TYPES)[number];
export const AudienceType = enumObject(AUDIENCE_TYPES);

export const COMPLAINT_PRIORITIES = values('LOW', 'NORMAL', 'HIGH', 'URGENT');
export type ComplaintPriority = (typeof COMPLAINT_PRIORITIES)[number];
export const ComplaintPriority = enumObject(COMPLAINT_PRIORITIES);

export const COMPLAINT_STATUSES = values(
  'OPEN',
  'ASSIGNED',
  'IN_PROGRESS',
  'RESOLVED',
  'CLOSED',
  'REOPENED',
  'CANCELLED',
);
export type ComplaintStatus = (typeof COMPLAINT_STATUSES)[number];
export const ComplaintStatus = enumObject(COMPLAINT_STATUSES);

export const MAINTENANCE_CHARGE_STATUSES = values(
  'UNPAID',
  'PARTIALLY_PAID',
  'PAID',
  'WAIVED',
  'CANCELLED',
);
export type MaintenanceChargeStatus = (typeof MAINTENANCE_CHARGE_STATUSES)[number];
export const MaintenanceChargeStatus = enumObject(MAINTENANCE_CHARGE_STATUSES);

export const PAYMENT_METHODS = values('CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE', 'OTHER');
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export const PaymentMethod = enumObject(PAYMENT_METHODS);

export const PAYMENT_STATUSES = values('PENDING_VERIFICATION', 'CONFIRMED', 'REVERSED', 'FAILED');
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];
export const PaymentStatus = enumObject(PAYMENT_STATUSES);

export const RECEIPT_STATUSES = values('ISSUED', 'VOIDED');
export type ReceiptStatus = (typeof RECEIPT_STATUSES)[number];
export const ReceiptStatus = enumObject(RECEIPT_STATUSES);

export const EMERGENCY_CATEGORIES = values(
  'MEDICAL',
  'FIRE',
  'SECURITY_THREAT',
  'LIFT_EMERGENCY',
  'OTHER',
);
export type EmergencyCategory = (typeof EMERGENCY_CATEGORIES)[number];
export const EmergencyCategory = enumObject(EMERGENCY_CATEGORIES);

export const EMERGENCY_STATUSES = values(
  'ACTIVE',
  'ACKNOWLEDGED',
  'RESPONDING',
  'RESOLVED',
  'FALSE_ALARM',
);
export type EmergencyStatus = (typeof EMERGENCY_STATUSES)[number];
export const EmergencyStatus = enumObject(EMERGENCY_STATUSES);

export const NOTIFICATION_CATEGORIES = values(
  'SECURITY_CRITICAL',
  'VISITOR_APPROVAL',
  'VISITOR_ACTIVITY',
  'EMERGENCY',
  'NOTICE',
  'COMPLAINT',
  'PAYMENT',
  'GENERAL',
);
export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];
export const NotificationCategory = enumObject(NOTIFICATION_CATEGORIES);

export const NOTIFICATION_CHANNELS = values('IN_APP', 'PUSH', 'REALTIME', 'SMS');
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];
export const NotificationChannel = enumObject(NOTIFICATION_CHANNELS);

export const NOTIFICATION_DELIVERY_STATUSES = values(
  'PENDING',
  'PROCESSING',
  'DELIVERED',
  'RETRY_SCHEDULED',
  'FAILED',
  'DEAD_LETTERED',
  'SKIPPED',
);
export type NotificationDeliveryStatus = (typeof NOTIFICATION_DELIVERY_STATUSES)[number];
export const NotificationDeliveryStatus = enumObject(NOTIFICATION_DELIVERY_STATUSES);

export const FILE_UPLOAD_STATUSES = values(
  'PENDING_UPLOAD',
  'UPLOADED',
  'QUARANTINED',
  'SCANNING',
  'CLEAN',
  'REJECTED',
  'DELETED',
);
export type FileUploadStatus = (typeof FILE_UPLOAD_STATUSES)[number];
export const FileUploadStatus = enumObject(FILE_UPLOAD_STATUSES);

export const OUTBOX_STATUSES = values(
  'PENDING',
  'PROCESSING',
  'DELIVERED',
  'RETRY_SCHEDULED',
  'DEAD_LETTERED',
);
export type OutboxStatus = (typeof OUTBOX_STATUSES)[number];
export const OutboxStatus = enumObject(OUTBOX_STATUSES);

export const OFFLINE_SYNC_STATUSES = values(
  'LOCAL_PENDING',
  'SYNCING',
  'SYNCED',
  'CONFLICT',
  'FAILED',
);
export type OfflineSyncStatus = (typeof OFFLINE_SYNC_STATUSES)[number];
export const OfflineSyncStatus = enumObject(OFFLINE_SYNC_STATUSES);

export const IDEMPOTENCY_STATUSES = values('PROCESSING', 'COMPLETED', 'FAILED');
export type IdempotencyStatus = (typeof IDEMPOTENCY_STATUSES)[number];
export const IdempotencyStatus = enumObject(IDEMPOTENCY_STATUSES);

export const OFFLINE_MUTATION_OPERATIONS = values(
  'VISIT_PREPARE',
  'VISIT_MANUAL_ENTRY',
  'VISIT_CHECK_OUT',
  'DAILY_HELP_CHECK_IN',
  'DAILY_HELP_CHECK_OUT',
  'EMERGENCY_ACKNOWLEDGE',
  'RESIDENT_VISITOR_APPROVAL',
);
export type OfflineMutationOperation = (typeof OFFLINE_MUTATION_OPERATIONS)[number];
export const OfflineMutationOperation = enumObject(OFFLINE_MUTATION_OPERATIONS);
