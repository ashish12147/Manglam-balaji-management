import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma, RecordStatus } from '@manglam/database';

import { ApiError } from '../../common/http/api-error.js';
import { DatabaseService } from '../../infrastructure/database/database.service.js';
import type { AuthenticatedPrincipal } from '../access/access.types.js';
import { MutationJournalService } from '../platform/mutation-journal.service.js';
import type { MutationRequestContext } from '../platform/request-context.js';
import { principalActor } from '../auth/session.service.js';
import type {
  CreateBlockInput,
  CreateFlatInput,
  CreateFloorInput,
  CreateGateInput,
  UpdateBlockInput,
  UpdateFlatInput,
  UpdateFloorInput,
  UpdateGateInput,
} from './society.schemas.js';

@Injectable()
export class SocietyService {
  constructor(
    private readonly database: DatabaseService,
    private readonly journal: MutationJournalService,
  ) {}

  async getHierarchy(principal: AuthenticatedPrincipal): Promise<object> {
    const society = await this.database.client.society.findFirst({
      include: {
        blocks: {
          include: {
            floors: {
              include: { flats: { orderBy: { number: 'asc' } } },
              orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
            },
          },
          orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
        },
        gates: { orderBy: { code: 'asc' } },
        settings: true,
      },
      where: { id: principal.societyId },
    });
    if (!society) {
      throw notFound();
    }
    return society;
  }

