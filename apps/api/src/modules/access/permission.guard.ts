import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import {
  PERMISSION_REQUIREMENTS,
  PUBLIC_ROUTE,
} from './access.decorators.js';
import type {
  AuthenticatedRequest,
  PermissionRequirement,
} from './access.types.js';
import { AuthorizationService } from './authorization.service.js';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authorization: AuthorizationService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_ROUTE, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const requirements =
      this.reflector.getAllAndOverride<readonly PermissionRequirement[]>(
        PERMISSION_REQUIREMENTS,
        [context.getHandler(), context.getClass()],
      ) ?? [];
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    await this.authorization.assertAny(request.principal, request, requirements);
    return true;
  }
}
