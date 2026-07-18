import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';

import { ZodValidationPipe } from '../../common/http/zod-validation.pipe.js';
import { CurrentPrincipal, RequireAnyPermission } from '../access/access.decorators.js';
import { AccessSessionGuard } from '../access/access-session.guard.js';
import type { AuthenticatedPrincipal } from '../access/access.types.js';
import { PermissionGuard } from '../access/permission.guard.js';
import { success } from '../platform/api-response.js';
import { mutationRequestContext, requestCorrelationId } from '../platform/request-context.js';
import {
  allocationCreateSchema,
  complaintAssignSchema,
  complaintNoteSchema,
  complaintTransitionSchema,
  emergencyResolveSchema,
  emergencyResponseSchema,
  noticeCreateSchema,
  operationsListQuerySchema,
  paymentCreateSchema,
  operationsUuidSchema as uuidSchema,
  reasonSchema,
  roleCreateSchema,
  type AllocationCreateInput,
  type ComplaintAssignInput,
  type ComplaintNoteInput,
  type ComplaintTransitionInput,
  type EmergencyResolveInput,
  type EmergencyResponseInput,
  type NoticeCreateInput,
  type OperationsListQuery,
  type PaymentCreateInput,
  type RoleCreateInput,
} from './operations.schemas.js';
import { OperationsService } from './operations.service.js';

@ApiBearerAuth()
@ApiTags('operations')
@Controller()
@UseGuards(AccessSessionGuard, PermissionGuard)
export class OperationsController {
  constructor(private readonly operations: OperationsService) {}

  @Get('admin/dashboard')
  @RequireAnyPermission({ action: 'society.read', resource: 'SOCIETY' })
  async dashboard(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Req() request: Request,
  ): Promise<object> {
    return success(await this.operations.dashboard(principal), requestCorrelationId(request));
  }

  @Get('users')
  @RequireAnyPermission({ action: 'resident.read_all', resource: 'SOCIETY' })
  listUsers(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Query(new ZodValidationPipe(operationsListQuerySchema)) query: OperationsListQuery,
    @Req() request: Request,
  ): Promise<object> {
    return this.respond(this.operations.users(principal, query), request);
  }

  @Get('family-members')
  @RequireAnyPermission({ action: 'membership.read_flat', resource: 'SOCIETY' })
  listFamily(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Query(new ZodValidationPipe(operationsListQuerySchema)) query: OperationsListQuery,
    @Req() request: Request,
  ): Promise<object> {
    return this.respond(this.operations.family(principal, query), request);
  }

  @Get('guards')
  @RequireAnyPermission({ action: 'guard.manage', resource: 'SOCIETY' })
  listGuards(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Query(new ZodValidationPipe(operationsListQuerySchema)) query: OperationsListQuery,
    @Req() request: Request,
  ): Promise<object> {
    return this.respond(this.operations.guards(principal, query), request);
  }

  @Get('guards/devices')
  @RequireAnyPermission({ action: 'guard.device_enroll', resource: 'SOCIETY' })
  listGuardDevices(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Query(new ZodValidationPipe(operationsListQuerySchema)) query: OperationsListQuery,
    @Req() request: Request,
  ): Promise<object> {
    return this.respond(this.operations.guardDevices(principal, query), request);
  }

  @Get('visitors/visits')
  @RequireAnyPermission({ action: 'visitor.read_all', resource: 'SOCIETY' })
  listVisits(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Query(new ZodValidationPipe(operationsListQuerySchema)) query: OperationsListQuery,
    @Req() request: Request,
  ): Promise<object> {
    return this.respond(this.operations.visits(principal, query), request);
  }

  @Get('visitors/approvals')
  @RequireAnyPermission({ action: 'visitor.read_all', resource: 'SOCIETY' })
  listVisitApprovals(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Query(new ZodValidationPipe(operationsListQuerySchema)) query: OperationsListQuery,
    @Req() request: Request,
  ): Promise<object> {
    return this.respond(this.operations.visitApprovals(principal, query), request);
  }

  @Get('visitors/pre-approvals')
  @RequireAnyPermission({ action: 'visitor.read_all', resource: 'SOCIETY' })
  listPreApprovals(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Query(new ZodValidationPipe(operationsListQuerySchema)) query: OperationsListQuery,
    @Req() request: Request,
  ): Promise<object> {
    return this.respond(this.operations.preApprovals(principal, query), request);
  }

  @Get('visitors/overrides')
  @RequireAnyPermission({ action: 'visitor.override', resource: 'SOCIETY' })
  listOverrides(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Query(new ZodValidationPipe(operationsListQuerySchema)) query: OperationsListQuery,
    @Req() request: Request,
  ): Promise<object> {
    return this.respond(this.operations.visitorOverrides(principal, query), request);
  }

