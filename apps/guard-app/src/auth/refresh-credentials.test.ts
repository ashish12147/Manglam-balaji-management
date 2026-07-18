import { describe, expect, it } from "vitest";

import {
  createRefreshCredentials,
  isDefinitiveRefreshFailure,
  parseRefreshCredentials
} from "./refresh-credentials";

describe("refresh credential persistence", () => {
  it("stores one idempotency key beside the refresh token", () => {
    const credentials = createRefreshCredentials(
      "r".repeat(64),
      "12345678-1234-4234-9234-123456789abc"
    );
    expect(credentials).toEqual({
      refreshIdempotencyKey: "session-refresh:12345678-1234-4234-9234-123456789abc",
      refreshToken: "r".repeat(64)
    });
    expect(parseRefreshCredentials(JSON.stringify(credentials))).toEqual(credentials);
  });

  it("rejects malformed or incomplete secure envelopes", () => {
    expect(parseRefreshCredentials("not-json")).toBeNull();
    expect(parseRefreshCredentials(JSON.stringify({ refreshToken: "r".repeat(64) }))).toBeNull();
    expect(() => createRefreshCredentials("short", "1234567890123456")).toThrow(
      /refresh credential/i
    );
  });

  it("retires a key only after a definitive 4xx response", () => {
    expect(isDefinitiveRefreshFailure(400)).toBe(true);
    expect(isDefinitiveRefreshFailure(401)).toBe(true);
    expect(isDefinitiveRefreshFailure(429)).toBe(true);
    expect(isDefinitiveRefreshFailure(0)).toBe(false);
    expect(isDefinitiveRefreshFailure(500)).toBe(false);
    expect(isDefinitiveRefreshFailure(503)).toBe(false);
  });
});
