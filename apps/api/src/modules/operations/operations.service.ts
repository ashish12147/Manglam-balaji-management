import { HttpStatus, Injectable } from '@nestjs/common';
import {
  ComplaintStatus,
  DeliveryStatus,
  EmergencyEventType,
  EmergencyStatus,
  NoticeStatus,
  PaymentStatus,
  Prisma,
  RecordStatus,
} from '@manglam/database';

import { ApiError } from '../../common/http/api-error.js';
import { DatabaseService } from '../../infrastructure/database/database.service.js';
import type { AuthenticatedPrincipal } from '../access/access.types.js';
import { principalActor } from '../auth/session.service.js';
import { decodeCursor, pageResult } from '../platform/cursor.js';
import { MutationJournalService } from '../platform/mutation-journal.service.js';
import { NOTIFICATION_DISPATCH_EVENT } from '../platform/outbox-contracts.js';
import type { MutationRequestContext } from '../platform/request-context.js';
import type {
  AllocationCreateInput,
  ComplaintAssignInput,
  ComplaintNoteInput,
  ComplaintTransitionInput,
  EmergencyResolveInput,
  EmergencyResponseInput,
  NoticeCreateInput,
  OperationsListQuery,
  PaymentCreateInput,
  RoleCreateInput,
} from './operations.schemas.js';

type PageWhere = Record<string, unknown>;
interface NoticeAudienceTarget {
  readonly blockId?: string;
  readonly flatId?: string;
  readonly roleId?: string;
  readonly type: NoticeCreateInput['audienceType'];
}

