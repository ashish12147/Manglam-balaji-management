import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const directory = dirname(fileURLToPath(import.meta.url));
const databaseRoot = resolve(directory, '..');
const schema = readFileSync(resolve(databaseRoot, 'prisma', 'schema.prisma'), 'utf8');
const migration = readFileSync(
  resolve(databaseRoot, 'prisma', 'migrations', '20260717223000_initial_schema', 'migration.sql'),
  'utf8',
);
const workerSecurityMigration = readFileSync(
  resolve(
    databaseRoot,
    'prisma',
    'migrations',
    '20260718000000_worker_runtime_contract',
    'migration.sql',
  ),
  'utf8',
);
const config = readFileSync(resolve(databaseRoot, 'prisma.config.ts'), 'utf8');

const requiredModels = [
  'Society',
  'SocietySettings',
  'Block',
  'Floor',
  'Flat',
  'Gate',
  'User',
  'MfaCredential',
  'AuthenticationAttempt',
  'OtpChallenge',
  'UserSession',
  'RefreshToken',
  'Device',
  'PushEndpoint',
  'Role',
  'Permission',
  'UserRole',
  'RolePermission',
  'FlatMembership',
  'FlatMembershipHistory',
  'FamilyMember',
  'GuardProfile',
  'GuardDevice',
  'GuardDeviceGate',
  'GuardGateAssignment',
  'Visitor',
  'VisitorPreApproval',
  'PreApprovalUse',
  'Visit',
  'VisitApproval',
  'VisitApprovalDecision',
  'VisitEvent',
  'DailyHelp',
  'DailyHelpFlatAssignment',
  'DailyHelpAccessWindow',
  'DailyHelpAttendance',
  'DailyHelpEvent',
  'Parcel',
  'ParcelEvent',
  'Notice',
  'NoticeAudience',
  'NoticeRecipient',
  'NoticeAttachment',
  'NoticeRead',
  'NoticeAcknowledgement',
  'ComplaintCategory',
  'Complaint',
  'ComplaintAttachment',
  'ComplaintComment',
  'ComplaintInternalNote',
  'ComplaintStatusHistory',
  'ComplaintAssignmentHistory',
  'MaintenanceChargeBatch',
  'MaintenanceCharge',
  'MaintenanceChargeAdjustment',
  'Payment',
  'PaymentAllocation',
  'PaymentReversal',
  'Receipt',
  'ReceiptEvent',
  'DocumentSequence',
  'EmergencyAlert',
  'EmergencyEvent',
  'NotificationPreference',
  'Notification',
  'NotificationDelivery',
  'OutboxEvent',
  'InboxMessage',
  'FileUpload',
  'AuditLog',
  'IdempotencyRecord',
  'OfflineSyncRecord',
  'OfflineSyncAttempt',
  'RetentionPolicy',
  'WorkerHeartbeat',
];

