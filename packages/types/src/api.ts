export const API_ERROR_CODES = Object.freeze([
  'AUTHENTICATION_REQUIRED',
  'SESSION_EXPIRED',
  'PERMISSION_DENIED',
  'RESOURCE_NOT_FOUND',
  'VALIDATION_FAILED',
  'CONFLICT',
  'RATE_LIMITED',
  'IDEMPOTENCY_KEY_REUSED',
  'IDEMPOTENCY_REQUEST_IN_PROGRESS',
  'OTP_INVALID',
  'OTP_EXPIRED',
  'OTP_ATTEMPTS_EXCEEDED',
  'OTP_SUPERSEDED',
  'OTP_ALREADY_USED',
  'OTP_RESEND_TOO_SOON',
  'VISIT_INVALID_TRANSITION',
  'VISIT_ALREADY_CHECKED_IN',
  'VISIT_ALREADY_CHECKED_OUT',
  'VISIT_OVERRIDE_NOT_ALLOWED',
  'VISIT_OVERRIDE_REASON_REQUIRED',
  'APPROVAL_ALREADY_DECIDED',
  'COMPLAINT_INVALID_TRANSITION',
  'COMPLAINT_REOPEN_WINDOW_EXPIRED',
  'PAYMENT_INVALID_TRANSITION',
  'PAYMENT_VERIFICATION_REQUIRED',
  'PAYMENT_ALLOCATION_INVALID',
  'PAYMENT_REFERENCE_REQUIRED',
  'EMERGENCY_INVALID_TRANSITION',
  'PARCEL_INVALID_TRANSITION',
  'PARCEL_COLLECTION_CODE_INVALID',
  'DAILY_HELP_INVALID_TRANSITION',
  'ATTENDANCE_INVALID_TRANSITION',
  'MEMBERSHIP_INVALID_TRANSITION',
  'OFFLINE_OPERATION_NOT_ALLOWED',
  'OFFLINE_DEVICE_REVOKED',
  'OFFLINE_LEASE_EXPIRED',
  'OFFLINE_SIGNATURE_INVALID',
  'OFFLINE_SEQUENCE_CONFLICT',
  'OFFLINE_VERSION_CONFLICT',
  'INTERNAL_ERROR',
] as const);

export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

export interface DomainError<
  TDetails extends Readonly<Record<string, unknown>> = Readonly<Record<string, unknown>>,
> {
  readonly code: ApiErrorCode;
  readonly message: string;
  readonly details: TDetails;
}

export interface ApiError<
  TDetails extends Readonly<Record<string, unknown>> = Readonly<Record<string, unknown>>,
> extends DomainError<TDetails> {
  readonly correlationId: string;
  readonly retryable: boolean;
}

export interface ApiErrorEnvelope<
  TDetails extends Readonly<Record<string, unknown>> = Readonly<Record<string, unknown>>,
> {
  readonly error: ApiError<TDetails>;
}

export interface ApiSuccessEnvelope<TData, TMeta = never> {
  readonly data: TData;
  readonly correlationId: string;
  readonly meta?: TMeta;
}

export type ApiResult<TData, TMeta = never> =
  | { readonly ok: true; readonly response: ApiSuccessEnvelope<TData, TMeta> }
  | { readonly ok: false; readonly response: ApiErrorEnvelope };

export type Result<TValue, TError = DomainError> =
  | { readonly ok: true; readonly value: TValue }
  | { readonly ok: false; readonly error: TError };

export const ok = <TValue>(value: TValue): Result<TValue, never> => ({ ok: true, value });

export const err = <TError>(error: TError): Result<never, TError> => ({ ok: false, error });

export const domainError = <TDetails extends Readonly<Record<string, unknown>>>(
  code: ApiErrorCode,
  message: string,
  details: TDetails,
): DomainError<TDetails> => ({ code, message, details });
