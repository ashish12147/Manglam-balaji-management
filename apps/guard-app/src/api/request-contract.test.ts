import { describe, expect, it } from "vitest";

import { deviceFingerprintHeaders, protectedIdentityHeaders } from "./request-contract";

describe("request device identity", () => {
  it("sends bearer authentication with the stable device fingerprint", () => {
    expect(
      protectedIdentityHeaders({
        accessToken: "access-token",
        deviceFingerprint: "cd".repeat(32),
        gateId: "e9dcbeec-6070-40dd-a1ac-ad82a9a50bd2"
      })
    ).toEqual({
      Authorization: "Bearer access-token",
      "X-Device-Fingerprint": "cd".repeat(32),
      "X-Gate-ID": "e9dcbeec-6070-40dd-a1ac-ad82a9a50bd2"
    });
  });

  it("builds the same fingerprint header for refresh and pre-auth guard calls", () => {
    expect(deviceFingerprintHeaders("ab".repeat(32))).toEqual({
      "X-Device-Fingerprint": "ab".repeat(32)
    });
  });

  it("refuses missing or malformed device fingerprints", () => {
    expect(() =>
      protectedIdentityHeaders({ accessToken: "token", deviceFingerprint: null, gateId: null })
    ).toThrow(/32-byte SecureStore device fingerprint/);
    expect(() => deviceFingerprintHeaders("not-a-fingerprint")).toThrow(/32-byte/);
  });
});
