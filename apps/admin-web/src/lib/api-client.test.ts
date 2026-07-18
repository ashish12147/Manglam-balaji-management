import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  apiData,
  buildQuery,
  clearAccessToken,
  createDeviceFingerprint,
  DEVICE_FINGERPRINT_STORAGE_KEY,
  REFRESH_IDEMPOTENCY_STORAGE_KEY,
  getAccessToken,
  getDeviceFingerprint,
  logoutSession,
  normalizeList,
  setAccessToken,
  signInAdmin,
  unwrapData,
} from './api-client';

function jsonResponse(body: unknown, status = 200, correlationId = 'support-reference') {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
      'x-correlation-id': correlationId,
    },
  });
}

function memoryStorage(): Storage {
  const records = new Map<string, string>();

  return {
    get length() {
      return records.size;
    },
    clear: () => records.clear(),
    getItem: (key) => records.get(key) ?? null,
    key: (index) => [...records.keys()][index] ?? null,
    removeItem: (key) => records.delete(key),
    setItem: (key, value) => records.set(key, String(value)),
  };
}

function requestHeaders(fetchMock: ReturnType<typeof vi.fn>, index: number) {
  const request = fetchMock.mock.calls[index]?.[1] as RequestInit | undefined;
  return new Headers(request?.headers);
}

const sessionResponse = {
  accessToken: 'access-token-from-api',
  accessTokenExpiresAt: '2030-01-01T00:00:00.000Z',
  refreshToken: 'must-remain-in-the-http-only-cookie',
  sessionId: 'session-id',
  tokenType: 'Bearer',
};

