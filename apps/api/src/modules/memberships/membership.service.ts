import { HttpStatus, Injectable } from '@nestjs/common';
import {
  MembershipStatus,
  Prisma,
  RecordStatus,
} from '@manglam/database';
import { transitionMembership } from '@manglam/domain';

import { ApiError } from '../../common/http/api-error.js';
import { DatabaseService } from '../../infrastructure/database/database.service.js';
import type { AuthenticatedPrincipal } from '../access/access.types.js';
import { principalActor } from '../auth/session.service.js';
import { decodeCursor, pageResult } from '../platform/cursor.js';
import { MutationJournalService } from '../platform/mutation-journal.service.js';
import type { MutationRequestContext } from '../platform/request-context.js';
import type {
  CreateFamilyMemberInput,
  MembershipDecisionInput,
  RequestMembershipInput,
  UpdateFamilyMemberInput,
} from './membership.schemas.js';

interface PageQuery {
  readonly cursor?: string;
  readonly limit: number;
}

@Injectable()
export class MembershipService {
  constructor(
    private readonly database: DatabaseService,
    private readonly journal: MutationJournalService,
  ) {}

  listMine(principal: AuthenticatedPrincipal, query: PageQuery): Promise<object> {
    return this.list(principal, query, { userId: principal.user.id });
  }

  listByFlat(
    principal: AuthenticatedPrincipal,
    flatId: string,
    query: PageQuery,
  ): Promise<object> {
    return this.list(principal, query, { flatId });
  }

  listAll(principal: AuthenticatedPrincipal, query: PageQuery): Promise<object> {
    return this.list(principal, query, {});
  }

