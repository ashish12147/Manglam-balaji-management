import { HttpStatus, Injectable } from '@nestjs/common';
import {
  DeviceStatus,
  GuardStatus,
  MembershipStatus,
  RecordStatus,
  SessionStatus,
  UserStatus,
} from '@manglam/database';
import {
  PERMISSION_ACTIONS,
  PERMISSION_BY_ACTION,
  effectiveActions,
  type AuthorizationActor,
  type DirectPermissionGrant,
  type PermissionAction,
  type PermissionScopeKind,
} from '@manglam/permissions';

import { ApiError } from '../../common/http/api-error.js';
import { DatabaseService } from '../../infrastructure/database/database.service.js';
import type { AccessTokenClaims } from '../security/access-token.service.js';
import { SecretDigestService } from '../security/secret-digest.service.js';
import { digestMatches } from '../security/secrets.js';
import type { AuthenticatedPrincipal } from './access.types.js';

const RECENT_AUTHENTICATION_MS = 10 * 60_000;

function isPermissionAction(action: string): action is PermissionAction {
  return (PERMISSION_ACTIONS as readonly string[]).includes(action);
}

function authenticationFailure(): ApiError {
  return new ApiError({
    code: 'AUTHENTICATION_REQUIRED',
    details: {},
    message: 'A valid active session is required.',
    status: HttpStatus.UNAUTHORIZED,
  });
}

@Injectable()
export class CurrentIdentityService {
  constructor(
    private readonly database: DatabaseService,
    private readonly digests: SecretDigestService,
  ) {}

