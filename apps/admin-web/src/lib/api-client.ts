import type {
  AdminCredentials,
  AuthDevice,
  AuthSessionResponse,
  CurrentUser,
  CurrentUserResponse,
} from './api-types';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface ApiErrorBody {
  code?: string;
  correlationId?: string;
  details?: unknown;
  message?: string;
}

export class ApiError extends Error {
  readonly code: string;
  readonly correlationId: string | undefined;
  readonly details: unknown;
  readonly status: number;

  constructor(
    status: number,
    code: string,
    message: string,
    correlationId?: string,
    details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.correlationId = correlationId;
    this.details = details;
  }
}

export interface RequestOptions {
  authenticated?: boolean;
  body?: unknown;
  headers?: Record<string, string>;
  idempotent?: boolean;
  method?: HttpMethod;
  retryAuth?: boolean;
  signal?: AbortSignal;
}

export type QueryValue = boolean | number | string | null | undefined;

export const DEVICE_FINGERPRINT_STORAGE_KEY = 'manglam.admin.device-fingerprint.v1';
export const REFRESH_IDEMPOTENCY_STORAGE_KEY = 'manglam.admin.refresh-idempotency.v1';

const AUTH_PATHS = new Set(['/auth/admin/sign-in', '/auth/refresh', '/auth/logout']);
const FINGERPRINT_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

let accessToken: string | null = null;
let refreshPromise: Promise<string> | null = null;

function getRefreshIdempotencyKey() {
  if (typeof window === 'undefined') {
    throw new ApiError(
      0,
      'BROWSER_REQUIRED',
      'Authentication must be completed in a supported browser.',
    );
  }

  try {
    const stored = window.localStorage.getItem(REFRESH_IDEMPOTENCY_STORAGE_KEY);
    if (stored && UUID_PATTERN.test(stored)) return stored;

    const generated = globalThis.crypto.randomUUID();
    window.localStorage.setItem(REFRESH_IDEMPOTENCY_STORAGE_KEY, generated);
    return generated;
  } catch {
    throw new ApiError(
      0,
      'DEVICE_STORAGE_UNAVAILABLE',
      'Secure sign-in requires browser storage for this device identifier.',
    );
  }
}

function clearRefreshIdempotencyKey() {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.removeItem(REFRESH_IDEMPOTENCY_STORAGE_KEY);
  } catch {
    // A failed cleanup is harmless; the server will replay the recorded refresh response.
  }
}

export function apiBaseUrl() {
  return (process.env.NEXT_PUBLIC_API_URL || '/api/v1').replace(/\/$/, '');
}

export function buildQuery(path: string, values: Record<string, QueryValue>): string {
  const [pathname, existing = ''] = path.split('?', 2);
  const params = new URLSearchParams(existing);

  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      params.set(key, String(value));
    }
  });

  const query = params.toString();
  return query ? `${pathname}?${query}` : (pathname ?? path);
}

export function createDeviceFingerprint() {
  if (!globalThis.crypto?.getRandomValues) {
    throw new ApiError(
      0,
      'DEVICE_ID_UNAVAILABLE',
      'This browser cannot establish a secure device identity.',
    );
  }

  const bytes = new Uint8Array(32);
  globalThis.crypto.getRandomValues(bytes);
  const encoded = btoa(String.fromCharCode(...bytes))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '');

  if (!FINGERPRINT_PATTERN.test(encoded)) {
    throw new ApiError(
      0,
      'DEVICE_ID_UNAVAILABLE',
      'This browser cannot establish a secure device identity.',
    );
  }

  return encoded;
}

export async function getDeviceFingerprint() {
  if (typeof window === 'undefined') {
    throw new ApiError(
      0,
      'BROWSER_REQUIRED',
      'Authentication must be completed in a supported browser.',
    );
  }

  try {
    const stored = window.localStorage.getItem(DEVICE_FINGERPRINT_STORAGE_KEY);
    if (stored && FINGERPRINT_PATTERN.test(stored)) {
      return stored;
    }

    const generated = createDeviceFingerprint();
    window.localStorage.setItem(DEVICE_FINGERPRINT_STORAGE_KEY, generated);
    return generated;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(
      0,
      'DEVICE_STORAGE_UNAVAILABLE',
      'Secure sign-in requires browser storage for this device identifier.',
    );
  }
}

export async function getWebAuthDevice(): Promise<AuthDevice> {
  const fingerprint = await getDeviceFingerprint();
  const browserNavigator = window.navigator as Navigator & {
    userAgentData?: { platform?: string };
  };
  const operatingSystem = (
    browserNavigator.userAgentData?.platform ||
    browserNavigator.platform ||
    'Unknown'
  )
    .trim()
    .slice(0, 80);

  return {
    fingerprint,
    label: 'Manglam Balaji Admin Web',
    operatingSystem,
    platform: 'WEB',
  };
}

export function getAccessToken() {
  return accessToken;
}