describe('API transport helpers', () => {
  beforeEach(() => {
    const storage = memoryStorage();
    vi.stubGlobal('window', {
      localStorage: storage,
      navigator: { platform: 'Win32' },
    });
  });

  afterEach(() => {
    clearAccessToken();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('preserves existing query parameters while omitting empty values', () => {
    expect(buildQuery('/users?type=RESIDENT', { q: 'Ashish', cursor: null, limit: 25 })).toBe(
      '/users?type=RESIDENT&q=Ashish&limit=25',
    );
  });

  it('unwraps typed API data envelopes', () => {
    expect(unwrapData<{ id: string }>({ data: { id: 'record-1' } })).toEqual({
      id: 'record-1',
    });
  });

  it('normalizes cursor-paginated result envelopes', () => {
    expect(
      normalizeList<{ id: string }>({
        data: {
          items: [{ id: 'one' }],
          meta: { nextCursor: 'next-page', total: 9 },
        },
      }),
    ).toEqual({ items: [{ id: 'one' }], nextCursor: 'next-page', total: 9 });
  });

  it('returns a safe empty result for an absent payload', () => {
    expect(normalizeList(null)).toEqual({ items: [], nextCursor: null, total: null });
  });

  it('generates and persists a stable 32-byte non-credential device identifier', async () => {
    const generated = createDeviceFingerprint();
    const first = await getDeviceFingerprint();
    const second = await getDeviceFingerprint();

    expect(generated).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(Buffer.from(generated.replaceAll('-', '+').replaceAll('_', '/'), 'base64')).toHaveLength(
      32,
    );
    expect(first).toBe(second);
    expect(window.localStorage.getItem(DEVICE_FINGERPRINT_STORAGE_KEY)).toBe(first);
    expect(window.localStorage).toHaveLength(1);
  });

  it('uses the canonical admin sign-in payload and keeps only the access token in memory', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        data: sessionResponse,
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await signInAdmin({
      email: 'admin@manglambalaji.example',
      password: 'a-secure-password',
    });

    const [url, request] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(request.body)) as Record<string, unknown>;
    const device = body.device as Record<string, unknown>;
    const headers = requestHeaders(fetchMock, 0);

    expect(url).toMatch(/\/auth\/admin\/sign-in$/);
    expect(request.credentials).toBe('include');
    expect(body).toMatchObject({
      email: 'admin@manglambalaji.example',
      password: 'a-secure-password',
    });
    expect(body).not.toHaveProperty('mfaCode');
    expect(device).toMatchObject({
      fingerprint: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/),
      label: 'Manglam Balaji Admin Web',
      operatingSystem: 'Win32',
      platform: 'WEB',
    });
    expect(headers.get('authorization')).toBeNull();
    expect(headers.get('idempotency-key')).toBeTruthy();
    expect(headers.get('x-device-fingerprint')).toBe(device.fingerprint);
    expect(getAccessToken()).toBe('access-token-from-api');
    expect(
      [...Array(window.localStorage.length)].map((_, index) => window.localStorage.key(index)),
    ).toEqual([DEVICE_FINGERPRINT_STORAGE_KEY]);
    expect(
      [...Array(window.localStorage.length)].map((_, index) =>
        window.localStorage.getItem(window.localStorage.key(index) ?? ''),
      ),
    ).not.toContain(sessionResponse.refreshToken);
  });

  it('preserves the MFA_REQUIRED code and support reference for the login state machine', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(
        {
          error: {
            code: 'MFA_REQUIRED',
            correlationId: 'mfa-support-reference',
            message: 'Additional verification is required.',
          },
        },
        401,
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      signInAdmin({
        email: 'admin@manglambalaji.example',
        password: 'a-secure-password',
      }),
    ).rejects.toMatchObject({
      code: 'MFA_REQUIRED',
      correlationId: 'mfa-support-reference',
      status: 401,
    });
    expect(getAccessToken()).toBeNull();
  });
  it('resubmits MFA to the same sign-in endpoint with retained credentials', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ data: sessionResponse }));
    vi.stubGlobal('fetch', fetchMock);

    await signInAdmin({
      email: 'admin@manglambalaji.example',
      mfaCode: '123456',
      password: 'a-secure-password',
    });

    const [url, request] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/auth\/admin\/sign-in$/);
    expect(JSON.parse(String(request.body))).toMatchObject({
      email: 'admin@manglambalaji.example',
      mfaCode: '123456',
      password: 'a-secure-password',
    });
  });

  it('sends logout with bearer, fingerprint, and cookies before clearing memory', async () => {
    setAccessToken('active-access-token');
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ data: { revoked: true } }));
    vi.stubGlobal('fetch', fetchMock);

    await logoutSession();

    const [url, request] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = requestHeaders(fetchMock, 0);

    expect(url).toMatch(/\/auth\/logout$/);
    expect(request.credentials).toBe('include');
    expect(headers.get('authorization')).toBe('Bearer active-access-token');
    expect(headers.get('x-device-fingerprint')).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(getAccessToken()).toBeNull();
  });
  it('refreshes once on 401 and retries with the rotated in-memory bearer token', async () => {
    setAccessToken('expired-access-token');
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(
          {
            error: {
              code: 'ACCESS_TOKEN_EXPIRED',
              correlationId: 'expired-reference',
              message: 'Authentication is required.',
            },
          },
          401,
        ),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          data: {
            ...sessionResponse,
            accessToken: 'rotated-access-token',
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          data: {
            deviceId: 'device-id',
            effectivePermissions: ['society.read'],
            memberships: [],
            roleCodes: ['SOCIETY_ADMIN'],
            sessionId: 'session-id',
            sessionKind: 'PRIVILEGED',
            societyId: 'society-id',
            user: {
              displayName: 'Admin User',
              email: 'admin@manglambalaji.example',
              id: 'user-id',
              normalizedPhone: '+919999999999',
              preferredLocale: 'en-IN',
            },
          },
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ data: { ok: true } }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      apiData<{ ok: boolean }>('/protected-resource', {
        body: { action: 'approve' },
        idempotent: true,
        method: 'POST',
      }),
    ).resolves.toEqual({ ok: true });

    const refreshRequest = fetchMock.mock.calls[1]?.[1] as RequestInit;
    const refreshBody = JSON.parse(String(refreshRequest.body)) as {
      deviceFingerprint: string;
    };

    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(requestHeaders(fetchMock, 0).get('authorization')).toBe('Bearer expired-access-token');
    expect(String(fetchMock.mock.calls[1]?.[0])).toMatch(/\/auth\/refresh$/);
    expect(refreshRequest.credentials).toBe('include');
    expect(refreshBody.deviceFingerprint).toBe(
      requestHeaders(fetchMock, 1).get('x-device-fingerprint'),
    );
    expect(requestHeaders(fetchMock, 1).get('authorization')).toBeNull();
    expect(String(fetchMock.mock.calls[2]?.[0])).toMatch(/\/users\/me$/);
    expect(requestHeaders(fetchMock, 2).get('authorization')).toBe('Bearer rotated-access-token');
    expect(requestHeaders(fetchMock, 3).get('authorization')).toBe('Bearer rotated-access-token');
    expect(requestHeaders(fetchMock, 0).get('idempotency-key')).toBe(
      requestHeaders(fetchMock, 3).get('idempotency-key'),
    );
    expect(requestHeaders(fetchMock, 1).get('idempotency-key')).toBeTruthy();
    expect(window.localStorage.getItem(REFRESH_IDEMPOTENCY_STORAGE_KEY)).toBeNull();
    expect(getAccessToken()).toBe('rotated-access-token');
  });

  it('rejects off-origin API targets before sending credentials', async () => {
    setAccessToken('active-access-token');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(apiData('https://attacker.example/collect')).rejects.toMatchObject({
      code: 'INVALID_API_PATH',
      status: 0,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
