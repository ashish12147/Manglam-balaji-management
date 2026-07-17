import { z } from 'zod';
import {
  deviceNonceSchema,
  e164PhoneSchema,
  otpCodeSchema,
  reasonSchema,
  uuidSchema,
} from '@manglam/validation';

export const authDeviceSchema = z
  .object({
    appVersion: z.string().trim().min(1).max(32).optional(),
    fingerprint: z.string().min(32).max(256),
    label: z.string().trim().min(1).max(120).optional(),
    operatingSystem: z.string().trim().min(1).max(80).optional(),
    platform: z.enum(['ANDROID', 'IOS', 'WEB', 'UNKNOWN']),
  })
  .strict();

export const otpRequestBodySchema = z
  .object({
    deviceNonce: deviceNonceSchema,
    phone: e164PhoneSchema,
    purpose: z.enum(['LOGIN', 'STEP_UP', 'PHONE_CHANGE']),
  })
  .strict();

export const otpVerifyBodySchema = z
  .object({
    challengeId: uuidSchema,
    code: otpCodeSchema,
    device: authDeviceSchema,
    deviceNonce: deviceNonceSchema,
    phone: e164PhoneSchema,
    purpose: z.enum(['LOGIN', 'STEP_UP', 'PHONE_CHANGE']),
  })
  .strict();

export const refreshBodySchema = z
  .object({
    deviceFingerprint: z.string().min(32).max(256),
    refreshToken: z.string().min(64).max(512),
  })
  .strict();

export const guardSignInBodySchema = z
  .object({
    device: authDeviceSchema,
    employeeCode: z.string().trim().min(2).max(40),
    pin: z.string().regex(/^\d{4,12}$/),
  })
  .strict();

export const adminSignInBodySchema = z
  .object({
    device: authDeviceSchema,
    email: z.string().email().max(254).transform((value) => value.toLowerCase()),
    mfaCode: z.string().min(6).max(12).optional(),
    password: z.string().min(8).max(256),
  })
  .strict();

export const revokeSessionBodySchema = z
  .object({ reason: reasonSchema.optional() })
  .strict();

export type AdminSignInInput = z.infer<typeof adminSignInBodySchema>;
export type AuthDeviceInput = z.infer<typeof authDeviceSchema>;
export type GuardSignInInput = z.infer<typeof guardSignInBodySchema>;
export type OtpRequestInput = z.infer<typeof otpRequestBodySchema>;
export type OtpVerifyInput = z.infer<typeof otpVerifyBodySchema>;
export type RefreshInput = z.infer<typeof refreshBodySchema>;
