import { z } from 'zod';

import {
  attendanceStatusSchema,
  complaintStatusSchema,
  dailyHelpStatusSchema,
  emergencyStatusSchema,
  membershipStatusSchema,
  notificationCategorySchema,
  notificationChannelSchema,
  offlineMutationOperationSchema,
  parcelStatusSchema,
  paymentMethodSchema,
  paymentStatusSchema,
  visitStatusSchema,
} from './enums.js';
import {
  deviceNonceSchema,
  e164PhoneSchema,
  idempotencyKeySchema,
  isoDateTimeSchema,
  minorMoneySchema,
  otpCodeSchema,
  reasonSchema,
  secureDigestSchema,
  sequenceSchema,
  shortTextSchema,
  uuidSchema,
  versionSchema,
} from './common.js';

export const otpRequestSchema = z
  .object({
    phone: e164PhoneSchema,
    purpose: z.enum(['LOGIN', 'STEP_UP', 'PHONE_CHANGE']),
    deviceNonce: deviceNonceSchema,
  })
  .strict();

export const otpVerifySchema = z
  .object({
    challengeId: uuidSchema,
    phone: e164PhoneSchema,
    purpose: z.enum(['LOGIN', 'STEP_UP', 'PHONE_CHANGE']),
    deviceNonce: deviceNonceSchema,
    code: otpCodeSchema,
  })
  .strict();

export const visitTransitionCommandSchema = z
  .object({
    current: visitStatusSchema,
    target: visitStatusSchema,
    mode: z.enum(['STANDARD', 'PRE_APPROVAL', 'RESIDENT_DECISION', 'OVERRIDE', 'SYSTEM']),
    actorId: uuidSchema,
    gateId: uuidSchema.optional(),
    guardId: uuidSchema.optional(),
    reason: reasonSchema.optional(),
    hasOverridePermission: z.boolean().default(false),
    recentAuthentication: z.boolean().default(false),
    preApprovalValid: z.boolean().default(false),
    occurredAt: isoDateTimeSchema,
    expectedVersion: versionSchema,
    idempotencyKey: idempotencyKeySchema,
  })
  .strict()
  .superRefine((command, context) => {
    if (command.mode === 'OVERRIDE' && !command.reason) {
      context.addIssue({
        code: 'custom',
        path: ['reason'],
        message: 'An override reason is required.',
      });
    }
  });

export const complaintTransitionCommandSchema = z
  .object({
    current: complaintStatusSchema,
    target: complaintStatusSchema,
    actorId: uuidSchema,
    assigneeId: uuidSchema.optional(),
    reason: reasonSchema.optional(),
    resolutionNote: z.string().trim().min(3).max(2_000).optional(),
    resolvedAt: isoDateTimeSchema.optional(),
    occurredAt: isoDateTimeSchema,
    expectedVersion: versionSchema,
  })
  .strict();

export const paymentTransitionCommandSchema = z
  .object({
    current: paymentStatusSchema,
    target: paymentStatusSchema,
    method: paymentMethodSchema,
    source: z.enum(['MANUAL', 'PAYMENT_GATEWAY']),
    amountMinor: minorMoneySchema.positive(),
    reference: z.string().trim().min(3).max(120).optional(),
    providerVerified: z.boolean().default(false),
    hasReversePermission: z.boolean().default(false),
    recentAuthentication: z.boolean().default(false),
    reason: reasonSchema.optional(),
    occurredAt: isoDateTimeSchema,
  })
  .strict()
  .superRefine((command, context) => {
    if (['UPI', 'BANK_TRANSFER', 'CHEQUE'].includes(command.method) && !command.reference) {
      context.addIssue({
        code: 'custom',
        path: ['reference'],
        message: 'A payment reference is required.',
      });
    }
    if (command.target === 'REVERSED' && !command.reason) {
      context.addIssue({
        code: 'custom',
        path: ['reason'],
        message: 'A reversal reason is required.',
      });
    }
  });

export const emergencyTransitionCommandSchema = z
  .object({
    current: emergencyStatusSchema,
    target: emergencyStatusSchema,
    actorId: uuidSchema,
    reason: reasonSchema.optional(),
    responseNote: z.string().trim().min(3).max(2_000).optional(),
    occurredAt: isoDateTimeSchema,
  })
  .strict();

export const parcelTransitionCommandSchema = z
  .object({
    current: parcelStatusSchema,
    target: parcelStatusSchema,
    actorId: uuidSchema,
    collectionCodeVerified: z.boolean().default(false),
    reason: reasonSchema.optional(),
    occurredAt: isoDateTimeSchema,
  })
  .strict();

export const dailyHelpTransitionCommandSchema = z
  .object({
    current: dailyHelpStatusSchema,
    target: dailyHelpStatusSchema,
    actorId: uuidSchema,
    reason: reasonSchema.optional(),
    occurredAt: isoDateTimeSchema,
  })
  .strict();

export const attendanceTransitionCommandSchema = z
  .object({
    current: attendanceStatusSchema.nullable(),
    target: attendanceStatusSchema,
    actorId: uuidSchema,
    gateId: uuidSchema,
    helperActive: z.boolean(),
    hasVoidPermission: z.boolean().default(false),
    reason: reasonSchema.optional(),
    occurredAt: isoDateTimeSchema,
  })
  .strict();

export const membershipTransitionCommandSchema = z
  .object({
    current: membershipStatusSchema,
    target: membershipStatusSchema,
    actorId: uuidSchema,
    reason: reasonSchema.optional(),
    occupancyEndsAt: isoDateTimeSchema.optional(),
    occurredAt: isoDateTimeSchema,
  })
  .strict();

export const notificationPreferenceSchema = z
  .object({
    category: notificationCategorySchema,
    enabledChannels: z
      .array(notificationChannelSchema)
      .max(4)
      .refine((items) => new Set(items).size === items.length),
  })
  .strict();

export const offlineMutationSchema = z
  .object({
    clientMutationId: uuidSchema,
    deviceId: uuidSchema,
    gateId: uuidSchema,
    operation: offlineMutationOperationSchema,
    aggregateId: uuidSchema,
    localSequence: sequenceSchema,
    baseVersion: versionSchema.nullable(),
    clientOccurredAt: isoDateTimeSchema,
    payload: z.record(z.string(), z.unknown()),
    payloadHash: secureDigestSchema,
    signature: secureDigestSchema,
  })
  .strict();

export const idempotentMutationHeadersSchema = z
  .object({
    idempotencyKey: idempotencyKeySchema,
    requestHash: secureDigestSchema,
  })
  .strict();

export const flatLookupSchema = z
  .object({
    blockCode: shortTextSchema.max(20),
    flatNumber: shortTextSchema.max(20),
  })
  .strict();

export type OtpRequestInput = z.infer<typeof otpRequestSchema>;
export type OtpVerifyInput = z.infer<typeof otpVerifySchema>;
export type VisitTransitionCommandInput = z.infer<typeof visitTransitionCommandSchema>;
export type OfflineMutationInput = z.infer<typeof offlineMutationSchema>;
