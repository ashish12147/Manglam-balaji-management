import { HttpStatus } from '@nestjs/common';

import { ApiError } from '../../common/http/api-error.js';

export interface StoredFailure {
  readonly code: string;
  readonly details: Record<string, unknown>;
  readonly message: string;
  readonly status: number;
}

export interface StoredFailureOutcome {
  readonly error: StoredFailure;
  readonly ok: false;
}

export interface StoredSuccessOutcome<T> {
  readonly data: T;
  readonly ok: true;
}


export type StoredOutcome<T> =
  | StoredFailureOutcome
  | StoredSuccessOutcome<T>;

export function failedOutcome<T>(
  failure: {
    readonly code: string;
    readonly details?: Record<string, unknown> | undefined;
    readonly message?: string | undefined;
    readonly status?: number | undefined;
  },
): StoredFailureOutcome {
  return {
    error: {
      code: failure.code,
      details: failure.details ?? {},
      message: failure.message ?? 'The supplied credentials are invalid.',
      status: failure.status ?? HttpStatus.UNAUTHORIZED,
    },
    ok: false,
  };
}

export function successfulOutcome<T>(data: T): StoredSuccessOutcome<T> {
  return { data, ok: true };
}

export function unwrapOutcome<T>(outcome: StoredOutcome<T>): T {
  if (outcome.ok) return outcome.data;
  throw new ApiError(outcome.error);
}
