import { createDatabaseClient } from '../src/client.js';
import {
  seedPermissionDefinitions,
  seedRoleDefinitions,
  seedRolePermissionActions,
} from './seed-catalog.js';

const DEVELOPMENT_SEED_FLAG = 'ALLOW_DEVELOPMENT_SEED';

async function seed(): Promise<void> {
  if (process.env[DEVELOPMENT_SEED_FLAG] !== 'true') {
    throw new Error(
      `${DEVELOPMENT_SEED_FLAG}=true is required. The development seed never creates users, credentials, OTPs, sessions, or login bypasses.`,
    );
  }

  const database = createDatabaseClient({ applicationName: 'manglam-development-seed' });
  try {
    await database.$transaction(async (tx) => {
      const society = await tx.society.upsert({
        where: { singletonKey: 'MANGLAM_BALAJI' },
        update: {
          name: 'Manglam Balaji Society',
          timezone: 'Asia/Kolkata',
          currency: 'INR',
          status: 'ACTIVE',
        },
        create: {
          singletonKey: 'MANGLAM_BALAJI',
          name: 'Manglam Balaji Society',
          timezone: 'Asia/Kolkata',
          currency: 'INR',
          status: 'ACTIVE',
        },
      });

      await tx.societySettings.upsert({
        where: { societyId: society.id },
        update: {},
        create: { societyId: society.id },
      });

      const block = await tx.block.upsert({
        where: { societyId_code: { societyId: society.id, code: 'A' } },
        update: { name: 'Block A', status: 'ACTIVE' },
        create: { societyId: society.id, code: 'A', name: 'Block A', sortOrder: 1 },
      });
      const floor = await tx.floor.upsert({
        where: { blockId_label: { blockId: block.id, label: 'G' } },
        update: { number: 0, status: 'ACTIVE' },
        create: { societyId: society.id, blockId: block.id, label: 'G', number: 0, sortOrder: 0 },
      });
      await tx.flat.upsert({
        where: { blockId_number: { blockId: block.id, number: 'A-001' } },
        update: { floorId: floor.id, displayName: 'A-001', status: 'ACTIVE' },
        create: {
          societyId: society.id,
          blockId: block.id,
          floorId: floor.id,
          number: 'A-001',
          displayName: 'A-001',
        },
      });
      await tx.gate.upsert({
        where: { societyId_code: { societyId: society.id, code: 'MAIN' } },
        update: { name: 'Main Gate', status: 'ACTIVE' },
        create: { societyId: society.id, code: 'MAIN', name: 'Main Gate' },
      });

      const permissionByAction = new Map<string, string>();
      for (const definition of seedPermissionDefinitions) {
        const permission = await tx.permission.upsert({
          where: {
            societyId_action: {
              action: definition.action,
              societyId: society.id,
            },
          },
          update: {
            description: definition.description,
            riskLevel: definition.riskLevel,
            status: 'ACTIVE',
          },
          create: {
            action: definition.action,
            description: definition.description,
            riskLevel: definition.riskLevel,
            societyId: society.id,
            status: 'ACTIVE',
          },
        });
        permissionByAction.set(definition.action, permission.id);
      }

      await tx.permission.updateMany({
        data: { status: 'INACTIVE' },
        where: {
          action: { notIn: seedPermissionDefinitions.map(({ action }) => action) },
          societyId: society.id,
        },
      });

      for (const definition of seedRoleDefinitions) {
        const role = await tx.role.upsert({
          where: {
            societyId_code: {
              code: definition.code,
              societyId: society.id,
            },
          },
          update: {
            isSystem: true,
            name: definition.name,
            privilegeLevel: definition.privilegeLevel,
            status: 'ACTIVE',
          },
          create: {
            code: definition.code,
            isSystem: true,
            name: definition.name,
            privilegeLevel: definition.privilegeLevel,
            societyId: society.id,
          },
        });

        await tx.rolePermission.deleteMany({
          where: { roleId: role.id, societyId: society.id },
        });
        await tx.rolePermission.createMany({
          data: seedRolePermissionActions[definition.code].map((action) => {
            const permissionId = permissionByAction.get(action);
            if (!permissionId) {
              throw new Error(`Canonical permission ${action} was not persisted.`);
            }
            return { permissionId, roleId: role.id, societyId: society.id };
          }),
        });
      }
    });
  } finally {
    await database.$disconnect();
  }
}

void seed();
