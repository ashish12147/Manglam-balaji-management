import { z } from 'zod';
import {
  e164PhoneSchema,
  isoDateTimeSchema,
  reasonSchema,
  uuidSchema,
} from '@manglam/validation';

export const requestMembershipSchema = z
  .object({
    flatId: uuidSchema,
    occupancyType: z.enum([
      'OWNER_OCCUPIED',
      'RENTED',
      'FAMILY_OCCUPIED',
      'OTHER',
    ]),
    relationship: z.enum(['OWNER', 'TENANT', 'ADULT_FAMILY']),
    startAt: isoDateTimeSchema,
  })
  .strict();

export const membershipDecisionSchema = z
  .object({ reason: reasonSchema.optional() })
  .strict();

export const createFamilyMemberSchema = z
  .object({
    dateOfBirth: z.string().date().nullable().optional(),
    name: z.string().trim().min(1).max(120),
    normalizedPhone: e164PhoneSchema.nullable().optional(),
    notes: z.string().trim().min(1).max(500).nullable().optional(),
    relationship: z.enum([
      'CHILD',
      'PARENT',
      'SPOUSE',
      'SIBLING',
      'DEPENDENT',
      'OTHER',
    ]),
  })
  .strict();

export const updateFamilyMemberSchema = createFamilyMemberSchema
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'At least one field is required.');

export const endFamilyMemberSchema = z
  .object({ reason: reasonSchema })
  .strict();

export type CreateFamilyMemberInput = z.infer<typeof createFamilyMemberSchema>;
export type MembershipDecisionInput = z.infer<typeof membershipDecisionSchema>;
export type RequestMembershipInput = z.infer<typeof requestMembershipSchema>;
export type UpdateFamilyMemberInput = z.infer<typeof updateFamilyMemberSchema>;