export function setAccessToken(token: string) {
  const normalized = token.trim();
  if (!normalized) {
    throw new ApiError(
      502,
      'INVALID_AUTH_RESPONSE',
      'The authentication response could not be accepted.',
    );
  }
  accessToken = normalized;
  return normalized;
}

export function clearAccessToken() {
  accessToken = null;
}

export function acceptAuthSession(session: AuthSessionResponse) {
  if (!session || typeof session.accessToken !== 'string') {
    throw new ApiError(
      502,
      'INVALID_AUTH_RESPONSE',
      'The authentication response could not be accepted.',
    );
  }
  return setAccessToken(session.accessToken);
}

export async function signInAdmin(input: AdminCredentials & { mfaCode?: string }) {
  const device = await getWebAuthDevice();
  const session = await apiData<AuthSessionResponse>('/auth/admin/sign-in', {
    authenticated: false,
    body: {
      device,
      email: input.email,
      ...(input.mfaCode ? { mfaCode: input.mfaCode } : {}),
      password: input.password,
    },
    idempotent: true,
    method: 'POST',
    retryAuth: false,
  });
  acceptAuthSession(session);
  return session;
}

export async function logoutSession() {
  try {
    await apiRequest('/auth/logout', {
      method: 'POST',
      retryAuth: false,
    });
  } finally {
    clearAccessToken();
  }
}

function resolveUrl(path: string) {
  if (/^[a-z][a-z\d+.-]*:/i.test(path) || path.startsWith('//')) {
    throw new ApiError(0, 'INVALID_API_PATH', 'The requested API path is not permitted.');
  }
  return `${apiBaseUrl()}${path.startsWith('/') ? path : `/${path}`}`;
}

function isNativeBody(body: unknown): body is BodyInit {
  return body instanceof FormData || body instanceof Blob || typeof body === 'string';
}

async function requestHeaders(options: RequestOptions) {
  const headers = new Headers(options.headers);
  const fingerprint = await getDeviceFingerprint();

  headers.set('Accept', 'application/json');
  headers.set('X-Client', 'admin-web');
  headers.set('X-Correlation-Id', globalThis.crypto.randomUUID());
  headers.set('X-Device-Fingerprint', fingerprint);

  if (options.authenticated ?? true) {
    if (!accessToken) {
      throw new ApiError(
        401,
        'AUTHENTICATION_REQUIRED',
        'Your session has expired. Sign in again to continue.',
      );
    }
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  if (options.body !== undefined && !isNativeBody(options.body)) {
    headers.set('Content-Type', 'application/json');
  }

  if (options.idempotent && !headers.has('Idempotency-Key')) {
    headers.set('Idempotency-Key', globalThis.crypto.randomUUID());
  }
  return headers;
}

function withStableIdempotencyKey(options: RequestOptions): RequestOptions {
  if (!options.idempotent) return options;

  const headers = new Headers(options.headers);
  if (!headers.has('Idempotency-Key')) {
    headers.set('Idempotency-Key', globalThis.crypto.randomUUID());
  }
  const stableHeaders: Record<string, string> = {};
  headers.forEach((value, key) => {
    stableHeaders[key] = value;
  });
  return { ...options, headers: stableHeaders };
}

async function parseError(response: Response) {
  let body: { error?: ApiErrorBody } & ApiErrorBody = {};

  try {
    body = (await response.json()) as typeof body;
  } catch {
    // Non-JSON gateway failures still receive a stable public message below.
  }

  const error = body.error ?? body;
  const correlationId =
    error.correlationId || response.headers.get('x-correlation-id') || undefined;

  return new ApiError(
    response.status,
    error.code || `HTTP_${response.status}`,
    error.message || 'The request could not be completed.',
    correlationId,
    error.details,
  );
}

async function responsePayload(response: Response): Promise<unknown> {
  if (response.status === 204) return undefined;
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) return response.text();
  return response.json();
}

async function performFetch(path: string, options: RequestOptions) {
  const method = options.method ?? 'GET';
  const body =
    options.body === undefined
      ? undefined
      : isNativeBody(options.body)
        ? options.body
        : JSON.stringify(options.body);

  try {
    return await fetch(resolveUrl(path), {
      method,
      headers: await requestHeaders(options),
      credentials: 'include',
      cache: 'no-store',
      ...(body === undefined ? {} : { body }),
      ...(options.signal ? { signal: options.signal } : {}),
    });
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(
      0,
      'NETWORK_ERROR',
      'The server could not be reached. Check your connection and try again.',
    );
  }
}

export async function refreshAccessToken() {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const deviceFingerprint = await getDeviceFingerprint();
    const refreshIdempotencyKey = getRefreshIdempotencyKey();
    const response = await performFetch('/auth/refresh', {
      authenticated: false,
      body: { deviceFingerprint },
      headers: { 'Idempotency-Key': refreshIdempotencyKey },
      idempotent: true,
      method: 'POST',
      retryAuth: false,
    });

    if (!response.ok) {
      clearAccessToken();
      if (response.status < 500) clearRefreshIdempotencyKey();
      throw await parseError(response);
    }

    const session = unwrapData<AuthSessionResponse>(await responsePayload(response));
    const token = acceptAuthSession(session);
    clearRefreshIdempotencyKey();
    return token;
  })();

  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
  }
}

