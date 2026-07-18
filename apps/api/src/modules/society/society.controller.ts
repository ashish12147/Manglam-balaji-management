import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { uuidSchema } from '@manglam/validation';

import { ZodValidationPipe } from '../../common/http/zod-validation.pipe.js';
import {
  CurrentPrincipal,
  RequireAnyPermission,
} from '../access/access.decorators.js';
import { AccessSessionGuard } from '../access/access-session.guard.js';
import type { AuthenticatedPrincipal } from '../access/access.types.js';
import { PermissionGuard } from '../access/permission.guard.js';
import { success } from '../platform/api-response.js';
import {
  mutationRequestContext,
  requestCorrelationId,
} from '../platform/request-context.js';
import {
  createBlockSchema,
  createFlatSchema,
  createFloorSchema,
  createGateSchema,
  updateBlockSchema,
  updateFlatSchema,
  updateFloorSchema,
  updateGateSchema,
  type CreateBlockInput,
  type CreateFlatInput,
  type CreateFloorInput,
  type CreateGateInput,
  type UpdateBlockInput,
  type UpdateFlatInput,
  type UpdateFloorInput,
  type UpdateGateInput,
} from './society.schemas.js';
import { SocietyService } from './society.service.js';

@ApiBearerAuth()
@ApiTags('society')
@Controller('society')
@UseGuards(AccessSessionGuard, PermissionGuard)
export class SocietyController {
  constructor(private readonly society: SocietyService) {}

  @Get()
  @RequireAnyPermission({ action: 'society.read', resource: 'SOCIETY' })
  async getHierarchy(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Req() request: Request,
  ): Promise<object> {
    return success(
      await this.society.getHierarchy(principal),
      requestCorrelationId(request),
    );
  }

  @Post('blocks')
  @RequireAnyPermission({ action: 'society.manage', resource: 'SOCIETY' })
  async createBlock(
    @Body(new ZodValidationPipe(createBlockSchema)) input: CreateBlockInput,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Req() request: Request,
  ): Promise<object> {
    return success(
      await this.society.createBlock(principal, input, mutationRequestContext(request)),
      requestCorrelationId(request),
    );
  }

  @Patch('blocks/:blockId')
  @RequireAnyPermission({ action: 'society.manage', resource: 'SOCIETY' })
  async updateBlock(
    @Body(new ZodValidationPipe(updateBlockSchema)) input: UpdateBlockInput,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('blockId', new ZodValidationPipe(uuidSchema)) blockId: string,
    @Req() request: Request,
  ): Promise<object> {
    return success(
      await this.society.updateBlock(
        principal,
        blockId,
        input,
        mutationRequestContext(request),
      ),
      requestCorrelationId(request),
    );
  }

  @Post('blocks/:blockId/floors')
  @RequireAnyPermission({ action: 'society.manage', resource: 'SOCIETY' })
  async createFloor(
    @Body(new ZodValidationPipe(createFloorSchema)) input: CreateFloorInput,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('blockId', new ZodValidationPipe(uuidSchema)) blockId: string,
    @Req() request: Request,
  ): Promise<object> {
    return success(
      await this.society.createFloor(
        principal,
        blockId,
        input,
        mutationRequestContext(request),
      ),
      requestCorrelationId(request),
    );
  }

  @Patch('floors/:floorId')
  @RequireAnyPermission({ action: 'society.manage', resource: 'SOCIETY' })
  async updateFloor(
    @Body(new ZodValidationPipe(updateFloorSchema)) input: UpdateFloorInput,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('floorId', new ZodValidationPipe(uuidSchema)) floorId: string,
    @Req() request: Request,
  ): Promise<object> {
    return success(
      await this.society.updateFloor(
        principal,
        floorId,
        input,
        mutationRequestContext(request),
      ),
      requestCorrelationId(request),
    );
  }

  @Post('floors/:floorId/flats')
  @RequireAnyPermission({ action: 'society.manage', resource: 'SOCIETY' })
  async createFlat(
    @Body(new ZodValidationPipe(createFlatSchema)) input: CreateFlatInput,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('floorId', new ZodValidationPipe(uuidSchema)) floorId: string,
    @Req() request: Request,
  ): Promise<object> {
    return success(
      await this.society.createFlat(
        principal,
        floorId,
        input,
        mutationRequestContext(request),
      ),
      requestCorrelationId(request),
    );
  }

  @Patch('flats/:flatId')
  @RequireAnyPermission({ action: 'society.manage', resource: 'SOCIETY' })
  async updateFlat(
    @Body(new ZodValidationPipe(updateFlatSchema)) input: UpdateFlatInput,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('flatId', new ZodValidationPipe(uuidSchema)) flatId: string,
    @Req() request: Request,
  ): Promise<object> {
    return success(
      await this.society.updateFlat(
        principal,
        flatId,
        input,
        mutationRequestContext(request),
      ),
      requestCorrelationId(request),
    );
  }

  @Post('gates')
  @RequireAnyPermission({ action: 'society.manage', resource: 'SOCIETY' })
  async createGate(
    @Body(new ZodValidationPipe(createGateSchema)) input: CreateGateInput,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Req() request: Request,
  ): Promise<object> {
    return success(
      await this.society.createGate(principal, input, mutationRequestContext(request)),
      requestCorrelationId(request),
    );
  }

  @Patch('gates/:gateId')
  @RequireAnyPermission({ action: 'society.manage', resource: 'SOCIETY' })
  async updateGate(
    @Body(new ZodValidationPipe(updateGateSchema)) input: UpdateGateInput,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('gateId', new ZodValidationPipe(uuidSchema)) gateId: string,
    @Req() request: Request,
  ): Promise<object> {
    return success(
      await this.society.updateGate(
        principal,
        gateId,
        input,
        mutationRequestContext(request),
      ),
      requestCorrelationId(request),
    );
  }
}
