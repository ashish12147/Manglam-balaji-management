import { CanActivate, ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { ApiError } from '../../common/http/api-error.js';
import { AccessTokenService } from '../security/access-token.service.js';
import { PUBLIC_ROUTE } from './access.decorators.js';
import type { AuthenticatedRequest } from './access.types.js';
import { CurrentIdentityService } from './current-identity.service.js';

@Injectable()
export class AccessSessionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: AccessTokenService,
    private readonly identities: CurrentIdentityService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_ROUTE, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = request.headers.authorization;
    const fingerprintHeader = request.headers['x-device-fingerprint'];
    const fingerprint = Array.isArray(fingerprintHeader) ? fingerprintHeader[0] : fingerprintHeader;

    if (
      !authorization?.startsWith('Bearer ') ||
      typeof fingerprint !== 'string' ||
      fingerprint.length < 32 ||
      fingerprint.length > 256
    ) {
      throw this.unauthorized();
    }

    try {
      const claims = await this.tokens.verify(authorization.slice('Bearer '.length));
      request.principal = await this.identities.load(claims, fingerprint);
      return true;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw this.unauthorized();
    }
  }

  private unauthorized(): ApiError {
    return new ApiError({
      code: 'AUTHENTICATION_REQUIRED',
      details: {},
      message: 'A valid active session is required.',
      status: HttpStatus.UNAUTHORIZED,
    });
  }
}