describe('database schema contract', () => {
  it('declares every planned persistence model', () => {
    const fragments = [
      'schema.prisma',
      'models/identity.prisma',
      'models/residents-and-guards.prisma',
      'models/visitors.prisma',
      'models/operations.prisma',
      'models/communication.prisma',
      'models/finance-and-emergency.prisma',
      'models/platform.prisma',
    ]
      .map((path) => readFileSync(resolve(databaseRoot, 'prisma', path), 'utf8'))
      .join('\n');
    for (const model of requiredModels) expect(fragments).toContain(`model ${model} `);
  });

  it('uses UUID keys, timestamptz, money precision, and optimistic versions', () => {
    expect(schema).toContain('@db.Uuid');
    expect(schema).toContain('@db.Timestamptz(6)');
    expect(
      readFileSync(
        resolve(databaseRoot, 'prisma', 'models', 'finance-and-emergency.prisma'),
        'utf8',
      ),
    ).toContain('@db.Decimal(12, 2)');
    expect(schema).toMatch(/version\s+Int\s+@default\(1\)/);
  });

  it('keeps folder-schema configuration and generated client exports aligned', () => {
    expect(config).toMatch(/schema:\s*['"]prisma['"]/);
    expect(schema).toContain('output       = "../src/generated/prisma"');
    expect(readFileSync(resolve(databaseRoot, 'src', 'index.ts'), 'utf8')).toContain(
      './generated/prisma/client.js',
    );
  });

  it('contains database-enforced isolation, idempotency, temporal, and immutability protections', () => {
    for (const token of [
      'flat_memberships_one_active_user_flat_key',
      'visit_approvals_one_pending_visit_key',
      'daily_help_attendance_one_open_shift_key',
      'payments_society_reference_key',
      'offline_sync_device_mutation_key',
      'idempotency_records_actor_operation_key',
      'prevent_append_only_mutation',
      'receipts_issued_immutable',
      'notices_published_immutable',
      'FOREIGN KEY (society_id,',
      'maintenance_charges_amounts_check',
      'visit_approval_decisions_override_check',
    ])
      expect(migration).toContain(token);
  });

  it('defines the worker runtime and tenant-scoped retention contract in a forward migration', () => {
    for (const token of [
      'CREATE TABLE "worker_heartbeats"',
      "'READY', 'DRAINING', 'FAILED'",
      'CREATE TABLE "retention_policies"',
      "'file_upload'",
      '"retention_policies_one_active_default_key"',
      '"retention_policies_one_active_file_purpose_key"',
      '"retention_policies_society_id_fkey"',
      '"retention_days" BETWEEN 1 AND 3650',
    ]) {
      expect(workerSecurityMigration).toContain(token);
    }
  });

  it('removes the non-delivery push provider through a guarded forward migration', () => {
    const pushProvider = schema.match(/enum PushProvider \{[\s\S]*?\n\}/)?.[0];
    expect(pushProvider).toBeDefined();
    expect(pushProvider).toContain('FCM');
    expect(pushProvider).toContain('EXPO');
    expect(pushProvider).toContain('WEB_PUSH');
    expect(pushProvider).not.toContain('DEVELOPMENT');

    for (const token of [
      "ARRAY['FCM', 'EXPO', 'WEB_PUSH', 'DEVELOPMENT']",
      'Cannot remove PushProvider.DEVELOPMENT while push endpoints use it',
      "CREATE TYPE \"PushProvider_without_development\" AS ENUM ('FCM', 'EXPO', 'WEB_PUSH')",
      'ALTER COLUMN "provider" TYPE "PushProvider_without_development"',
    ]) {
      expect(workerSecurityMigration).toContain(token);
    }
  });

  it('enforces replay-safe MFA, digest-only attempts, and one-time guard activation', () => {
    for (const token of [
      'CREATE TABLE "mfa_credentials"',
      '"last_used_time_step"',
      '"mfa_credentials_one_current_totp_key"',
      '"mfa_credentials_user_id_society_fkey"',
      '"secret_nonce") = 12',
      '"encryption_algorithm" VARCHAR(32) NOT NULL DEFAULT \'AES-256-GCM\'',
      'CREATE TABLE "authentication_attempts"',
      "'RESIDENT_APP_PIN'",
      '"auth_attempts_subject_recent_idx"',
      '"auth_attempts_origin_recent_idx"',
      '"auth_attempts_retention_until_idx"',
      '"guard_devices_enrollment_token_digest_key"',
      '"guard_devices_enrollment_state_check"',
      '"guard_devices_society_device_key"',
      '"guard_devices_device_society_fkey"',
      '"guard_devices_registered_by_user_society_fkey"',
      'btrim("enrollment_token_digest") ~ \'^[0-9a-f]{64}$\'',
      '"enrollment_expires_at" > "created_at"',
    ]) {
      expect(workerSecurityMigration).toContain(token);
    }
    const attemptTable = workerSecurityMigration.match(
      /CREATE TABLE "authentication_attempts" \([\s\S]*?\n\);/,
    );
    expect(attemptTable?.[0]).toBeDefined();
    expect(attemptTable?.[0]).not.toMatch(/email|phone|ip_address|normalized_/);
  });
});
