export interface ApiErrorBody {
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
    correlationId?: string;
  };
}

export class ApiError extends Error {
  readonly code: string;
  readonly correlationId: string | null;
  readonly details: unknown;
  readonly status: number;

  constructor(input: {
    code: string;
    message: string;
    status: number;
    correlationId?: string | null;
    details?: unknown;
  }) {
    super(input.message);
    this.name = "ApiError";
    this.code = input.code;
    this.status = input.status;
    this.correlationId = input.correlationId ?? null;
    this.details = input.details;
  }
}

export function isApiError(value: unknown): value is ApiError {
  return value instanceof ApiError;
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return "The operation could not be completed. Please try again.";
}

export function isRetryableApiError(error: unknown): boolean {
  if (!(error instanceof ApiError)) return false;
  return error.status === 0 || error.status === 408 || error.status === 429 || error.status >= 500;
}
