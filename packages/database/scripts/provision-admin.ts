import { createHash, randomUUID } from 'node:crypto';

import { createDatabaseClient } from '../src/client.js';
import { Prisma } from '../src/generated/prisma/client.js';
import { hashCredential } from '../src/security/credential-hasher.js';
import {
  seedPermissionDefinitions,
  seedRoleDefinitions,
  seedRolePermissionActions,
} from '../prisma/seed-catalog.js';
import {
  digestProvisionedPhone,
  encryptTotpSecret,
  parseProvisioningConfig,
  resolveProvisioningSecrets,
  verifyCurrentTotp,
} from './provisioning.js';

const MAX_STDIN_BYTES = 16_384;

async function readStdin(): Promise<string> {
  if (process.stdin.isTTY) {
    throw new Error(
      'Missing credentials. Pipe JSON through stdin or provide all secret environment variables.',
    );
  }

  process.stdin.setEncoding('utf8');
  let input = '';
  for await (const chunk of process.stdin) {
    input += chunk;
    if (Buffer.byteLength(input, 'utf8') > MAX_STDIN_BYTES) {
      throw new Error('Provisioning stdin exceeds the allowed size.');
    }
  }
  return input;
}

async function provision(): Promise<void> {
  if (process.argv.length > 2) {
    throw new Error('Command-line arguments are forbidden; use environment variables or stdin.');
  }

  const config = parseProvisioningConfig(process.env);
  const suppliedSecretCount = [
    process.env.PROVISION_ADMIN_PASSWORD,
    process.env.PROVISION_ADMIN_TOTP_CODE,
    process.env.PROVISION_ADMIN_TOTP_SECRET,
  ].filter(Boolean).length;
  const stdinText = suppliedSecretCount > 0 ? '' : await readStdin();
  const secrets = resolveProvisioningSecrets(process.env, stdinText, config);
  const confirmedTimeStep = verifyCurrentTotp(secrets.totpSecret, secrets.totpCode);

  const passwordHash = await hashCredential(
    secrets.password,
    'ADMIN_PASSWORD',
    config.passwordPepper,
  );
  const database = createDatabaseClient({ applicationName: 'manglam-admin-provisioner' });

  try {
    const result = await database.$transaction(
      async (transaction) => {
        const society = await transaction.society.findUnique({
          where: { singletonKey: config.societyKey },
        });
        if (!society || society.status !== 'ACTIVE') {
          throw new Error('The requested active society does not exist.');
        }

        const existingEmail = await transaction.user.findFirst({
          select: { id: true, normalizedPhone: true },
          where: {
            email: { equals: config.email, mode: 'insensitive' },
            societyId: society.id,
          },
        });
        if (existingEmail && existingEmail.normalizedPhone !== config.phoneE164) {
          throw new Error('The admin email is already assigned to a different society user.');
        }

        const phoneDigest = digestProvisionedPhone(
          config.phoneE164,
          society.id,
          config.phoneHmacSecret,
        );
        const user = await transaction.user.upsert({
          where: {
            societyId_normalizedPhone: {
              normalizedPhone: config.phoneE164,
              societyId: society.id,
            },
          },
          update: {
            displayName: config.displayName,
            email: config.email,
            mfaEnabled: true,
            passwordHash,
            phoneDigest,
            status: 'ACTIVE',
          },
          create: {
            displayName: config.displayName,
            email: config.email,
            mfaEnabled: true,
            normalizedPhone: config.phoneE164,
            passwordHash,
            phoneDigest,
            societyId: society.id,
            status: 'ACTIVE',
          },
        });

        const permissionByAction = new Map<string, string>();
        for (const definition of seedPermissionDefinitions) {
          const permission = await transaction.permission.upsert({
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

        const roleDefinition = seedRoleDefinitions.find(({ code }) => code === config.role);
        if (!roleDefinition) throw new Error('The requested canonical admin role is unavailable.');
        const role = await transaction.role.upsert({
          where: {
            societyId_code: {
              code: roleDefinition.code,
              societyId: society.id,
            },
          },
          update: {
            isSystem: true,
            name: roleDefinition.name,
            privilegeLevel: roleDefinition.privilegeLevel,
            status: 'ACTIVE',
          },
          create: {
            code: roleDefinition.code,
            isSystem: true,
            name: roleDefinition.name,
            privilegeLevel: roleDefinition.privilegeLevel,
            societyId: society.id,
          },
        });

        await transaction.rolePermission.deleteMany({
          where: { roleId: role.id, societyId: society.id },
        });
        await transaction.rolePermission.createMany({
          data: seedRolePermissionActions[config.role].map((action) => {
            const permissionId = permissionByAction.get(action);
            if (!permissionId) throw new Error(`Canonical permission ${action} is unavailable.`);
            return { permissionId, roleId: role.id, societyId: society.id };
          }),
        });

        const activeAssignment = await transaction.userRole.findFirst({
          where: {
            expiresAt: null,
            revokedAt: null,
            roleId: role.id,
            societyId: society.id,
            userId: user.id,
          },
        });
        if (!activeAssignment) {
          await transaction.userRole.create({
            data: {
              roleId: role.id,
              scope: 'SOCIETY',
              societyId: society.id,
              userId: user.id,
            },
          });
        }

        const now = new Date();
        await transaction.mfaCredential.updateMany({
          data: {
            revocationReason: 'REPLACED_BY_PROVISIONING',
            revokedAt: now,
            status: 'REVOKED',
            version: { increment: 1 },
          },
          where: {
            societyId: society.id,
            status: { in: ['PENDING', 'ACTIVE'] },
            type: 'TOTP',
            userId: user.id,
          },
        });

        const additionalAuthenticatedData = `${society.id}:${user.id}:TOTP:v${config.encryptionKeyVersion}`;
        const encrypted = encryptTotpSecret(
          secrets.totpSecret,
          config.encryptionKey,
          additionalAuthenticatedData,
        );
        const credential = await transaction.mfaCredential.create({
          data: {
            confirmedAt: now,
            encryptionAlgorithm: 'AES-256-GCM',
            keyVersion: config.encryptionKeyVersion,
            lastUsedTimeStep: confirmedTimeStep,
            label: 'Primary authenticator',
            secretAuthTag: encrypted.authTag,
            secretCiphertext: encrypted.ciphertext,
            secretNonce: encrypted.nonce,
            societyId: society.id,
            status: 'ACTIVE',
            type: 'TOTP',
            userId: user.id,
          },
        });

        const previousAudit = await transaction.auditLog.findFirst({
          orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
          select: { entryHash: true },
          where: { societyId: society.id },
        });
        const correlationId = randomUUID();
        const entryHash = createHash('sha256')
          .update(
            JSON.stringify({
              action: 'admin.provisioned',
              correlationId,
              credentialId: credential.id,
              previousHash: previousAudit?.entryHash ?? null,
              role: config.role,
              societyId: society.id,
              userId: user.id,
            }),
          )
          .digest('hex');
        await transaction.auditLog.create({
          data: {
            action: 'admin.provisioned',
            actorUserId: user.id,
            correlationId,
            entityId: user.id,
            entityType: 'User',
            entryHash,
            metadata: {
              credentialId: credential.id,
              method: 'ONE_TIME_PROVISIONING_CLI',
              role: config.role,
            },
            outcome: 'SUCCESS',
            previousHash: previousAudit?.entryHash,
            societyId: society.id,
          },
        });

        return {
          mfaCredentialId: credential.id,
          role: config.role,
          societyId: society.id,
          status: 'PROVISIONED',
          userId: user.id,
        } as const;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    process.stdout.write(`${JSON.stringify(result)}\n`);
  } finally {
    await database.$disconnect();
    config.encryptionKey.fill(0);
  }
}

void provision().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown provisioning failure.';
  process.stderr.write(`Admin provisioning failed: ${message}\n`);
  process.exitCode = 1;
});
