import { z } from 'zod';

const codeSchema = z
  .string()
  .trim()
  .min(1)
  .max(32)
  .regex(/^[A-Za-z0-9_-]+$/)
  .transform((value) => value.toUpperCase());
const nameSchema = z.string().trim().min(1).max(120);
const statusSchema = z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']);

export const createBlockSchema = z
  .object({
    code: codeSchema,
    name: nameSchema,
    sortOrder: z.number().int().min(0).max(10_000).default(0),
  })
  .strict();

export const updateBlockSchema = z
  .object({
    code: codeSchema.optional(),
    name: nameSchema.optional(),
    sortOrder: z.number().int().min(0).max(10_000).optional(),
    status: statusSchema.optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'At least one field is required.');

export const createFloorSchema = z
  .object({
    label: z.string().trim().min(1).max(32),
    number: z.number().int().min(-20).max(500).nullable().optional(),
    sortOrder: z.number().int().min(0).max(10_000).default(0),
  })
  .strict();

export const updateFloorSchema = z
  .object({
    label: z.string().trim().min(1).max(32).optional(),
    number: z.number().int().min(-20).max(500).nullable().optional(),
    sortOrder: z.number().int().min(0).max(10_000).optional(),
    status: statusSchema.optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'At least one field is required.');

export const createFlatSchema = z
  .object({
    displayName: z.string().trim().min(1).max(80),
    intercomNumber: z.string().trim().min(1).max(32).nullable().optional(),
    number: z.string().trim().min(1).max(32),
    occupancyType: z
      .enum(['OWNER_OCCUPIED', 'RENTED', 'FAMILY_OCCUPIED', 'OTHER'])
      .nullable()
      .optional(),
  })
  .strict();

export const updateFlatSchema = z
  .object({
    displayName: z.string().trim().min(1).max(80).optional(),
    intercomNumber: z.string().trim().min(1).max(32).nullable().optional(),
    number: z.string().trim().min(1).max(32).optional(),
    occupancyType: z
      .enum(['OWNER_OCCUPIED', 'RENTED', 'FAMILY_OCCUPIED', 'OTHER'])
      .nullable()
      .optional(),
    status: statusSchema.optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'At least one field is required.');

export const createGateSchema = z
  .object({ code: codeSchema, name: nameSchema })
  .strict();

export const updateGateSchema = z
  .object({
    code: codeSchema.optional(),
    name: nameSchema.optional(),
    status: statusSchema.optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'At least one field is required.');

export type CreateBlockInput = z.infer<typeof createBlockSchema>;
export type CreateFlatInput = z.infer<typeof createFlatSchema>;
export type CreateFloorInput = z.infer<typeof createFloorSchema>;
export type CreateGateInput = z.infer<typeof createGateSchema>;
export type UpdateBlockInput = z.infer<typeof updateBlockSchema>;
export type UpdateFlatInput = z.infer<typeof updateFlatSchema>;
export type UpdateFloorInput = z.infer<typeof updateFloorSchema>;
export type UpdateGateInput = z.infer<typeof updateGateSchema>;
