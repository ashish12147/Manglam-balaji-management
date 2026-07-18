import { HttpStatus, Injectable } from '@nestjs/common';
import { MembershipStatus, Prisma, RecordStatus } from '@manglam/database';

import { ApiError } from '../../common/http/api-error.js';
import { DatabaseService } from '../../infrastructure/database/database.service.js';
import type { AuthenticatedPrincipal } from '../access/access.types.js';
import { MutationJournalService } from '../platform/mutation-journal.service.js';
import type { MutationRequestContext } from '../platform/request-context.js';

export interface CurrentUserProfile {
  readonly deviceId: string;
  readonly displayName: string;
  readonly effectivePermissions: readonly string[];
  readonly email: string | null;
  readonly id: string;
  readonly memberships: readonly {
    readonly endAt: string | null;
    readonly flatId: string;
    readonly flatLabel: string;
    readonly flat: {
      readonly block: { readonly code: string; readonly id: string; readonly name: string };
      readonly floor: { readonly id: string; readonly label: string } | null;
      readonly id: string;
      readonly number: string;
    };
    readonly id: string;
    readonly occupancyType: string;
    readonly relationship: string;
    readonly startAt: string;
    readonly status: string;
  }[];
  readonly name: string;
  readonly permissions: readonly string[];
  readonly phoneMasked: string;
  readonly pinEnabled: boolean;
  readonly roleCodes: readonly string[];
  readonly roles: readonly string[];
  readonly sessionId: string;
  readonly sessionKind: 'GUARD' | 'PRIVILEGED' | 'RESIDENT';
  readonly societyId: string;
  readonly status: string;
  readonly user: {
    readonly displayName: string;
    readonly email: string | null;
    readonly id: string;
    readonly normalizedPhone: string;
    readonly preferredLocale: string;
  };
}

@Injectable()
export class CurrentUserService {
  constructor(
    private readonly database: DatabaseService,
    private readonly journal: MutationJournalService,
  ) {}

  get(principal: AuthenticatedPrincipal): Promise<CurrentUserProfile> {
    return this.getForUser(
      principal.user.id,
      principal.societyId,
      principal.effectivePermissions,
      principal,
    );
  }

  async getForUser(
    userId: string,
    societyId: string,
    knownPermissions: readonly string[] | undefined,
    principal: AuthenticatedPrincipal,
  ): Promise<CurrentUserProfile> {
    const now = new Date();
    const user = await this.database.client.user.findFirst({
      include: {
        memberships: {
          include: {
            flat: { include: { block: true, floor: true } },
          },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
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
      where: { id: userId, societyId },
    });
    if (!user) throw resourceNotFound();

    const activeMembershipIds = new Set(
      user.memberships
        .filter(
          (membership) =>
            membership.status === MembershipStatus.APPROVED &&
            membership.startAt <= now &&
            (!membership.endAt || membership.endAt > now),
        )
        .map((membership) => membership.id),
    );
    const permissions =
      knownPermissions ??
      [
        ...new Set(
          user.roleAssignments.flatMap((assignment) => {
            if (
              assignment.scope === 'FLAT' &&
              (!assignment.flatMembershipId ||
                !activeMembershipIds.has(assignment.flatMembershipId))
            ) {
              return [];
            }
            return assignment.role.permissionLinks.map(
              (link) => link.permission.action,
            );
          }),
        ),
      ].sort();
    const roles = user.roleAssignments.map((assignment) => assignment.role.code);

    return {
      displayName: user.displayName,
      effectivePermissions: permissions,
      email: user.email,
      deviceId: principal.deviceId,
      id: user.id,
      memberships: user.memberships.map((membership) => ({
        endAt: membership.endAt?.toISOString() ?? null,
        flatId: membership.flat.id,
        flatLabel: `${membership.flat.block.code}-${membership.flat.number}`,
        flat: {
          block: {
            code: membership.flat.block.code,
            id: membership.flat.block.id,
            name: membership.flat.block.name,
          },
          floor: membership.flat.floor
            ? {
                id: membership.flat.floor.id,
                label: membership.flat.floor.label,
              }
            : null,
          id: membership.flat.id,
          number: membership.flat.number,
        },
        id: membership.id,
        occupancyType: membership.occupancyType,
        relationship: membership.relationship,
        startAt: membership.startAt.toISOString(),
        status: membership.status,
      })),
      name: user.displayName,
      permissions,
      phoneMasked: maskPhone(user.normalizedPhone),
      pinEnabled: user.appPinHash !== null,
      roleCodes: roles,
      roles,
      sessionId: principal.sessionId,
      sessionKind: principal.sessionKind,
      societyId: principal.societyId,
      status: user.status,
      user: {
        displayName: user.displayName,
        email: user.email,
        id: user.id,
        normalizedPhone: user.normalizedPhone,
        preferredLocale: user.preferredLocale,
      },
    };
  }

  async update(
    principal: AuthenticatedPrincipal,
    input: { readonly displayName: string; readonly email: string | null },
    context: MutationRequestContext,
  ): Promise<CurrentUserProfile> {
    await this.database.client.$transaction(
      async (transaction) => {
        const actor = {
          actorScopeKey: `session:${principal.sessionId}`,
          deviceId: principal.deviceId,
          sessionId: principal.sessionId,
          userId: principal.user.id,
        };
        const claim = await this.journal.begin<{ readonly updated: true }>(
          transaction,
          {
            actor,
            idempotencyKey: context.idempotencyKey,
            operation: 'account.profile.update',
            request: input,
            societyId: principal.societyId,
          },
        );
        if (claim.kind === 'replay') return;

        const user = await transaction.user.findFirst({
          where: {
            id: principal.user.id,
            societyId: principal.societyId,
          },
        });
        if (!user) throw resourceNotFound();
        await transaction.user.update({
          data: {
            displayName: input.displayName,
            email: input.email,
            version: { increment: 1 },
          },
          where: { id: user.id },
        });
        const response = { updated: true as const };
        await this.journal.commit(transaction, {
          action: 'account.profile.update',
          actor,
          aggregateId: user.id,
          aggregateType: 'User',
          correlationId: context.databaseCorrelationId,
          entityId: user.id,
          entityType: 'User',
          eventType: 'account.profile.updated',
          idempotencyRecordId: claim.recordId,
          metadata: { ipAddress: context.ipAddress },
          newValues: input,
          previousValues: {
            displayName: user.displayName,
            email: user.email,
          },
          response,
          responseStatus: HttpStatus.OK,
          societyId: principal.societyId,
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    return this.get(principal);
  }
}

function maskPhone(phone: string): string {
  if (phone.length <= 6) return '*'.repeat(phone.length);
  return `${phone.slice(0, 4)}${'*'.repeat(phone.length - 6)}${phone.slice(-2)}`;
}

function resourceNotFound(): ApiError {
  return new ApiError({
    code: 'RESOURCE_NOT_FOUND',
    details: {},
    message: 'The requested resource was not found.',
    status: HttpStatus.NOT_FOUND,
  });
}