async function verifyRefreshedIdentity(requestedPath: string) {
  if (requestedPath !== '/users/me') {
    await apiCurrentUser({ retryAuth: false });
  }
}

async function authenticatedFetch(path: string, options: RequestOptions) {
  const stableOptions = withStableIdempotencyKey(options);
  const authenticated = stableOptions.authenticated ?? true;
  const retryAuth = stableOptions.retryAuth ?? true;
  const pathname = path.split('?')[0] ?? path;

  if (authenticated && !accessToken) {
    if (!retryAuth || AUTH_PATHS.has(pathname)) {
      throw new ApiError(
        401,
        'AUTHENTICATION_REQUIRED',
        'Your session has expired. Sign in again to continue.',
      );
    }
    await refreshAccessToken();
    await verifyRefreshedIdentity(pathname);
  }

  let response = await performFetch(path, stableOptions);

  if (response.status === 401 && authenticated && retryAuth && !AUTH_PATHS.has(pathname)) {
    clearAccessToken();
    await refreshAccessToken();
    await verifyRefreshedIdentity(pathname);
    response = await performFetch(path, { ...stableOptions, retryAuth: false });
  }

  return response;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const response = await authenticatedFetch(path, options);
  if (!response.ok) throw await parseError(response);
  return (await responsePayload(response)) as T;
}

export function unwrapData<T>(payload: unknown): T {
  if (
    payload &&
    typeof payload === 'object' &&
    'data' in payload &&
    (payload as { data: unknown }).data !== undefined
  ) {
    return (payload as { data: T }).data;
  }
  return payload as T;
}

export async function apiData<T>(path: string, options: RequestOptions = {}): Promise<T> {
  return unwrapData<T>(await apiRequest<unknown>(path, options));
}

export async function apiCurrentUser(options: RequestOptions = {}): Promise<CurrentUser> {
  const identity = await apiData<CurrentUserResponse>('/users/me', options);

  if (
    !identity ||
    !identity.user ||
    typeof identity.user.id !== 'string' ||
    typeof identity.user.displayName !== 'string' ||
    !Array.isArray(identity.effectivePermissions) ||
    !Array.isArray(identity.memberships) ||
    !Array.isArray(identity.roleCodes)
  ) {
    throw new ApiError(
      502,
      'INVALID_CURRENT_USER_RESPONSE',
      'The session profile returned by the server was invalid.',
    );
  }

  return {
    ...identity.user,
    deviceId: identity.deviceId,
    memberships: [...identity.memberships],
    permissions: [...identity.effectivePermissions],
    roles: [...identity.roleCodes],
    sessionId: identity.sessionId,
    sessionKind: identity.sessionKind,
    societyId: identity.societyId,
  };
}

export interface ListResult<T> {
  items: T[];
  nextCursor: string | null;
  total: number | null;
}

export function normalizeList<T>(payload: unknown): ListResult<T> {
  const unwrapped = unwrapData<unknown>(payload);

  if (Array.isArray(unwrapped)) {
    return { items: unwrapped as T[], nextCursor: null, total: unwrapped.length };
  }

  if (!unwrapped || typeof unwrapped !== 'object') {
    return { items: [], nextCursor: null, total: null };
  }

  const record = unwrapped as Record<string, unknown>;
  const items = Array.isArray(record.items)
    ? (record.items as T[])
    : Array.isArray(record.results)
      ? (record.results as T[])
      : [];
  const meta =
    record.meta && typeof record.meta === 'object'
      ? (record.meta as Record<string, unknown>)
      : record;
  const nextCursor =
    typeof meta.nextCursor === 'string'
      ? meta.nextCursor
      : typeof meta.next_cursor === 'string'
        ? meta.next_cursor
        : null;
  const total = typeof meta.total === 'number' ? meta.total : null;

  return { items, nextCursor, total };
}

export async function apiList<T>(
  path: string,
  query: Record<string, QueryValue> = {},
  signal?: AbortSignal,
) {
  const payload = await apiRequest<unknown>(buildQuery(path, query), {
    ...(signal ? { signal } : {}),
  });
  return normalizeList<T>(payload);
}

export async function apiDownload(path: string, fileName: string) {
  const response = await authenticatedFetch(path, { retryAuth: true });
  if (!response.ok) throw await parseError(response);

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = fileName;
  anchor.rel = 'noopener';
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}

export function isPermissionError(error: unknown) {
  return error instanceof ApiError && error.status === 403;
}

export function isSessionError(error: unknown) {
  return error instanceof ApiError && error.status === 401;
}