  async request(
    principal: AuthenticatedPrincipal,
    input: RequestMembershipInput,
    context: MutationRequestContext,
  ): Promise<object> {
    const actor = principalActor(principal);
    return this.database.client.$transaction(
      async (transaction) => {
        const claim = await this.journal.begin<object>(transaction, {
          actor,
          idempotencyKey: context.idempotencyKey,
          operation: 'membership.request',
          request: input,
          societyId: principal.societyId,
        });
        if (claim.kind === 'replay') return claim.response;

        const flat = await transaction.flat.findFirst({
          select: { id: true },
          where: {
            id: input.flatId,
            societyId: principal.societyId,
            status: RecordStatus.ACTIVE,
          },
        });
        if (!flat) throw notFound();
        const existing = await transaction.flatMembership.findFirst({
          where: {
            flatId: input.flatId,
            societyId: principal.societyId,
            status: { in: [MembershipStatus.PENDING, MembershipStatus.APPROVED] },
            userId: principal.user.id,
          },
        });
        if (existing) {
          throw conflict('An active or pending membership already exists for this flat.');
        }

        const membership = await transaction.flatMembership.create({
          data: {
            flatId: input.flatId,
            occupancyType: input.occupancyType,
            relationship: input.relationship,
            societyId: principal.societyId,
            startAt: new Date(input.startAt),
            status: MembershipStatus.PENDING,
            userId: principal.user.id,
          },
        });
        await transaction.flatMembershipHistory.create({
          data: {
            actorUserId: principal.user.id,
            correlationId: context.databaseCorrelationId,
            membershipId: membership.id,
            sequence: 1,
            societyId: principal.societyId,
            toStatus: MembershipStatus.PENDING,
          },
        });
        await this.journal.commit(transaction, {
          action: 'membership.request',
          actor,
          aggregateId: membership.id,
          aggregateType: 'FlatMembership',
          correlationId: context.databaseCorrelationId,
          entityId: membership.id,
          entityType: 'FlatMembership',
          eventType: 'membership.requested',
          idempotencyRecordId: claim.recordId,
          metadata: { ipAddress: context.ipAddress },
          newValues: { flatId: membership.flatId, status: membership.status },
          response: membership,
          responseStatus: HttpStatus.CREATED,
          societyId: principal.societyId,
        });
        return membership;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  transition(
    principal: AuthenticatedPrincipal,
    membershipId: string,
    target: 'APPROVED' | 'REJECTED' | 'SUSPENDED' | 'ENDED',
    input: MembershipDecisionInput,
    context: MutationRequestContext,
  ): Promise<object> {
    const actor = principalActor(principal);
    return this.database.client.$transaction(
      async (transaction) => {
        const claim = await this.journal.begin<object>(transaction, {
          actor,
          idempotencyKey: context.idempotencyKey,
          operation: `membership.${target.toLowerCase()}`,
          request: { membershipId, reason: input.reason, target },
          societyId: principal.societyId,
        });
        if (claim.kind === 'replay') return claim.response;
        const membership = await transaction.flatMembership.findFirst({
          where: { id: membershipId, societyId: principal.societyId },
        });
        if (!membership) throw notFound();

        const decision = transitionMembership({
          actorId: principal.user.id,
          current: membership.status,
          occurredAt: new Date().toISOString(),
          reason: input.reason,
          target,
        });
        if (!decision.ok) {
          throw new ApiError({
            code: decision.error.code,
            details: { ...decision.error.details },
            message: decision.error.message,
            status: HttpStatus.CONFLICT,
          });
        }
        const now = new Date();
        const updatedCount = await transaction.flatMembership.updateMany({
          data: {
            ...(target === MembershipStatus.APPROVED
              ? { approvedAt: now, approvedByUserId: principal.user.id }
              : {}),
            ...(target === MembershipStatus.REJECTED
              ? { rejectedAt: now, rejectionReason: input.reason ?? 'Rejected' }
              : {}),
            ...(target === MembershipStatus.SUSPENDED
              ? { suspendedAt: now, suspensionReason: input.reason ?? 'Suspended' }
              : {}),
            ...(target === MembershipStatus.ENDED
              ? { endReason: input.reason ?? 'Ended', endedAt: now }
              : {}),
            status: target,
            version: { increment: 1 },
          },
          where: { id: membership.id, version: membership.version },
        });
        if (updatedCount.count !== 1) throw conflict('The membership changed concurrently.');
        const previousHistory = await transaction.flatMembershipHistory.findFirst({
          orderBy: { sequence: 'desc' },
          select: { sequence: true },
          where: { membershipId: membership.id },
        });
        await transaction.flatMembershipHistory.create({
          data: {
            actorUserId: principal.user.id,
            correlationId: context.databaseCorrelationId,
            fromStatus: membership.status,
            membershipId: membership.id,
            reason: input.reason ?? null,
            sequence: (previousHistory?.sequence ?? 0) + 1,
            societyId: principal.societyId,
            toStatus: target,
          },
        });
        const updated = await transaction.flatMembership.findUniqueOrThrow({
          where: { id: membership.id },
        });
        await this.journal.commit(transaction, {
          action: `membership.${target.toLowerCase()}`,
          actor,
          aggregateId: membership.id,
          aggregateType: 'FlatMembership',
          correlationId: context.databaseCorrelationId,
          entityId: membership.id,
          entityType: 'FlatMembership',
          eventType: `membership.${target.toLowerCase()}`,
          idempotencyRecordId: claim.recordId,
          newValues: { status: target, version: updated.version },
          previousValues: { status: membership.status, version: membership.version },
          reason: input.reason,
          response: updated,
          responseStatus: HttpStatus.OK,
          societyId: principal.societyId,
        });
        return updated;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async listFamily(
    principal: AuthenticatedPrincipal,
    membershipId: string,
  ): Promise<readonly object[]> {
    const membership = await this.database.client.flatMembership.findFirst({
      select: { flatId: true },
      where: { id: membershipId, societyId: principal.societyId },
    });
    if (!membership) throw notFound();
    return this.database.client.familyMember.findMany({
      orderBy: { name: 'asc' },
      where: { flatId: membership.flatId, societyId: principal.societyId },
    });
  }

  async createFamilyMember(
    principal: AuthenticatedPrincipal,
    membershipId: string,
    input: CreateFamilyMemberInput,
    context: MutationRequestContext,
  ): Promise<object> {
    const actor = principalActor(principal);
    return this.database.client.$transaction(
      async (transaction) => {
        const claim = await this.journal.begin<object>(transaction, {
          actor,
          idempotencyKey: context.idempotencyKey,
          operation: 'family_member.create',
          request: { membershipId, ...input },
          societyId: principal.societyId,
        });
        if (claim.kind === 'replay') return claim.response;
        const membership = await transaction.flatMembership.findFirst({
          where: {
            id: membershipId,
            societyId: principal.societyId,
            status: MembershipStatus.APPROVED,
          },
        });
        if (!membership) throw notFound();
        const familyMember = await transaction.familyMember.create({
          data: {
            dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : null,
            flatId: membership.flatId,
            managedByMembershipId: membership.id,
            name: input.name,
            normalizedPhone: input.normalizedPhone ?? null,
            notes: input.notes ?? null,
            relationship: input.relationship,
            societyId: principal.societyId,
          },
        });
        await this.journal.commit(transaction, {
          action: 'family_member.create',
          actor,
          aggregateId: familyMember.id,
          aggregateType: 'FamilyMember',
          correlationId: context.databaseCorrelationId,
          entityId: familyMember.id,
          entityType: 'FamilyMember',
          eventType: 'family_member.created',
          idempotencyRecordId: claim.recordId,
          newValues: { flatId: familyMember.flatId, status: familyMember.status },
          response: familyMember,
          responseStatus: HttpStatus.CREATED,
          societyId: principal.societyId,
        });
        return familyMember;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async updateFamilyMember(
    principal: AuthenticatedPrincipal,
    familyMemberId: string,
    input: UpdateFamilyMemberInput,
    context: MutationRequestContext,
  ): Promise<object> {
    const actor = principalActor(principal);
    return this.database.client.$transaction(
      async (transaction) => {
        const claim = await this.journal.begin<object>(transaction, {
          actor,
          idempotencyKey: context.idempotencyKey,
          operation: 'family_member.update',
          request: { familyMemberId, ...input },
          societyId: principal.societyId,
        });
        if (claim.kind === 'replay') return claim.response;
        const previous = await transaction.familyMember.findFirst({
          where: { id: familyMemberId, societyId: principal.societyId },
        });
        if (!previous) throw notFound();
        const updated = await transaction.familyMember.update({
          data: {
            ...input,
            ...(input.dateOfBirth !== undefined
              ? { dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : null }
              : {}),
            version: { increment: 1 },
          },
          where: { id: familyMemberId },
        });
        await this.journal.commit(transaction, {
          action: 'family_member.update',
          actor,
          aggregateId: updated.id,
          aggregateType: 'FamilyMember',
          correlationId: context.databaseCorrelationId,
          entityId: updated.id,
          entityType: 'FamilyMember',
          eventType: 'family_member.updated',
          idempotencyRecordId: claim.recordId,
          newValues: updated as unknown as Record<string, unknown>,
          previousValues: previous as unknown as Record<string, unknown>,
          response: updated,
          responseStatus: HttpStatus.OK,
          societyId: principal.societyId,
        });
        return updated;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  private async list(
    principal: AuthenticatedPrincipal,
    query: PageQuery,
    scope: { readonly flatId?: string; readonly userId?: string },
  ): Promise<object> {
    const cursor = decodeCursor(query.cursor);
    const rows = await this.database.client.flatMembership.findMany({
      include: { flat: { include: { block: true } }, user: true },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      where: {
        societyId: principal.societyId,
        ...scope,
        ...(cursor
          ? {
              OR: [
                { createdAt: { lt: new Date(cursor.at) } },
                { createdAt: new Date(cursor.at), id: { lt: cursor.id } },
              ],
            }
          : {}),
      },
    });
    return pageResult(rows, query.limit);
  }
}

function notFound(): ApiError {
  return new ApiError({
    code: 'RESOURCE_NOT_FOUND',
    details: {},
    message: 'The requested resource was not found.',
    status: HttpStatus.NOT_FOUND,
  });
}

function conflict(message: string): ApiError {
  return new ApiError({
    code: 'CONFLICT',
    details: {},
    message,
    status: HttpStatus.CONFLICT,
  });
}
