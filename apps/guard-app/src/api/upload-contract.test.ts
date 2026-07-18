import { describe, expect, it } from "vitest";

import {
  bytesToBase64,
  isPendingFileStatus,
  isRejectedFileStatus,
  parseFileScanStatus,
  requireSignedUploadHeaders
} from "./upload-contract";

describe("private upload contract", () => {
  it("encodes SHA-256 bytes as standard padded base64", () => {
    expect(bytesToBase64(new Uint8Array([0, 1, 2, 253, 254, 255]))).toBe("AAEC/f7/");
    expect(bytesToBase64(new Uint8Array([255]))).toBe("/w==");
  });

  it("requires every signed header to match the bytes being uploaded", () => {
    const headers = {
      "content-type": "image/jpeg",
      "x-amz-checksum-sha256": "A".repeat(43) + "=",
      "x-amz-meta-maximum-bytes": "42"
    };
    expect(
      requireSignedUploadHeaders(headers, {
        bytes: 42,
        checksumSha256: "A".repeat(43) + "=",
        mimeType: "image/jpeg"
      })
    ).toEqual(headers);
    expect(() =>
      requireSignedUploadHeaders(headers, {
        bytes: 41,
        checksumSha256: "A".repeat(43) + "=",
        mimeType: "image/jpeg"
      })
    ).toThrow(/byte count/i);
  });

  it("keeps scan pending and rejected states distinct", () => {
    expect(isPendingFileStatus(parseFileScanStatus("QUARANTINED"))).toBe(true);
    expect(isPendingFileStatus(parseFileScanStatus("SCANNING"))).toBe(true);
    expect(isRejectedFileStatus(parseFileScanStatus("REJECTED"))).toBe(true);
    expect(() => parseFileScanStatus("AVAILABLE")).toThrow(/unknown scan status/i);
  });
});
