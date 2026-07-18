import * as Crypto from "expo-crypto";

import { ApiError, type ApiErrorBody } from "@/api/errors";
import { deviceFingerprintHeaders, protectedIdentityHeaders } from "@/api/request-contract";
import { isDefinitiveRefreshFailure } from "@/auth/refresh-credentials";
import { env } from "@/config/env";
import type { AuthTokens } from "@/types/domain";

interface AuthContext {
  accessToken: string | null;
  deviceFingerprint: string | null;
  gateId: string | null;
  refreshIdempotencyKey: string | null;
  refreshToken: string | null;
}

interface AuthAdapter {
  getContext: () => Promise<AuthContext> | AuthContext;
  onRefreshRejected: (refreshToken: string) => Promise<void> | void;
  onSessionExpired: () => Promise<void> | void;
  onTokensRotated: (tokens: AuthTokens) => Promise<void> | void;
}

export interface ApiRequestOptions {
  auth?: boolean;
  body?: unknown;
  headers?: Record<string, string>;
  idempotencyKey?: string;
  method?: "DELETE" | "GET" | "PATCH" | "POST" | "PUT";
  query?: Record<string, boolean | number | string | null | undefined>;
  signal?: AbortSignal;
  timeoutMs?: number;
}

const missingAdapter: AuthAdapter = {
  getContext: () => ({
    accessToken: null,
    deviceFingerprint: null,
    gateId: null,
    refreshIdempotencyKey: null,
    refreshToken: null
  }),
  onRefreshRejected: () => undefined,
  onSessionExpired: () => undefined,
  onTokensRotated: () => undefined
};

let authAdapter: AuthAdapter = missingAdapter;
let refreshPromise: Promise<AuthTokens> | null = null;

export function configureApiAuth(adapter: AuthAdapter): void {
  authAdapter = adapter;
}

function makeUrl(path: string, query?: ApiRequestOptions["query"]): string {
  if (!env.apiUrl) {
    throw new ApiError({
      code: "APP_NOT_CONFIGURED",
      message: "This app build is not connected to the society server.",
      status: 0
    });
  }
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = new URL(`${env.apiUrl}${normalizedPath}`);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== null && value !== undefined && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

async function parseBody(response: Response): Promise<unknown> {
  if (response.status === 204) return null;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response.text();
  return response.json();
}

function unwrap<T>(body: unknown): T {
  if (body && typeof body === "object" && "data" in body) {
    return (body as { data: T }).data;
  }
  return body as T;
}

function toApiError(response: Response, body: unknown): ApiError {
  const envelope = body as ApiErrorBody;
  return new ApiError({
    code: envelope?.error?.code ?? `HTTP_${response.status}`,
    correlationId: envelope?.error?.correlationId ?? response.headers.get("x-correlation-id"),
    details: envelope?.error?.details,
    message: envelope?.error?.message ?? "The society server rejected this operation.",
    status: response.status
  });
}

async function rotateTokens(): Promise<AuthTokens> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    const context = await authAdapter.getContext();
    if (
      !context.refreshToken ||
      !context.refreshIdempotencyKey ||
      !context.deviceFingerprint
    ) {
      throw new ApiError({
        code: "SESSION_EXPIRED",
        message: "Your guard shift has expired. Sign in again.",
        status: 401
      });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);
    let response: Response;
    try {
      response = await fetch(makeUrl("/auth/refresh"), {
        body: JSON.stringify({
          deviceFingerprint: context.deviceFingerprint,
          refreshToken: context.refreshToken
        }),
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          ...deviceFingerprintHeaders(context.deviceFingerprint),
          "Idempotency-Key": context.refreshIdempotencyKey,
          "X-Correlation-ID": Crypto.randomUUID()
        },
        method: "POST",
        signal: controller.signal
      });
    } catch (error) {
      const timedOut = error instanceof Error && error.name === "AbortError";
      throw new ApiError({
        code: timedOut ? "REQUEST_TIMEOUT" : "NETWORK_UNAVAILABLE",
        details: error,
        message: timedOut
          ? "The server took too long to refresh this shift."
          : "The society server could not be reached.",
        status: 0
      });
    } finally {
      clearTimeout(timeout);
    }

    const body = await parseBody(response);
    if (!response.ok) {
      const error = toApiError(response, body);
      if (isDefinitiveRefreshFailure(response.status)) {
        if (response.status === 401 || response.status === 403) {
          await authAdapter.onSessionExpired();
        } else {
          await authAdapter.onRefreshRejected(context.refreshToken);
        }
      }
      throw error;
    }
    const tokens = unwrap<AuthTokens>(body);
    await authAdapter.onTokensRotated(tokens);
    return tokens;
  })().finally(() => {
    refreshPromise = null;
  });
  return refreshPromise;
}

async function performRequest<T>(
  path: string,
  options: ApiRequestOptions,
  hasRetriedAfterRefresh: boolean
): Promise<T> {
  const authRequired = options.auth !== false;
  const context = await authAdapter.getContext();
  let identityHeaders: Record<string, string> = {};
  if (authRequired) {
    try {
      identityHeaders = protectedIdentityHeaders(context);
    } catch (error) {
      throw new ApiError({
        code: "DEVICE_IDENTITY_MISSING",
        details: error,
        message: "This protected request has no registered device identity.",
        status: 0
      });
    }
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 20_000);
  const externalAbort = () => controller.abort();
  if (options.signal?.aborted) controller.abort();
  else options.signal?.addEventListener("abort", externalAbort, { once: true });

  try {
    const response = await fetch(makeUrl(path, options.query), {
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      headers: {
        Accept: "application/json",
        ...(options.body === undefined ? {} : { "Content-Type": "application/json" }),
        "X-Correlation-ID": Crypto.randomUUID(),
        ...identityHeaders,
        ...(options.idempotencyKey ? { "Idempotency-Key": options.idempotencyKey } : {}),
        ...options.headers
      },
      method: options.method ?? (options.body === undefined ? "GET" : "POST"),
      signal: controller.signal
    });

    if (response.status === 401 && authRequired && !hasRetriedAfterRefresh) {
      await rotateTokens();
      return performRequest(path, options, true);
    }

    const body = await parseBody(response);
    if (!response.ok) throw toApiError(response, body);
    return unwrap<T>(body);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    const aborted = error instanceof Error && error.name === "AbortError";
    throw new ApiError({
      code: aborted ? "REQUEST_TIMEOUT" : "NETWORK_UNAVAILABLE",
      details: error,
      message: aborted
        ? "The server took too long to respond. Check the connection and try again."
        : "The society server could not be reached.",
      status: 0
    });
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener("abort", externalAbort);
  }
}

export const api = {
  delete: <T>(path: string, options: Omit<ApiRequestOptions, "method"> = {}) =>
    performRequest<T>(path, { ...options, method: "DELETE" }, false),
  get: <T>(path: string, options: Omit<ApiRequestOptions, "method"> = {}) =>
    performRequest<T>(path, { ...options, method: "GET" }, false),
  patch: <T>(path: string, body: unknown, options: Omit<ApiRequestOptions, "body" | "method"> = {}) =>
    performRequest<T>(path, { ...options, body, method: "PATCH" }, false),
  post: <T>(path: string, body?: unknown, options: Omit<ApiRequestOptions, "body" | "method"> = {}) =>
    performRequest<T>(path, { ...options, body, method: "POST" }, false),
  put: <T>(path: string, body: unknown, options: Omit<ApiRequestOptions, "body" | "method"> = {}) =>
    performRequest<T>(path, { ...options, body, method: "PUT" }, false),
  refresh: rotateTokens
};