  @Get('visitors/events')
  @RequireAnyPermission({ action: 'visitor.read_all', resource: 'SOCIETY' })
  listVisitorEvents(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Query(new ZodValidationPipe(operationsListQuerySchema)) query: OperationsListQuery,
    @Req() request: Request,
  ): Promise<object> {
    return this.respond(this.operations.visitorEvents(principal, query), request);
  }

  @Get('daily-help')
  @RequireAnyPermission({ action: 'daily_help.manage', resource: 'SOCIETY' })
  listDailyHelp(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Query(new ZodValidationPipe(operationsListQuerySchema)) query: OperationsListQuery,
    @Req() request: Request,
  ): Promise<object> {
    return this.respond(this.operations.dailyHelp(principal, query), request);
  }

  @Get('daily-help/assignments')
  @RequireAnyPermission({ action: 'daily_help.manage_assignment', resource: 'SOCIETY' })
  listDailyHelpAssignments(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Query(new ZodValidationPipe(operationsListQuerySchema)) query: OperationsListQuery,
    @Req() request: Request,
  ): Promise<object> {
    return this.respond(this.operations.dailyHelpAssignments(principal, query), request);
  }

  @Get('daily-help/attendance')
  @RequireAnyPermission({ action: 'daily_help.attendance', resource: 'SOCIETY' })
  listDailyHelpAttendance(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Query(new ZodValidationPipe(operationsListQuerySchema)) query: OperationsListQuery,
    @Req() request: Request,
  ): Promise<object> {
    return this.respond(this.operations.dailyHelpAttendance(principal, query), request);
  }

  @Get('parcels')
  @RequireAnyPermission({ action: 'parcel.read_all', resource: 'SOCIETY' })
  listParcels(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Query(new ZodValidationPipe(operationsListQuerySchema)) query: OperationsListQuery,
    @Req() request: Request,
  ): Promise<object> {
    return this.respond(this.operations.parcels(principal, query), request);
  }

  @Get('notices')
  @RequireAnyPermission({ action: 'notice.read', resource: 'SOCIETY' })
  listNotices(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Query(new ZodValidationPipe(operationsListQuerySchema)) query: OperationsListQuery,
    @Req() request: Request,
  ): Promise<object> {
    return this.respond(this.operations.notices(principal, query), request);
  }

  @Get('notices/acknowledgements')
  @RequireAnyPermission({ action: 'notice.read', resource: 'SOCIETY' })
  listNoticeAcknowledgements(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Query(new ZodValidationPipe(operationsListQuerySchema)) query: OperationsListQuery,
    @Req() request: Request,
  ): Promise<object> {
    return this.respond(this.operations.noticeAcknowledgements(principal, query), request);
  }

  @Post('notices')
  @RequireAnyPermission({ action: 'notice.create', resource: 'SOCIETY' })
  async createNotice(
    @Body(new ZodValidationPipe(noticeCreateSchema)) input: NoticeCreateInput,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Req() request: Request,
  ): Promise<object> {
    return success(
      await this.operations.createNotice(principal, input, mutationRequestContext(request)),
      requestCorrelationId(request),
    );
  }

  @Post('notices/:noticeId/publish')
  @RequireAnyPermission({ action: 'notice.publish', resource: 'SOCIETY' })
  async publishNotice(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('noticeId', new ZodValidationPipe(uuidSchema)) noticeId: string,
    @Req() request: Request,
  ): Promise<object> {
    return success(
      await this.operations.publishNotice(principal, noticeId, mutationRequestContext(request)),
      requestCorrelationId(request),
    );
  }

  @Post('notices/:noticeId/archive')
  @RequireAnyPermission({ action: 'notice.manage', resource: 'SOCIETY' })
  async archiveNotice(
    @Body(new ZodValidationPipe(reasonSchema)) input: { reason: string },
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('noticeId', new ZodValidationPipe(uuidSchema)) noticeId: string,
    @Req() request: Request,
  ): Promise<object> {
    return success(
      await this.operations.archiveNotice(
        principal,
        noticeId,
        input.reason,
        mutationRequestContext(request),
      ),
      requestCorrelationId(request),
    );
  }
  @Get('complaints')
  @RequireAnyPermission({ action: 'complaint.read_all', resource: 'SOCIETY' })
  listComplaints(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Query(new ZodValidationPipe(operationsListQuerySchema)) query: OperationsListQuery,
    @Req() request: Request,
  ): Promise<object> {
    return this.respond(this.operations.complaints(principal, query), request);
  }

  @Post('complaints/:complaintId/assign')
  @RequireAnyPermission({ action: 'complaint.assign', resource: 'SOCIETY' })
  async assignComplaint(
    @Body(new ZodValidationPipe(complaintAssignSchema)) input: ComplaintAssignInput,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('complaintId', new ZodValidationPipe(uuidSchema)) complaintId: string,
    @Req() request: Request,
  ): Promise<object> {
    return success(
      await this.operations.assignComplaint(
        principal,
        complaintId,
        input,
        mutationRequestContext(request),
      ),
      requestCorrelationId(request),
    );
  }

