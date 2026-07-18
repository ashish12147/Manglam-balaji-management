import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { uuidSchema } from '@manglam/validation';

import { ApiError } from '../../common/http/api-error.js';
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
  guardEnrollBodySchema,
  guardSignInBodySchema,
  otpRequestBodySchema,
  otpVerifyBodySchema,
  pinUnlockBodySchema,
  profileUpdateBodySchema,
  refreshBodySchema,
  revokeSessionBodySchema,
  sessionListQuerySchema,
  setPinBodySchema,
  type AdminSignInInput,
  type GuardEnrollInput,
  type GuardSignInInput,
  type OtpRequestInput,
  type OtpVerifyInput,
  type PinUnlockInput,
  type ProfileUpdateInput,
  type RefreshInput,
  type SessionListQuery,
  type SetPinInput,
} from './auth.schemas.js';
import { AuthService } from './auth.service.js';
import { CurrentUserService } from './current-user.service.js';
import { GuardAuthService } from './guard-auth.service.js';
import { RefreshCookieService } from './refresh-cookie.service.js';
import { ResidentPinService } from './resident-pin.service.js';
import {
  SessionService,
  type SessionTokenResponse,
} from './session.service.js';

@ApiTags('authentication')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly guards: GuardAuthService,
    private readonly pins: ResidentPinService,
    private readonly sessions: SessionService,
    private readonly cookies: RefreshCookieService,
  ) {}

  @Public()
  @Post('otp/request')
  async requestOtp(
    @Body(new ZodValidationPipe(otpRequestBodySchema)) input: OtpRequestInput,
    @Req() request: Request,
  ): Promise<object> {
    const response = await this.auth.requestOtp(
      input,
      mutationRequestContext(request),
    );
    return success(response, requestCorrelationId(request));
  }

  @Public()
  @Post('otp/verify')
  async verifyOtp(
    @Body(new ZodValidationPipe(otpVerifyBodySchema)) input: OtpVerifyInput,
    @Req() request: Request,
  ): Promise<object> {
    const response = await this.auth.verifyOtp(
      input,
      mutationRequestContext(request),
    );
    return success(response, requestCorrelationId(request));
  }

  @Public()
  @Post('guard/sign-in')
  async guardSignIn(
    @Body(new ZodValidationPipe(guardSignInBodySchema)) input: GuardSignInInput,
    @Req() request: Request,
  ): Promise<object> {
    const response = await this.auth.signInGuard(
      input,
      mutationRequestContext(request),
    );
    return success(response, requestCorrelationId(request));
  }

  @Public()
  @Post('guard/enroll')
  async guardEnroll(
    @Body(new ZodValidationPipe(guardEnrollBodySchema)) input: GuardEnrollInput,
    @Req() request: Request,
  ): Promise<object> {
    const response = await this.guards.enroll(
      input,
      mutationRequestContext(request),
    );
    return success(response, requestCorrelationId(request));
  }

  @Public()
  @Post('admin/sign-in')
  async adminSignIn(
    @Body(new ZodValidationPipe(adminSignInBodySchema)) input: AdminSignInInput,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<object> {
    this.cookies.assertTrustedOrigin(request);
    const tokens = await this.auth.signInAdmin(
      input,
      mutationRequestContext(request),
    );
    this.cookies.set(response, tokens.refreshToken, new Date(tokens.refreshTokenExpiresAt));
    return success(withoutRefreshToken(tokens), requestCorrelationId(request));
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('pin/unlock')
  async unlockPin(
    @Body(new ZodValidationPipe(pinUnlockBodySchema)) input: PinUnlockInput,
    @Req() request: Request,
  ): Promise<object> {
    const response = await this.pins.unlock(
      input,
      mutationRequestContext(request),
    );
    return success(response, requestCorrelationId(request));
  }

  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @Put('pin')
  @RequireAnyPermission({ action: 'account.manage_self', resource: 'SELF' })
  @UseGuards(AccessSessionGuard, PermissionGuard)
  async setPin(
    @Body(new ZodValidationPipe(setPinBodySchema)) input: SetPinInput,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Req() request: Request,
  ): Promise<object> {
    const response = await this.pins.setPin(
      principal,
      input,
      mutationRequestContext(request),
    );
    return success(response, requestCorrelationId(request));
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  async refresh(
    @Body(new ZodValidationPipe(refreshBodySchema)) input: RefreshInput,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<object> {
    const cookie = this.cookies.read(request);
    const refreshToken = cookie.present ? cookie.token : input.refreshToken;
    if (cookie.present) this.cookies.assertTrustedOrigin(request);
    if (!refreshToken) throw authenticationFailure();

    const tokens = await this.sessions.rotate(
      { deviceFingerprint: input.deviceFingerprint, refreshToken },
      mutationRequestContext(request),
    );
    if (cookie.present) {
      this.cookies.set(
        response,
        tokens.refreshToken,
        new Date(tokens.refreshTokenExpiresAt),
      );
    }
    return success(
      cookie.present ? withoutRefreshToken(tokens) : tokens,
      requestCorrelationId(request),
    );
  }

  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @Post('logout')
  @RequireAnyPermission({ action: 'session.revoke_self', resource: 'SELF' })
  @UseGuards(AccessSessionGuard, PermissionGuard)
  async logout(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<object> {
    const cookie = this.cookies.read(request);
    if (cookie.present) this.cookies.assertTrustedOrigin(request);
    const result = await this.sessions.logout(
      principal,
      mutationRequestContext(request),
    );
    this.cookies.clear(response);
    return success(result, requestCorrelationId(request));
  }
}

@ApiBearerAuth()
@ApiTags('current-user')
@Controller(['me', 'users/me'])
@UseGuards(AccessSessionGuard, PermissionGuard)
export class CurrentUserController {
  constructor(
    private readonly currentUsers: CurrentUserService,
    private readonly sessions: SessionService,
  ) {}

  @Get()
  @RequireAnyPermission({ action: 'account.read_self', resource: 'SELF' })
  async getCurrentUser(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Req() request: Request,
  ): Promise<object> {
    return success(
      await this.currentUsers.get(principal),
      requestCorrelationId(request),
    );
  }

  @Patch()
  @RequireAnyPermission({ action: 'account.manage_self', resource: 'SELF' })
  async updateCurrentUser(
    @Body(new ZodValidationPipe(profileUpdateBodySchema)) input: ProfileUpdateInput,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Req() request: Request,
  ): Promise<object> {
    return success(
      await this.currentUsers.update(
        principal,
        input,
        mutationRequestContext(request),
      ),
      requestCorrelationId(request),
    );
  }

  @Get('sessions')
  @RequireAnyPermission({ action: 'session.read_self', resource: 'SELF' })
  async listSessions(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Query(new ZodValidationPipe(sessionListQuerySchema)) query: SessionListQuery,
    @Req() request: Request,
  ): Promise<object> {
    return success(
      await this.sessions.list(principal, query),
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
    return this.revoke(
      body.reason ?? 'Revoked by user',
      principal,
      sessionId,
      request,
    );
  }

  private async revoke(
    reason: string,
    principal: AuthenticatedPrincipal,
    sessionId: string,
    request: Request,
  ): Promise<object> {
    const response = await this.sessions.revokeSession(
      principal,
      uuidSchema.parse(sessionId),
      reason,
      mutationRequestContext(request),
    );
    return success(response, requestCorrelationId(request));
  }
}

@ApiBearerAuth()
@ApiTags('sessions')
@Controller('auth/sessions')
@UseGuards(AccessSessionGuard, PermissionGuard)
export class SessionAliasController {
  constructor(private readonly sessions: SessionService) {}

  @Get()
  @RequireAnyPermission({ action: 'session.read_self', resource: 'SELF' })
  async list(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Query(new ZodValidationPipe(sessionListQuerySchema)) query: SessionListQuery,
    @Req() request: Request,
  ): Promise<object> {
    return success(
      await this.sessions.list(principal, query),
      requestCorrelationId(request),
    );
  }

  @Delete(':sessionId')
  @RequireAnyPermission({ action: 'session.revoke_self', resource: 'SESSION' })
  async revoke(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('sessionId') sessionId: string,
    @Req() request: Request,
  ): Promise<object> {
    const result = await this.sessions.revokeSession(
      principal,
      uuidSchema.parse(sessionId),
      'Revoked by user',
      mutationRequestContext(request),
    );
    return success(result, requestCorrelationId(request));
  }
}

function withoutRefreshToken(tokens: SessionTokenResponse): {
  readonly accessToken: string;
  readonly accessTokenExpiresAt: string;
  readonly sessionId: string;
  readonly tokenType: 'Bearer';
} {
  return {
    accessToken: tokens.accessToken,
    accessTokenExpiresAt: tokens.accessTokenExpiresAt,
    sessionId: tokens.sessionId,
    tokenType: tokens.tokenType,
  };
}

function authenticationFailure(): ApiError {
  return new ApiError({
    code: 'AUTHENTICATION_REQUIRED',
    details: {},
    message: 'The supplied session is invalid.',
    status: HttpStatus.UNAUTHORIZED,
  });
}
