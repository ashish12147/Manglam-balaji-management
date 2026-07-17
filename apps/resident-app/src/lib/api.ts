import * as Crypto from 'expo-crypto';

import { getRuntimeConfig } from '@/lib/config';
import { getOrCreateDeviceId } from '@/lib/storage';

interface ApiErrorPayload {
  error?: {
    code?: string;
    correlationId?: string;
    details?: unknown;
    message?: string;
  };
}

export class ApiError extends Error {
  readonly code: string;
  readonly correlationId?: string;
  readonly details?: unknown;
  readonly status: number;

  constructor(input: {
    code: string;
    correlationId?: string;
    details?: unknown;
    message: string;
    status: number;
  }) {
    super(input.message);
    this.name = 'ApiError';
    this.code = input.code;
    this.status = input.status;
    if (input.correlationId !== undefined) this.correlationId = input.correlationId;
    if (input.details !== undefined) this.details = input.details;
  }
}

export class NetworkError extends Error {
  constructor(message = 'The service could not be reached. Check your connection and try again.') {
    super(message);
    this.name = 'NetworkError';
  }
}

type RefreshHandler = () => Promise<void>;

export interface ApiRequestOptions {
  auth?: boolean;
  body?: unknown;
  headers?: Record<string, string>;
  idempotencyKey?: string;
  method?: 'DELETE' | 'GET' | 'PATCH' | 'POST' | 'PUT';
  retryAuth?: boolean;
  signal?: AbortSignal;
  timeoutMs?: number;
}

function unwrapEnvelope<T>(value: unknown): T {
  if (value && typeof value === 'object' && 'data' in value) {
    return (value as { data: T }).data;
  }
  return value as T;
}

function parseError(status: number, payload: unknown): ApiError {
  const parsed = payload as ApiErrorPayload;
  const correlationId = parsed.error?.correlationId;
  return new ApiError({
    code: parsed.error?.code ?? `HTTP_${status}`,
    ...(correlationId ? { correlationId } : {}),
    ...(parsed.error?.details !== undefined ? { details: parsed.error.details } : {}),
    message: parsed.error?.message ?? 'The request could not be completed.',
    status,
  });
}

class ApiClient {
  private accessToken: string | null = null;
  private membershipId: string | null = null;
  private refreshHandler: RefreshHandler | null = null;
  private refreshPromise: Promise<void> | null = null;

  getAccessToken(): string | null {
    return this.accessToken;
  }

  setAccessToken(token: string | null): void {
    this.accessToken = token;
  }

  setMembershipId(membershipId: string | null): void {
    this.membershipId = membershipId;
  }

  setRefreshHandler(handler: RefreshHandler | null): void {
    this.refreshHandler = handler;
  }

  async request<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
    const config = getRuntimeConfig();
    const deviceId = await getOrCreateDeviceId();
    const controller = new AbortController();
    let timedOut = false;
    const timeoutId = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, options.timeoutMs ?? 15_000);
    const abortFromCaller = () => controller.abort();
    if (options.signal?.aborted) controller.abort();
    else options.signal?.addEventListener('abort', abortFromCaller, { once: true });
    const auth = options.auth ?? true;
    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...(options.body !== undefined && !(options.body instanceof FormData)
        ? { 'Content-Type': 'application/json' }
        : {}),
      'X-Device-Fingerprint': deviceId,
      ...options.headers,
    };

    if (auth && this.accessToken) headers.Authorization = `Bearer ${this.accessToken}`;
    if (this.membershipId) headers['X-Membership-Id'] = this.membershipId;
    if (options.idempotencyKey) headers['Idempotency-Key'] = options.idempotencyKey;

    try {
      const response = await fetch(`${config.apiUrl}${path}`, {
        method: options.method ?? 'GET',
        headers,
        ...(options.body !== undefined
          ? {
              body: options.body instanceof FormData ? options.body : JSON.stringify(options.body),
            }
          : {}),
        signal: controller.signal,
      });

      const payload: unknown =
        response.status === 204 ? undefined : await response.json().catch(() => undefined);

      if (response.status === 401 && auth && (options.retryAuth ?? true) && this.refreshHandler) {
        this.refreshPromise ??= this.refreshHandler().finally(() => {
          this.refreshPromise = null;
        });
        await this.refreshPromise;
        return this.request<T>(path, { ...options, retryAuth: false });
      }

      if (!response.ok) throw parseError(response.status, payload);
      return unwrapEnvelope<T>(payload);
    } catch (error) {
      if (error instanceof ApiError) throw error;
      if (error instanceof Error && error.name === 'AbortError') {
        throw new NetworkError(
          timedOut ? 'The request timed out. Please try again.' : 'The request was cancelled.',
        );
      }
      throw new NetworkError();
    } finally {
      clearTimeout(timeoutId);
      options.signal?.removeEventListener('abort', abortFromCaller);
    }
  }
}

export const apiClient = new ApiClient();

export function createIdempotencyKey(scope: string): string {
  return `${scope}:${Crypto.randomUUID()}`;
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError || error instanceof NetworkError) return error.message;
  return 'Something went wrong. Please try again.';
}

export function errorReference(error: unknown): string | undefined {
  return error instanceof ApiError ? error.correlationId : undefined;
}