  @Post('complaints/:complaintId/transition')
  @RequireAnyPermission({ action: 'complaint.update', resource: 'SOCIETY' })
  async transitionComplaint(
    @Body(new ZodValidationPipe(complaintTransitionSchema)) input: ComplaintTransitionInput,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('complaintId', new ZodValidationPipe(uuidSchema)) complaintId: string,
    @Req() request: Request,
  ): Promise<object> {
    return success(
      await this.operations.transitionComplaint(
        principal,
        complaintId,
        input,
        mutationRequestContext(request),
      ),
      requestCorrelationId(request),
    );
  }

  @Post('complaints/:complaintId/internal-notes')
  @RequireAnyPermission({ action: 'complaint.internal_note', resource: 'SOCIETY' })
  async addComplaintNote(
    @Body(new ZodValidationPipe(complaintNoteSchema)) input: ComplaintNoteInput,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('complaintId', new ZodValidationPipe(uuidSchema)) complaintId: string,
    @Req() request: Request,
  ): Promise<object> {
    return success(
      await this.operations.addComplaintInternalNote(
        principal,
        complaintId,
        input,
        mutationRequestContext(request),
      ),
      requestCorrelationId(request),
    );
  }

  @Get('maintenance/charge-batches')
  @RequireAnyPermission({ action: 'dues.read_all', resource: 'SOCIETY' })
  listChargeBatches(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Query(new ZodValidationPipe(operationsListQuerySchema)) query: OperationsListQuery,
    @Req() request: Request,
  ): Promise<object> {
    return this.respond(this.operations.chargeBatches(principal, query), request);
  }

  @Get('maintenance/charges')
  @RequireAnyPermission({ action: 'dues.read_all', resource: 'SOCIETY' })
  listCharges(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Query(new ZodValidationPipe(operationsListQuerySchema)) query: OperationsListQuery,
    @Req() request: Request,
  ): Promise<object> {
    return this.respond(this.operations.charges(principal, query), request);
  }

  @Get('maintenance/payments')
  @RequireAnyPermission({ action: 'payment.read_all', resource: 'SOCIETY' })
  listPayments(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Query(new ZodValidationPipe(operationsListQuerySchema)) query: OperationsListQuery,
    @Req() request: Request,
  ): Promise<object> {
    return this.respond(this.operations.payments(principal, query), request);
  }

  @Post('maintenance/payments')
  @RequireAnyPermission({ action: 'payment.record', resource: 'SOCIETY' })
  async recordPayment(
    @Body(new ZodValidationPipe(paymentCreateSchema)) input: PaymentCreateInput,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Req() request: Request,
  ): Promise<object> {
    return success(
      await this.operations.recordPayment(principal, input, mutationRequestContext(request)),
      requestCorrelationId(request),
    );
  }

  @Get('maintenance/allocations')
  @RequireAnyPermission({ action: 'payment.read_all', resource: 'SOCIETY' })
  listAllocations(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Query(new ZodValidationPipe(operationsListQuerySchema)) query: OperationsListQuery,
    @Req() request: Request,
  ): Promise<object> {
    return this.respond(this.operations.allocations(principal, query), request);
  }

  @Post('maintenance/allocations')
  @RequireAnyPermission({ action: 'payment.record', resource: 'SOCIETY' })
  async allocatePayment(
    @Body(new ZodValidationPipe(allocationCreateSchema)) input: AllocationCreateInput,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Req() request: Request,
  ): Promise<object> {
    return success(
      await this.operations.allocatePayment(principal, input, mutationRequestContext(request)),
      requestCorrelationId(request),
    );
  }

  @Get('maintenance/receipts')
  @RequireAnyPermission({ action: 'receipt.read_all', resource: 'SOCIETY' })
  listReceipts(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Query(new ZodValidationPipe(operationsListQuerySchema)) query: OperationsListQuery,
    @Req() request: Request,
  ): Promise<object> {
    return this.respond(this.operations.receipts(principal, query), request);
  }

  @Get('maintenance/reversals')
  @RequireAnyPermission({ action: 'payment.reverse', resource: 'SOCIETY' })
  listReversals(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Query(new ZodValidationPipe(operationsListQuerySchema)) query: OperationsListQuery,
    @Req() request: Request,
  ): Promise<object> {
    return this.respond(this.operations.reversals(principal, query), request);
  }
  @Get('emergencies')
  @RequireAnyPermission({ action: 'emergency.read_active', resource: 'SOCIETY' })
  listEmergencies(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Query(new ZodValidationPipe(operationsListQuerySchema)) query: OperationsListQuery,
    @Req() request: Request,
  ): Promise<object> {
    return this.respond(this.operations.emergencies(principal, query), request);
  }

