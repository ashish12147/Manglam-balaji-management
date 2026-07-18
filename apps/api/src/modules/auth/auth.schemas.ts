import { z } from 'zod';
import {
  deviceNonceSchema,
  e164PhoneSchema,
  otpCodeSchema,
  reasonSchema,
  uuidSchema,
} from '@manglam/validation';

export const deviceFingerprintSchema = z.string().min(32).max(256);

export const authDeviceSchema = z
  .object({
    appVersion: z.string().trim().min(1).max(32).optional(),
    fingerprint: deviceFingerprintSchema,
    label: z.string().trim().min(1).max(120).optional(),
    operatingSystem: z.string().trim().min(1).max(80).optional(),
    platform: z.enum(['ANDROID', 'IOS', 'WEB', 'UNKNOWN']),
  })
  .strict();

export const otpRequestBodySchema = z
  .object({
    deviceNonce: deviceNonceSchema,
    phone: e164PhoneSchema,
    purpose: z.literal('LOGIN'),
  })
  .strict();

export const otpVerifyBodySchema = z
  .object({
    challengeId: uuidSchema,
    code: otpCodeSchema,
    device: authDeviceSchema,
    deviceNonce: deviceNonceSchema,
    phone: e164PhoneSchema,
    purpose: z.literal('LOGIN'),
  })
  .strict();

export const refreshBodySchema = z
  .object({
    deviceFingerprint: deviceFingerprintSchema,
    refreshToken: z.string().min(64).max(512).optional(),
  })
  .strict();

export const guardSignInBodySchema = z
  .object({
    device: authDeviceSchema,
    employeeCode: z.string().trim().min(2).max(40),
    pin: z.string().regex(/^\d{4,12}$/),
  })
  .strict();

export const guardEnrollBodySchema = guardSignInBodySchema
  .extend({ enrollmentToken: z.string().min(64).max(512) })
  .strict();

export const adminSignInBodySchema = z
  .object({
    device: authDeviceSchema,
    email: z.string().email().max(254).transform((value) => value.toLowerCase()),
    mfaCode: z.string().regex(/^\d{6}$/).optional(),
    password: z.string().min(8).max(256),
  })
  .strict();

export const setPinBodySchema = z
  .object({ pin: z.string().regex(/^\d{4,12}$/) })
  .strict();

export const pinUnlockBodySchema = z
  .object({
    device: authDeviceSchema,
    phone: e164PhoneSchema,
    pin: z.string().regex(/^\d{4,12}$/),
  })
  .strict();

export const revokeSessionBodySchema = z
  .object({ reason: reasonSchema.optional() })
  .strict();

export const profileUpdateBodySchema = z
  .object({
    displayName: z.string().trim().min(2).max(120),
    email: z.string().email().max(254).nullable(),
  })
  .strict();

export const sessionListQuerySchema = z
  .object({
    cursor: z.string().min(1).max(1_024).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  })
  .strict();

export const issueGuardEnrollmentBodySchema = z
  .object({ expiresInMinutes: z.coerce.number().int().min(5).max(60).default(15) })
  .strict();

export const revokeGuardDeviceBodySchema = z
  .object({
    reason: reasonSchema,
    status: z.enum(['LOST', 'REVOKED']),
  })
  .strict();

export type AdminSignInInput = z.infer<typeof adminSignInBodySchema>;
export type AuthDeviceInput = z.infer<typeof authDeviceSchema>;
export type GuardEnrollInput = z.infer<typeof guardEnrollBodySchema>;
export type GuardSignInInput = z.infer<typeof guardSignInBodySchema>;
export type OtpRequestInput = z.infer<typeof otpRequestBodySchema>;
export type OtpVerifyInput = z.infer<typeof otpVerifyBodySchema>;
export type PinUnlockInput = z.infer<typeof pinUnlockBodySchema>;
export type ProfileUpdateInput = z.infer<typeof profileUpdateBodySchema>;
export type RefreshInput = z.infer<typeof refreshBodySchema>;
export type SessionListQuery = z.infer<typeof sessionListQuerySchema>;
export type SetPinInput = z.infer<typeof setPinBodySchema>;
