import { createParamDecorator, SetMetadata, type ExecutionContext } from '@nestjs/common';

import type {
  AuthenticatedPrincipal,
  AuthenticatedRequest,
  PermissionRequirement,
} from './access.types.js';

export const PUBLIC_ROUTE = Symbol('PUBLIC_ROUTE');
export const PERMISSION_REQUIREMENTS = Symbol('PERMISSION_REQUIREMENTS');

export const Public = (): MethodDecorator & ClassDecorator =>
  SetMetadata(PUBLIC_ROUTE, true);

export const RequireAnyPermission = (
  ...requirements: readonly PermissionRequirement[]
): MethodDecorator & ClassDecorator =>
  SetMetadata(PERMISSION_REQUIREMENTS, requirements);

export const CurrentPrincipal = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedPrincipal =>
    context.switchToHttp().getRequest<AuthenticatedRequest>().principal,
);