  @Post('emergencies/:alertId/acknowledge')
  @RequireAnyPermission({ action: 'emergency.acknowledge', resource: 'SOCIETY' })
  async acknowledgeEmergency(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('alertId', new ZodValidationPipe(uuidSchema)) alertId: string,
    @Req() request: Request,
  ): Promise<object> {
    return success(
      await this.operations.acknowledgeEmergency(
        principal,
        alertId,
        mutationRequestContext(request),
      ),
      requestCorrelationId(request),
    );
  }

  @Post('emergencies/:alertId/respond')
  @RequireAnyPermission({ action: 'emergency.respond', resource: 'SOCIETY' })
  async respondEmergency(
    @Body(new ZodValidationPipe(emergencyResponseSchema)) input: EmergencyResponseInput,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('alertId', new ZodValidationPipe(uuidSchema)) alertId: string,
    @Req() request: Request,
  ): Promise<object> {
    return success(
      await this.operations.respondEmergency(
        principal,
        alertId,
        input,
        mutationRequestContext(request),
      ),
      requestCorrelationId(request),
    );
  }

  @Post('emergencies/:alertId/resolve')
  @RequireAnyPermission({ action: 'emergency.resolve', resource: 'SOCIETY' })
  async resolveEmergency(
    @Body(new ZodValidationPipe(emergencyResolveSchema)) input: EmergencyResolveInput,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('alertId', new ZodValidationPipe(uuidSchema)) alertId: string,
    @Req() request: Request,
  ): Promise<object> {
    return success(
      await this.operations.resolveEmergency(
        principal,
        alertId,
        input,
        mutationRequestContext(request),
      ),
      requestCorrelationId(request),
    );
  }

  @Get('roles')
  @RequireAnyPermission({ action: 'role.read', resource: 'SOCIETY' })
  listRoles(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Query(new ZodValidationPipe(operationsListQuerySchema)) query: OperationsListQuery,
    @Req() request: Request,
  ): Promise<object> {
    return this.respond(this.operations.roles(principal, query), request);
  }

  @Get('roles/permissions')
  @RequireAnyPermission({ action: 'role.read', resource: 'SOCIETY' })
  listPermissions(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Query(new ZodValidationPipe(operationsListQuerySchema)) query: OperationsListQuery,
    @Req() request: Request,
  ): Promise<object> {
    return this.respond(this.operations.permissions(principal, query), request);
  }

  @Post('roles')
  @RequireAnyPermission({ action: 'role.manage', resource: 'SOCIETY' })
  async createRole(
    @Body(new ZodValidationPipe(roleCreateSchema)) input: RoleCreateInput,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Req() request: Request,
  ): Promise<object> {
    return success(
      await this.operations.createRole(principal, input, mutationRequestContext(request)),
      requestCorrelationId(request),
    );
  }

  @Post('roles/:roleId/deactivate')
  @RequireAnyPermission({ action: 'role.manage', resource: 'SOCIETY' })
  async deactivateRole(
    @Body(new ZodValidationPipe(reasonSchema)) input: { reason: string },
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('roleId', new ZodValidationPipe(uuidSchema)) roleId: string,
    @Req() request: Request,
  ): Promise<object> {
    return success(
      await this.operations.deactivateRole(
        principal,
        roleId,
        input.reason,
        mutationRequestContext(request),
      ),
      requestCorrelationId(request),
    );
  }

  @Get('audit')
  @RequireAnyPermission({ action: 'audit.read', resource: 'SOCIETY' })
  listAudit(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Query(new ZodValidationPipe(operationsListQuerySchema)) query: OperationsListQuery,
    @Req() request: Request,
  ): Promise<object> {
    return this.respond(this.operations.audit(principal, query), request);
  }

  @Get('notifications/deliveries')
  @RequireAnyPermission({ action: 'notification.diagnostics', resource: 'SOCIETY' })
  listDeliveries(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Query(new ZodValidationPipe(operationsListQuerySchema)) query: OperationsListQuery,
    @Req() request: Request,
  ): Promise<object> {
    return this.respond(this.operations.deliveries(principal, query), request);
  }

  @Post('notifications/deliveries/:deliveryId/retry')
  @RequireAnyPermission({ action: 'notification.diagnostics', resource: 'SOCIETY' })
  async retryDelivery(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('deliveryId', new ZodValidationPipe(uuidSchema)) deliveryId: string,
    @Req() request: Request,
  ): Promise<object> {
    return success(
      await this.operations.retryDelivery(principal, deliveryId, mutationRequestContext(request)),
      requestCorrelationId(request),
    );
  }

  private async respond(result: Promise<object>, request: Request): Promise<object> {
    return success(await result, requestCorrelationId(request));
  }
}
