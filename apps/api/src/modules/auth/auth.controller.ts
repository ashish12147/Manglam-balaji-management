import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
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
  Public,
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
  adminSignInBodySchema,
  guardSignInBodySchema,
  otpRequestBodySchema,
  otpVerifyBodySchema,
  refreshBodySchema,
  revokeSessionBodySchema,
  type AdminSignInInput,
  type GuardSignInInput,
  type OtpRequestInput,
  type OtpVerifyInput,
  type RefreshInput,
} from './auth.schemas.js';
import { AuthService } from './auth.service.js';
import { SessionService } from './session.service.js';

@ApiTags('authentication')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly sessions: SessionService,
  ) {}

  @Public()
  @Post('otp/request')
  async requestOtp(
    @Body(new ZodValidationPipe(otpRequestBodySchema)) input: OtpRequestInput,
    @Req() request: Request,
  ): Promise<object> {
    const response = await this.auth.requestOtp(input, mutationRequestContext(request));
    return success(response, requestCorrelationId(request));
  }

  @Public()
  @Post('otp/verify')
  async verifyOtp(
    @Body(new ZodValidationPipe(otpVerifyBodySchema)) input: OtpVerifyInput,
    @Req() request: Request,
  ): Promise<object> {
    const response = await this.auth.verifyOtp(input, mutationRequestContext(request));
    return success(response, requestCorrelationId(request));
  }

  @Public()
  @Post('guard/sign-in')
  async guardSignIn(
    @Body(new ZodValidationPipe(guardSignInBodySchema)) input: GuardSignInInput,
    @Req() request: Request,
  ): Promise<object> {
    const response = await this.auth.signInGuard(input, mutationRequestContext(request));
    return success(response, requestCorrelationId(request));
  }

  @Public()
  @Post('admin/sign-in')
  async adminSignIn(
    @Body(new ZodValidationPipe(adminSignInBodySchema)) input: AdminSignInInput,
    @Req() request: Request,
  ): Promise<object> {
    const response = await this.auth.signInAdmin(input, mutationRequestContext(request));
    return success(response, requestCorrelationId(request));
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  async refresh(
    @Body(new ZodValidationPipe(refreshBodySchema)) input: RefreshInput,
    @Req() request: Request,
  ): Promise<object> {
    const response = await this.sessions.rotate(input, mutationRequestContext(request));
    return success(response, requestCorrelationId(request));
  }

  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @Post('logout')
  @RequireAnyPermission({ action: 'session.revoke_self', resource: 'SELF' })
  @UseGuards(AccessSessionGuard, PermissionGuard)
  async logout(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Req() request: Request,
  ): Promise<object> {
    const response = await this.sessions.logout(
      principal,
      mutationRequestContext(request),
    );
    return success(response, requestCorrelationId(request));
  }
}

@ApiBearerAuth()
@ApiTags('current-user')
@Controller('me')
@UseGuards(AccessSessionGuard, PermissionGuard)
export class CurrentUserController {
  constructor(private readonly sessions: SessionService) {}

  @Get()
  @RequireAnyPermission({ action: 'account.read_self', resource: 'SELF' })
  getCurrentUser(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Req() request: Request,
  ): object {
    return success(
      {
        deviceId: principal.deviceId,
        effectivePermissions: principal.effectivePermissions,
        memberships: principal.memberships,
        roleCodes: principal.roleCodes,
        sessionId: principal.sessionId,
        sessionKind: principal.sessionKind,
        societyId: principal.societyId,
        user: principal.user,
      },
      requestCorrelationId(request),
    );
  }

  @Get('sessions')
  @RequireAnyPermission({ action: 'session.read_self', resource: 'SELF' })
  async listSessions(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Req() request: Request,
  ): Promise<object> {
    return success(
      await this.sessions.list(principal),
      requestCorrelationId(request),
    );
  }

  @Post('sessions/:sessionId/revoke')
  @RequireAnyPermission({ action: 'session.revoke_self', resource: 'SESSION' })
  async revokeSession(
    @Body(new ZodValidationPipe(revokeSessionBodySchema))
    body: { readonly reason?: string },
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('sessionId') sessionId: string,
    @Req() request: Request,
  ): Promise<object> {
    const id = uuidSchema.parse(sessionId);
    const response = await this.sessions.revokeSession(
      principal,
      id,
      body.reason ?? 'Revoked by user',
      mutationRequestContext(request),
    );
    return success(response, requestCorrelationId(request));
  }
}