  async createBlock(
    principal: AuthenticatedPrincipal,
    input: CreateBlockInput,
    context: MutationRequestContext,
  ): Promise<object> {
    return this.database.client.$transaction(
      async (transaction) => {
        const claim = await this.journal.begin<object>(transaction, {
          actor: principalActor(principal),
          idempotencyKey: context.idempotencyKey,
          operation: 'society.block.create',
          request: input,
          societyId: principal.societyId,
        });
        if (claim.kind === 'replay') return claim.response;
        const block = await transaction.block.create({
          data: { ...input, societyId: principal.societyId },
        });
        await this.commit(transaction, principal, context, claim.recordId, {
          action: 'society.block.create',
          entity: block,
          entityType: 'Block',
          eventType: 'society.block.created',
          response: block,
        });
        return block;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async updateBlock(
    principal: AuthenticatedPrincipal,
    blockId: string,
    input: UpdateBlockInput,
    context: MutationRequestContext,
  ): Promise<object> {
    return this.updateEntity(principal, context, {
      action: 'society.block.update',
      entityId: blockId,
      entityType: 'Block',
      eventType: 'society.block.updated',
      input,
      load: (transaction) =>
        transaction.block.findFirst({
          where: { id: blockId, societyId: principal.societyId },
        }),
      update: (transaction) =>
        transaction.block.update({
          data: { ...input, version: { increment: 1 } },
          where: { id: blockId },
        }),
    });
  }

  async createFloor(
    principal: AuthenticatedPrincipal,
    blockId: string,
    input: CreateFloorInput,
    context: MutationRequestContext,
  ): Promise<object> {
    return this.database.client.$transaction(
      async (transaction) => {
        const claim = await this.journal.begin<object>(transaction, {
          actor: principalActor(principal),
          idempotencyKey: context.idempotencyKey,
          operation: 'society.floor.create',
          request: { blockId, ...input },
          societyId: principal.societyId,
        });
        if (claim.kind === 'replay') return claim.response;
        const block = await transaction.block.findFirst({
          where: { id: blockId, societyId: principal.societyId },
        });
        if (!block) throw notFound();
        const floor = await transaction.floor.create({
          data: {
            blockId,
            label: input.label,
            number: input.number ?? null,
            societyId: principal.societyId,
            sortOrder: input.sortOrder,
          },
        });
        await this.commit(transaction, principal, context, claim.recordId, {
          action: 'society.floor.create',
          entity: floor,
          entityType: 'Floor',
          eventType: 'society.floor.created',
          response: floor,
        });
        return floor;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async updateFloor(
    principal: AuthenticatedPrincipal,
    floorId: string,
    input: UpdateFloorInput,
    context: MutationRequestContext,
  ): Promise<object> {
    return this.updateEntity(principal, context, {
      action: 'society.floor.update',
      entityId: floorId,
      entityType: 'Floor',
      eventType: 'society.floor.updated',
      input,
      load: (transaction) =>
        transaction.floor.findFirst({
          where: { id: floorId, societyId: principal.societyId },
        }),
      update: (transaction) =>
        transaction.floor.update({
          data: { ...input, version: { increment: 1 } },
          where: { id: floorId },
        }),
    });
  }

  async createFlat(
    principal: AuthenticatedPrincipal,
    floorId: string,
    input: CreateFlatInput,
    context: MutationRequestContext,
  ): Promise<object> {
    return this.database.client.$transaction(
      async (transaction) => {
        const claim = await this.journal.begin<object>(transaction, {
          actor: principalActor(principal),
          idempotencyKey: context.idempotencyKey,
          operation: 'society.flat.create',
          request: { floorId, ...input },
          societyId: principal.societyId,
        });
        if (claim.kind === 'replay') return claim.response;
        const floor = await transaction.floor.findFirst({
          where: { id: floorId, societyId: principal.societyId },
        });
        if (!floor) throw notFound();
        const flat = await transaction.flat.create({
          data: {
            blockId: floor.blockId,
            displayName: input.displayName,
            floorId,
            intercomNumber: input.intercomNumber ?? null,
            number: input.number,
            occupancyType: input.occupancyType ?? null,
            societyId: principal.societyId,
          },
        });
        await this.commit(transaction, principal, context, claim.recordId, {
          action: 'society.flat.create',
          entity: flat,
          entityType: 'Flat',
          eventType: 'society.flat.created',
          response: flat,
        });
        return flat;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async updateFlat(
    principal: AuthenticatedPrincipal,
    flatId: string,
    input: UpdateFlatInput,
    context: MutationRequestContext,
  ): Promise<object> {
    return this.updateEntity(principal, context, {
      action: 'society.flat.update',
      entityId: flatId,
      entityType: 'Flat',
      eventType: 'society.flat.updated',
      input,
      load: (transaction) =>
        transaction.flat.findFirst({
          where: { id: flatId, societyId: principal.societyId },
        }),
      update: (transaction) =>
        transaction.flat.update({
          data: { ...input, version: { increment: 1 } },
          where: { id: flatId },
        }),
    });
  }

  async createGate(
    principal: AuthenticatedPrincipal,
    input: CreateGateInput,
    context: MutationRequestContext,
  ): Promise<object> {
    return this.database.client.$transaction(
      async (transaction) => {
        const claim = await this.journal.begin<object>(transaction, {
          actor: principalActor(principal),
          idempotencyKey: context.idempotencyKey,
          operation: 'society.gate.create',
          request: input,
          societyId: principal.societyId,
        });
        if (claim.kind === 'replay') return claim.response;
        const gate = await transaction.gate.create({
          data: { ...input, societyId: principal.societyId },
        });
        await this.commit(transaction, principal, context, claim.recordId, {
          action: 'society.gate.create',
          entity: gate,
          entityType: 'Gate',
          eventType: 'society.gate.created',
          response: gate,
        });
        return gate;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async updateGate(
    principal: AuthenticatedPrincipal,
    gateId: string,
    input: UpdateGateInput,
    context: MutationRequestContext,
  ): Promise<object> {
    return this.updateEntity(principal, context, {
      action: 'society.gate.update',
      entityId: gateId,
      entityType: 'Gate',
      eventType: 'society.gate.updated',
      input,
      load: (transaction) =>
        transaction.gate.findFirst({
          where: { id: gateId, societyId: principal.societyId },
        }),
      update: (transaction) =>
        transaction.gate.update({
          data: { ...input, version: { increment: 1 } },
          where: { id: gateId },
        }),
    });
  }

  private async updateEntity(
    principal: AuthenticatedPrincipal,
    context: MutationRequestContext,
    input: {
      readonly action: string;
      readonly entityId: string;
      readonly entityType: string;
      readonly eventType: string;
      readonly input: object;
      readonly load: (transaction: Prisma.TransactionClient) => Promise<object | null>;
      readonly update: (transaction: Prisma.TransactionClient) => Promise<object>;
    },
  ): Promise<object> {
    return this.database.client.$transaction(
      async (transaction) => {
        const claim = await this.journal.begin<object>(transaction, {
          actor: principalActor(principal),
          idempotencyKey: context.idempotencyKey,
          operation: input.action,
          request: { entityId: input.entityId, ...input.input },
          societyId: principal.societyId,
        });
        if (claim.kind === 'replay') return claim.response;
        const previous = await input.load(transaction);
        if (!previous) throw notFound();
        const entity = await input.update(transaction);
        await this.commit(transaction, principal, context, claim.recordId, {
          action: input.action,
          entity: entity as { id: string },
          entityType: input.entityType,
          eventType: input.eventType,
          previous,
          response: entity,
        });
        return entity;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  private async commit(
    transaction: Prisma.TransactionClient,
    principal: AuthenticatedPrincipal,
    context: MutationRequestContext,
    claimId: string,
    input: {
      readonly action: string;
      readonly entity: { id: string };
      readonly entityType: string;
      readonly eventType: string;
      readonly previous?: object;
      readonly response: object;
    },
  ): Promise<void> {
    await this.journal.commit(transaction, {
      action: input.action,
      actor: principalActor(principal),
      aggregateId: input.entity.id,
      aggregateType: input.entityType,
      correlationId: context.databaseCorrelationId,
      entityId: input.entity.id,
      entityType: input.entityType,
      eventType: input.eventType,
      idempotencyRecordId: claimId,
      metadata: { ipAddress: context.ipAddress },
      newValues: input.entity as Record<string, unknown>,
      previousValues: input.previous as Record<string, unknown> | undefined,
      response: input.response,
      responseStatus: input.previous ? HttpStatus.OK : HttpStatus.CREATED,
      societyId: principal.societyId,
    });
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
