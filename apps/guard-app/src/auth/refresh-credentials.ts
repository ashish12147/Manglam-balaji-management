export interface RefreshCredentials {
  refreshIdempotencyKey: string;
  refreshToken: string;
}

const IDEMPOTENCY_PREFIX = "session-refresh:";

export function createRefreshCredentials(
  refreshToken: string,
  randomUuid: string
): RefreshCredentials {
  if (refreshToken.length < 32) throw new Error("The refresh credential is invalid.");
  if (randomUuid.length < 16) throw new Error("The refresh idempotency seed is invalid.");
  return {
    refreshIdempotencyKey: `${IDEMPOTENCY_PREFIX}${randomUuid}`,
    refreshToken
  };
}

export function parseRefreshCredentials(stored: string): RefreshCredentials | null {
  try {
    const parsed = JSON.parse(stored) as Partial<RefreshCredentials>;
    if (
      typeof parsed.refreshToken !== "string" ||
      parsed.refreshToken.length < 32 ||
      typeof parsed.refreshIdempotencyKey !== "string" ||
      !parsed.refreshIdempotencyKey.startsWith(IDEMPOTENCY_PREFIX) ||
      parsed.refreshIdempotencyKey.length < IDEMPOTENCY_PREFIX.length + 16
    ) {
      return null;
    }
    return {
      refreshIdempotencyKey: parsed.refreshIdempotencyKey,
      refreshToken: parsed.refreshToken
    };
  } catch {
    return null;
  }
}

export function isDefinitiveRefreshFailure(status: number): boolean {
  return status >= 400 && status < 500;
}