  async load(
    claims: AccessTokenClaims,
    deviceFingerprint: string,
  ): Promise<AuthenticatedPrincipal> {
    const now = new Date();
    const session = await this.database.client.userSession.findFirst({
      include: {
        device: {
          include: {
            guardDevice: {
              include: {
                gateAssignments: {
                  where: {
                    startsAt: { lte: now },
                    status: RecordStatus.ACTIVE,
                    OR: [{ endsAt: null }, { endsAt: { gt: now } }],
                  },
                },
              },
            },
          },
        },
        user: {
          include: {
            guardProfile: {
              include: {
                gateAssignments: {
                  where: {
                    startsAt: { lte: now },
                    status: RecordStatus.ACTIVE,
                    OR: [{ endsAt: null }, { endsAt: { gt: now } }],
                  },
                },
              },
            },
            memberships: {
              include: { flat: { include: { block: true } } },
              where: {
                startAt: { lte: now },
                status: MembershipStatus.APPROVED,
                OR: [{ endAt: null }, { endAt: { gt: now } }],
              },
            },
            roleAssignments: {
              include: {
                role: {
                  include: {
                    permissionLinks: {
                      include: { permission: true },
                      where: { permission: { status: RecordStatus.ACTIVE } },
                    },
                  },
                },
              },
              where: {
                startsAt: { lte: now },
                revokedAt: null,
                OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
                role: { status: RecordStatus.ACTIVE },
              },
            },
          },
        },
      },
      where: {
        absoluteExpiresAt: { gt: now },
        id: claims.sid,
        idleExpiresAt: { gt: now },
        societyId: claims.soc,
        status: SessionStatus.ACTIVE,
        userId: claims.sub,
      },
    });

    if (
      !session ||
      session.kind !== claims.kind ||
      session.deviceId !== claims.did ||
      session.user.status !== UserStatus.ACTIVE ||
      !session.device ||
      session.device.status !== DeviceStatus.ACTIVE
    ) {
      throw authenticationFailure();
    }
    if (
      session.kind === 'GUARD' &&
      (session.user.guardProfile?.status !== GuardStatus.ACTIVE ||
        session.device.guardDevice?.status !== DeviceStatus.ACTIVE)
    ) {
      throw authenticationFailure();
    }


    const fingerprintDigest = this.digests.deviceFingerprint(
      deviceFingerprint,
      session.societyId,
    );
    if (!digestMatches(fingerprintDigest, session.device.fingerprintDigest)) {
      throw authenticationFailure();
    }

    const activeMembershipIds = new Set(
      session.user.memberships.map((membership) => membership.id),
    );
    const activeFlatIds = session.user.memberships.map((membership) => membership.flatId);
    const assignedGateIds = [
      ...(session.user.guardProfile?.gateAssignments.map(
        (assignment) => assignment.gateId,
      ) ?? []),
      ...(session.device.guardDevice?.gateAssignments.map(
        (assignment) => assignment.gateId,
      ) ?? []),
    ].filter((gateId, index, all) => all.indexOf(gateId) === index);

    const grantScopes = new Map<PermissionAction, Set<PermissionScopeKind>>();
    for (const assignment of session.user.roleAssignments) {
      for (const link of assignment.role.permissionLinks) {
        const action = link.permission.action;
        if (!isPermissionAction(action)) {
          continue;
        }
        const allowedScopes = PERMISSION_BY_ACTION[action].scopes;
        const scopes = grantScopes.get(action) ?? new Set<PermissionScopeKind>();

        if (allowedScopes.includes('SELF')) {
          scopes.add('SELF');
        }
        if (allowedScopes.includes('TARGETED')) {
          scopes.add('TARGETED');
        }
        if (assignment.scope === 'SOCIETY' && allowedScopes.includes('SOCIETY')) {
          scopes.add('SOCIETY');
        }
        if (
          assignment.scope === 'FLAT' &&
          assignment.flatMembershipId &&
          activeMembershipIds.has(assignment.flatMembershipId) &&
          allowedScopes.includes('ACTIVE_FLAT')
        ) {
          scopes.add('ACTIVE_FLAT');
        }
        if (
          assignment.scope === 'GATE' &&
          assignment.gateId &&
          assignedGateIds.includes(assignment.gateId) &&
          allowedScopes.includes('ASSIGNED_GATE')
        ) {
          scopes.add('ASSIGNED_GATE');
        }
        if (scopes.size > 0) {
          grantScopes.set(action, scopes);
        }
      }
    }

    const directGrants: DirectPermissionGrant[] = [...grantScopes].map(
      ([action, scopes]) => ({ action, scopes: [...scopes] }),
    );
    const actor: AuthorizationActor = {
      active: true,
      activeFlatIds,
      assignedComplaintIds: [],
      assignedGateIds,
      directGrants,
      roles: [],
      societyId: session.societyId,
      userId: session.userId,
    };

    await this.database.client.userSession.updateMany({
      data: { lastSeenAt: now },
      where: { id: session.id, status: SessionStatus.ACTIVE },
    });
    await this.database.client.device.updateMany({
      data: { lastSeenAt: now },
      where: { id: session.device.id, status: DeviceStatus.ACTIVE },
    });

    return {
      actor,
      deviceId: session.device.id,
      effectivePermissions: effectiveActions(actor),
      guardDeviceId: session.device.guardDevice?.id ?? null,
      guardProfileId: session.user.guardProfile?.id ?? null,
      memberships: session.user.memberships.map((membership) => ({
        flatId: membership.flatId,
        flatLabel: `${membership.flat.block.code}-${membership.flat.number}`,
        id: membership.id,
        relationship: membership.relationship,
      })),
      recentlyAuthenticated:
        session.user.lastAuthenticatedAt !== null &&
        now.getTime() - session.user.lastAuthenticatedAt.getTime() <=
          RECENT_AUTHENTICATION_MS,
      roleCodes: session.user.roleAssignments.map(
        (assignment) => assignment.role.code,
      ),
      sessionId: session.id,
      sessionKind: session.kind,
      societyId: session.societyId,
      user: {
        displayName: session.user.displayName,
        email: session.user.email,
        id: session.user.id,
        normalizedPhone: session.user.normalizedPhone,
        preferredLocale: session.user.preferredLocale,
      },
    };
  }
}
