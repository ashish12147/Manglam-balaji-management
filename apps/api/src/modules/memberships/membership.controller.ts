import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { cursorQuerySchema, uuidSchema } from '@manglam/validation';

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
  createFamilyMemberSchema,
  membershipDecisionSchema,
  requestMembershipSchema,
  updateFamilyMemberSchema,
  type CreateFamilyMemberInput,
  type MembershipDecisionInput,
  type RequestMembershipInput,
  type UpdateFamilyMemberInput,
} from './membership.schemas.js';
import { MembershipService } from './membership.service.js';

interface CursorQuery {
  readonly cursor?: string;
  readonly limit: number;
}

@ApiBearerAuth()
@ApiTags('memberships')
@Controller('memberships')
@UseGuards(AccessSessionGuard, PermissionGuard)
export class MembershipController {
  constructor(private readonly memberships: MembershipService) {}

  @Get('me')
  @RequireAnyPermission({ action: 'account.read_self', resource: 'SELF' })
  async mine(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Query(new ZodValidationPipe(cursorQuerySchema)) query: CursorQuery,
    @Req() request: Request,
  ): Promise<object> {
    return success(
      await this.memberships.listMine(principal, query),
      requestCorrelationId(request),
    );
  }

  @Get('flat/:flatId')
  @RequireAnyPermission({ action: 'membership.read_flat', resource: 'PARAM_FLAT' })
  async byFlat(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('flatId', new ZodValidationPipe(uuidSchema)) flatId: string,
    @Query(new ZodValidationPipe(cursorQuerySchema)) query: CursorQuery,
    @Req() request: Request,
  ): Promise<object> {
    return success(
      await this.memberships.listByFlat(principal, flatId, query),
      requestCorrelationId(request),
    );
  }

  @Get()
  @RequireAnyPermission({ action: 'resident.read_all', resource: 'SOCIETY' })
  async all(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Query(new ZodValidationPipe(cursorQuerySchema)) query: CursorQuery,
    @Req() request: Request,
  ): Promise<object> {
    return success(
      await this.memberships.listAll(principal, query),
      requestCorrelationId(request),
    );
  }

  @Post('requests')
  @RequireAnyPermission({ action: 'membership.request', resource: 'SELF' })
  async requestMembership(
    @Body(new ZodValidationPipe(requestMembershipSchema)) input: RequestMembershipInput,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Req() request: Request,
  ): Promise<object> {
    return success(
      await this.memberships.request(principal, input, mutationRequestContext(request)),
      requestCorrelationId(request),
    );
  }

  @Post(':membershipId/approve')
  @RequireAnyPermission({ action: 'membership.approve', resource: 'SOCIETY' })
  approve(
    @Body(new ZodValidationPipe(membershipDecisionSchema)) input: MembershipDecisionInput,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('membershipId', new ZodValidationPipe(uuidSchema)) membershipId: string,
    @Req() request: Request,
  ): Promise<object> {
    return this.transition(principal, membershipId, 'APPROVED', input, request);
  }

  @Post(':membershipId/reject')
  @RequireAnyPermission({ action: 'membership.reject', resource: 'SOCIETY' })
  reject(
    @Body(new ZodValidationPipe(membershipDecisionSchema)) input: MembershipDecisionInput,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('membershipId', new ZodValidationPipe(uuidSchema)) membershipId: string,
    @Req() request: Request,
  ): Promise<object> {
    return this.transition(principal, membershipId, 'REJECTED', input, request);
  }

  @Post(':membershipId/suspend')
  @RequireAnyPermission({ action: 'membership.suspend', resource: 'SOCIETY' })
  suspend(
    @Body(new ZodValidationPipe(membershipDecisionSchema)) input: MembershipDecisionInput,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('membershipId', new ZodValidationPipe(uuidSchema)) membershipId: string,
    @Req() request: Request,
  ): Promise<object> {
    return this.transition(principal, membershipId, 'SUSPENDED', input, request);
  }

  @Post(':membershipId/end')
  @RequireAnyPermission({ action: 'membership.end', resource: 'MEMBERSHIP' })
  end(
    @Body(new ZodValidationPipe(membershipDecisionSchema)) input: MembershipDecisionInput,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('membershipId', new ZodValidationPipe(uuidSchema)) membershipId: string,
    @Req() request: Request,
  ): Promise<object> {
    return this.transition(principal, membershipId, 'ENDED', input, request);
  }

  @Get(':membershipId/family')
  @RequireAnyPermission({ action: 'membership.read_flat', resource: 'MEMBERSHIP' })
  async family(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('membershipId', new ZodValidationPipe(uuidSchema)) membershipId: string,
    @Req() request: Request,
  ): Promise<object> {
    return success(
      await this.memberships.listFamily(principal, membershipId),
      requestCorrelationId(request),
    );
  }

  @Post(':membershipId/family')
  @RequireAnyPermission({ action: 'membership.manage_flat', resource: 'MEMBERSHIP' })
  async createFamilyMember(
    @Body(new ZodValidationPipe(createFamilyMemberSchema)) input: CreateFamilyMemberInput,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('membershipId', new ZodValidationPipe(uuidSchema)) membershipId: string,
    @Req() request: Request,
  ): Promise<object> {
    return success(
      await this.memberships.createFamilyMember(
        principal,
        membershipId,
        input,
        mutationRequestContext(request),
      ),
      requestCorrelationId(request),
    );
  }

  @Patch('family/:familyMemberId')
  @RequireAnyPermission({ action: 'membership.manage_flat', resource: 'FAMILY' })
  async updateFamilyMember(
    @Body(new ZodValidationPipe(updateFamilyMemberSchema)) input: UpdateFamilyMemberInput,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('familyMemberId', new ZodValidationPipe(uuidSchema)) familyMemberId: string,
    @Req() request: Request,
  ): Promise<object> {
    return success(
      await this.memberships.updateFamilyMember(
        principal,
        familyMemberId,
        input,
        mutationRequestContext(request),
      ),
      requestCorrelationId(request),
    );
  }

  private async transition(
    principal: AuthenticatedPrincipal,
    membershipId: string,
    target: 'APPROVED' | 'REJECTED' | 'SUSPENDED' | 'ENDED',
    input: MembershipDecisionInput,
    request: Request,
  ): Promise<object> {
    return success(
      await this.memberships.transition(
        principal,
        membershipId,
        target,
        input,
        mutationRequestContext(request),
      ),
      requestCorrelationId(request),
    );
  }
}
