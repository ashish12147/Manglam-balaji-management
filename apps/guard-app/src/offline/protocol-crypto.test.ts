import { describe, expect, it, vi } from "vitest";

import {
  bytesToHex,
  canonicalJson,
  hmacSha256,
  signOfflineMutation,
  type Sha256Digest,
  utf8Bytes
} from "./protocol-crypto";

vi.mock("expo-crypto", () => ({
  CryptoDigestAlgorithm: { SHA256: "SHA-256" },
  digest: vi.fn()
}));

const webSha256: Sha256Digest = async (data) => {
  const owned = Uint8Array.from(data);
  return new Uint8Array(await globalThis.crypto.subtle.digest("SHA-256", owned.buffer));
};

describe("offline protocol cryptography", () => {
  it("canonicalizes nested payloads in server-compatible key order", () => {
    expect(canonicalJson({ z: [2, { b: true, a: null }], a: "जय" })).toBe(
      '{"a":"जय","z":[2,{"a":null,"b":true}]}'
    );
  });

  it("rejects undefined values instead of signing a different payload", () => {
    expect(() => canonicalJson({ value: undefined } as never)).toThrow("undefined");
  });

  it("matches the RFC 4231 HMAC-SHA256 vector", async () => {
    const signature = await hmacSha256(
      utf8Bytes("Jefe"),
      utf8Bytes("what do ya want for nothing?"),
      webSha256
    );
    expect(bytesToHex(signature)).toBe(
      "5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843"
    );
  });

  it("binds the signature to sequence, aggregate, and payload hash", async () => {
    const common = {
      aggregateId: "e08a2428-6cf9-4a25-872c-181317fa8622",
      baseVersion: 4,
      clientMutationId: "fd8f4012-1687-4a8f-a516-af11b127ea04",
      clientOccurredAt: "2026-07-17T12:00:00.000Z",
      deviceId: "4e6a9fe0-3830-4a20-ad69-a50bb63253ad",
      gateId: "f9ff76d9-41db-4486-bf76-9792f39bfdd3",
      localSequence: 12,
      operation: "VISIT_CHECK_OUT",
      payloadHash: "8".repeat(64)
    };
    const first = await signOfflineMutation(
      common,
      "device-secret-that-is-at-least-32-characters",
      webSha256
    );
    const second = await signOfflineMutation(
      { ...common, localSequence: 13 },
      "device-secret-that-is-at-least-32-characters",
      webSha256
    );
    expect(first).toMatch(/^[a-f0-9]{64}$/);
    expect(second).not.toBe(first);
  });
});
