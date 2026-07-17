-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "RecordStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED', 'DEACTIVATED');

-- CreateEnum
CREATE TYPE "SessionKind" AS ENUM ('RESIDENT', 'GUARD', 'PRIVILEGED');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('ACTIVE', 'REVOKED', 'EXPIRED', 'COMPROMISED');

-- CreateEnum
CREATE TYPE "OtpPurpose" AS ENUM ('SIGN_IN', 'PHONE_CHANGE', 'PIN_RESET', 'STEP_UP');

-- CreateEnum
CREATE TYPE "OtpChallengeStatus" AS ENUM ('PENDING', 'VERIFIED', 'EXPIRED', 'SUPERSEDED', 'LOCKED');

-- CreateEnum
CREATE TYPE "DevicePlatform" AS ENUM ('ANDROID', 'IOS', 'WEB', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "DeviceStatus" AS ENUM ('PENDING', 'ACTIVE', 'REVOKED', 'LOST');

-- CreateEnum
CREATE TYPE "PushProvider" AS ENUM ('FCM', 'EXPO', 'WEB_PUSH', 'DEVELOPMENT');

-- CreateEnum
CREATE TYPE "PushEndpointStatus" AS ENUM ('ACTIVE', 'INVALID', 'REVOKED');

-- CreateEnum
CREATE TYPE "RoleScope" AS ENUM ('SOCIETY', 'FLAT', 'GATE');

-- CreateEnum
CREATE TYPE "MembershipRelationship" AS ENUM ('OWNER', 'TENANT', 'ADULT_FAMILY');

-- CreateEnum
CREATE TYPE "OccupancyType" AS ENUM ('OWNER_OCCUPIED', 'RENTED', 'FAMILY_OCCUPIED', 'OTHER');

-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED', 'ENDED');

-- CreateEnum
CREATE TYPE "FamilyRelationship" AS ENUM ('CHILD', 'PARENT', 'SPOUSE', 'SIBLING', 'DEPENDENT', 'OTHER');

-- CreateEnum
CREATE TYPE "GuardStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'INACTIVE');

-- CreateEnum
CREATE TYPE "VisitorCategory" AS ENUM ('GUEST', 'DELIVERY', 'CAB', 'SERVICE_PROVIDER', 'OTHER');

-- CreateEnum
CREATE TYPE "VisitSource" AS ENUM ('PRE_APPROVAL', 'WALK_IN', 'OFFLINE_MANUAL');

-- CreateEnum
CREATE TYPE "VisitStatus" AS ENUM ('DRAFT', 'EXPECTED', 'ARRIVED_AT_GATE', 'AWAITING_APPROVAL', 'APPROVED', 'REJECTED', 'APPROVAL_TIMED_OUT', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'TIMED_OUT', 'CANCELLED', 'OVERRIDDEN');

-- CreateEnum
CREATE TYPE "ApprovalSource" AS ENUM ('RESIDENT_APP', 'PRE_APPROVAL', 'GUARD_OVERRIDE', 'SYSTEM');

-- CreateEnum
CREATE TYPE "VisitEventType" AS ENUM ('CREATED', 'ARRIVED', 'APPROVAL_REQUESTED', 'APPROVED', 'REJECTED', 'APPROVAL_TIMED_OUT', 'OVERRIDDEN', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED', 'EXPIRED', 'LONG_VISIT_FLAGGED', 'SYNC_CONFLICT');

-- CreateEnum
CREATE TYPE "AccessType" AS ENUM ('ONE_TIME', 'RECURRING');

-- CreateEnum
CREATE TYPE "PreApprovalStatus" AS ENUM ('ACTIVE', 'CONSUMED', 'CANCELLED', 'EXPIRED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "DailyHelpType" AS ENUM ('MAID', 'COOK', 'DRIVER', 'CLEANER', 'NANNY', 'DELIVERY_STAFF', 'REGULAR_SERVICE_PROVIDER', 'OTHER');

-- CreateEnum
CREATE TYPE "DailyHelpStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'INACTIVE');

-- CreateEnum
CREATE TYPE "AssignmentStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'ENDED');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('CHECKED_IN', 'CHECKED_OUT', 'VOIDED');

-- CreateEnum
CREATE TYPE "DailyHelpEventType" AS ENUM ('CREATED', 'ACTIVATED', 'SUSPENDED', 'DEACTIVATED', 'ASSIGNED', 'ASSIGNMENT_ENDED', 'CHECKED_IN', 'CHECKED_OUT', 'ATTENDANCE_VOIDED');

-- CreateEnum
CREATE TYPE "ParcelDecision" AS ENUM ('ALLOW_ENTRY', 'REJECT', 'LEAVE_AT_GATE');

-- CreateEnum
CREATE TYPE "ParcelStatus" AS ENUM ('EXPECTED', 'ARRIVED', 'HELD_AT_GATE', 'COLLECTED', 'RETURNED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ParcelEventType" AS ENUM ('CREATED', 'ARRIVED', 'DECISION_RECORDED', 'HELD', 'COLLECTED', 'RETURNED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "NoticeCategory" AS ENUM ('GENERAL', 'URGENT', 'MAINTENANCE', 'WATER', 'ELECTRICITY', 'MEETING', 'OTHER');

-- CreateEnum
CREATE TYPE "NoticePriority" AS ENUM ('NORMAL', 'IMPORTANT', 'URGENT');

-- CreateEnum
CREATE TYPE "NoticeStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'PUBLISHED', 'EXPIRED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "AudienceType" AS ENUM ('ALL_RESIDENTS', 'ROLE', 'BLOCK', 'FLAT');

-- CreateEnum
CREATE TYPE "ComplaintPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "ComplaintStatus" AS ENUM ('OPEN', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'REOPENED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ChargeBatchStatus" AS ENUM ('DRAFT', 'POSTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MaintenanceDueStatus" AS ENUM ('UNPAID', 'PARTIALLY_PAID', 'PAID', 'WAIVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ChargeAdjustmentType" AS ENUM ('LATE_FEE', 'DEBIT', 'CREDIT', 'WAIVER', 'CANCELLATION');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE', 'OTHER');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING_VERIFICATION', 'CONFIRMED', 'REVERSED', 'FAILED');

-- CreateEnum
CREATE TYPE "ReceiptStatus" AS ENUM ('ISSUED', 'VOIDED');

-- CreateEnum
CREATE TYPE "ReceiptEventType" AS ENUM ('ISSUED', 'VOIDED');

-- CreateEnum
CREATE TYPE "EmergencyCategory" AS ENUM ('MEDICAL', 'FIRE', 'SECURITY_THREAT', 'LIFT_EMERGENCY', 'OTHER');

-- CreateEnum
CREATE TYPE "EmergencyStatus" AS ENUM ('ACTIVE', 'ACKNOWLEDGED', 'RESPONDING', 'RESOLVED', 'FALSE_ALARM');

-- CreateEnum
CREATE TYPE "EmergencyEventType" AS ENUM ('CREATED', 'GUARD_ACKNOWLEDGED', 'ADMIN_ACKNOWLEDGED', 'RESPONSE_STARTED', 'RESPONSE_UPDATED', 'RESOLVED', 'MARKED_FALSE_ALARM');

-- CreateEnum
CREATE TYPE "NotificationCategory" AS ENUM ('SECURITY_CRITICAL', 'VISITOR_APPROVAL', 'VISITOR_ACTIVITY', 'EMERGENCY', 'NOTICE', 'COMPLAINT', 'PAYMENT', 'GENERAL');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('IN_APP', 'PUSH', 'SMS', 'EMAIL', 'REALTIME');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('PENDING', 'PROCESSING', 'DELIVERED', 'RETRY', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "OutboxStatus" AS ENUM ('PENDING', 'PROCESSING', 'PUBLISHED', 'RETRY', 'DEAD_LETTER');

-- CreateEnum
CREATE TYPE "InboxStatus" AS ENUM ('RECEIVED', 'PROCESSING', 'PROCESSED', 'FAILED');

-- CreateEnum
CREATE TYPE "FileStatus" AS ENUM ('PENDING_UPLOAD', 'UPLOADED', 'QUARANTINED', 'SCANNING', 'CLEAN', 'REJECTED', 'DELETED');

-- CreateEnum
CREATE TYPE "FilePurpose" AS ENUM ('PROFILE_PHOTO', 'VISITOR_PHOTO', 'DAILY_HELP_PHOTO', 'PARCEL_PHOTO', 'NOTICE_ATTACHMENT', 'COMPLAINT_ATTACHMENT', 'RECEIPT');

-- CreateEnum
CREATE TYPE "AuditOutcome" AS ENUM ('SUCCESS', 'DENIED', 'FAILURE');

-- CreateEnum
CREATE TYPE "IdempotencyStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "OfflineSyncStatus" AS ENUM ('LOCAL_PENDING', 'SYNCING', 'SYNCED', 'CONFLICT', 'FAILED');

-- CreateEnum
CREATE TYPE "SyncAttemptResult" AS ENUM ('ACCEPTED', 'DUPLICATE', 'CONFLICT', 'FAILED');

-- CreateTable
CREATE TABLE "notices" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "society_id" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "body" TEXT NOT NULL,
    "category" "NoticeCategory" NOT NULL,
    "priority" "NoticePriority" NOT NULL DEFAULT 'NORMAL',
    "status" "NoticeStatus" NOT NULL DEFAULT 'DRAFT',
    "publish_at" TIMESTAMPTZ(6),
    "published_at" TIMESTAMPTZ(6),
    "expires_at" TIMESTAMPTZ(6),
    "created_by_user_id" UUID NOT NULL,
    "published_by_user_id" UUID,
    "requires_acknowledgement" BOOLEAN NOT NULL DEFAULT false,
    "audience_frozen_at" TIMESTAMPTZ(6),
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "notices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notice_audiences" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "society_id" UUID NOT NULL,
    "notice_id" UUID NOT NULL,
    "type" "AudienceType" NOT NULL,
    "role_id" UUID,
    "block_id" UUID,
    "flat_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notice_audiences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notice_recipients" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "society_id" UUID NOT NULL,
    "notice_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "membership_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notice_recipients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notice_attachments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "society_id" UUID NOT NULL,
    "notice_id" UUID NOT NULL,
    "file_id" UUID NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notice_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notice_reads" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "society_id" UUID NOT NULL,
    "notice_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "read_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notice_reads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notice_acknowledgements" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "society_id" UUID NOT NULL,
    "notice_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "acknowledged_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notice_acknowledgements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "complaint_categories" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "society_id" UUID NOT NULL,
    "code" VARCHAR(64) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" VARCHAR(500),
    "sla_hours" INTEGER,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "complaint_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "complaints" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "society_id" UUID NOT NULL,
    "flat_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "created_by_user_id" UUID NOT NULL,
    "created_by_membership_id" UUID NOT NULL,
    "subject" VARCHAR(200) NOT NULL,
    "description" TEXT NOT NULL,
    "priority" "ComplaintPriority" NOT NULL DEFAULT 'NORMAL',
    "status" "ComplaintStatus" NOT NULL DEFAULT 'OPEN',
    "assigned_to_user_id" UUID,
    "resolution_notes" TEXT,
    "resolved_at" TIMESTAMPTZ(6),
    "closed_at" TIMESTAMPTZ(6),
    "reopen_count" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "complaints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "complaint_attachments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "society_id" UUID NOT NULL,
    "complaint_id" UUID NOT NULL,
    "file_id" UUID NOT NULL,
    "uploaded_by_user_id" UUID NOT NULL,
    "visible_to_resident" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "complaint_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "complaint_comments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "society_id" UUID NOT NULL,
    "complaint_id" UUID NOT NULL,
    "author_user_id" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "edited_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "complaint_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "complaint_internal_notes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "society_id" UUID NOT NULL,
    "complaint_id" UUID NOT NULL,
    "author_user_id" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "complaint_internal_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "complaint_status_history" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "society_id" UUID NOT NULL,
    "complaint_id" UUID NOT NULL,
    "sequence" INTEGER NOT NULL,
    "from_status" "ComplaintStatus",
    "to_status" "ComplaintStatus" NOT NULL,
    "actor_user_id" UUID NOT NULL,
    "reason" VARCHAR(500),
    "resolution_notes" TEXT,
    "correlation_id" UUID NOT NULL,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "complaint_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "complaint_assignment_history" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "society_id" UUID NOT NULL,
    "complaint_id" UUID NOT NULL,
    "sequence" INTEGER NOT NULL,
    "from_assignee_user_id" UUID,
    "to_assignee_user_id" UUID,
    "actor_user_id" UUID NOT NULL,
    "reason" VARCHAR(500),
    "correlation_id" UUID NOT NULL,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "complaint_assignment_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maintenance_charge_batches" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "society_id" UUID NOT NULL,
    "code" VARCHAR(80) NOT NULL,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "due_date" DATE NOT NULL,
    "description" VARCHAR(240) NOT NULL,
    "status" "ChargeBatchStatus" NOT NULL DEFAULT 'DRAFT',
    "created_by_user_id" UUID NOT NULL,
    "posted_by_user_id" UUID,
    "posted_at" TIMESTAMPTZ(6),
    "cancelled_at" TIMESTAMPTZ(6),
    "cancel_reason" VARCHAR(500),
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "maintenance_charge_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maintenance_charges" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "society_id" UUID NOT NULL,
    "batch_id" UUID NOT NULL,
    "flat_id" UUID NOT NULL,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "due_date" DATE NOT NULL,
    "base_amount" DECIMAL(12,2) NOT NULL,
    "previous_balance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "late_charge" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "adjustment_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total_amount" DECIMAL(12,2) NOT NULL,
    "paid_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "currency" CHAR(3) NOT NULL DEFAULT 'INR',
    "status" "MaintenanceDueStatus" NOT NULL DEFAULT 'UNPAID',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "maintenance_charges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maintenance_charge_adjustments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "society_id" UUID NOT NULL,
    "charge_id" UUID NOT NULL,
    "type" "ChargeAdjustmentType" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "reason" VARCHAR(500) NOT NULL,
    "actor_user_id" UUID NOT NULL,
    "reversal_of_adjustment_id" UUID,
    "correlation_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "maintenance_charge_adjustments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "society_id" UUID NOT NULL,
    "flat_id" UUID NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING_VERIFICATION',
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'INR',
    "reference" VARCHAR(160),
    "provider_transaction_id" VARCHAR(160),
    "received_at" TIMESTAMPTZ(6) NOT NULL,
    "recorded_by_user_id" UUID NOT NULL,
    "verified_by_user_id" UUID,
    "verified_at" TIMESTAMPTZ(6),
    "notes" VARCHAR(500),
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_allocations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "society_id" UUID NOT NULL,
    "flat_id" UUID NOT NULL,
    "payment_id" UUID NOT NULL,
    "charge_id" UUID NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "allocated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_reversals" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "society_id" UUID NOT NULL,
    "payment_id" UUID NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "reason" VARCHAR(500) NOT NULL,
    "actor_user_id" UUID NOT NULL,
    "idempotency_key" VARCHAR(160) NOT NULL,
    "correlation_id" UUID NOT NULL,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_reversals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "receipts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "society_id" UUID NOT NULL,
    "payment_id" UUID NOT NULL,
    "number" VARCHAR(80) NOT NULL,
    "status" "ReceiptStatus" NOT NULL DEFAULT 'ISSUED',
    "total_amount" DECIMAL(12,2) NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'INR',
    "issued_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "issued_by_user_id" UUID NOT NULL,
    "voided_at" TIMESTAMPTZ(6),
    "voided_by_user_id" UUID,
    "void_reason" VARCHAR(500),
    "file_id" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "receipt_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "society_id" UUID NOT NULL,
    "receipt_id" UUID NOT NULL,
    "sequence" INTEGER NOT NULL,
    "event_type" "ReceiptEventType" NOT NULL,
    "actor_user_id" UUID NOT NULL,
    "reason" VARCHAR(500),
    "correlation_id" UUID NOT NULL,
    "metadata" JSONB,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "receipt_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_sequences" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "society_id" UUID NOT NULL,
    "kind" VARCHAR(64) NOT NULL,
    "prefix" VARCHAR(24) NOT NULL,
    "year" INTEGER NOT NULL,
    "current_value" BIGINT NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "document_sequences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "emergency_alerts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "society_id" UUID NOT NULL,
    "flat_id" UUID NOT NULL,
    "created_by_user_id" UUID NOT NULL,
    "category" "EmergencyCategory" NOT NULL,
    "status" "EmergencyStatus" NOT NULL DEFAULT 'ACTIVE',
    "description" VARCHAR(500),
    "acknowledged_by_guard_id" UUID,
    "guard_acknowledged_at" TIMESTAMPTZ(6),
    "acknowledged_by_admin_user_id" UUID,
    "admin_acknowledged_at" TIMESTAMPTZ(6),
    "responding_at" TIMESTAMPTZ(6),
    "resolved_at" TIMESTAMPTZ(6),
    "resolved_by_user_id" UUID,
    "resolution" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "emergency_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "emergency_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "society_id" UUID NOT NULL,
    "alert_id" UUID NOT NULL,
    "sequence" INTEGER NOT NULL,
    "event_type" "EmergencyEventType" NOT NULL,
    "previous_status" "EmergencyStatus",
    "new_status" "EmergencyStatus",
    "actor_user_id" UUID,
    "actor_guard_profile_id" UUID,
    "details" VARCHAR(1000),
    "correlation_id" UUID NOT NULL,
    "metadata" JSONB,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "emergency_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "society_id" UUID NOT NULL,
    "normalized_phone" VARCHAR(16) NOT NULL,
    "phone_digest" CHAR(64) NOT NULL,
    "email" VARCHAR(254),
    "display_name" VARCHAR(120) NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'PENDING',
    "preferred_locale" VARCHAR(16) NOT NULL DEFAULT 'en-IN',
    "password_hash" VARCHAR(255),
    "app_pin_hash" VARCHAR(255),
    "mfa_enabled" BOOLEAN NOT NULL DEFAULT false,
    "last_authenticated_at" TIMESTAMPTZ(6),
    "deactivated_at" TIMESTAMPTZ(6),
    "deactivation_reason" VARCHAR(500),
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "otp_challenges" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "society_id" UUID NOT NULL,
    "user_id" UUID,
    "normalized_phone" VARCHAR(16) NOT NULL,
    "phone_digest" CHAR(64) NOT NULL,
    "purpose" "OtpPurpose" NOT NULL,
    "status" "OtpChallengeStatus" NOT NULL DEFAULT 'PENDING',
    "code_digest" CHAR(64) NOT NULL,
    "device_nonce_digest" CHAR(64) NOT NULL,
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 5,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "verified_at" TIMESTAMPTZ(6),
    "superseded_at" TIMESTAMPTZ(6),
    "request_ip_hash" CHAR(64),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "otp_challenges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "devices" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "society_id" UUID NOT NULL,
    "user_id" UUID,
    "platform" "DevicePlatform" NOT NULL DEFAULT 'UNKNOWN',
    "status" "DeviceStatus" NOT NULL DEFAULT 'PENDING',
    "label" VARCHAR(120),
    "fingerprint_digest" CHAR(64) NOT NULL,
    "public_key" TEXT,
    "app_version" VARCHAR(32),
    "operating_system" VARCHAR(80),
    "last_seen_at" TIMESTAMPTZ(6),
    "revoked_at" TIMESTAMPTZ(6),
    "revocation_reason" VARCHAR(500),
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "society_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "device_id" UUID,
    "kind" "SessionKind" NOT NULL,
    "status" "SessionStatus" NOT NULL DEFAULT 'ACTIVE',
    "refresh_token_family_id" UUID NOT NULL,
    "last_seen_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "idle_expires_at" TIMESTAMPTZ(6) NOT NULL,
    "absolute_expires_at" TIMESTAMPTZ(6) NOT NULL,
    "revoked_at" TIMESTAMPTZ(6),
    "revocation_reason" VARCHAR(500),
    "ip_address" INET,
    "user_agent_hash" CHAR(64),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "society_id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "family_id" UUID NOT NULL,
    "token_digest" CHAR(64) NOT NULL,
    "parent_token_id" UUID,
    "status" "SessionStatus" NOT NULL DEFAULT 'ACTIVE',
    "issued_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "consumed_at" TIMESTAMPTZ(6),
    "revoked_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "push_endpoints" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "society_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "device_id" UUID,
    "provider" "PushProvider" NOT NULL,
    "status" "PushEndpointStatus" NOT NULL DEFAULT 'ACTIVE',
    "token_digest" CHAR(64) NOT NULL,
    "encrypted_token" TEXT NOT NULL,
    "last_delivered_at" TIMESTAMPTZ(6),
    "last_failure_at" TIMESTAMPTZ(6),
    "last_failure_code" VARCHAR(80),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "push_endpoints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "society_id" UUID NOT NULL,
    "code" VARCHAR(80) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" VARCHAR(500),
    "privilege_level" INTEGER NOT NULL DEFAULT 0,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "society_id" UUID NOT NULL,
    "action" VARCHAR(120) NOT NULL,
    "description" VARCHAR(500),
    "risk_level" INTEGER NOT NULL DEFAULT 0,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "society_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "permission_id" UUID NOT NULL,
    "granted_by_user_id" UUID,
    "granted_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "society_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "scope" "RoleScope" NOT NULL DEFAULT 'SOCIETY',
    "flat_membership_id" UUID,
    "gate_id" UUID,
    "granted_by_user_id" UUID,
    "starts_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6),
    "revoked_at" TIMESTAMPTZ(6),
    "revocation_reason" VARCHAR(500),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_help" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "society_id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "normalized_phone" VARCHAR(16),
    "phone_digest" CHAR(64),
    "photo_file_id" UUID,
    "type" "DailyHelpType" NOT NULL,
    "identification_reference" VARCHAR(120),
    "status" "DailyHelpStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" VARCHAR(500),
    "emergency_contact_name" VARCHAR(120),
    "emergency_contact_phone" VARCHAR(16),
    "activated_at" TIMESTAMPTZ(6),
    "suspended_at" TIMESTAMPTZ(6),
    "suspension_reason" VARCHAR(500),
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "daily_help_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_help_flat_assignments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "society_id" UUID NOT NULL,
    "daily_help_id" UUID NOT NULL,
    "flat_id" UUID NOT NULL,
    "managed_by_membership_id" UUID NOT NULL,
    "status" "AssignmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "starts_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ends_at" TIMESTAMPTZ(6),
    "notes" VARCHAR(500),
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "daily_help_flat_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_help_access_windows" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "society_id" UUID NOT NULL,
    "assignment_id" UUID NOT NULL,
    "weekday" INTEGER NOT NULL,
    "start_minute" INTEGER NOT NULL,
    "end_minute" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "daily_help_access_windows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_help_attendance" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "society_id" UUID NOT NULL,
    "daily_help_id" UUID NOT NULL,
    "gate_id" UUID NOT NULL,
    "status" "AttendanceStatus" NOT NULL DEFAULT 'CHECKED_IN',
    "checked_in_at" TIMESTAMPTZ(6) NOT NULL,
    "checked_out_at" TIMESTAMPTZ(6),
    "checked_in_by_guard_id" UUID NOT NULL,
    "checked_out_by_guard_id" UUID,
    "check_in_client_mutation_id" UUID,
    "check_out_client_mutation_id" UUID,
    "voided_at" TIMESTAMPTZ(6),
    "void_reason" VARCHAR(500),
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "daily_help_attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_help_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "society_id" UUID NOT NULL,
    "daily_help_id" UUID NOT NULL,
    "assignment_id" UUID,
    "attendance_id" UUID,
    "sequence" INTEGER NOT NULL,
    "event_type" "DailyHelpEventType" NOT NULL,
    "actor_user_id" UUID,
    "actor_guard_profile_id" UUID,
    "server_occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "client_occurred_at" TIMESTAMPTZ(6),
    "correlation_id" UUID NOT NULL,
    "metadata" JSONB,

    CONSTRAINT "daily_help_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parcels" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "society_id" UUID NOT NULL,
    "flat_id" UUID NOT NULL,
    "gate_id" UUID NOT NULL,
    "delivery_visit_id" UUID,
    "status" "ParcelStatus" NOT NULL DEFAULT 'EXPECTED',
    "resident_decision" "ParcelDecision",
    "carrier_name" VARCHAR(120),
    "tracking_reference" VARCHAR(120),
    "photo_file_id" UUID,
    "collection_code_digest" CHAR(64),
    "collection_code_expires_at" TIMESTAMPTZ(6),
    "recorded_by_guard_profile_id" UUID NOT NULL,
    "arrived_at" TIMESTAMPTZ(6),
    "held_at" TIMESTAMPTZ(6),
    "collected_at" TIMESTAMPTZ(6),
    "collected_by_guard_profile_id" UUID,
    "returned_at" TIMESTAMPTZ(6),
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "parcels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parcel_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "society_id" UUID NOT NULL,
    "parcel_id" UUID NOT NULL,
    "sequence" INTEGER NOT NULL,
    "event_type" "ParcelEventType" NOT NULL,
    "previous_status" "ParcelStatus",
    "new_status" "ParcelStatus",
    "actor_user_id" UUID,
    "actor_guard_profile_id" UUID,
    "server_occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "client_occurred_at" TIMESTAMPTZ(6),
    "correlation_id" UUID NOT NULL,
    "metadata" JSONB,

    CONSTRAINT "parcel_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_preferences" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "society_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "category" "NotificationCategory" NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "quiet_start" INTEGER,
    "quiet_end" INTEGER,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "society_id" UUID NOT NULL,
    "recipient_user_id" UUID NOT NULL,
    "category" "NotificationCategory" NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "body" TEXT NOT NULL,
    "entity_type" VARCHAR(80),
    "entity_id" UUID,
    "deep_link" VARCHAR(500),
    "dedupe_key" VARCHAR(200) NOT NULL,
    "read_at" TIMESTAMPTZ(6),
    "expires_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_deliveries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "society_id" UUID NOT NULL,
    "notification_id" UUID NOT NULL,
    "push_endpoint_id" UUID,
    "channel" "NotificationChannel" NOT NULL,
    "status" "DeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "next_attempt_at" TIMESTAMPTZ(6),
    "provider_message_id" VARCHAR(200),
    "delivered_at" TIMESTAMPTZ(6),
    "failed_at" TIMESTAMPTZ(6),
    "error_code" VARCHAR(80),
    "error_detail" VARCHAR(500),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "notification_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbox_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "society_id" UUID NOT NULL,
    "aggregate_type" VARCHAR(80) NOT NULL,
    "aggregate_id" UUID NOT NULL,
    "event_type" VARCHAR(120) NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "OutboxStatus" NOT NULL DEFAULT 'PENDING',
    "dedupe_key" VARCHAR(200) NOT NULL,
    "available_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "claimed_at" TIMESTAMPTZ(6),
    "published_at" TIMESTAMPTZ(6),
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "last_error_code" VARCHAR(80),
    "correlation_id" UUID NOT NULL,
    "trace_id" VARCHAR(64),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbox_attempts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "society_id" UUID NOT NULL,
    "outbox_event_id" UUID NOT NULL,
    "attempt" INTEGER NOT NULL,
    "status" "OutboxStatus" NOT NULL,
    "error_code" VARCHAR(80),
    "error_detail" VARCHAR(500),
    "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "outbox_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inbox_messages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "society_id" UUID NOT NULL,
    "source" VARCHAR(80) NOT NULL,
    "external_message_id" VARCHAR(200) NOT NULL,
    "message_type" VARCHAR(120) NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "InboxStatus" NOT NULL DEFAULT 'RECEIVED',
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "processed_at" TIMESTAMPTZ(6),
    "error_code" VARCHAR(80),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "inbox_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "file_uploads" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "society_id" UUID NOT NULL,
    "purpose" "FilePurpose" NOT NULL,
    "status" "FileStatus" NOT NULL DEFAULT 'PENDING_UPLOAD',
    "bucket" VARCHAR(120) NOT NULL,
    "storage_key" VARCHAR(500) NOT NULL,
    "original_filename" VARCHAR(255) NOT NULL,
    "declared_mime_type" VARCHAR(120) NOT NULL,
    "detected_mime_type" VARCHAR(120),
    "byte_size" BIGINT NOT NULL,
    "sha256_digest" CHAR(64),
    "uploaded_by_user_id" UUID NOT NULL,
    "parent_entity_type" VARCHAR(80) NOT NULL,
    "parent_entity_id" UUID NOT NULL,
    "scan_provider" VARCHAR(80),
    "scan_completed_at" TIMESTAMPTZ(6),
    "rejection_reason" VARCHAR(500),
    "uploaded_at" TIMESTAMPTZ(6),
    "retention_until" TIMESTAMPTZ(6),
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "file_uploads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "society_id" UUID NOT NULL,
    "actor_user_id" UUID,
    "session_id" UUID,
    "device_id" UUID,
    "gate_id" UUID,
    "action" VARCHAR(120) NOT NULL,
    "entity_type" VARCHAR(80) NOT NULL,
    "entity_id" UUID,
    "outcome" "AuditOutcome" NOT NULL DEFAULT 'SUCCESS',
    "previous_values" JSONB,
    "new_values" JSONB,
    "reason" VARCHAR(500),
    "ip_address" INET,
    "correlation_id" UUID NOT NULL,
    "previous_hash" CHAR(64),
    "entry_hash" CHAR(64) NOT NULL,
    "metadata" JSONB,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idempotency_records" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "society_id" UUID NOT NULL,
    "actor_scope_key" VARCHAR(200) NOT NULL,
    "actor_user_id" UUID,
    "session_id" UUID,
    "guard_device_id" UUID,
    "operation" VARCHAR(120) NOT NULL,
    "key" VARCHAR(200) NOT NULL,
    "request_hash" CHAR(64) NOT NULL,
    "status" "IdempotencyStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "response_status" INTEGER,
    "response_body" JSONB,
    "locked_until" TIMESTAMPTZ(6),
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "idempotency_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offline_sync_records" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "society_id" UUID NOT NULL,
    "guard_device_id" UUID NOT NULL,
    "client_mutation_id" UUID NOT NULL,
    "client_sequence" BIGINT NOT NULL,
    "operation" VARCHAR(120) NOT NULL,
    "entity_type" VARCHAR(80) NOT NULL,
    "entity_id" UUID NOT NULL,
    "payload_hash" CHAR(64) NOT NULL,
    "signature" TEXT NOT NULL,
    "status" "OfflineSyncStatus" NOT NULL DEFAULT 'LOCAL_PENDING',
    "local_created_at" TIMESTAMPTZ(6) NOT NULL,
    "last_server_seen_at" TIMESTAMPTZ(6),
    "server_received_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "synced_at" TIMESTAMPTZ(6),
    "conflict_code" VARCHAR(80),
    "conflict_details" JSONB,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "offline_sync_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offline_sync_attempts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "society_id" UUID NOT NULL,
    "sync_record_id" UUID NOT NULL,
    "attempt" INTEGER NOT NULL,
    "result" "SyncAttemptResult" NOT NULL,
    "error_code" VARCHAR(80),
    "error_detail" VARCHAR(500),
    "correlation_id" UUID NOT NULL,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "offline_sync_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "flat_memberships" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "society_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "flat_id" UUID NOT NULL,
    "relationship" "MembershipRelationship" NOT NULL,
    "occupancy_type" "OccupancyType" NOT NULL,
    "status" "MembershipStatus" NOT NULL DEFAULT 'PENDING',
    "start_at" TIMESTAMPTZ(6) NOT NULL,
    "end_at" TIMESTAMPTZ(6),
    "requested_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approved_by_user_id" UUID,
    "approved_at" TIMESTAMPTZ(6),
    "rejected_at" TIMESTAMPTZ(6),
    "rejection_reason" VARCHAR(500),
    "suspended_at" TIMESTAMPTZ(6),
    "suspension_reason" VARCHAR(500),
    "ended_at" TIMESTAMPTZ(6),
    "end_reason" VARCHAR(500),
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "flat_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "flat_membership_history" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "society_id" UUID NOT NULL,
    "membership_id" UUID NOT NULL,
    "sequence" INTEGER NOT NULL,
    "from_status" "MembershipStatus",
    "to_status" "MembershipStatus" NOT NULL,
    "actor_user_id" UUID,
    "reason" VARCHAR(500),
    "metadata" JSONB,
    "correlation_id" UUID NOT NULL,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "flat_membership_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "family_members" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "society_id" UUID NOT NULL,
    "flat_id" UUID NOT NULL,
    "managed_by_membership_id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "relationship" "FamilyRelationship" NOT NULL,
    "date_of_birth" DATE,
    "normalized_phone" VARCHAR(16),
    "notes" VARCHAR(500),
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "start_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "end_at" TIMESTAMPTZ(6),
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "family_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guard_profiles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "society_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "employee_code" VARCHAR(40) NOT NULL,
    "pin_hash" VARCHAR(255) NOT NULL,
    "status" "GuardStatus" NOT NULL DEFAULT 'ACTIVE',
    "preferred_locale" VARCHAR(16) NOT NULL DEFAULT 'hi-IN',
    "last_shift_started_at" TIMESTAMPTZ(6),
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "guard_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guard_devices" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "society_id" UUID NOT NULL,
    "device_id" UUID NOT NULL,
    "enrollment_token_digest" CHAR(64),
    "enrollment_expires_at" TIMESTAMPTZ(6),
    "key_id" VARCHAR(120),
    "offline_lease_expires_at" TIMESTAMPTZ(6),
    "last_synced_at" TIMESTAMPTZ(6),
    "last_accepted_sequence" BIGINT NOT NULL DEFAULT 0,
    "registered_by_user_id" UUID,
    "status" "DeviceStatus" NOT NULL DEFAULT 'PENDING',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "guard_devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guard_device_gates" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "society_id" UUID NOT NULL,
    "guard_device_id" UUID NOT NULL,
    "gate_id" UUID NOT NULL,
    "starts_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ends_at" TIMESTAMPTZ(6),
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "guard_device_gates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guard_gate_assignments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "society_id" UUID NOT NULL,
    "guard_profile_id" UUID NOT NULL,
    "gate_id" UUID NOT NULL,
    "starts_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ends_at" TIMESTAMPTZ(6),
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "guard_gate_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "visitors" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "society_id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "normalized_phone" VARCHAR(16),
    "phone_digest" CHAR(64),
    "vehicle_number" VARCHAR(24),
    "photo_file_id" UUID,
    "notes" VARCHAR(500),
    "created_by_user_id" UUID,
    "last_visited_at" TIMESTAMPTZ(6),
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "visitors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "visitor_pre_approvals" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "society_id" UUID NOT NULL,
    "flat_id" UUID NOT NULL,
    "visitor_id" UUID NOT NULL,
    "created_by_membership_id" UUID NOT NULL,
    "created_by_user_id" UUID NOT NULL,
    "category" "VisitorCategory" NOT NULL,
    "purpose" VARCHAR(240),
    "expected_at" TIMESTAMPTZ(6) NOT NULL,
    "valid_from" TIMESTAMPTZ(6) NOT NULL,
    "valid_until" TIMESTAMPTZ(6) NOT NULL,
    "access_type" "AccessType" NOT NULL DEFAULT 'ONE_TIME',
    "status" "PreApprovalStatus" NOT NULL DEFAULT 'ACTIVE',
    "code_digest" CHAR(64) NOT NULL,
    "max_uses" INTEGER NOT NULL DEFAULT 1,
    "use_count" INTEGER NOT NULL DEFAULT 0,
    "cancelled_at" TIMESTAMPTZ(6),
    "cancellation_reason" VARCHAR(500),
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "visitor_pre_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pre_approval_uses" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "society_id" UUID NOT NULL,
    "pre_approval_id" UUID NOT NULL,
    "visit_id" UUID NOT NULL,
    "verified_by_guard_id" UUID NOT NULL,
    "used_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pre_approval_uses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "visits" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "society_id" UUID NOT NULL,
    "flat_id" UUID NOT NULL,
    "visitor_id" UUID NOT NULL,
    "gate_id" UUID NOT NULL,
    "pre_approval_id" UUID,
    "source" "VisitSource" NOT NULL,
    "category" "VisitorCategory" NOT NULL,
    "status" "VisitStatus" NOT NULL DEFAULT 'DRAFT',
    "visitor_name_snapshot" VARCHAR(120) NOT NULL,
    "visitor_phone_masked" VARCHAR(24),
    "vehicle_number_snapshot" VARCHAR(24),
    "purpose" VARCHAR(240),
    "expected_at" TIMESTAMPTZ(6),
    "arrived_at" TIMESTAMPTZ(6),
    "approval_deadline_at" TIMESTAMPTZ(6),
    "approved_at" TIMESTAMPTZ(6),
    "checked_in_at" TIMESTAMPTZ(6),
    "checked_out_at" TIMESTAMPTZ(6),
    "expires_at" TIMESTAMPTZ(6),
    "long_visit_flagged_at" TIMESTAMPTZ(6),
    "created_by_user_id" UUID,
    "created_by_guard_profile_id" UUID,
    "created_by_guard_device_id" UUID,
    "offline_created" BOOLEAN NOT NULL DEFAULT false,
    "client_created_at" TIMESTAMPTZ(6),
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "visits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "visit_approvals" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "society_id" UUID NOT NULL,
    "visit_id" UUID NOT NULL,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "requested_by_guard_profile_id" UUID NOT NULL,
    "requested_by_guard_device_id" UUID NOT NULL,
    "requested_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "decided_at" TIMESTAMPTZ(6),
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "visit_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "visit_approval_decisions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "society_id" UUID NOT NULL,
    "approval_id" UUID NOT NULL,
    "decision" "ApprovalStatus" NOT NULL,
    "source" "ApprovalSource" NOT NULL,
    "actor_user_id" UUID,
    "actor_guard_profile_id" UUID,
    "reason" VARCHAR(500),
    "actor_authenticated_at" TIMESTAMPTZ(6),
    "correlation_id" UUID NOT NULL,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "visit_approval_decisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "visit_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "society_id" UUID NOT NULL,
    "visit_id" UUID NOT NULL,
    "sequence" INTEGER NOT NULL,
    "event_type" "VisitEventType" NOT NULL,
    "previous_status" "VisitStatus",
    "new_status" "VisitStatus",
    "actor_user_id" UUID,
    "actor_guard_profile_id" UUID,
    "actor_guard_device_id" UUID,
    "gate_id" UUID,
    "server_occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "client_occurred_at" TIMESTAMPTZ(6),
    "correlation_id" UUID NOT NULL,
    "metadata" JSONB,

    CONSTRAINT "visit_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "societies" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "singleton_key" VARCHAR(32) NOT NULL DEFAULT 'MANGLAM_BALAJI',
    "name" VARCHAR(160) NOT NULL,
    "legal_name" VARCHAR(200),
    "timezone" VARCHAR(64) NOT NULL DEFAULT 'Asia/Kolkata',
    "currency" CHAR(3) NOT NULL DEFAULT 'INR',
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "societies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "society_settings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "society_id" UUID NOT NULL,
    "visitor_approval_timeout_seconds" INTEGER NOT NULL DEFAULT 120,
    "long_visit_threshold_minutes" INTEGER NOT NULL DEFAULT 720,
    "guard_offline_lease_hours" INTEGER NOT NULL DEFAULT 24,
    "visitor_retention_days" INTEGER NOT NULL DEFAULT 180,
    "photo_retention_days" INTEGER NOT NULL DEFAULT 30,
    "notification_retention_days" INTEGER NOT NULL DEFAULT 90,
    "audit_retention_days" INTEGER NOT NULL DEFAULT 365,
    "allow_visitor_photos" BOOLEAN NOT NULL DEFAULT true,
    "emergency_contacts" JSONB,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "society_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blocks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "society_id" UUID NOT NULL,
    "code" VARCHAR(32) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "blocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "floors" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "society_id" UUID NOT NULL,
    "block_id" UUID NOT NULL,
    "label" VARCHAR(32) NOT NULL,
    "number" INTEGER,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "floors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "flats" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "society_id" UUID NOT NULL,
    "block_id" UUID NOT NULL,
    "floor_id" UUID NOT NULL,
    "number" VARCHAR(32) NOT NULL,
    "display_name" VARCHAR(80) NOT NULL,
    "occupancy_type" "OccupancyType",
    "intercom_number" VARCHAR(32),
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "flats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gates" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "society_id" UUID NOT NULL,
    "code" VARCHAR(32) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "gates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notices_society_status_published_idx" ON "notices"("society_id", "status", "published_at" DESC);

-- CreateIndex
CREATE INDEX "notices_priority_status_expires_idx" ON "notices"("priority", "status", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "notices_society_id_id_key" ON "notices"("society_id", "id");

-- CreateIndex
CREATE INDEX "notice_audiences_notice_type_idx" ON "notice_audiences"("notice_id", "type");

-- CreateIndex
CREATE UNIQUE INDEX "notice_audiences_society_id_id_key" ON "notice_audiences"("society_id", "id");

-- CreateIndex
CREATE INDEX "notice_recipients_user_created_idx" ON "notice_recipients"("user_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "notice_recipients_notice_user_key" ON "notice_recipients"("notice_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "notice_recipients_society_id_id_key" ON "notice_recipients"("society_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "notice_attachments_notice_file_key" ON "notice_attachments"("notice_id", "file_id");

-- CreateIndex
CREATE UNIQUE INDEX "notice_attachments_society_id_id_key" ON "notice_attachments"("society_id", "id");

-- CreateIndex
CREATE INDEX "notice_reads_user_read_idx" ON "notice_reads"("user_id", "read_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "notice_reads_notice_user_key" ON "notice_reads"("notice_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "notice_reads_society_id_id_key" ON "notice_reads"("society_id", "id");

-- CreateIndex
CREATE INDEX "notice_acknowledgements_user_ack_idx" ON "notice_acknowledgements"("user_id", "acknowledged_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "notice_acknowledgements_notice_user_key" ON "notice_acknowledgements"("notice_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "notice_acknowledgements_society_id_id_key" ON "notice_acknowledgements"("society_id", "id");

-- CreateIndex
CREATE INDEX "complaint_categories_society_status_sort_idx" ON "complaint_categories"("society_id", "status", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "complaint_categories_society_code_key" ON "complaint_categories"("society_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "complaint_categories_society_id_id_key" ON "complaint_categories"("society_id", "id");

-- CreateIndex
CREATE INDEX "complaints_status_priority_created_idx" ON "complaints"("status", "priority", "created_at");

-- CreateIndex
CREATE INDEX "complaints_flat_created_idx" ON "complaints"("flat_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "complaints_assignee_status_idx" ON "complaints"("assigned_to_user_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "complaints_society_id_id_key" ON "complaints"("society_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "complaint_attachments_complaint_file_key" ON "complaint_attachments"("complaint_id", "file_id");

-- CreateIndex
CREATE UNIQUE INDEX "complaint_attachments_society_id_id_key" ON "complaint_attachments"("society_id", "id");

-- CreateIndex
CREATE INDEX "complaint_comments_complaint_created_idx" ON "complaint_comments"("complaint_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "complaint_comments_society_id_id_key" ON "complaint_comments"("society_id", "id");

-- CreateIndex
CREATE INDEX "complaint_internal_notes_complaint_created_idx" ON "complaint_internal_notes"("complaint_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "complaint_internal_notes_society_id_id_key" ON "complaint_internal_notes"("society_id", "id");

-- CreateIndex
CREATE INDEX "complaint_status_history_complaint_occurred_idx" ON "complaint_status_history"("complaint_id", "occurred_at");

-- CreateIndex
CREATE UNIQUE INDEX "complaint_status_history_complaint_sequence_key" ON "complaint_status_history"("complaint_id", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "complaint_status_history_society_id_id_key" ON "complaint_status_history"("society_id", "id");

-- CreateIndex
CREATE INDEX "complaint_assignment_history_complaint_occurred_idx" ON "complaint_assignment_history"("complaint_id", "occurred_at");

-- CreateIndex
CREATE UNIQUE INDEX "complaint_assignment_history_complaint_sequence_key" ON "complaint_assignment_history"("complaint_id", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "complaint_assignment_history_society_id_id_key" ON "complaint_assignment_history"("society_id", "id");

-- CreateIndex
CREATE INDEX "maintenance_batches_status_period_idx" ON "maintenance_charge_batches"("society_id", "status", "period_start" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "maintenance_batches_society_code_key" ON "maintenance_charge_batches"("society_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "maintenance_batches_society_id_id_key" ON "maintenance_charge_batches"("society_id", "id");

-- CreateIndex
CREATE INDEX "maintenance_charges_flat_due_date_idx" ON "maintenance_charges"("flat_id", "due_date");

-- CreateIndex
CREATE INDEX "maintenance_charges_status_due_date_idx" ON "maintenance_charges"("status", "due_date");

-- CreateIndex
CREATE UNIQUE INDEX "maintenance_charges_flat_period_key" ON "maintenance_charges"("flat_id", "period_start");

-- CreateIndex
CREATE UNIQUE INDEX "maintenance_charges_society_id_id_key" ON "maintenance_charges"("society_id", "id");

-- CreateIndex
CREATE INDEX "maintenance_adjustments_charge_created_idx" ON "maintenance_charge_adjustments"("charge_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "maintenance_adjustments_society_id_id_key" ON "maintenance_charge_adjustments"("society_id", "id");

-- CreateIndex
CREATE INDEX "payments_flat_received_idx" ON "payments"("flat_id", "received_at" DESC);

-- CreateIndex
CREATE INDEX "payments_status_received_idx" ON "payments"("status", "received_at" DESC);

-- CreateIndex
CREATE INDEX "payments_reference_idx" ON "payments"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "payments_society_id_id_key" ON "payments"("society_id", "id");

-- CreateIndex
CREATE INDEX "payment_allocations_charge_id_idx" ON "payment_allocations"("charge_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_allocations_payment_charge_key" ON "payment_allocations"("payment_id", "charge_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_allocations_society_id_id_key" ON "payment_allocations"("society_id", "id");

-- CreateIndex
CREATE INDEX "payment_reversals_payment_occurred_idx" ON "payment_reversals"("payment_id", "occurred_at");

-- CreateIndex
CREATE UNIQUE INDEX "payment_reversals_society_idempotency_key" ON "payment_reversals"("society_id", "idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "payment_reversals_society_id_id_key" ON "payment_reversals"("society_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "receipts_payment_id_key" ON "receipts"("payment_id");

-- CreateIndex
CREATE INDEX "receipts_issued_at_idx" ON "receipts"("issued_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "receipts_society_number_key" ON "receipts"("society_id", "number");

-- CreateIndex
CREATE UNIQUE INDEX "receipts_society_id_id_key" ON "receipts"("society_id", "id");

-- CreateIndex
CREATE INDEX "receipt_events_receipt_occurred_idx" ON "receipt_events"("receipt_id", "occurred_at");

-- CreateIndex
CREATE UNIQUE INDEX "receipt_events_receipt_sequence_key" ON "receipt_events"("receipt_id", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "receipt_events_society_id_id_key" ON "receipt_events"("society_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "document_sequences_society_kind_year_key" ON "document_sequences"("society_id", "kind", "year");

-- CreateIndex
CREATE UNIQUE INDEX "document_sequences_society_id_id_key" ON "document_sequences"("society_id", "id");

-- CreateIndex
CREATE INDEX "emergency_alerts_society_status_created_idx" ON "emergency_alerts"("society_id", "status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "emergency_alerts_flat_created_idx" ON "emergency_alerts"("flat_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "emergency_alerts_society_id_id_key" ON "emergency_alerts"("society_id", "id");

-- CreateIndex
CREATE INDEX "emergency_events_alert_occurred_idx" ON "emergency_events"("alert_id", "occurred_at");

-- CreateIndex
CREATE UNIQUE INDEX "emergency_events_alert_sequence_key" ON "emergency_events"("alert_id", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "emergency_events_society_id_id_key" ON "emergency_events"("society_id", "id");

-- CreateIndex
CREATE INDEX "users_society_id_status_idx" ON "users"("society_id", "status");

-- CreateIndex
CREATE INDEX "users_phone_digest_idx" ON "users"("phone_digest");

-- CreateIndex
CREATE UNIQUE INDEX "users_society_id_phone_key" ON "users"("society_id", "normalized_phone");

-- CreateIndex
CREATE UNIQUE INDEX "users_society_id_id_key" ON "users"("society_id", "id");

-- CreateIndex
CREATE INDEX "otp_challenges_phone_purpose_created_idx" ON "otp_challenges"("phone_digest", "purpose", "created_at" DESC);

-- CreateIndex
CREATE INDEX "otp_challenges_status_expires_idx" ON "otp_challenges"("status", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "otp_challenges_society_id_id_key" ON "otp_challenges"("society_id", "id");

-- CreateIndex
CREATE INDEX "devices_user_id_status_idx" ON "devices"("user_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "devices_society_id_fingerprint_key" ON "devices"("society_id", "fingerprint_digest");

-- CreateIndex
CREATE UNIQUE INDEX "devices_society_id_id_key" ON "devices"("society_id", "id");

-- CreateIndex
CREATE INDEX "user_sessions_user_status_expires_idx" ON "user_sessions"("user_id", "status", "absolute_expires_at");

-- CreateIndex
CREATE INDEX "user_sessions_token_family_idx" ON "user_sessions"("refresh_token_family_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_sessions_society_id_id_key" ON "user_sessions"("society_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_digest_key" ON "refresh_tokens"("token_digest");

-- CreateIndex
CREATE INDEX "refresh_tokens_session_id_status_idx" ON "refresh_tokens"("session_id", "status");

-- CreateIndex
CREATE INDEX "refresh_tokens_family_id_status_idx" ON "refresh_tokens"("family_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_society_id_id_key" ON "refresh_tokens"("society_id", "id");

-- CreateIndex
CREATE INDEX "push_endpoints_user_id_status_idx" ON "push_endpoints"("user_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "push_endpoints_society_id_token_key" ON "push_endpoints"("society_id", "token_digest");

-- CreateIndex
CREATE UNIQUE INDEX "push_endpoints_society_id_id_key" ON "push_endpoints"("society_id", "id");

-- CreateIndex
CREATE INDEX "roles_society_id_status_idx" ON "roles"("society_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "roles_society_id_code_key" ON "roles"("society_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "roles_society_id_id_key" ON "roles"("society_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_society_id_action_key" ON "permissions"("society_id", "action");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_society_id_id_key" ON "permissions"("society_id", "id");

-- CreateIndex
CREATE INDEX "role_permissions_permission_id_idx" ON "role_permissions"("permission_id");

-- CreateIndex
CREATE UNIQUE INDEX "role_permissions_role_permission_key" ON "role_permissions"("role_id", "permission_id");

-- CreateIndex
CREATE UNIQUE INDEX "role_permissions_society_id_id_key" ON "role_permissions"("society_id", "id");

-- CreateIndex
CREATE INDEX "user_roles_user_active_idx" ON "user_roles"("user_id", "revoked_at", "expires_at");

-- CreateIndex
CREATE INDEX "user_roles_role_id_idx" ON "user_roles"("role_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_roles_society_id_id_key" ON "user_roles"("society_id", "id");

-- CreateIndex
CREATE INDEX "daily_help_society_status_type_idx" ON "daily_help"("society_id", "status", "type");

-- CreateIndex
CREATE INDEX "daily_help_society_phone_idx" ON "daily_help"("society_id", "phone_digest");

-- CreateIndex
CREATE UNIQUE INDEX "daily_help_society_id_id_key" ON "daily_help"("society_id", "id");

-- CreateIndex
CREATE INDEX "daily_help_assignments_flat_status_idx" ON "daily_help_flat_assignments"("flat_id", "status");

-- CreateIndex
CREATE INDEX "daily_help_assignments_helper_status_idx" ON "daily_help_flat_assignments"("daily_help_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "daily_help_assignments_society_id_id_key" ON "daily_help_flat_assignments"("society_id", "id");

-- CreateIndex
CREATE INDEX "daily_help_windows_assignment_weekday_idx" ON "daily_help_access_windows"("assignment_id", "weekday");

-- CreateIndex
CREATE UNIQUE INDEX "daily_help_windows_assignment_time_key" ON "daily_help_access_windows"("assignment_id", "weekday", "start_minute", "end_minute");

-- CreateIndex
CREATE UNIQUE INDEX "daily_help_windows_society_id_id_key" ON "daily_help_access_windows"("society_id", "id");

-- CreateIndex
CREATE INDEX "daily_help_attendance_helper_checked_in_idx" ON "daily_help_attendance"("daily_help_id", "checked_in_at" DESC);

-- CreateIndex
CREATE INDEX "daily_help_attendance_gate_status_idx" ON "daily_help_attendance"("gate_id", "status", "checked_in_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "daily_help_attendance_society_id_id_key" ON "daily_help_attendance"("society_id", "id");

-- CreateIndex
CREATE INDEX "daily_help_events_helper_occurred_idx" ON "daily_help_events"("daily_help_id", "server_occurred_at");

-- CreateIndex
CREATE UNIQUE INDEX "daily_help_events_helper_sequence_key" ON "daily_help_events"("daily_help_id", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "daily_help_events_society_id_id_key" ON "daily_help_events"("society_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "parcels_collection_code_digest_key" ON "parcels"("collection_code_digest");

-- CreateIndex
CREATE INDEX "parcels_flat_status_created_idx" ON "parcels"("flat_id", "status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "parcels_gate_status_idx" ON "parcels"("gate_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "parcels_society_id_id_key" ON "parcels"("society_id", "id");

-- CreateIndex
CREATE INDEX "parcel_events_parcel_occurred_idx" ON "parcel_events"("parcel_id", "server_occurred_at");

-- CreateIndex
CREATE UNIQUE INDEX "parcel_events_parcel_sequence_key" ON "parcel_events"("parcel_id", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "parcel_events_society_id_id_key" ON "parcel_events"("society_id", "id");

-- CreateIndex
CREATE INDEX "notification_preferences_user_enabled_idx" ON "notification_preferences"("user_id", "enabled");

-- CreateIndex
CREATE UNIQUE INDEX "notification_preferences_user_category_channel_key" ON "notification_preferences"("user_id", "category", "channel");

-- CreateIndex
CREATE UNIQUE INDEX "notification_preferences_society_id_id_key" ON "notification_preferences"("society_id", "id");

-- CreateIndex
CREATE INDEX "notifications_recipient_read_created_idx" ON "notifications"("recipient_user_id", "read_at", "created_at" DESC);

-- CreateIndex
CREATE INDEX "notifications_category_created_idx" ON "notifications"("category", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "notifications_recipient_dedupe_key" ON "notifications"("recipient_user_id", "dedupe_key");

-- CreateIndex
CREATE UNIQUE INDEX "notifications_society_id_id_key" ON "notifications"("society_id", "id");

-- CreateIndex
CREATE INDEX "notification_deliveries_status_next_attempt_idx" ON "notification_deliveries"("status", "next_attempt_at");

-- CreateIndex
CREATE INDEX "notification_deliveries_notification_id_idx" ON "notification_deliveries"("notification_id");

-- CreateIndex
CREATE UNIQUE INDEX "notification_deliveries_notification_channel_endpoint_key" ON "notification_deliveries"("notification_id", "channel", "push_endpoint_id");

-- CreateIndex
CREATE UNIQUE INDEX "notification_deliveries_society_id_id_key" ON "notification_deliveries"("society_id", "id");

-- CreateIndex
CREATE INDEX "outbox_events_status_available_idx" ON "outbox_events"("status", "available_at");

-- CreateIndex
CREATE INDEX "outbox_events_aggregate_created_idx" ON "outbox_events"("aggregate_type", "aggregate_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "outbox_events_society_dedupe_key" ON "outbox_events"("society_id", "dedupe_key");

-- CreateIndex
CREATE UNIQUE INDEX "outbox_events_society_id_id_key" ON "outbox_events"("society_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "outbox_attempts_event_attempt_key" ON "outbox_attempts"("outbox_event_id", "attempt");

-- CreateIndex
CREATE UNIQUE INDEX "outbox_attempts_society_id_id_key" ON "outbox_attempts"("society_id", "id");

-- CreateIndex
CREATE INDEX "inbox_messages_status_created_idx" ON "inbox_messages"("status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "inbox_messages_source_external_key" ON "inbox_messages"("source", "external_message_id");

-- CreateIndex
CREATE UNIQUE INDEX "inbox_messages_society_id_id_key" ON "inbox_messages"("society_id", "id");

-- CreateIndex
CREATE INDEX "file_uploads_parent_idx" ON "file_uploads"("parent_entity_type", "parent_entity_id");

-- CreateIndex
CREATE INDEX "file_uploads_status_created_idx" ON "file_uploads"("status", "created_at");

-- CreateIndex
CREATE INDEX "file_uploads_retention_until_idx" ON "file_uploads"("retention_until");

-- CreateIndex
CREATE UNIQUE INDEX "file_uploads_bucket_storage_key" ON "file_uploads"("bucket", "storage_key");

-- CreateIndex
CREATE UNIQUE INDEX "file_uploads_society_id_id_key" ON "file_uploads"("society_id", "id");

-- CreateIndex
CREATE INDEX "audit_logs_society_occurred_idx" ON "audit_logs"("society_id", "occurred_at" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_entity_occurred_idx" ON "audit_logs"("entity_type", "entity_id", "occurred_at");

-- CreateIndex
CREATE INDEX "audit_logs_actor_occurred_idx" ON "audit_logs"("actor_user_id", "occurred_at" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_correlation_id_idx" ON "audit_logs"("correlation_id");

-- CreateIndex
CREATE UNIQUE INDEX "audit_logs_society_id_id_key" ON "audit_logs"("society_id", "id");

-- CreateIndex
CREATE INDEX "idempotency_records_status_locked_idx" ON "idempotency_records"("status", "locked_until");

-- CreateIndex
CREATE INDEX "idempotency_records_expires_at_idx" ON "idempotency_records"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "idempotency_records_actor_operation_key" ON "idempotency_records"("society_id", "actor_scope_key", "operation", "key");

-- CreateIndex
CREATE UNIQUE INDEX "idempotency_records_society_id_id_key" ON "idempotency_records"("society_id", "id");

-- CreateIndex
CREATE INDEX "offline_sync_device_status_created_idx" ON "offline_sync_records"("guard_device_id", "status", "local_created_at");

-- CreateIndex
CREATE INDEX "offline_sync_status_received_idx" ON "offline_sync_records"("status", "server_received_at");

-- CreateIndex
CREATE UNIQUE INDEX "offline_sync_device_mutation_key" ON "offline_sync_records"("guard_device_id", "client_mutation_id");

-- CreateIndex
CREATE UNIQUE INDEX "offline_sync_device_sequence_key" ON "offline_sync_records"("guard_device_id", "client_sequence");

-- CreateIndex
CREATE UNIQUE INDEX "offline_sync_records_society_id_id_key" ON "offline_sync_records"("society_id", "id");

-- CreateIndex
CREATE INDEX "offline_sync_attempts_record_occurred_idx" ON "offline_sync_attempts"("sync_record_id", "occurred_at");

-- CreateIndex
CREATE UNIQUE INDEX "offline_sync_attempts_record_attempt_key" ON "offline_sync_attempts"("sync_record_id", "attempt");

-- CreateIndex
CREATE UNIQUE INDEX "offline_sync_attempts_society_id_id_key" ON "offline_sync_attempts"("society_id", "id");

-- CreateIndex
CREATE INDEX "flat_memberships_user_id_status_idx" ON "flat_memberships"("user_id", "status");

-- CreateIndex
CREATE INDEX "flat_memberships_flat_status_dates_idx" ON "flat_memberships"("flat_id", "status", "start_at", "end_at");

-- CreateIndex
CREATE UNIQUE INDEX "flat_memberships_society_id_id_key" ON "flat_memberships"("society_id", "id");

-- CreateIndex
CREATE INDEX "membership_history_membership_occurred_idx" ON "flat_membership_history"("membership_id", "occurred_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "membership_history_membership_sequence_key" ON "flat_membership_history"("membership_id", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "membership_history_society_id_id_key" ON "flat_membership_history"("society_id", "id");

-- CreateIndex
CREATE INDEX "family_members_flat_id_status_idx" ON "family_members"("flat_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "family_members_society_id_id_key" ON "family_members"("society_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "guard_profiles_user_id_key" ON "guard_profiles"("user_id");

-- CreateIndex
CREATE INDEX "guard_profiles_society_status_idx" ON "guard_profiles"("society_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "guard_profiles_society_employee_key" ON "guard_profiles"("society_id", "employee_code");

-- CreateIndex
CREATE UNIQUE INDEX "guard_profiles_society_id_id_key" ON "guard_profiles"("society_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "guard_devices_device_id_key" ON "guard_devices"("device_id");

-- CreateIndex
CREATE INDEX "guard_devices_society_status_idx" ON "guard_devices"("society_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "guard_devices_society_id_id_key" ON "guard_devices"("society_id", "id");

-- CreateIndex
CREATE INDEX "guard_device_gates_device_status_idx" ON "guard_device_gates"("guard_device_id", "status");

-- CreateIndex
CREATE INDEX "guard_device_gates_gate_status_idx" ON "guard_device_gates"("gate_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "guard_device_gates_society_id_id_key" ON "guard_device_gates"("society_id", "id");

-- CreateIndex
CREATE INDEX "guard_gate_assignments_guard_status_idx" ON "guard_gate_assignments"("guard_profile_id", "status");

-- CreateIndex
CREATE INDEX "guard_gate_assignments_gate_status_idx" ON "guard_gate_assignments"("gate_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "guard_gate_assignments_society_id_id_key" ON "guard_gate_assignments"("society_id", "id");

-- CreateIndex
CREATE INDEX "visitors_society_phone_digest_idx" ON "visitors"("society_id", "phone_digest");

-- CreateIndex
CREATE INDEX "visitors_society_vehicle_idx" ON "visitors"("society_id", "vehicle_number");

-- CreateIndex
CREATE UNIQUE INDEX "visitors_society_id_id_key" ON "visitors"("society_id", "id");

-- CreateIndex
CREATE INDEX "visitor_preapprovals_flat_status_expected_idx" ON "visitor_pre_approvals"("flat_id", "status", "expected_at" DESC);

-- CreateIndex
CREATE INDEX "visitor_preapprovals_visitor_status_idx" ON "visitor_pre_approvals"("visitor_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "visitor_preapprovals_society_code_key" ON "visitor_pre_approvals"("society_id", "code_digest");

-- CreateIndex
CREATE UNIQUE INDEX "visitor_preapprovals_society_id_id_key" ON "visitor_pre_approvals"("society_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "pre_approval_uses_visit_id_key" ON "pre_approval_uses"("visit_id");

-- CreateIndex
CREATE INDEX "pre_approval_uses_preapproval_used_idx" ON "pre_approval_uses"("pre_approval_id", "used_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "pre_approval_uses_society_id_id_key" ON "pre_approval_uses"("society_id", "id");

-- CreateIndex
CREATE INDEX "visits_flat_status_created_idx" ON "visits"("flat_id", "status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "visits_gate_status_arrived_idx" ON "visits"("gate_id", "status", "arrived_at" DESC);

-- CreateIndex
CREATE INDEX "visits_status_expected_idx" ON "visits"("status", "expected_at");

-- CreateIndex
CREATE INDEX "visits_visitor_created_idx" ON "visits"("visitor_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "visits_society_id_id_key" ON "visits"("society_id", "id");

-- CreateIndex
CREATE INDEX "visit_approvals_visit_status_requested_idx" ON "visit_approvals"("visit_id", "status", "requested_at" DESC);

-- CreateIndex
CREATE INDEX "visit_approvals_status_expires_idx" ON "visit_approvals"("status", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "visit_approvals_society_id_id_key" ON "visit_approvals"("society_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "visit_approval_decisions_approval_id_key" ON "visit_approval_decisions"("approval_id");

-- CreateIndex
CREATE INDEX "visit_decisions_actor_user_occurred_idx" ON "visit_approval_decisions"("actor_user_id", "occurred_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "visit_approval_decisions_society_id_id_key" ON "visit_approval_decisions"("society_id", "id");

-- CreateIndex
CREATE INDEX "visit_events_visit_occurred_idx" ON "visit_events"("visit_id", "server_occurred_at");

-- CreateIndex
CREATE INDEX "visit_events_type_occurred_idx" ON "visit_events"("event_type", "server_occurred_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "visit_events_visit_sequence_key" ON "visit_events"("visit_id", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "visit_events_society_id_id_key" ON "visit_events"("society_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "societies_singleton_key_key" ON "societies"("singleton_key");

-- CreateIndex
CREATE UNIQUE INDEX "societies_id_singleton_key_key" ON "societies"("id", "singleton_key");

-- CreateIndex
CREATE UNIQUE INDEX "society_settings_society_id_key" ON "society_settings"("society_id");

-- CreateIndex
CREATE INDEX "blocks_society_id_status_idx" ON "blocks"("society_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "blocks_society_id_code_key" ON "blocks"("society_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "blocks_society_id_id_key" ON "blocks"("society_id", "id");

-- CreateIndex
CREATE INDEX "floors_block_id_sort_order_idx" ON "floors"("block_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "floors_block_id_label_key" ON "floors"("block_id", "label");

-- CreateIndex
CREATE UNIQUE INDEX "floors_society_id_id_key" ON "floors"("society_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "floors_society_block_id_key" ON "floors"("society_id", "block_id", "id");

-- CreateIndex
CREATE INDEX "flats_floor_id_status_idx" ON "flats"("floor_id", "status");

-- CreateIndex
CREATE INDEX "flats_society_id_display_name_idx" ON "flats"("society_id", "display_name");

-- CreateIndex
CREATE UNIQUE INDEX "flats_block_id_number_key" ON "flats"("block_id", "number");

-- CreateIndex
CREATE UNIQUE INDEX "flats_society_id_id_key" ON "flats"("society_id", "id");

-- CreateIndex
CREATE INDEX "gates_society_id_status_idx" ON "gates"("society_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "gates_society_id_code_key" ON "gates"("society_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "gates_society_id_id_key" ON "gates"("society_id", "id");

-- AddForeignKey
ALTER TABLE "notice_audiences" ADD CONSTRAINT "notice_audiences_notice_id_fkey" FOREIGN KEY ("notice_id") REFERENCES "notices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notice_audiences" ADD CONSTRAINT "notice_audiences_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notice_audiences" ADD CONSTRAINT "notice_audiences_block_id_fkey" FOREIGN KEY ("block_id") REFERENCES "blocks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notice_audiences" ADD CONSTRAINT "notice_audiences_flat_id_fkey" FOREIGN KEY ("flat_id") REFERENCES "flats"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notice_recipients" ADD CONSTRAINT "notice_recipients_notice_id_fkey" FOREIGN KEY ("notice_id") REFERENCES "notices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notice_recipients" ADD CONSTRAINT "notice_recipients_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notice_attachments" ADD CONSTRAINT "notice_attachments_notice_id_fkey" FOREIGN KEY ("notice_id") REFERENCES "notices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notice_attachments" ADD CONSTRAINT "notice_attachments_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "file_uploads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notice_reads" ADD CONSTRAINT "notice_reads_notice_id_fkey" FOREIGN KEY ("notice_id") REFERENCES "notices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notice_reads" ADD CONSTRAINT "notice_reads_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notice_acknowledgements" ADD CONSTRAINT "notice_acknowledgements_notice_id_fkey" FOREIGN KEY ("notice_id") REFERENCES "notices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notice_acknowledgements" ADD CONSTRAINT "notice_acknowledgements_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "complaint_categories" ADD CONSTRAINT "complaint_categories_society_id_fkey" FOREIGN KEY ("society_id") REFERENCES "societies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "complaints" ADD CONSTRAINT "complaints_flat_id_fkey" FOREIGN KEY ("flat_id") REFERENCES "flats"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "complaints" ADD CONSTRAINT "complaints_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "complaint_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "complaint_attachments" ADD CONSTRAINT "complaint_attachments_complaint_id_fkey" FOREIGN KEY ("complaint_id") REFERENCES "complaints"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "complaint_attachments" ADD CONSTRAINT "complaint_attachments_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "file_uploads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "complaint_comments" ADD CONSTRAINT "complaint_comments_complaint_id_fkey" FOREIGN KEY ("complaint_id") REFERENCES "complaints"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "complaint_internal_notes" ADD CONSTRAINT "complaint_internal_notes_complaint_id_fkey" FOREIGN KEY ("complaint_id") REFERENCES "complaints"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "complaint_status_history" ADD CONSTRAINT "complaint_status_history_complaint_id_fkey" FOREIGN KEY ("complaint_id") REFERENCES "complaints"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "complaint_assignment_history" ADD CONSTRAINT "complaint_assignment_history_complaint_id_fkey" FOREIGN KEY ("complaint_id") REFERENCES "complaints"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_charge_batches" ADD CONSTRAINT "maintenance_charge_batches_society_id_fkey" FOREIGN KEY ("society_id") REFERENCES "societies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_charges" ADD CONSTRAINT "maintenance_charges_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "maintenance_charge_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_charges" ADD CONSTRAINT "maintenance_charges_flat_id_fkey" FOREIGN KEY ("flat_id") REFERENCES "flats"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_charge_adjustments" ADD CONSTRAINT "maintenance_charge_adjustments_charge_id_fkey" FOREIGN KEY ("charge_id") REFERENCES "maintenance_charges"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_flat_id_fkey" FOREIGN KEY ("flat_id") REFERENCES "flats"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_charge_id_fkey" FOREIGN KEY ("charge_id") REFERENCES "maintenance_charges"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_reversals" ADD CONSTRAINT "payment_reversals_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "file_uploads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipt_events" ADD CONSTRAINT "receipt_events_receipt_id_fkey" FOREIGN KEY ("receipt_id") REFERENCES "receipts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_sequences" ADD CONSTRAINT "document_sequences_society_id_fkey" FOREIGN KEY ("society_id") REFERENCES "societies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emergency_alerts" ADD CONSTRAINT "emergency_alerts_flat_id_fkey" FOREIGN KEY ("flat_id") REFERENCES "flats"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emergency_events" ADD CONSTRAINT "emergency_events_alert_id_fkey" FOREIGN KEY ("alert_id") REFERENCES "emergency_alerts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_society_id_fkey" FOREIGN KEY ("society_id") REFERENCES "societies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "otp_challenges" ADD CONSTRAINT "otp_challenges_society_id_fkey" FOREIGN KEY ("society_id") REFERENCES "societies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devices" ADD CONSTRAINT "devices_society_id_fkey" FOREIGN KEY ("society_id") REFERENCES "societies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devices" ADD CONSTRAINT "devices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "user_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_parent_token_id_fkey" FOREIGN KEY ("parent_token_id") REFERENCES "refresh_tokens"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_endpoints" ADD CONSTRAINT "push_endpoints_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_endpoints" ADD CONSTRAINT "push_endpoints_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roles" ADD CONSTRAINT "roles_society_id_fkey" FOREIGN KEY ("society_id") REFERENCES "societies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permissions" ADD CONSTRAINT "permissions_society_id_fkey" FOREIGN KEY ("society_id") REFERENCES "societies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_help" ADD CONSTRAINT "daily_help_society_id_fkey" FOREIGN KEY ("society_id") REFERENCES "societies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_help" ADD CONSTRAINT "daily_help_photo_file_id_fkey" FOREIGN KEY ("photo_file_id") REFERENCES "file_uploads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_help_flat_assignments" ADD CONSTRAINT "daily_help_flat_assignments_daily_help_id_fkey" FOREIGN KEY ("daily_help_id") REFERENCES "daily_help"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_help_flat_assignments" ADD CONSTRAINT "daily_help_flat_assignments_flat_id_fkey" FOREIGN KEY ("flat_id") REFERENCES "flats"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_help_flat_assignments" ADD CONSTRAINT "daily_help_flat_assignments_managed_by_membership_id_fkey" FOREIGN KEY ("managed_by_membership_id") REFERENCES "flat_memberships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_help_access_windows" ADD CONSTRAINT "daily_help_access_windows_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "daily_help_flat_assignments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_help_attendance" ADD CONSTRAINT "daily_help_attendance_daily_help_id_fkey" FOREIGN KEY ("daily_help_id") REFERENCES "daily_help"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_help_attendance" ADD CONSTRAINT "daily_help_attendance_gate_id_fkey" FOREIGN KEY ("gate_id") REFERENCES "gates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_help_events" ADD CONSTRAINT "daily_help_events_daily_help_id_fkey" FOREIGN KEY ("daily_help_id") REFERENCES "daily_help"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_help_events" ADD CONSTRAINT "daily_help_events_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "daily_help_flat_assignments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_help_events" ADD CONSTRAINT "daily_help_events_attendance_id_fkey" FOREIGN KEY ("attendance_id") REFERENCES "daily_help_attendance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parcels" ADD CONSTRAINT "parcels_flat_id_fkey" FOREIGN KEY ("flat_id") REFERENCES "flats"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parcels" ADD CONSTRAINT "parcels_gate_id_fkey" FOREIGN KEY ("gate_id") REFERENCES "gates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parcels" ADD CONSTRAINT "parcels_delivery_visit_id_fkey" FOREIGN KEY ("delivery_visit_id") REFERENCES "visits"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parcels" ADD CONSTRAINT "parcels_photo_file_id_fkey" FOREIGN KEY ("photo_file_id") REFERENCES "file_uploads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parcel_events" ADD CONSTRAINT "parcel_events_parcel_id_fkey" FOREIGN KEY ("parcel_id") REFERENCES "parcels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipient_user_id_fkey" FOREIGN KEY ("recipient_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_notification_id_fkey" FOREIGN KEY ("notification_id") REFERENCES "notifications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_push_endpoint_id_fkey" FOREIGN KEY ("push_endpoint_id") REFERENCES "push_endpoints"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbox_events" ADD CONSTRAINT "outbox_events_society_id_fkey" FOREIGN KEY ("society_id") REFERENCES "societies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbox_attempts" ADD CONSTRAINT "outbox_attempts_outbox_event_id_fkey" FOREIGN KEY ("outbox_event_id") REFERENCES "outbox_events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inbox_messages" ADD CONSTRAINT "inbox_messages_society_id_fkey" FOREIGN KEY ("society_id") REFERENCES "societies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file_uploads" ADD CONSTRAINT "file_uploads_society_id_fkey" FOREIGN KEY ("society_id") REFERENCES "societies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_society_id_fkey" FOREIGN KEY ("society_id") REFERENCES "societies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "idempotency_records" ADD CONSTRAINT "idempotency_records_society_id_fkey" FOREIGN KEY ("society_id") REFERENCES "societies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offline_sync_records" ADD CONSTRAINT "offline_sync_records_guard_device_id_fkey" FOREIGN KEY ("guard_device_id") REFERENCES "guard_devices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offline_sync_attempts" ADD CONSTRAINT "offline_sync_attempts_sync_record_id_fkey" FOREIGN KEY ("sync_record_id") REFERENCES "offline_sync_records"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flat_memberships" ADD CONSTRAINT "flat_memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flat_memberships" ADD CONSTRAINT "flat_memberships_flat_id_fkey" FOREIGN KEY ("flat_id") REFERENCES "flats"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flat_membership_history" ADD CONSTRAINT "flat_membership_history_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "flat_memberships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "family_members" ADD CONSTRAINT "family_members_flat_id_fkey" FOREIGN KEY ("flat_id") REFERENCES "flats"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "family_members" ADD CONSTRAINT "family_members_managed_by_membership_id_fkey" FOREIGN KEY ("managed_by_membership_id") REFERENCES "flat_memberships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guard_profiles" ADD CONSTRAINT "guard_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guard_devices" ADD CONSTRAINT "guard_devices_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guard_device_gates" ADD CONSTRAINT "guard_device_gates_guard_device_id_fkey" FOREIGN KEY ("guard_device_id") REFERENCES "guard_devices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guard_device_gates" ADD CONSTRAINT "guard_device_gates_gate_id_fkey" FOREIGN KEY ("gate_id") REFERENCES "gates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guard_gate_assignments" ADD CONSTRAINT "guard_gate_assignments_guard_profile_id_fkey" FOREIGN KEY ("guard_profile_id") REFERENCES "guard_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guard_gate_assignments" ADD CONSTRAINT "guard_gate_assignments_gate_id_fkey" FOREIGN KEY ("gate_id") REFERENCES "gates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visitors" ADD CONSTRAINT "visitors_society_id_fkey" FOREIGN KEY ("society_id") REFERENCES "societies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visitors" ADD CONSTRAINT "visitors_photo_file_id_fkey" FOREIGN KEY ("photo_file_id") REFERENCES "file_uploads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visitor_pre_approvals" ADD CONSTRAINT "visitor_pre_approvals_flat_id_fkey" FOREIGN KEY ("flat_id") REFERENCES "flats"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visitor_pre_approvals" ADD CONSTRAINT "visitor_pre_approvals_visitor_id_fkey" FOREIGN KEY ("visitor_id") REFERENCES "visitors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visitor_pre_approvals" ADD CONSTRAINT "visitor_pre_approvals_created_by_membership_id_fkey" FOREIGN KEY ("created_by_membership_id") REFERENCES "flat_memberships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pre_approval_uses" ADD CONSTRAINT "pre_approval_uses_pre_approval_id_fkey" FOREIGN KEY ("pre_approval_id") REFERENCES "visitor_pre_approvals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pre_approval_uses" ADD CONSTRAINT "pre_approval_uses_visit_id_fkey" FOREIGN KEY ("visit_id") REFERENCES "visits"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visits" ADD CONSTRAINT "visits_flat_id_fkey" FOREIGN KEY ("flat_id") REFERENCES "flats"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visits" ADD CONSTRAINT "visits_visitor_id_fkey" FOREIGN KEY ("visitor_id") REFERENCES "visitors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visits" ADD CONSTRAINT "visits_gate_id_fkey" FOREIGN KEY ("gate_id") REFERENCES "gates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visits" ADD CONSTRAINT "visits_pre_approval_id_fkey" FOREIGN KEY ("pre_approval_id") REFERENCES "visitor_pre_approvals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visit_approvals" ADD CONSTRAINT "visit_approvals_visit_id_fkey" FOREIGN KEY ("visit_id") REFERENCES "visits"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visit_approval_decisions" ADD CONSTRAINT "visit_approval_decisions_approval_id_fkey" FOREIGN KEY ("approval_id") REFERENCES "visit_approvals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visit_events" ADD CONSTRAINT "visit_events_visit_id_fkey" FOREIGN KEY ("visit_id") REFERENCES "visits"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "society_settings" ADD CONSTRAINT "society_settings_society_id_fkey" FOREIGN KEY ("society_id") REFERENCES "societies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blocks" ADD CONSTRAINT "blocks_society_id_fkey" FOREIGN KEY ("society_id") REFERENCES "societies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "floors" ADD CONSTRAINT "floors_block_id_fkey" FOREIGN KEY ("block_id") REFERENCES "blocks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flats" ADD CONSTRAINT "flats_block_id_fkey" FOREIGN KEY ("block_id") REFERENCES "blocks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flats" ADD CONSTRAINT "flats_floor_id_fkey" FOREIGN KEY ("floor_id") REFERENCES "floors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gates" ADD CONSTRAINT "gates_society_id_fkey" FOREIGN KEY ("society_id") REFERENCES "societies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- PostgreSQL-only integrity rules. Prisma cannot represent partial indexes, cross-society
-- composite foreign keys, or immutable history protections.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE "societies"
  ADD CONSTRAINT "societies_singleton_key_check" CHECK ("singleton_key" = 'MANGLAM_BALAJI');

ALTER TABLE "society_settings"
  ADD CONSTRAINT "society_settings_positive_limits_check" CHECK (
    "visitor_approval_timeout_seconds" BETWEEN 15 AND 3600
    AND "long_visit_threshold_minutes" BETWEEN 1 AND 10080
    AND "guard_offline_lease_hours" BETWEEN 1 AND 168
    AND "visitor_retention_days" >= 1
    AND "photo_retention_days" >= 1
    AND "notification_retention_days" >= 1
    AND "audit_retention_days" >= 365
  );
ALTER TABLE "otp_challenges"
  ADD CONSTRAINT "otp_challenges_attempts_check" CHECK ("attempt_count" >= 0 AND "max_attempts" > 0 AND "attempt_count" <= "max_attempts"),
  ADD CONSTRAINT "otp_challenges_expiry_check" CHECK ("expires_at" > "created_at");
ALTER TABLE "visitor_pre_approvals"
  ADD CONSTRAINT "visitor_preapprovals_window_check" CHECK ("valid_until" >= "valid_from"),
  ADD CONSTRAINT "visitor_preapprovals_uses_check" CHECK ("max_uses" > 0 AND "use_count" >= 0 AND "use_count" <= "max_uses");
ALTER TABLE "visits"
  ADD CONSTRAINT "visits_checkout_order_check" CHECK ("checked_out_at" IS NULL OR ("checked_in_at" IS NOT NULL AND "checked_out_at" >= "checked_in_at")),
  ADD CONSTRAINT "visits_approval_deadline_check" CHECK ("approval_deadline_at" IS NULL OR "arrived_at" IS NULL OR "approval_deadline_at" >= "arrived_at");
ALTER TABLE "daily_help_access_windows"
  ADD CONSTRAINT "daily_help_windows_bounds_check" CHECK ("weekday" BETWEEN 0 AND 6 AND "start_minute" BETWEEN 0 AND 1439 AND "end_minute" BETWEEN 1 AND 1440 AND "end_minute" > "start_minute");
ALTER TABLE "daily_help_attendance"
  ADD CONSTRAINT "daily_help_attendance_checkout_order_check" CHECK ("checked_out_at" IS NULL OR "checked_out_at" >= "checked_in_at");
ALTER TABLE "file_uploads"
  ADD CONSTRAINT "file_uploads_byte_size_check" CHECK ("byte_size" >= 0);
ALTER TABLE "maintenance_charge_batches"
  ADD CONSTRAINT "maintenance_batches_dates_check" CHECK ("period_end" >= "period_start" AND "due_date" >= "period_start");
ALTER TABLE "maintenance_charges"
  ADD CONSTRAINT "maintenance_charges_amounts_check" CHECK (
    "base_amount" >= 0 AND "previous_balance" >= 0 AND "late_charge" >= 0
    AND "paid_amount" >= 0 AND "total_amount" = "base_amount" + "previous_balance" + "late_charge" + "adjustment_amount"
    AND "paid_amount" <= "total_amount"
  );
ALTER TABLE "maintenance_charge_adjustments"
  ADD CONSTRAINT "maintenance_adjustments_nonzero_check" CHECK ("amount" <> 0 AND length(btrim("reason")) > 0);
ALTER TABLE "payments"
  ADD CONSTRAINT "payments_positive_amount_check" CHECK ("amount" > 0),
  ADD CONSTRAINT "payments_verification_check" CHECK ("status" <> 'CONFIRMED' OR ("verified_at" IS NOT NULL AND "verified_by_user_id" IS NOT NULL));
ALTER TABLE "payment_allocations"
  ADD CONSTRAINT "payment_allocations_positive_amount_check" CHECK ("amount" > 0);
ALTER TABLE "payment_reversals"
  ADD CONSTRAINT "payment_reversals_positive_amount_check" CHECK ("amount" > 0 AND length(btrim("reason")) > 0);
ALTER TABLE "offline_sync_records"
  ADD CONSTRAINT "offline_sync_sequence_check" CHECK ("client_sequence" >= 0 AND "retry_count" >= 0);
ALTER TABLE "notification_preferences"
  ADD CONSTRAINT "notification_preferences_quiet_minutes_check" CHECK (("quiet_start" IS NULL OR "quiet_start" BETWEEN 0 AND 1439) AND ("quiet_end" IS NULL OR "quiet_end" BETWEEN 0 AND 1439));
ALTER TABLE "visit_approval_decisions"
  ADD CONSTRAINT "visit_approval_decisions_override_check" CHECK (
    "source" <> 'GUARD_OVERRIDE' OR (
      "actor_guard_profile_id" IS NOT NULL
      AND "actor_authenticated_at" IS NOT NULL
      AND "actor_authenticated_at" <= "occurred_at"
      AND "actor_authenticated_at" >= "occurred_at" - INTERVAL '15 minutes'
      AND length(btrim(coalesce("reason", ''))) > 0
    )
  );
ALTER TABLE "notice_audiences"
  ADD CONSTRAINT "notice_audiences_target_check" CHECK (
    ("type" = 'ALL_RESIDENTS' AND "role_id" IS NULL AND "block_id" IS NULL AND "flat_id" IS NULL)
    OR ("type" = 'ROLE' AND "role_id" IS NOT NULL AND "block_id" IS NULL AND "flat_id" IS NULL)
    OR ("type" = 'BLOCK' AND "role_id" IS NULL AND "block_id" IS NOT NULL AND "flat_id" IS NULL)
    OR ("type" = 'FLAT' AND "role_id" IS NULL AND "block_id" IS NULL AND "flat_id" IS NOT NULL)
  );

CREATE UNIQUE INDEX "flat_memberships_one_active_user_flat_key"
  ON "flat_memberships" ("society_id", "user_id", "flat_id")
  WHERE "status" = 'APPROVED' AND "ended_at" IS NULL;
CREATE UNIQUE INDEX "visit_approvals_one_pending_visit_key"
  ON "visit_approvals" ("society_id", "visit_id")
  WHERE "status" = 'PENDING';
CREATE UNIQUE INDEX "daily_help_attendance_one_open_shift_key"
  ON "daily_help_attendance" ("society_id", "daily_help_id")
  WHERE "status" = 'CHECKED_IN' AND "checked_out_at" IS NULL AND "voided_at" IS NULL;
CREATE UNIQUE INDEX "guard_device_gates_one_active_assignment_key"
  ON "guard_device_gates" ("society_id", "guard_device_id", "gate_id")
  WHERE "status" = 'ACTIVE' AND "ends_at" IS NULL;
CREATE UNIQUE INDEX "guard_gate_assignments_one_active_assignment_key"
  ON "guard_gate_assignments" ("society_id", "guard_profile_id", "gate_id")
  WHERE "status" = 'ACTIVE' AND "ends_at" IS NULL;
CREATE UNIQUE INDEX "payments_society_reference_key"
  ON "payments" ("society_id", "reference")
  WHERE "reference" IS NOT NULL AND "status" <> 'FAILED';
CREATE UNIQUE INDEX "payments_society_provider_transaction_key"
  ON "payments" ("society_id", "provider_transaction_id")
  WHERE "provider_transaction_id" IS NOT NULL AND "status" <> 'FAILED';
CREATE UNIQUE INDEX "notification_deliveries_null_safe_endpoint_key"
  ON "notification_deliveries" ("notification_id", "channel", coalesce("push_endpoint_id", '00000000-0000-0000-0000-000000000000'::uuid));

-- Every relationship below is additionally scoped by society_id. These composite FKs
-- make cross-society references impossible even if application-level filters regress.
DO $$
DECLARE relation record;
BEGIN
  FOR relation IN
    SELECT * FROM (VALUES
      ('floors','block_id','blocks'), ('flats','block_id','blocks'), ('flats','floor_id','floors'),
      ('flat_memberships','user_id','users'), ('flat_memberships','flat_id','flats'),
      ('flat_membership_history','membership_id','flat_memberships'), ('family_members','flat_id','flats'), ('family_members','managed_by_membership_id','flat_memberships'),
      ('guard_profiles','user_id','users'), ('guard_devices','device_id','devices'), ('guard_device_gates','guard_device_id','guard_devices'), ('guard_device_gates','gate_id','gates'), ('guard_gate_assignments','guard_profile_id','guard_profiles'), ('guard_gate_assignments','gate_id','gates'),
      ('visitors','photo_file_id','file_uploads'), ('visitor_pre_approvals','flat_id','flats'), ('visitor_pre_approvals','visitor_id','visitors'), ('visitor_pre_approvals','created_by_membership_id','flat_memberships'),
      ('pre_approval_uses','pre_approval_id','visitor_pre_approvals'), ('pre_approval_uses','visit_id','visits'), ('visits','flat_id','flats'), ('visits','visitor_id','visitors'), ('visits','gate_id','gates'), ('visits','pre_approval_id','visitor_pre_approvals'),
      ('visit_approvals','visit_id','visits'), ('visit_approval_decisions','approval_id','visit_approvals'), ('visit_events','visit_id','visits'),
      ('daily_help','photo_file_id','file_uploads'), ('daily_help_flat_assignments','daily_help_id','daily_help'), ('daily_help_flat_assignments','flat_id','flats'), ('daily_help_flat_assignments','managed_by_membership_id','flat_memberships'),
      ('daily_help_access_windows','assignment_id','daily_help_flat_assignments'), ('daily_help_attendance','daily_help_id','daily_help'), ('daily_help_attendance','gate_id','gates'), ('daily_help_events','daily_help_id','daily_help'), ('daily_help_events','assignment_id','daily_help_flat_assignments'), ('daily_help_events','attendance_id','daily_help_attendance'),
      ('parcels','flat_id','flats'), ('parcels','gate_id','gates'), ('parcels','delivery_visit_id','visits'), ('parcels','photo_file_id','file_uploads'), ('parcel_events','parcel_id','parcels'),
      ('notice_audiences','notice_id','notices'), ('notice_audiences','role_id','roles'), ('notice_audiences','block_id','blocks'), ('notice_audiences','flat_id','flats'), ('notice_recipients','notice_id','notices'), ('notice_recipients','user_id','users'), ('notice_attachments','notice_id','notices'), ('notice_attachments','file_id','file_uploads'), ('notice_reads','notice_id','notices'), ('notice_reads','user_id','users'), ('notice_acknowledgements','notice_id','notices'), ('notice_acknowledgements','user_id','users'),
      ('complaints','flat_id','flats'), ('complaints','category_id','complaint_categories'), ('complaint_attachments','complaint_id','complaints'), ('complaint_attachments','file_id','file_uploads'), ('complaint_comments','complaint_id','complaints'), ('complaint_internal_notes','complaint_id','complaints'), ('complaint_status_history','complaint_id','complaints'), ('complaint_assignment_history','complaint_id','complaints'),
      ('maintenance_charges','batch_id','maintenance_charge_batches'), ('maintenance_charges','flat_id','flats'), ('maintenance_charge_adjustments','charge_id','maintenance_charges'), ('payments','flat_id','flats'), ('payment_allocations','payment_id','payments'), ('payment_allocations','charge_id','maintenance_charges'), ('payment_reversals','payment_id','payments'), ('receipts','payment_id','payments'), ('receipts','file_id','file_uploads'), ('receipt_events','receipt_id','receipts'),
      ('emergency_alerts','flat_id','flats'), ('emergency_events','alert_id','emergency_alerts'),
      ('devices','user_id','users'), ('user_sessions','user_id','users'), ('user_sessions','device_id','devices'), ('refresh_tokens','session_id','user_sessions'), ('push_endpoints','user_id','users'), ('push_endpoints','device_id','devices'), ('role_permissions','role_id','roles'), ('role_permissions','permission_id','permissions'), ('user_roles','user_id','users'), ('user_roles','role_id','roles'),
      ('notification_preferences','user_id','users'), ('notifications','recipient_user_id','users'), ('notification_deliveries','notification_id','notifications'), ('notification_deliveries','push_endpoint_id','push_endpoints'), ('outbox_attempts','outbox_event_id','outbox_events'), ('offline_sync_records','guard_device_id','guard_devices'), ('offline_sync_attempts','sync_record_id','offline_sync_records')
    ) AS links(child_table, child_column, parent_table)
  LOOP
    EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY (society_id, %I) REFERENCES %I(society_id, id) ON DELETE RESTRICT ON UPDATE CASCADE', relation.child_table, left(relation.child_table || '_' || relation.child_column || '_society_fkey', 63), relation.child_column, relation.parent_table);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION "prevent_append_only_mutation"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'append-only table % cannot be %', TG_TABLE_NAME, TG_OP USING ERRCODE = '55000';
END;
$$;

DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'audit_logs', 'visit_events', 'visit_approval_decisions', 'flat_membership_history',
    'complaint_status_history', 'complaint_assignment_history', 'daily_help_events', 'parcel_events',
    'emergency_events', 'maintenance_charge_adjustments', 'payment_allocations', 'payment_reversals',
    'receipt_events', 'offline_sync_attempts', 'outbox_attempts'
  ] LOOP
    EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION prevent_append_only_mutation()', left(table_name || '_append_only', 63), table_name);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION "protect_issued_receipt"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'receipts cannot be deleted' USING ERRCODE = '55000'; END IF;
  IF OLD.status = 'ISSUED' AND (NEW.status <> 'VOIDED' OR NEW.payment_id <> OLD.payment_id OR NEW.number <> OLD.number OR NEW.total_amount <> OLD.total_amount OR NEW.currency <> OLD.currency OR NEW.issued_at <> OLD.issued_at OR NEW.issued_by_user_id <> OLD.issued_by_user_id) THEN
    RAISE EXCEPTION 'issued receipts are immutable; use a void event and compensating record' USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "receipts_issued_immutable" BEFORE UPDATE OR DELETE ON "receipts" FOR EACH ROW EXECUTE FUNCTION "protect_issued_receipt"();

CREATE OR REPLACE FUNCTION "protect_published_notice"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'notices cannot be deleted' USING ERRCODE = '55000'; END IF;
  IF OLD.status = 'PUBLISHED' AND (NEW.title <> OLD.title OR NEW.body <> OLD.body OR NEW.category <> OLD.category OR NEW.priority <> OLD.priority OR NEW.requires_acknowledgement <> OLD.requires_acknowledgement OR NEW.publish_at IS DISTINCT FROM OLD.publish_at OR NEW.published_at IS DISTINCT FROM OLD.published_at) THEN
    RAISE EXCEPTION 'published notices are immutable; create a corrective notice instead' USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "notices_published_immutable" BEFORE UPDATE OR DELETE ON "notices" FOR EACH ROW EXECUTE FUNCTION "protect_published_notice"();
