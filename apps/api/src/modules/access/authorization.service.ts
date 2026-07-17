import { HttpStatus, Injectable } from '@nestjs/common';
import {
  authorize,
  type AuthorizationResource,
} from '@manglam/permissions';

import { ApiError } from '../../common/http/api-error.js';
import { DatabaseService } from '../../infrastructure/database/database.service.js';
import type {
  AuthenticatedPrincipal,
  AuthenticatedRequest,
  PermissionRequirement,
  PermissionResourceKind,
} from './access.types.js';

const OBJECT_RESOURCES = new Set<PermissionResourceKind>([
  'APPROVAL',
  'BODY_FLAT',
  'BODY_GATE',
  'FAMILY',
  'MEMBERSHIP',
  'PARAM_FLAT',
  'PARAM_GATE',
  'PREAPPROVAL',
  'SESSION',
  'VISIT',
]);

@Injectable()
export class AuthorizationService {
  constructor(private readonly database: DatabaseService) {}

  async assertAny(
    principal: AuthenticatedPrincipal,
    request: AuthenticatedRequest,
    requirements: readonly PermissionRequirement[],
  ): Promise<void> {
    if (requirements.length === 0) {
      return;
    }

    let hideResource = false;
    for (const requirement of requirements) {
      const resource = await this.resolveResource(principal, request, requirement);
      if (!resource) {
        hideResource ||= OBJECT_RESOURCES.has(requirement.resource);
        continue;
      }

      const reason =
        request.body &&
        typeof request.body === 'object' &&
        'reason' in (request.body as Record<string, unknown>) &&
        typeof (request.body as Record<string, unknown>).reason === 'string'
          ? ((request.body as Record<string, unknown>).reason as string)
          : undefined;
      const decision = authorize({
        action: requirement.action,
        actor: principal.actor,
        recentlyAuthenticated: principal.recentlyAuthenticated,
        reason,
        resource,
      });
      if (decision.allowed) {
        return;
      }
      hideResource ||= OBJECT_RESOURCES.has(requirement.resource);
    }

    if (hideResource) {
      throw new ApiError({
        code: 'RESOURCE_NOT_FOUND',
        details: {},
        message: 'The requested resource was not found.',
        status: HttpStatus.NOT_FOUND,
      });
    }

    throw new ApiError({
      code: 'PERMISSION_DENIED',
      details: {},
      message: 'You do not have permission to perform this action.',
      status: HttpStatus.FORBIDDEN,
    });
  }

  private async resolveResource(
    principal: AuthenticatedPrincipal,
    request: AuthenticatedRequest,
    requirement: PermissionRequirement,
  ): Promise<AuthorizationResource | null> {
    const parameter = requirement.parameter ?? this.defaultParameter(requirement.resource);
    const id = this.resourceId(request, requirement.resource, parameter);

    switch (requirement.resource) {
      case 'SOCIETY':
        return { societyId: principal.societyId };
      case 'SELF':
        return { ownerUserId: principal.user.id, societyId: principal.societyId };
      case 'BODY_FLAT':
      case 'PARAM_FLAT': {
        const flat = id
          ? await this.database.client.flat.findFirst({
              select: { id: true, societyId: true },
              where: { id, societyId: principal.societyId },
            })
          : null;
        return flat ? { flatId: flat.id, societyId: flat.societyId } : null;
      }
      case 'BODY_GATE':
      case 'PARAM_GATE': {
        const gate = id
          ? await this.database.client.gate.findFirst({
              select: { id: true, societyId: true },
              where: { id, societyId: principal.societyId },
            })
          : null;
        return gate ? { gateId: gate.id, societyId: gate.societyId } : null;
      }
      case 'VISIT': {
        const visit = id
          ? await this.database.client.visit.findFirst({
              select: { flatId: true, gateId: true, societyId: true },
              where: { id, societyId: principal.societyId },
            })
          : null;
        return visit
          ? { flatId: visit.flatId, gateId: visit.gateId, societyId: visit.societyId }
          : null;
      }
      case 'APPROVAL': {
        const approval = id
          ? await this.database.client.visitApproval.findFirst({
              select: {
                societyId: true,
                visit: { select: { flatId: true, gateId: true } },
              },
              where: { id, societyId: principal.societyId },
            })
          : null;
        return approval
          ? {
              flatId: approval.visit.flatId,
              gateId: approval.visit.gateId,
              societyId: approval.societyId,
            }
          : null;
      }
      case 'PREAPPROVAL': {
        const preapproval = id
          ? await this.database.client.visitorPreApproval.findFirst({
              select: { flatId: true, societyId: true },
              where: { id, societyId: principal.societyId },
            })
          : null;
        return preapproval
          ? { flatId: preapproval.flatId, societyId: preapproval.societyId }
          : null;
      }
      case 'MEMBERSHIP': {
        const membership = id
          ? await this.database.client.flatMembership.findFirst({
              select: { flatId: true, societyId: true, userId: true },
              where: { id, societyId: principal.societyId },
            })
          : null;
        return membership
          ? {
              flatId: membership.flatId,
              ownerUserId: membership.userId,
              societyId: membership.societyId,
            }
          : null;
      }
      case 'FAMILY': {
        const family = id
          ? await this.database.client.familyMember.findFirst({
              select: { flatId: true, societyId: true },
              where: { id, societyId: principal.societyId },
            })
          : null;
        return family
          ? { flatId: family.flatId, societyId: family.societyId }
          : null;
      }
      case 'SESSION': {
        const session = id
          ? await this.database.client.userSession.findFirst({
              select: { societyId: true, userId: true },
              where: { id, societyId: principal.societyId },
            })
          : null;
        return session
          ? { ownerUserId: session.userId, societyId: session.societyId }
          : null;
      }
    }
  }

  private defaultParameter(resource: PermissionResourceKind): string {
    switch (resource) {
      case 'APPROVAL':
        return 'approvalId';
      case 'FAMILY':
        return 'familyMemberId';
      case 'MEMBERSHIP':
        return 'membershipId';
      case 'PREAPPROVAL':
        return 'preapprovalId';
      case 'SESSION':
        return 'sessionId';
      case 'VISIT':
        return 'visitId';
      case 'BODY_FLAT':
      case 'PARAM_FLAT':
        return 'flatId';
      case 'BODY_GATE':
      case 'PARAM_GATE':
        return 'gateId';
      case 'SELF':
      case 'SOCIETY':
        return '';
    }
  }

  private resourceId(
    request: AuthenticatedRequest,
    resource: PermissionResourceKind,
    parameter: string,
  ): string | undefined {
    const value =
      resource.startsWith('BODY_') && request.body && typeof request.body === 'object'
        ? (request.body as Record<string, unknown>)[parameter]
        : request.params[parameter];
    return typeof value === 'string' ? value : undefined;
  }
}
