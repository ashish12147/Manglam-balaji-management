import { z } from 'zod';

const optionalText = (max: number) => z.string().trim().min(1).max(max).optional();
const operationStatusSchema = z.enum([
  'ACKNOWLEDGED',
  'ACTIVE',
  'APPROVED',
  'ARCHIVED',
  'ARRIVED_AT_GATE',
  'ASSIGNED',
  'AWAITING_APPROVAL',
  'CANCELLED',
  'CHECKED_IN',
  'CHECKED_OUT',
  'CLOSED',
  'CONFIRMED',
  'CONSUMED',
  'DEACTIVATED',
  'DELIVERED',
  'DENIED',
  'DRAFT',
  'EXPIRED',
  'FAILED',
  'FAILURE',
  'FALSE_ALARM',
  'INACTIVE',
  'IN_PROGRESS',
  'ISSUED',
  'LOST',
  'PAID',
  'PARTIALLY_PAID',
  'PENDING',
  'PENDING_VERIFICATION',
  'POSTED',
  'PROCESSING',
  'PUBLISHED',
  'REJECTED',
  'REOPENED',
  'RESPONDING',
  'RESOLVED',
  'RETRY',
  'REVERSED',
  'REVOKED',
  'SCHEDULED',
  'SUCCESS',
  'SUSPENDED',
  'TIMED_OUT',
  'UNPAID',
  'VOIDED',
  'WAIVED',
]);

export const operationsUuidSchema = z.string().uuid();

export const operationsListQuerySchema = z
  .object({
    cursor: z.string().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(25),
    permission: z.string().trim().max(120).optional(),
    q: z.string().trim().max(120).optional(),
    search: z.string().trim().max(120).optional(),
    status: operationStatusSchema.optional(),
    type: z.string().trim().max(80).optional(),
    role: z.string().trim().max(80).optional(),
  })
  .strict()
  .transform(({ q, ...query }) => (q && !query.search ? { ...query, search: q } : query));

export const reasonSchema = z.object({ reason: z.string().trim().min(3).max(500) }).strict();

export const noticeCreateSchema = z
  .object({
    title: z.string().trim().min(3).max(200),
    body: z.string().trim().min(1).max(20_000),
    category: z.enum([
      'GENERAL',
      'URGENT',
      'MAINTENANCE',
      'WATER',
      'ELECTRICITY',
      'MEETING',
      'OTHER',
    ]),
    priority: z.enum(['NORMAL', 'IMPORTANT', 'URGENT']).default('NORMAL'),
    publishAt: z.string().datetime({ offset: true }).optional(),
    expiresAt: z.string().datetime({ offset: true }).optional(),
    acknowledgementRequired: z.boolean().default(false),
    attachmentIds: z.array(z.string().uuid()).max(20).default([]),
    audienceType: z.enum(['ALL_RESIDENTS', 'ROLE', 'BLOCK', 'FLAT']),
    targetIds: z.array(z.string().uuid()).max(100).default([]),
  })
  .strict()
  .superRefine((value, context) => {
    const invalidAll = value.audienceType === 'ALL_RESIDENTS' && value.targetIds.length > 0;
    const missingTargets = value.audienceType !== 'ALL_RESIDENTS' && value.targetIds.length === 0;
    if (invalidAll || missingTargets) {
      context.addIssue({
        code: 'custom',
        message: invalidAll
          ? 'An all-residents notice cannot include target IDs.'
          : 'A targeted notice requires at least one target.',
        path: ['targetIds'],
      });
    }
  });

export const complaintAssignSchema = z
  .object({ assignedToUserId: z.string().uuid(), note: optionalText(500) })
  .strict();

export const complaintTransitionSchema = z
  .object({
    status: z.enum(['ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'REOPENED', 'CANCELLED']),
    comment: optionalText(1_000),
    reason: optionalText(500),
    resolutionNotes: optionalText(4_000),
    version: z.number().int().positive().optional(),
  })
  .strict();

export const complaintNoteSchema = z.object({ body: z.string().trim().min(1).max(4_000) }).strict();

export const paymentCreateSchema = z
  .object({
    flatId: z.string().uuid(),
    amount: z.coerce.number().positive().max(99_999_999.99),
    method: z.enum(['CASH', 'BANK_TRANSFER', 'CHEQUE', 'UPI_EXTERNAL', 'OTHER']),
    reference: z.string().trim().min(1).max(160),
    receivedAt: z.string().datetime({ offset: true }),
    notes: optionalText(500),
  })
  .strict();

export const allocationCreateSchema = z
  .object({
    paymentId: z.string().uuid(),
    chargeId: z.string().uuid(),
    amount: z.coerce.number().positive().max(99_999_999.99),
  })
  .strict();

export const emergencyResponseSchema = z
  .object({
    status: z.enum([
      'RESPONDING',
      'SECURITY_DISPATCHED',
      'MEDICAL_ASSISTANCE_REQUESTED',
      'POLICE_CONTACTED',
    ]),
    note: z.string().trim().min(1).max(1_000),
    version: z.number().int().positive().optional(),
  })
  .strict();

export const emergencyResolveSchema = z
  .object({
    resolution: z.enum(['RESOLVED', 'FALSE_ALARM']),
    reason: z.string().trim().min(3).max(500),
    version: z.number().int().positive().optional(),
  })
  .strict();

export const roleCreateSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    code: z
      .string()
      .trim()
      .min(2)
      .max(80)
      .regex(/^[A-Z][A-Z0-9_]*$/),
    description: z.string().trim().min(3).max(500),
    permissionIds: z.array(z.string().uuid()).min(1).max(200),
    reason: z.string().trim().min(3).max(500),
  })
  .strict();

export type OperationsListQuery = z.infer<typeof operationsListQuerySchema>;
export type NoticeCreateInput = z.infer<typeof noticeCreateSchema>;
export type ComplaintAssignInput = z.infer<typeof complaintAssignSchema>;
export type ComplaintTransitionInput = z.infer<typeof complaintTransitionSchema>;
export type ComplaintNoteInput = z.infer<typeof complaintNoteSchema>;
export type PaymentCreateInput = z.infer<typeof paymentCreateSchema>;
export type AllocationCreateInput = z.infer<typeof allocationCreateSchema>;
export type EmergencyResponseInput = z.infer<typeof emergencyResponseSchema>;
export type EmergencyResolveInput = z.infer<typeof emergencyResolveSchema>;
export type RoleCreateInput = z.infer<typeof roleCreateSchema>;
