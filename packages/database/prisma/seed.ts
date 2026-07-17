import { createDatabaseClient } from "../src/client.js";

const DEVELOPMENT_SEED_FLAG = "ALLOW_DEVELOPMENT_SEED";

const roles = [
  ["RESIDENT_OWNER", "Resident owner", 10],
  ["RESIDENT_TENANT", "Resident tenant", 10],
  ["RESIDENT_FAMILY", "Resident family member", 5],
  ["GUARD", "Security guard", 20],
  ["SECURITY_SUPERVISOR", "Security supervisor", 30],
  ["COMPLAINT_STAFF", "Complaint staff", 30],
  ["ACCOUNTANT", "Society accountant", 35],
  ["SOCIETY_ADMIN", "Society administrator", 50],
  ["SUPER_ADMIN", "Society super administrator", 60],
] as const;

const permissions = [
  "resident.read_self", "resident.manage_family", "resident.approve_visitor", "visitor.create",
  "visitor.read_flat", "visitor.read_all", "visitor.check_in", "visitor.check_out", "visitor.override",
  "notice.create", "notice.publish", "complaint.create", "complaint.assign", "complaint.resolve",
  "dues.read_self", "dues.manage", "payment.record", "receipt.generate", "emergency.acknowledge",
  "guard.manage", "role.manage", "audit.read", "report.export",
] as const;

async function seed(): Promise<void> {
  if (process.env[DEVELOPMENT_SEED_FLAG] !== "true") {
    throw new Error(`${DEVELOPMENT_SEED_FLAG}=true is required. The development seed never creates users, credentials, OTPs, sessions, or login bypasses.`);
  }

  const database = createDatabaseClient({ applicationName: "manglam-development-seed" });
  try {
    await database.$transaction(async (tx) => {
      const society = await tx.society.upsert({
        where: { singletonKey: "MANGLAM_BALAJI" },
        update: { name: "Manglam Balaji Society", timezone: "Asia/Kolkata", currency: "INR", status: "ACTIVE" },
        create: { singletonKey: "MANGLAM_BALAJI", name: "Manglam Balaji Society", timezone: "Asia/Kolkata", currency: "INR", status: "ACTIVE" },
      });

      await tx.societySettings.upsert({
        where: { societyId: society.id },
        update: {},
        create: { societyId: society.id },
      });

      const block = await tx.block.upsert({
        where: { societyId_code: { societyId: society.id, code: "A" } },
        update: { name: "Block A", status: "ACTIVE" },
        create: { societyId: society.id, code: "A", name: "Block A", sortOrder: 1 },
      });
      const floor = await tx.floor.upsert({
        where: { blockId_label: { blockId: block.id, label: "G" } },
        update: { number: 0, status: "ACTIVE" },
        create: { societyId: society.id, blockId: block.id, label: "G", number: 0, sortOrder: 0 },
      });
      await tx.flat.upsert({
        where: { blockId_number: { blockId: block.id, number: "A-001" } },
        update: { floorId: floor.id, displayName: "A-001", status: "ACTIVE" },
        create: { societyId: society.id, blockId: block.id, floorId: floor.id, number: "A-001", displayName: "A-001" },
      });
      await tx.gate.upsert({
        where: { societyId_code: { societyId: society.id, code: "MAIN" } },
        update: { name: "Main Gate", status: "ACTIVE" },
        create: { societyId: society.id, code: "MAIN", name: "Main Gate" },
      });

      for (const action of permissions) {
        await tx.permission.upsert({
          where: { societyId_action: { societyId: society.id, action } },
          update: { status: "ACTIVE" },
          create: { societyId: society.id, action, status: "ACTIVE" },
        });
      }
      for (const [code, name, privilegeLevel] of roles) {
        await tx.role.upsert({
          where: { societyId_code: { societyId: society.id, code } },
          update: { name, privilegeLevel, isSystem: true, status: "ACTIVE" },
          create: { societyId: society.id, code, name, privilegeLevel, isSystem: true },
        });
      }
    });
  } finally {
    await database.$disconnect();
  }
}

void seed();