import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const directory = dirname(fileURLToPath(import.meta.url));
const databaseRoot = resolve(directory, "..");
const schema = readFileSync(resolve(databaseRoot, "prisma", "schema.prisma"), "utf8");
const migration = readFileSync(resolve(databaseRoot, "prisma", "migrations", "20260717223000_initial_schema", "migration.sql"), "utf8");
const config = readFileSync(resolve(databaseRoot, "prisma.config.ts"), "utf8");

const requiredModels = [
  "Society", "SocietySettings", "Block", "Floor", "Flat", "Gate", "User", "OtpChallenge", "UserSession", "RefreshToken", "Device", "PushEndpoint", "Role", "Permission", "UserRole", "RolePermission", "FlatMembership", "FlatMembershipHistory", "FamilyMember", "GuardProfile", "GuardDevice", "GuardDeviceGate", "GuardGateAssignment", "Visitor", "VisitorPreApproval", "PreApprovalUse", "Visit", "VisitApproval", "VisitApprovalDecision", "VisitEvent", "DailyHelp", "DailyHelpFlatAssignment", "DailyHelpAccessWindow", "DailyHelpAttendance", "DailyHelpEvent", "Parcel", "ParcelEvent", "Notice", "NoticeAudience", "NoticeRecipient", "NoticeAttachment", "NoticeRead", "NoticeAcknowledgement", "ComplaintCategory", "Complaint", "ComplaintAttachment", "ComplaintComment", "ComplaintInternalNote", "ComplaintStatusHistory", "ComplaintAssignmentHistory", "MaintenanceChargeBatch", "MaintenanceCharge", "MaintenanceChargeAdjustment", "Payment", "PaymentAllocation", "PaymentReversal", "Receipt", "ReceiptEvent", "DocumentSequence", "EmergencyAlert", "EmergencyEvent", "NotificationPreference", "Notification", "NotificationDelivery", "OutboxEvent", "InboxMessage", "FileUpload", "AuditLog", "IdempotencyRecord", "OfflineSyncRecord", "OfflineSyncAttempt",
];

describe("database schema contract", () => {
  it("declares every planned persistence model", () => {
    const fragments = ["schema.prisma", "models/identity.prisma", "models/residents-and-guards.prisma", "models/visitors.prisma", "models/operations.prisma", "models/communication.prisma", "models/finance-and-emergency.prisma", "models/platform.prisma"].map((path) => readFileSync(resolve(databaseRoot, "prisma", path), "utf8")).join("\n");
    for (const model of requiredModels) expect(fragments).toContain(`model ${model} `);
  });

  it("uses UUID keys, timestamptz, money precision, and optimistic versions", () => {
    expect(schema).toContain("@db.Uuid");
    expect(schema).toContain("@db.Timestamptz(6)");
    expect(readFileSync(resolve(databaseRoot, "prisma", "models", "finance-and-emergency.prisma"), "utf8")).toContain("@db.Decimal(12, 2)");
    expect(schema).toMatch(/version\s+Int\s+@default\(1\)/);
  });

  it("keeps folder-schema configuration and generated client exports aligned", () => {
    expect(config).toContain('schema: "prisma"');
    expect(schema).toContain('output       = "../src/generated/prisma"');
    expect(readFileSync(resolve(databaseRoot, "src", "index.ts"), "utf8")).toContain("./generated/prisma/client.js");
  });

  it("contains database-enforced isolation, idempotency, temporal, and immutability protections", () => {
    for (const token of ["flat_memberships_one_active_user_flat_key", "visit_approvals_one_pending_visit_key", "daily_help_attendance_one_open_shift_key", "payments_society_reference_key", "offline_sync_device_mutation_key", "idempotency_records_actor_operation_key", "prevent_append_only_mutation", "receipts_issued_immutable", "notices_published_immutable", "FOREIGN KEY (society_id,", "maintenance_charges_amounts_check", "visit_approval_decisions_override_check"]) expect(migration).toContain(token);
  });
});