@Injectable()
export class OperationsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly journal: MutationJournalService,
  ) {}

  async dashboard(principal: AuthenticatedPrincipal): Promise<object> {
    const since = new Date(Date.now() - 24 * 60 * 60_000);
    const societyId = principal.societyId;
    const [
      activeResidents,
      pendingMemberships,
      activeGuards,
      activeGateActivity,
      openComplaints,
      activeEmergencies,
      failedDeliveries,
      unpaid,
      recentVisitorActivity,
      auditAlerts,
      recentGateActivity,
    ] = await Promise.all([
      this.database.client.user.count({
        where: { guardProfile: null, societyId, status: 'ACTIVE' },
      }),
      this.database.client.flatMembership.count({ where: { societyId, status: 'PENDING' } }),
      this.database.client.guardProfile.count({ where: { societyId, status: 'ACTIVE' } }),
      this.database.client.visit.count({
        where: {
          societyId,
          status: 'CHECKED_IN',
        },
      }),
      this.database.client.complaint.count({
        where: { societyId, status: { notIn: ['RESOLVED', 'CLOSED', 'CANCELLED'] } },
      }),
      this.database.client.emergencyAlert.count({
        where: { societyId, status: { in: ['ACTIVE', 'ACKNOWLEDGED', 'RESPONDING'] } },
      }),
      this.database.client.notificationDelivery.count({
        where: { societyId, status: DeliveryStatus.FAILED },
      }),
      this.database.client.maintenanceCharge.aggregate({
        _count: true,
        _sum: { paidAmount: true, totalAmount: true },
        where: { societyId, status: { in: ['UNPAID', 'PARTIALLY_PAID'] } },
      }),
      this.database.client.visit.count({
        where: { createdAt: { gte: since }, societyId },
      }),
      this.database.client.auditLog.count({
        where: { occurredAt: { gte: since }, outcome: { not: 'SUCCESS' }, societyId },
      }),
      this.database.client.visitEvent.findMany({
        include: {
          visit: {
            include: {
              flat: { include: { block: true } },
              gate: true,
            },
          },
        },
        orderBy: [{ serverOccurredAt: 'desc' }, { id: 'desc' }],
        take: 8,
        where: { societyId },
      }),
    ]);

    const unpaidMaintenanceAmount = (unpaid._sum.totalAmount ?? new Prisma.Decimal(0)).minus(
      unpaid._sum.paidAmount ?? new Prisma.Decimal(0),
    );
    return {
      activeEmergencies,
      activeGateActivity,
      activeGuards,
      activeResidents,
      auditAlerts,
      failedDeliveries,
      openComplaints,
      outstandingCharges: unpaid._count,
      outstandingPaidAmount: unpaid._sum.paidAmount?.toString() ?? '0',
      outstandingTotalAmount: unpaid._sum.totalAmount?.toString() ?? '0',
      pendingResidentApprovals: pendingMemberships,
      pendingMemberships,
      recentGateActivity: recentGateActivity.map((event) => ({
        createdAt: event.serverOccurredAt,
        detail: `${event.visit.flat.displayName} at ${event.visit.gate.name}`,
        id: event.id,
        occurredAt: event.serverOccurredAt,
        title: event.eventType,
        visitorName: event.visit.visitorNameSnapshot,
      })),
      recentVisitorActivity,
      unpaidMaintenanceAmount: unpaidMaintenanceAmount.toString(),
    };
  }

  async users(principal: AuthenticatedPrincipal, query: OperationsListQuery): Promise<object> {
    const rows = await this.database.client.user.findMany({
      include: {
        guardProfile: { select: { employeeCode: true, status: true } },
        roleAssignments: {
          include: { role: { select: { code: true, name: true } } },
          where: { revokedAt: null },
        },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      where: {
        societyId: principal.societyId,
        ...this.cursor(query),
        ...(query.status ? { status: query.status as never } : {}),
        ...(query.type === 'RESIDENT'
          ? {
              AND: [
                {
                  OR: [
                    { memberships: { some: {} } },
                    {
                      roleAssignments: {
                        some: {
                          revokedAt: null,
                          role: {
                            code: { in: ['RESIDENT_OWNER', 'RESIDENT_TENANT', 'RESIDENT_FAMILY'] },
                          },
                        },
                      },
                    },
                  ],
                },
              ],
            }
          : {}),
        ...(query.role
          ? { roleAssignments: { some: { revokedAt: null, role: { code: query.role } } } }
          : {}),
        ...(query.permission
          ? {
              roleAssignments: {
                some: {
                  revokedAt: null,
                  role: {
                    permissionLinks: {
                      some: { permission: { action: query.permission, status: 'ACTIVE' } },
                    },
                  },
                },
              },
            }
          : {}),
        ...(query.search
          ? {
              OR: [
                { displayName: { contains: query.search, mode: 'insensitive' } },
                { email: { contains: query.search, mode: 'insensitive' } },
                { normalizedPhone: { contains: query.search } },
              ],
            }
          : {}),
      },
    });
    return pageResult(
      rows.map(({ normalizedPhone, roleAssignments, ...user }) => ({
        ...user,
        name: user.displayName,
        phoneMasked: maskPhone(normalizedPhone),
        roles: roleAssignments.map(({ role }) => role.code),
      })),
      query.limit,
    );
  }

  async family(principal: AuthenticatedPrincipal, query: OperationsListQuery): Promise<object> {
    const rows = await this.database.client.familyMember.findMany({
      include: {
        flat: { include: { block: true } },
        managedByMembership: { include: { user: { select: { displayName: true } } } },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      where: {
        societyId: principal.societyId,
        ...this.cursor(query),
        ...(query.status ? { status: query.status as never } : {}),
        ...(query.search ? { name: { contains: query.search, mode: 'insensitive' } } : {}),
      },
    });
    return pageResult(rows, query.limit);
  }

  async guards(principal: AuthenticatedPrincipal, query: OperationsListQuery): Promise<object> {
    const rows = await this.database.client.guardProfile.findMany({
      include: {
        gateAssignments: {
          include: { gate: { select: { code: true, id: true, name: true } } },
          where: { status: RecordStatus.ACTIVE },
        },
        user: { select: { displayName: true, normalizedPhone: true } },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      where: {
        societyId: principal.societyId,
        ...this.cursor(query),
        ...(query.status ? { status: query.status as never } : {}),
        ...(query.search
          ? {
              OR: [
                { employeeCode: { contains: query.search, mode: 'insensitive' } },
                { user: { displayName: { contains: query.search, mode: 'insensitive' } } },
              ],
            }
          : {}),
      },
    });
    return pageResult(
      rows.map(({ gateAssignments, user, ...guard }) => ({
        ...guard,
        assignedGates: gateAssignments.map(({ gate }) => gate),
        name: user.displayName,
        phoneMasked: maskPhone(user.normalizedPhone),
      })),
      query.limit,
    );
  }

  async guardDevices(
    principal: AuthenticatedPrincipal,
    query: OperationsListQuery,
  ): Promise<object> {
    const rows = await this.database.client.guardDevice.findMany({
      include: {
        device: {
          select: {
            appVersion: true,
            label: true,
            lastSeenAt: true,
            operatingSystem: true,
            platform: true,
          },
        },
        gateAssignments: {
          include: { gate: { select: { code: true, id: true, name: true } } },
          where: { status: RecordStatus.ACTIVE },
        },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      where: {
        societyId: principal.societyId,
        ...this.cursor(query),
        ...(query.status ? { status: query.status as never } : {}),
      },
    });
    return pageResult(rows, query.limit);
  }

  async visits(principal: AuthenticatedPrincipal, query: OperationsListQuery): Promise<object> {
    const rows = await this.database.client.visit.findMany({
      include: {
        approvals: { include: { decision: true }, orderBy: { requestedAt: 'desc' }, take: 1 },
        flat: { include: { block: true } },
        gate: true,
        visitor: { select: { name: true } },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      where: {
        societyId: principal.societyId,
        ...this.cursor(query),
        ...(query.status ? { status: query.status as never } : {}),
        ...(query.search
          ? {
              OR: [
                { visitorNameSnapshot: { contains: query.search, mode: 'insensitive' } },
                { vehicleNumberSnapshot: { contains: query.search, mode: 'insensitive' } },
                { purpose: { contains: query.search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
    });
    return pageResult(rows, query.limit);
  }

  async visitApprovals(
    principal: AuthenticatedPrincipal,
    query: OperationsListQuery,
  ): Promise<object> {
    const rows = await this.database.client.visitApproval.findMany({
      include: {
        decision: true,
        visit: { include: { flat: { include: { block: true } }, gate: true } },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      where: {
        societyId: principal.societyId,
        ...this.cursor(query),
        ...(query.status ? { status: query.status as never } : {}),
      },
    });
    return pageResult(rows, query.limit);
  }

  async preApprovals(
    principal: AuthenticatedPrincipal,
    query: OperationsListQuery,
  ): Promise<object> {
    const rows = await this.database.client.visitorPreApproval.findMany({
      include: { flat: { include: { block: true } }, visitor: true },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      where: {
        societyId: principal.societyId,
        ...this.cursor(query),
        ...(query.status ? { status: query.status as never } : {}),
      },
    });
    return pageResult(rows, query.limit);
  }

  async visitorOverrides(
    principal: AuthenticatedPrincipal,
    query: OperationsListQuery,
  ): Promise<object> {
    const rows = await this.database.client.visitApprovalDecision.findMany({
      include: { approval: { include: { visit: { include: { flat: true, gate: true } } } } },
      orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      where: {
        societyId: principal.societyId,
        source: 'GUARD_OVERRIDE',
        ...this.occurredCursor(query),
      },
    });
    return this.occurredPage(rows, query.limit);
  }

  async visitorEvents(
    principal: AuthenticatedPrincipal,
    query: OperationsListQuery,
  ): Promise<object> {
    const rows = await this.database.client.visitEvent.findMany({
      include: { visit: { include: { flat: true, gate: true } } },
      orderBy: [{ serverOccurredAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      where: { societyId: principal.societyId, ...this.serverCursor(query) },
    });
    return this.timestampPage(rows, query.limit, 'serverOccurredAt');
  }
  async dailyHelp(principal: AuthenticatedPrincipal, query: OperationsListQuery): Promise<object> {
    const rows = await this.database.client.dailyHelp.findMany({
      include: {
        flatAssignments: {
          include: { flat: { include: { block: true } } },
          where: { status: 'ACTIVE' },
        },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      where: {
        societyId: principal.societyId,
        ...this.cursor(query),
        ...(query.status ? { status: query.status as never } : {}),
        ...(query.type ? { type: query.type as never } : {}),
        ...(query.search ? { name: { contains: query.search, mode: 'insensitive' } } : {}),
      },
    });
    return pageResult(rows, query.limit);
  }

  async dailyHelpAssignments(
    principal: AuthenticatedPrincipal,
    query: OperationsListQuery,
  ): Promise<object> {
    const rows = await this.database.client.dailyHelpFlatAssignment.findMany({
      include: {
        accessWindows: true,
        dailyHelp: true,
        flat: { include: { block: true } },
        managedByMembership: { include: { user: { select: { displayName: true } } } },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      where: {
        societyId: principal.societyId,
        ...this.cursor(query),
        ...(query.status ? { status: query.status as never } : {}),
      },
    });
    return pageResult(rows, query.limit);
  }

  async dailyHelpAttendance(
    principal: AuthenticatedPrincipal,
    query: OperationsListQuery,
  ): Promise<object> {
    const rows = await this.database.client.dailyHelpAttendance.findMany({
      include: { dailyHelp: true, gate: true },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      where: {
        societyId: principal.societyId,
        ...this.cursor(query),
        ...(query.status ? { status: query.status as never } : {}),
      },
    });
    return pageResult(rows, query.limit);
  }

  async parcels(principal: AuthenticatedPrincipal, query: OperationsListQuery): Promise<object> {
    const rows = await this.database.client.parcel.findMany({
      include: { flat: { include: { block: true } }, gate: true },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      where: {
        societyId: principal.societyId,
        ...this.cursor(query),
        ...(query.status ? { status: query.status as never } : {}),
        ...(query.search
          ? {
              OR: [
                { carrierName: { contains: query.search, mode: 'insensitive' } },
                { trackingReference: { contains: query.search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
    });
    return pageResult(rows, query.limit);
  }
  async notices(principal: AuthenticatedPrincipal, query: OperationsListQuery): Promise<object> {
    const rows = await this.database.client.notice.findMany({
      include: { _count: { select: { acknowledgements: true, reads: true, recipients: true } } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      where: {
        societyId: principal.societyId,
        ...this.cursor(query),
        ...(query.status ? { status: query.status as never } : {}),
        ...(query.search
          ? {
              OR: [
                { title: { contains: query.search, mode: 'insensitive' } },
                { category: { equals: query.search.toUpperCase() as never } },
              ],
            }
          : {}),
      },
    });
    return pageResult(
      rows.map(({ _count, ...notice }) => ({
        ...notice,
        acknowledgementCount: _count.acknowledgements,
        readCount: _count.reads,
        recipientCount: _count.recipients,
      })),
      query.limit,
    );
  }

  async noticeAcknowledgements(
    principal: AuthenticatedPrincipal,
    query: OperationsListQuery,
  ): Promise<object> {
    const recipients = await this.database.client.noticeRecipient.findMany({
      include: {
        notice: { select: { id: true, title: true } },
        user: { select: { displayName: true } },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      where: { societyId: principal.societyId, ...this.cursor(query) },
    });
    const keys = recipients.map((row) => ({ noticeId: row.noticeId, userId: row.userId }));
    const [reads, acknowledgements] = keys.length
      ? await Promise.all([
          this.database.client.noticeRead.findMany({
            where: { societyId: principal.societyId, OR: keys },
          }),
          this.database.client.noticeAcknowledgement.findMany({
            where: { societyId: principal.societyId, OR: keys },
          }),
        ])
      : [[], []];
    const readByKey = new Map(reads.map((row) => [`${row.noticeId}:${row.userId}`, row.readAt]));
    const ackByKey = new Map(
      acknowledgements.map((row) => [`${row.noticeId}:${row.userId}`, row.acknowledgedAt]),
    );
    return pageResult(
      recipients.map((row) => {
        const key = `${row.noticeId}:${row.userId}`;
        const readAt = readByKey.get(key) ?? null;
        const acknowledgedAt = ackByKey.get(key) ?? null;
        return {
          ...row,
          acknowledgedAt,
          readAt,
          status: acknowledgedAt ? 'ACKNOWLEDGED' : readAt ? 'READ' : 'UNREAD',
          user: { name: row.user.displayName },
        };
      }),
      query.limit,
    );
  }

  async complaints(principal: AuthenticatedPrincipal, query: OperationsListQuery): Promise<object> {
    if (query.status === 'ACKNOWLEDGED') {
      throw validation('status', 'ACKNOWLEDGED is not a persisted complaint status.');
    }
    const rows = await this.database.client.complaint.findMany({
      include: { category: true, flat: { include: { block: true } } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      where: {
        societyId: principal.societyId,
        ...this.cursor(query),
        ...(query.status ? { status: query.status as never } : {}),
        ...(query.search ? { subject: { contains: query.search, mode: 'insensitive' } } : {}),
      },
    });
    const assigneeIds = rows.flatMap((row) => (row.assignedToUserId ? [row.assignedToUserId] : []));
    const assignees = assigneeIds.length
      ? await this.database.client.user.findMany({
          select: { displayName: true, id: true },
          where: { id: { in: assigneeIds }, societyId: principal.societyId },
        })
      : [];
    const names = new Map(assignees.map((user) => [user.id, user.displayName]));
    return pageResult(
      rows.map((row) => ({
        ...row,
        assignedTo: row.assignedToUserId
          ? { id: row.assignedToUserId, name: names.get(row.assignedToUserId) ?? null }
          : null,
        reference: `CMP-${row.id.slice(0, 8).toUpperCase()}`,
      })),
      query.limit,
    );
  }
  async chargeBatches(
    principal: AuthenticatedPrincipal,
    query: OperationsListQuery,
  ): Promise<object> {
    const rows = await this.database.client.maintenanceChargeBatch.findMany({
      include: { _count: { select: { charges: true } } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      where: {
        societyId: principal.societyId,
        ...this.cursor(query),
        ...(query.status ? { status: query.status as never } : {}),
      },
    });
    return pageResult(
      rows.map(({ _count, ...row }) => ({ ...row, chargeCount: _count.charges })),
      query.limit,
    );
  }

  async charges(principal: AuthenticatedPrincipal, query: OperationsListQuery): Promise<object> {
    const rows = await this.database.client.maintenanceCharge.findMany({
      include: { batch: true, flat: { include: { block: true } } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      where: {
        societyId: principal.societyId,
        ...this.cursor(query),
        ...(query.status ? { status: query.status as never } : {}),
      },
    });
    return pageResult(
      rows.map((row) => ({
        ...row,
        balanceAmount: row.totalAmount.minus(row.paidAmount),
        reference: `${row.batch.code}-${row.flat.number}`,
      })),
      query.limit,
    );
  }

  async payments(principal: AuthenticatedPrincipal, query: OperationsListQuery): Promise<object> {
    const rows = await this.database.client.payment.findMany({
      include: { flat: { include: { block: true } }, receipt: true },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      where: {
        societyId: principal.societyId,
        ...this.cursor(query),
        ...(query.status ? { status: query.status as never } : {}),
        ...(query.search ? { reference: { contains: query.search, mode: 'insensitive' } } : {}),
      },
    });
    return pageResult(rows, query.limit);
  }

  async allocations(
    principal: AuthenticatedPrincipal,
    query: OperationsListQuery,
  ): Promise<object> {
    const rows = await this.database.client.paymentAllocation.findMany({
      include: { charge: { include: { batch: true } }, payment: true },
      orderBy: [{ allocatedAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      where: { societyId: principal.societyId, ...this.allocatedCursor(query) },
    });
    return this.timestampPage(rows, query.limit, 'allocatedAt');
  }

  async receipts(principal: AuthenticatedPrincipal, query: OperationsListQuery): Promise<object> {
    const rows = await this.database.client.receipt.findMany({
      include: { payment: { include: { flat: { include: { block: true } } } } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      where: {
        societyId: principal.societyId,
        ...this.cursor(query),
        ...(query.status ? { status: query.status as never } : {}),
      },
    });
    return pageResult(rows, query.limit);
  }

  async reversals(principal: AuthenticatedPrincipal, query: OperationsListQuery): Promise<object> {
    const rows = await this.database.client.paymentReversal.findMany({
      include: { payment: { include: { flat: { include: { block: true } } } } },
      orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      where: { societyId: principal.societyId, ...this.occurredCursor(query) },
    });
    return this.occurredPage(rows, query.limit);
  }

  async emergencies(
    principal: AuthenticatedPrincipal,
    query: OperationsListQuery,
  ): Promise<object> {
    const rows = await this.database.client.emergencyAlert.findMany({
      include: {
        events: { orderBy: { sequence: 'asc' } },
        flat: { include: { block: true } },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      where: {
        societyId: principal.societyId,
        ...this.cursor(query),
        ...(query.status ? { status: query.status as never } : {}),
      },
    });
    return pageResult(
      rows.map((row) => ({
        ...row,
        reference: `EMG-${row.id.slice(0, 8).toUpperCase()}`,
      })),
      query.limit,
    );
  }

  async roles(principal: AuthenticatedPrincipal, query: OperationsListQuery): Promise<object> {
    const rows = await this.database.client.role.findMany({
      include: {
        _count: { select: { permissionLinks: true, userAssignments: true } },
        permissionLinks: { include: { permission: true } },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      where: {
        societyId: principal.societyId,
        ...this.cursor(query),
        ...(query.status ? { status: query.status as never } : {}),
        ...(query.search
          ? {
              OR: [
                { code: { contains: query.search, mode: 'insensitive' } },
                { name: { contains: query.search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
    });
    return pageResult(
      rows.map(({ _count, ...row }) => ({
        ...row,
        permissionCount: _count.permissionLinks,
        userCount: _count.userAssignments,
      })),
      query.limit,
    );
  }

  async permissions(
    principal: AuthenticatedPrincipal,
    query: OperationsListQuery,
  ): Promise<object> {
    const rows = await this.database.client.permission.findMany({
      include: { _count: { select: { roleLinks: true } } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      where: {
        societyId: principal.societyId,
        ...this.cursor(query),
        ...(query.search ? { action: { contains: query.search, mode: 'insensitive' } } : {}),
      },
    });
    return pageResult(
      rows.map(({ _count, ...row }) => ({
        ...row,
        code: row.action,
        module: row.action.split('.')[0],
        roleCount: _count.roleLinks,
      })),
      query.limit,
    );
  }
  async audit(principal: AuthenticatedPrincipal, query: OperationsListQuery): Promise<object> {
    const correlationId = safeUuid(query.search);
    const rows = await this.database.client.auditLog.findMany({
      orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      where: {
        societyId: principal.societyId,
        ...this.occurredCursor(query),
        ...(query.status
          ? {
              outcome: (query.status === 'FAILED' ? 'FAILURE' : query.status) as never,
            }
          : {}),
        ...(query.search
          ? {
              OR: [
                { action: { contains: query.search, mode: 'insensitive' } },
                { entityType: { contains: query.search, mode: 'insensitive' } },
                ...(correlationId ? [{ correlationId }] : []),
              ],
            }
          : {}),
      },
    });
    const actorIds = rows.flatMap((row) => (row.actorUserId ? [row.actorUserId] : []));
    const actors = actorIds.length
      ? await this.database.client.user.findMany({
          select: { displayName: true, id: true },
          where: { id: { in: actorIds }, societyId: principal.societyId },
        })
      : [];
    const names = new Map(actors.map((user) => [user.id, user.displayName]));
    return this.occurredPage(
      rows.map((row) => ({
        ...row,
        actor: row.actorUserId
          ? { id: row.actorUserId, name: names.get(row.actorUserId) ?? null }
          : null,
        result: row.outcome,
      })),
      query.limit,
    );
  }

  async deliveries(principal: AuthenticatedPrincipal, query: OperationsListQuery): Promise<object> {
    const rows = await this.database.client.notificationDelivery.findMany({
      include: {
        notification: {
          include: { recipient: { select: { normalizedPhone: true } } },
        },
        pushEndpoint: { select: { provider: true } },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      where: {
        societyId: principal.societyId,
        ...this.cursor(query),
        ...(query.status ? { status: query.status as never } : {}),
      },
    });
    return pageResult(
      rows.map(({ notification, pushEndpoint, ...row }) => ({
        ...row,
        lastAttemptAt: row.updatedAt,
        provider: pushEndpoint?.provider ?? null,
        recipientMasked: maskPhone(notification.recipient.normalizedPhone),
      })),
      query.limit,
    );
  }
  createNotice(
    principal: AuthenticatedPrincipal,
    input: NoticeCreateInput,
    context: MutationRequestContext,
  ): Promise<object> {
    const actor = principalActor(principal);
    return this.database.client.$transaction(
      async (transaction) => {
        const claim = await this.journal.begin<object>(transaction, {
          actor,
          idempotencyKey: context.idempotencyKey,
          operation: 'notice.create',
          request: input,
          societyId: principal.societyId,
        });
        if (claim.kind === 'replay') return claim.response;

        const now = new Date();
        const publishAt = input.publishAt ? new Date(input.publishAt) : null;
        if (publishAt && publishAt <= now) {
          throw validation('publishAt', 'A scheduled publish time must be in the future.');
        }
        if (input.expiresAt && publishAt && new Date(input.expiresAt) <= publishAt) {
          throw validation('expiresAt', 'Notice expiry must be later than publication.');
        }
        const audiences = noticeAudiences(input);
        await this.validateAudience(transaction, principal.societyId, audiences);
        const attachmentIds = [...new Set(input.attachmentIds)];
        if (attachmentIds.length) {
          const attachmentCount = await transaction.fileUpload.count({
            where: {
              id: { in: attachmentIds },
              purpose: 'NOTICE_ATTACHMENT',
              societyId: principal.societyId,
              status: 'CLEAN',
            },
          });
          if (attachmentCount !== attachmentIds.length) {
            throw validation(
              'attachmentIds',
              'Every notice attachment must be a clean, society-scoped upload.',
            );
          }
        }
        const notice = await transaction.notice.create({
          data: {
            body: input.body,
            category: input.category,
            createdByUserId: principal.user.id,
            expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
            priority: input.priority,
            publishAt,
            requiresAcknowledgement: input.acknowledgementRequired,
            societyId: principal.societyId,
            status: publishAt ? NoticeStatus.SCHEDULED : NoticeStatus.DRAFT,
            title: input.title,
            audiences: {
              create: audiences.map((audience) => ({
                blockId: audience.blockId ?? null,
                flatId: audience.flatId ?? null,
                roleId: audience.roleId ?? null,
                societyId: principal.societyId,
                type: audience.type,
              })),
            },
            ...(attachmentIds.length
              ? {
                  attachments: {
                    create: attachmentIds.map((fileId, sortOrder) => ({
                      fileId,
                      societyId: principal.societyId,
                      sortOrder,
                    })),
                  },
                }
              : {}),
          },
          include: { attachments: true, audiences: true },
        });
        await this.journal.commit(transaction, {
          action: 'notice.create',
          actor,
          aggregateId: notice.id,
          aggregateType: 'Notice',
          correlationId: context.databaseCorrelationId,
          entityId: notice.id,
          entityType: 'Notice',
          eventType: 'notice.created',
          idempotencyRecordId: claim.recordId,
          newValues: { status: notice.status, title: notice.title },
          response: notice,
          responseStatus: HttpStatus.CREATED,
          societyId: principal.societyId,
        });
        return notice;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  publishNotice(
    principal: AuthenticatedPrincipal,
    noticeId: string,
    context: MutationRequestContext,
  ): Promise<object> {
    const actor = principalActor(principal);
    return this.database.client.$transaction(
      async (transaction) => {
        const claim = await this.journal.begin<object>(transaction, {
          actor,
          idempotencyKey: context.idempotencyKey,
          operation: 'notice.publish',
          request: { noticeId },
          societyId: principal.societyId,
        });
        if (claim.kind === 'replay') return claim.response;
        const notice = await transaction.notice.findFirst({
          include: { audiences: true },
          where: { id: noticeId, societyId: principal.societyId },
        });
        if (!notice) throw notFound();
        if (notice.status !== NoticeStatus.DRAFT && notice.status !== NoticeStatus.SCHEDULED) {
          throw conflict('Only a draft or scheduled notice can be published.');
        }

        const userIds = await this.resolveNoticeRecipients(
          transaction,
          principal.societyId,
          notice.audiences,
        );
        const now = new Date();
        const updatedCount = await transaction.notice.updateMany({
          data: {
            audienceFrozenAt: now,
            publishAt: notice.publishAt ?? now,
            publishedAt: now,
            publishedByUserId: principal.user.id,
            status: NoticeStatus.PUBLISHED,
            version: { increment: 1 },
          },
          where: {
            id: notice.id,
            societyId: principal.societyId,
            version: notice.version,
          },
        });
        if (updatedCount.count !== 1) throw conflict('The notice changed concurrently.');
        if (userIds.length) {
          await transaction.noticeRecipient.createMany({
            data: userIds.map((userId) => ({
              noticeId: notice.id,
              societyId: principal.societyId,
              userId,
            })),
            skipDuplicates: true,
          });
        }
        const updated = await transaction.notice.findUniqueOrThrow({
          include: { _count: { select: { recipients: true } } },
          where: { id: notice.id },
        });
        await this.journal.commit(transaction, {
          action: 'notice.publish',
          actor,
          aggregateId: notice.id,
          aggregateType: 'Notice',
          correlationId: context.databaseCorrelationId,
          entityId: notice.id,
          entityType: 'Notice',
          eventType: 'notice.published',
          idempotencyRecordId: claim.recordId,
          newValues: { recipientCount: updated._count.recipients, status: updated.status },
          previousValues: { status: notice.status, version: notice.version },
          response: updated,
          responseStatus: HttpStatus.OK,
          societyId: principal.societyId,
        });
        return updated;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  archiveNotice(
    principal: AuthenticatedPrincipal,
    noticeId: string,
    reason: string,
    context: MutationRequestContext,
  ): Promise<object> {
    return this.versionedStatusMutation(
      principal,
      context,
      'notice.archive',
      'Notice',
      noticeId,
      reason,
      async (transaction) => {
        const previous = await transaction.notice.findFirst({
          where: { id: noticeId, societyId: principal.societyId },
        });
        if (!previous) throw notFound();
        if (previous.status === NoticeStatus.ARCHIVED) {
          throw conflict('The notice is already archived.');
        }
        const result = await transaction.notice.updateMany({
          data: { status: NoticeStatus.ARCHIVED, version: { increment: 1 } },
          where: { id: noticeId, societyId: principal.societyId, version: previous.version },
        });
        if (result.count !== 1) throw conflict('The notice changed concurrently.');
        return {
          previous,
          updated: await transaction.notice.findUniqueOrThrow({ where: { id: noticeId } }),
        };
      },
    );
  }
  assignComplaint(
    principal: AuthenticatedPrincipal,
    complaintId: string,
    input: ComplaintAssignInput,
    context: MutationRequestContext,
  ): Promise<object> {
    const actor = principalActor(principal);
    return this.database.client.$transaction(
      async (transaction) => {
        const claim = await this.journal.begin<object>(transaction, {
          actor,
          idempotencyKey: context.idempotencyKey,
          operation: 'complaint.assign',
          request: { complaintId, ...input },
          societyId: principal.societyId,
        });
        if (claim.kind === 'replay') return claim.response;
        const [complaint, assignee] = await Promise.all([
          transaction.complaint.findFirst({
            where: { id: complaintId, societyId: principal.societyId },
          }),
          transaction.user.findFirst({
            select: { id: true },
            where: {
              id: input.assignedToUserId,
              societyId: principal.societyId,
              status: 'ACTIVE',
              roleAssignments: {
                some: {
                  revokedAt: null,
                  role: {
                    permissionLinks: {
                      some: { permission: { action: 'complaint.update', status: 'ACTIVE' } },
                    },
                    status: 'ACTIVE',
                  },
                },
              },
            },
          }),
        ]);
        if (!complaint || !assignee) throw notFound();
        if (
          complaint.status === ComplaintStatus.RESOLVED ||
          complaint.status === ComplaintStatus.CLOSED ||
          complaint.status === ComplaintStatus.CANCELLED
        ) {
          throw conflict('A completed complaint cannot be reassigned.');
        }
        const sequence = await transaction.complaintAssignmentHistory.count({
          where: { complaintId: complaint.id },
        });
        const updatedCount = await transaction.complaint.updateMany({
          data: {
            assignedToUserId: assignee.id,
            status: ComplaintStatus.ASSIGNED,
            version: { increment: 1 },
          },
          where: {
            id: complaint.id,
            societyId: principal.societyId,
            version: complaint.version,
          },
        });
        if (updatedCount.count !== 1) throw conflict('The complaint changed concurrently.');
        await transaction.complaintAssignmentHistory.create({
          data: {
            actorUserId: principal.user.id,
            complaintId: complaint.id,
            correlationId: context.databaseCorrelationId,
            fromAssigneeUserId: complaint.assignedToUserId,
            reason: input.note ?? null,
            sequence: sequence + 1,
            societyId: principal.societyId,
            toAssigneeUserId: assignee.id,
          },
        });
        const updated = await transaction.complaint.findUniqueOrThrow({
          where: { id: complaint.id },
        });
        await this.journal.commit(transaction, {
          action: 'complaint.assign',
          actor,
          aggregateId: complaint.id,
          aggregateType: 'Complaint',
          correlationId: context.databaseCorrelationId,
          entityId: complaint.id,
          entityType: 'Complaint',
          eventType: 'complaint.assigned',
          idempotencyRecordId: claim.recordId,
          newValues: { assignedToUserId: updated.assignedToUserId, status: updated.status },
          previousValues: {
            assignedToUserId: complaint.assignedToUserId,
            status: complaint.status,
          },
          ...(input.note ? { reason: input.note } : {}),
          response: updated,
          responseStatus: HttpStatus.OK,
          societyId: principal.societyId,
        });
        return updated;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  transitionComplaint(
    principal: AuthenticatedPrincipal,
    complaintId: string,
    input: ComplaintTransitionInput,
    context: MutationRequestContext,
  ): Promise<object> {
    const actor = principalActor(principal);
    return this.database.client.$transaction(
      async (transaction) => {
        const claim = await this.journal.begin<object>(transaction, {
          actor,
          idempotencyKey: context.idempotencyKey,
          operation: 'complaint.transition',
          request: { complaintId, ...input },
          societyId: principal.societyId,
        });
        if (claim.kind === 'replay') return claim.response;
        const complaint = await transaction.complaint.findFirst({
          where: { id: complaintId, societyId: principal.societyId },
        });
        if (!complaint) throw notFound();
        const target = input.status as ComplaintStatus;
        if (!allowedComplaintTransition(complaint.status, target)) {
          throw conflict(`Cannot transition a complaint from ${complaint.status} to ${target}.`);
        }
        const sequence = await transaction.complaintStatusHistory.count({
          where: { complaintId: complaint.id },
        });
        const now = new Date();
        const updatedCount = await transaction.complaint.updateMany({
          data: {
            ...(target === ComplaintStatus.RESOLVED
              ? { resolutionNotes: input.resolutionNotes ?? input.comment ?? null, resolvedAt: now }
              : {}),
            ...(target === ComplaintStatus.CLOSED ? { closedAt: now } : {}),
            ...(target === ComplaintStatus.REOPENED ? { reopenCount: { increment: 1 } } : {}),
            status: target,
            version: { increment: 1 },
          },
          where: {
            id: complaint.id,
            societyId: principal.societyId,
            version: input.version ?? complaint.version,
          },
        });
        if (updatedCount.count !== 1) throw conflict('The complaint changed concurrently.');
        await transaction.complaintStatusHistory.create({
          data: {
            actorUserId: principal.user.id,
            complaintId: complaint.id,
            correlationId: context.databaseCorrelationId,
            fromStatus: complaint.status,
            reason: input.reason ?? null,
            resolutionNotes: input.resolutionNotes ?? null,
            sequence: sequence + 1,
            societyId: principal.societyId,
            toStatus: target,
          },
        });
        if (input.comment) {
          await transaction.complaintComment.create({
            data: {
              authorUserId: principal.user.id,
              body: input.comment,
              complaintId: complaint.id,
              societyId: principal.societyId,
            },
          });
        }
        const updated = await transaction.complaint.findUniqueOrThrow({
          where: { id: complaint.id },
        });
        await this.journal.commit(transaction, {
          action: 'complaint.transition',
          actor,
          aggregateId: complaint.id,
          aggregateType: 'Complaint',
          correlationId: context.databaseCorrelationId,
          entityId: complaint.id,
          entityType: 'Complaint',
          eventType: 'complaint.transitioned',
          idempotencyRecordId: claim.recordId,
          newValues: { status: updated.status, version: updated.version },
          previousValues: { status: complaint.status, version: complaint.version },
          ...(input.reason ? { reason: input.reason } : {}),
          response: updated,
          responseStatus: HttpStatus.OK,
          societyId: principal.societyId,
        });
        return updated;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  addComplaintInternalNote(
    principal: AuthenticatedPrincipal,
    complaintId: string,
    input: ComplaintNoteInput,
    context: MutationRequestContext,
  ): Promise<object> {
    const actor = principalActor(principal);
    return this.database.client.$transaction(async (transaction) => {
      const claim = await this.journal.begin<object>(transaction, {
        actor,
        idempotencyKey: context.idempotencyKey,
        operation: 'complaint.internal_note',
        request: { complaintId, ...input },
        societyId: principal.societyId,
      });
      if (claim.kind === 'replay') return claim.response;
      const complaint = await transaction.complaint.findFirst({
        select: { id: true },
        where: { id: complaintId, societyId: principal.societyId },
      });
      if (!complaint) throw notFound();
      const note = await transaction.complaintInternalNote.create({
        data: {
          authorUserId: principal.user.id,
          body: input.body,
          complaintId,
          societyId: principal.societyId,
        },
      });
      await this.journal.commit(transaction, {
        action: 'complaint.internal_note',
        actor,
        aggregateId: complaintId,
        aggregateType: 'Complaint',
        correlationId: context.databaseCorrelationId,
        entityId: note.id,
        entityType: 'ComplaintInternalNote',
        eventType: 'complaint.internal_note_added',
        idempotencyRecordId: claim.recordId,
        newValues: { complaintId },
        response: note,
        responseStatus: HttpStatus.CREATED,
        societyId: principal.societyId,
      });
      return note;
    });
  }
  recordPayment(
    principal: AuthenticatedPrincipal,
    input: PaymentCreateInput,
    context: MutationRequestContext,
  ): Promise<object> {
    const actor = principalActor(principal);
    return this.database.client.$transaction(
      async (transaction) => {
        const claim = await this.journal.begin<object>(transaction, {
          actor,
          idempotencyKey: context.idempotencyKey,
          operation: 'payment.record',
          request: input,
          societyId: principal.societyId,
        });
        if (claim.kind === 'replay') return claim.response;
        const [flat, duplicate] = await Promise.all([
          transaction.flat.findFirst({
            select: { id: true },
            where: { id: input.flatId, societyId: principal.societyId, status: 'ACTIVE' },
          }),
          transaction.payment.findFirst({
            select: { id: true },
            where: { reference: input.reference, societyId: principal.societyId },
          }),
        ]);
        if (!flat) throw notFound();
        if (duplicate) throw conflict('The payment reference already exists in this society.');
        const payment = await transaction.payment.create({
          data: {
            amount: new Prisma.Decimal(input.amount),
            flatId: flat.id,
            method: input.method === 'UPI_EXTERNAL' ? 'UPI' : input.method,
            notes: input.notes ?? null,
            receivedAt: new Date(input.receivedAt),
            recordedByUserId: principal.user.id,
            reference: input.reference,
            societyId: principal.societyId,
            status: PaymentStatus.CONFIRMED,
            verifiedAt: new Date(),
            verifiedByUserId: principal.user.id,
          },
        });
        await this.journal.commit(transaction, {
          action: 'payment.record',
          actor,
          aggregateId: payment.id,
          aggregateType: 'Payment',
          correlationId: context.databaseCorrelationId,
          entityId: payment.id,
          entityType: 'Payment',
          eventType: 'payment.recorded',
          idempotencyRecordId: claim.recordId,
          newValues: {
            amount: payment.amount.toString(),
            flatId: payment.flatId,
            reference: payment.reference,
            status: payment.status,
          },
          response: payment,
          responseStatus: HttpStatus.CREATED,
          societyId: principal.societyId,
        });
        return payment;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  allocatePayment(
    principal: AuthenticatedPrincipal,
    input: AllocationCreateInput,
    context: MutationRequestContext,
  ): Promise<object> {
    const actor = principalActor(principal);
    return this.database.client.$transaction(
      async (transaction) => {
        const claim = await this.journal.begin<object>(transaction, {
          actor,
          idempotencyKey: context.idempotencyKey,
          operation: 'payment.allocate',
          request: input,
          societyId: principal.societyId,
        });
        if (claim.kind === 'replay') return claim.response;
        const [payment, charge] = await Promise.all([
          transaction.payment.findFirst({
            include: { allocations: true },
            where: {
              id: input.paymentId,
              societyId: principal.societyId,
              status: PaymentStatus.CONFIRMED,
            },
          }),
          transaction.maintenanceCharge.findFirst({
            where: {
              id: input.chargeId,
              societyId: principal.societyId,
              status: { in: ['UNPAID', 'PARTIALLY_PAID'] },
            },
          }),
        ]);
        if (!payment || !charge) throw notFound();
        if (payment.flatId !== charge.flatId) {
          throw conflict('Payments can only be allocated to charges for the same flat.');
        }
        const amount = new Prisma.Decimal(input.amount);
        const paymentAllocated = payment.allocations.reduce(
          (sum, allocation) => sum.plus(allocation.amount),
          new Prisma.Decimal(0),
        );
        const paymentBalance = payment.amount.minus(paymentAllocated);
        const chargeBalance = charge.totalAmount.minus(charge.paidAmount);
        if (amount.greaterThan(paymentBalance) || amount.greaterThan(chargeBalance)) {
          throw conflict('The allocation exceeds the available payment or charge balance.');
        }
        const allocation = await transaction.paymentAllocation.create({
          data: {
            amount,
            chargeId: charge.id,
            flatId: charge.flatId,
            paymentId: payment.id,
            societyId: principal.societyId,
          },
        });
        const nextPaid = charge.paidAmount.plus(amount);
        const updatedCount = await transaction.maintenanceCharge.updateMany({
          data: {
            paidAmount: nextPaid,
            status: nextPaid.equals(charge.totalAmount) ? 'PAID' : 'PARTIALLY_PAID',
            version: { increment: 1 },
          },
          where: {
            id: charge.id,
            societyId: principal.societyId,
            version: charge.version,
          },
        });
        if (updatedCount.count !== 1) throw conflict('The charge changed concurrently.');
        await this.journal.commit(transaction, {
          action: 'payment.allocate',
          actor,
          aggregateId: payment.id,
          aggregateType: 'Payment',
          correlationId: context.databaseCorrelationId,
          entityId: allocation.id,
          entityType: 'PaymentAllocation',
          eventType: 'payment.allocated',
          idempotencyRecordId: claim.recordId,
          newValues: {
            amount: allocation.amount.toString(),
            chargeId: charge.id,
            paymentId: payment.id,
          },
          response: allocation,
          responseStatus: HttpStatus.CREATED,
          societyId: principal.societyId,
        });
        return allocation;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }
  acknowledgeEmergency(
    principal: AuthenticatedPrincipal,
    alertId: string,
    context: MutationRequestContext,
  ): Promise<object> {
    return this.mutateEmergency(
      principal,
      alertId,
      context,
      'emergency.acknowledge',
      async (transaction, alert) => {
        if (alert.status !== EmergencyStatus.ACTIVE) {
          throw conflict('Only an active emergency can be acknowledged.');
        }
        return {
          data: {
            acknowledgedByAdminUserId: principal.user.id,
            adminAcknowledgedAt: new Date(),
            status: EmergencyStatus.ACKNOWLEDGED,
          },
          details: 'Emergency acknowledged by administrator.',
          eventType: EmergencyEventType.ADMIN_ACKNOWLEDGED,
          status: EmergencyStatus.ACKNOWLEDGED,
        };
      },
    );
  }

  respondEmergency(
    principal: AuthenticatedPrincipal,
    alertId: string,
    input: EmergencyResponseInput,
    context: MutationRequestContext,
  ): Promise<object> {
    return this.mutateEmergency(
      principal,
      alertId,
      context,
      'emergency.respond',
      async (_transaction, alert) => {
        if (
          alert.status !== EmergencyStatus.ACKNOWLEDGED &&
          alert.status !== EmergencyStatus.RESPONDING
        ) {
          throw conflict('The emergency must be acknowledged before recording a response.');
        }
        return {
          data: {
            respondingAt: alert.respondingAt ?? new Date(),
            status: EmergencyStatus.RESPONDING,
          },
          details: `[${input.status}] ${input.note}`,
          eventType:
            alert.status === EmergencyStatus.RESPONDING
              ? EmergencyEventType.RESPONSE_UPDATED
              : EmergencyEventType.RESPONSE_STARTED,
          ...(input.version ? { expectedVersion: input.version } : {}),
          status: EmergencyStatus.RESPONDING,
        };
      },
    );
  }

  resolveEmergency(
    principal: AuthenticatedPrincipal,
    alertId: string,
    input: EmergencyResolveInput,
    context: MutationRequestContext,
  ): Promise<object> {
    return this.mutateEmergency(
      principal,
      alertId,
      context,
      'emergency.resolve',
      async (_transaction, alert) => {
        if (
          alert.status === EmergencyStatus.RESOLVED ||
          alert.status === EmergencyStatus.FALSE_ALARM
        ) {
          throw conflict('The emergency is already resolved.');
        }
        const status =
          input.resolution === 'FALSE_ALARM'
            ? EmergencyStatus.FALSE_ALARM
            : EmergencyStatus.RESOLVED;
        return {
          data: {
            resolution: input.reason,
            resolvedAt: new Date(),
            resolvedByUserId: principal.user.id,
            status,
          },
          details: input.reason,
          eventType:
            status === EmergencyStatus.FALSE_ALARM
              ? EmergencyEventType.MARKED_FALSE_ALARM
              : EmergencyEventType.RESOLVED,
          ...(input.version ? { expectedVersion: input.version } : {}),
          reason: input.reason,
          status,
        };
      },
    );
  }

  createRole(
    principal: AuthenticatedPrincipal,
    input: RoleCreateInput,
    context: MutationRequestContext,
  ): Promise<object> {
    const actor = principalActor(principal);
    return this.database.client.$transaction(
      async (transaction) => {
        const claim = await this.journal.begin<object>(transaction, {
          actor,
          idempotencyKey: context.idempotencyKey,
          operation: 'role.create',
          request: input,
          societyId: principal.societyId,
        });
        if (claim.kind === 'replay') return claim.response;
        const permissions = await transaction.permission.findMany({
          select: { id: true },
          where: {
            id: { in: input.permissionIds },
            societyId: principal.societyId,
            status: RecordStatus.ACTIVE,
          },
        });
        if (permissions.length !== new Set(input.permissionIds).size) {
          throw validation('permissionIds', 'One or more permissions are unavailable.');
        }
        const role = await transaction.role.create({
          data: {
            code: input.code,
            description: input.description,
            name: input.name,
            societyId: principal.societyId,
            permissionLinks: {
              create: permissions.map(({ id }) => ({
                grantedByUserId: principal.user.id,
                permissionId: id,
                societyId: principal.societyId,
              })),
            },
          },
          include: { permissionLinks: { include: { permission: true } } },
        });
        await this.journal.commit(transaction, {
          action: 'role.create',
          actor,
          aggregateId: role.id,
          aggregateType: 'Role',
          correlationId: context.databaseCorrelationId,
          entityId: role.id,
          entityType: 'Role',
          eventType: 'role.created',
          idempotencyRecordId: claim.recordId,
          newValues: { code: role.code, permissionCount: role.permissionLinks.length },
          reason: input.reason,
          response: role,
          responseStatus: HttpStatus.CREATED,
          societyId: principal.societyId,
        });
        return role;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  deactivateRole(
    principal: AuthenticatedPrincipal,
    roleId: string,
    reason: string,
    context: MutationRequestContext,
  ): Promise<object> {
    return this.versionedStatusMutation(
      principal,
      context,
      'role.deactivate',
      'Role',
      roleId,
      reason,
      async (transaction) => {
        const previous = await transaction.role.findFirst({
          where: { id: roleId, societyId: principal.societyId },
        });
        if (!previous) throw notFound();
        if (previous.isSystem) throw conflict('System roles cannot be deactivated.');
        const result = await transaction.role.updateMany({
          data: { status: RecordStatus.INACTIVE, version: { increment: 1 } },
          where: { id: roleId, societyId: principal.societyId, version: previous.version },
        });
        if (result.count !== 1) throw conflict('The role changed concurrently.');
        return {
          previous,
          updated: await transaction.role.findUniqueOrThrow({ where: { id: roleId } }),
        };
      },
    );
  }

  retryDelivery(
    principal: AuthenticatedPrincipal,
    deliveryId: string,
    context: MutationRequestContext,
  ): Promise<object> {
    const actor = principalActor(principal);
    return this.database.client.$transaction(
      async (transaction) => {
        const claim = await this.journal.begin<object>(transaction, {
          actor,
          idempotencyKey: context.idempotencyKey,
          operation: 'notification.retry',
          request: { deliveryId },
          societyId: principal.societyId,
        });
        if (claim.kind === 'replay') return claim.response;
        const delivery = await transaction.notificationDelivery.findFirst({
          include: { notification: true, pushEndpoint: true },
          where: { id: deliveryId, societyId: principal.societyId },
        });
        if (!delivery) throw notFound();
        if (delivery.status !== DeliveryStatus.FAILED && delivery.status !== DeliveryStatus.RETRY) {
          throw conflict('Only failed notification deliveries can be retried.');
        }
        if (
          !delivery.pushEndpointId ||
          !delivery.pushEndpoint ||
          delivery.pushEndpoint.status !== 'ACTIVE'
        ) {
          throw conflict('The original push endpoint is no longer active.');
        }
        const updated = await transaction.notificationDelivery.update({
          data: {
            errorCode: null,
            errorDetail: null,
            failedAt: null,
            nextAttemptAt: new Date(),
            status: DeliveryStatus.RETRY,
          },
          where: { id: delivery.id },
        });
        await this.journal.commit(transaction, {
          action: 'notification.retry',
          actor,
          aggregateId: delivery.notificationId,
          aggregateType: 'Notification',
          correlationId: context.databaseCorrelationId,
          entityId: delivery.id,
          entityType: 'NotificationDelivery',
          eventType: NOTIFICATION_DISPATCH_EVENT,
          idempotencyRecordId: claim.recordId,
          newValues: { status: updated.status },
          outboxPayload: {
            body: delivery.notification.body,
            category: delivery.notification.category,
            deliveryId: delivery.id,
            endpointId: delivery.pushEndpointId,
            notificationId: delivery.notificationId,
            title: delivery.notification.title,
          },
          response: updated,
          responseStatus: HttpStatus.ACCEPTED,
          societyId: principal.societyId,
        });
        return updated;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }
  private cursor(query: OperationsListQuery): PageWhere {
    const cursor = decodeCursor(query.cursor);
    return cursor
      ? {
          OR: [
            { createdAt: { lt: new Date(cursor.at) } },
            { createdAt: new Date(cursor.at), id: { lt: cursor.id } },
          ],
        }
      : {};
  }

  private occurredCursor(query: OperationsListQuery): PageWhere {
    return this.timeCursor(query, 'occurredAt');
  }

  private serverCursor(query: OperationsListQuery): PageWhere {
    return this.timeCursor(query, 'serverOccurredAt');
  }

  private allocatedCursor(query: OperationsListQuery): PageWhere {
    return this.timeCursor(query, 'allocatedAt');
  }

  private timeCursor(query: OperationsListQuery, field: string): PageWhere {
    const cursor = decodeCursor(query.cursor);
    return cursor
      ? {
          OR: [
            { [field]: { lt: new Date(cursor.at) } },
            { [field]: new Date(cursor.at), id: { lt: cursor.id } },
          ],
        }
      : {};
  }

  private occurredPage<T extends { id: string }>(rows: readonly T[], limit: number): object {
    return this.timestampPage(rows, limit, 'occurredAt');
  }

  private timestampPage<T extends { id: string }>(
    rows: readonly T[],
    limit: number,
    field: string,
  ): object {
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    const last = items.at(-1);
    const at = last ? (last as unknown as Record<string, unknown>)[field] : null;
    if (last && !(at instanceof Date)) {
      throw new Error(`Pagination field ${field} is not a Date.`);
    }
    return {
      hasMore,
      items,
      nextCursor:
        last && at instanceof Date
          ? Buffer.from(JSON.stringify({ at: at.toISOString(), id: last.id }), 'utf8').toString(
              'base64url',
            )
          : null,
    };
  }

  private async validateAudience(
    transaction: Prisma.TransactionClient,
    societyId: string,
    audiences: readonly NoticeAudienceTarget[],
  ): Promise<void> {
    for (const audience of audiences) {
      const identifiers = [audience.blockId, audience.flatId, audience.roleId].filter(Boolean);
      if (audience.type === 'ALL_RESIDENTS') {
        if (identifiers.length) {
          throw validation('audience', 'An all-residents audience cannot include a target ID.');
        }
        continue;
      }
      const targetId =
        audience.type === 'ROLE'
          ? audience.roleId
          : audience.type === 'BLOCK'
            ? audience.blockId
            : audience.flatId;
      if (!targetId || identifiers.length !== 1) {
        throw validation(
          'audience',
          'Each targeted audience requires exactly one matching target ID.',
        );
      }
      const exists =
        audience.type === 'ROLE'
          ? await transaction.role.count({ where: { id: targetId, societyId, status: 'ACTIVE' } })
          : audience.type === 'BLOCK'
            ? await transaction.block.count({
                where: { id: targetId, societyId, status: 'ACTIVE' },
              })
            : await transaction.flat.count({
                where: { id: targetId, societyId, status: 'ACTIVE' },
              });
      if (exists !== 1) throw validation('audience', 'An audience target does not exist.');
    }
  }

  private async resolveNoticeRecipients(
    transaction: Prisma.TransactionClient,
    societyId: string,
    audiences: readonly {
      blockId: string | null;
      flatId: string | null;
      roleId: string | null;
      type: string;
    }[],
  ): Promise<string[]> {
    const userIds = new Set<string>();
    const now = new Date();
    for (const audience of audiences) {
      if (audience.type === 'ROLE' && audience.roleId) {
        const assignments = await transaction.userRole.findMany({
          select: { userId: true },
          where: {
            expiresAt: { gt: now },
            revokedAt: null,
            roleId: audience.roleId,
            societyId,
            startsAt: { lte: now },
          },
        });
        const openEnded = await transaction.userRole.findMany({
          select: { userId: true },
          where: {
            expiresAt: null,
            revokedAt: null,
            roleId: audience.roleId,
            societyId,
            startsAt: { lte: now },
          },
        });
        [...assignments, ...openEnded].forEach(({ userId }) => userIds.add(userId));
        continue;
      }
      const memberships = await transaction.flatMembership.findMany({
        select: { userId: true },
        where: {
          societyId,
          status: 'APPROVED',
          ...(audience.type === 'BLOCK' && audience.blockId
            ? { flat: { blockId: audience.blockId } }
            : {}),
          ...(audience.type === 'FLAT' && audience.flatId ? { flatId: audience.flatId } : {}),
        },
      });
      memberships.forEach(({ userId }) => userIds.add(userId));
    }
    return [...userIds];
  }

  private versionedStatusMutation<
    TPrevious extends { id: string; status: unknown; version: number },
    TUpdated extends { id: string; status: unknown; version: number },
  >(
    principal: AuthenticatedPrincipal,
    context: MutationRequestContext,
    operation: string,
    entityType: string,
    entityId: string,
    reason: string,
    work: (
      transaction: Prisma.TransactionClient,
    ) => Promise<{ previous: TPrevious; updated: TUpdated }>,
  ): Promise<object> {
    const actor = principalActor(principal);
    return this.database.client.$transaction(
      async (transaction) => {
        const claim = await this.journal.begin<object>(transaction, {
          actor,
          idempotencyKey: context.idempotencyKey,
          operation,
          request: { entityId, reason },
          societyId: principal.societyId,
        });
        if (claim.kind === 'replay') return claim.response;
        const { previous, updated } = await work(transaction);
        await this.journal.commit(transaction, {
          action: operation,
          actor,
          aggregateId: entityId,
          aggregateType: entityType,
          correlationId: context.databaseCorrelationId,
          entityId,
          entityType,
          eventType: `${operation}d`,
          idempotencyRecordId: claim.recordId,
          newValues: { status: String(updated.status), version: updated.version },
          previousValues: { status: String(previous.status), version: previous.version },
          reason,
          response: updated,
          responseStatus: HttpStatus.OK,
          societyId: principal.societyId,
        });
        return updated;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  private mutateEmergency(
    principal: AuthenticatedPrincipal,
    alertId: string,
    context: MutationRequestContext,
    operation: string,
    transition: (
      transaction: Prisma.TransactionClient,
      alert: {
        id: string;
        respondingAt: Date | null;
        status: EmergencyStatus;
        version: number;
      },
    ) => Promise<{
      data: Prisma.EmergencyAlertUpdateManyMutationInput;
      details: string;
      eventType: EmergencyEventType;
      expectedVersion?: number;
      reason?: string;
      status: EmergencyStatus;
    }>,
  ): Promise<object> {
    const actor = principalActor(principal);
    return this.database.client.$transaction(
      async (transaction) => {
        const claim = await this.journal.begin<object>(transaction, {
          actor,
          idempotencyKey: context.idempotencyKey,
          operation,
          request: { alertId },
          societyId: principal.societyId,
        });
        if (claim.kind === 'replay') return claim.response;
        const alert = await transaction.emergencyAlert.findFirst({
          where: { id: alertId, societyId: principal.societyId },
        });
        if (!alert) throw notFound();
        const next = await transition(transaction, alert);
        const sequence = await transaction.emergencyEvent.count({ where: { alertId } });
        const updatedCount = await transaction.emergencyAlert.updateMany({
          data: { ...next.data, version: { increment: 1 } },
          where: {
            id: alert.id,
            societyId: principal.societyId,
            version: next.expectedVersion ?? alert.version,
          },
        });
        if (updatedCount.count !== 1) throw conflict('The emergency changed concurrently.');
        await transaction.emergencyEvent.create({
          data: {
            actorUserId: principal.user.id,
            alertId: alert.id,
            correlationId: context.databaseCorrelationId,
            details: next.details,
            eventType: next.eventType,
            newStatus: next.status,
            previousStatus: alert.status,
            sequence: sequence + 1,
            societyId: principal.societyId,
          },
        });
        const updated = await transaction.emergencyAlert.findUniqueOrThrow({
          where: { id: alert.id },
        });
        await this.journal.commit(transaction, {
          action: operation,
          actor,
          aggregateId: alert.id,
          aggregateType: 'EmergencyAlert',
          correlationId: context.databaseCorrelationId,
          entityId: alert.id,
          entityType: 'EmergencyAlert',
          eventType: operation,
          idempotencyRecordId: claim.recordId,
          newValues: { status: updated.status, version: updated.version },
          previousValues: { status: alert.status, version: alert.version },
          ...(next.reason ? { reason: next.reason } : {}),
          response: updated,
          responseStatus: HttpStatus.OK,
          societyId: principal.societyId,
        });
        return updated;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }
}

function noticeAudiences(input: NoticeCreateInput): readonly NoticeAudienceTarget[] {
  if (input.audienceType === 'ALL_RESIDENTS') {
    if (input.targetIds.length) {
      throw validation('targetIds', 'An all-residents notice cannot include target IDs.');
    }
    return [{ type: 'ALL_RESIDENTS' }];
  }
  if (!input.targetIds.length) {
    throw validation('targetIds', 'A targeted notice requires at least one target.');
  }
  return input.targetIds.map((targetId) => ({
    ...(input.audienceType === 'ROLE' ? { roleId: targetId } : {}),
    ...(input.audienceType === 'BLOCK' ? { blockId: targetId } : {}),
    ...(input.audienceType === 'FLAT' ? { flatId: targetId } : {}),
    type: input.audienceType,
  }));
}

function maskPhone(phone: string): string {
  if (phone.length <= 4) return '*'.repeat(phone.length);
  return `${phone.slice(0, 3)}******${phone.slice(-2)}`;
}

function safeUuid(value: string | undefined): string | null {
  return value &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
    ? value
    : null;
}

function allowedComplaintTransition(from: ComplaintStatus, to: ComplaintStatus): boolean {
  const transitions: Readonly<Record<ComplaintStatus, readonly ComplaintStatus[]>> = {
    OPEN: [ComplaintStatus.ASSIGNED, ComplaintStatus.CANCELLED],
    ASSIGNED: [ComplaintStatus.IN_PROGRESS, ComplaintStatus.CANCELLED],
    IN_PROGRESS: [ComplaintStatus.RESOLVED, ComplaintStatus.CANCELLED],
    RESOLVED: [ComplaintStatus.CLOSED, ComplaintStatus.REOPENED],
    CLOSED: [ComplaintStatus.REOPENED],
    REOPENED: [ComplaintStatus.ASSIGNED, ComplaintStatus.IN_PROGRESS, ComplaintStatus.CANCELLED],
    CANCELLED: [ComplaintStatus.REOPENED],
  };
  return transitions[from].includes(to);
}

function notFound(): ApiError {
  return new ApiError({
    code: 'RESOURCE_NOT_FOUND',
    details: {},
    message: 'The requested resource was not found.',
    status: HttpStatus.NOT_FOUND,
  });
}

function conflict(message: string): ApiError {
  return new ApiError({
    code: 'CONFLICT',
    details: {},
    message,
    status: HttpStatus.CONFLICT,
  });
}

function validation(field: string, message: string): ApiError {
  return new ApiError({
    code: 'VALIDATION_FAILED',
    details: { field },
    message,
    status: HttpStatus.BAD_REQUEST,
  });
}
