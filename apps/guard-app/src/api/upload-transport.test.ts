import { afterEach, describe, expect, it, vi } from "vitest";

import { putSignedUpload, requireAllowedSignedUploadUrl } from "./upload-transport";

afterEach(() => {
  vi.useRealTimers();
});

describe("signed upload transport", () => {
  it("requires HTTPS outside development", () => {
    expect(requireAllowedSignedUploadUrl("https://storage.example.test/object", "production"))
      .toBe("https://storage.example.test/object");
    expect(() =>
      requireAllowedSignedUploadUrl("http://storage.example.test/object", "production")
    ).toThrow(/HTTPS/i);
    expect(requireAllowedSignedUploadUrl("http://10.0.2.2:9000/object", "development"))
      .toBe("http://10.0.2.2:9000/object");
  });

  it("sends only the exact signed headers and exact bytes", async () => {
    const bytes = new Uint8Array([1, 2, 3]).buffer;
    const headers = {
      "content-type": "image/jpeg",
      "x-amz-checksum-sha256": "A".repeat(43) + "=",
      "x-amz-meta-maximum-bytes": "3"
    };
    const response = new Response(null, { status: 200 });
    const fetchImpl = vi.fn().mockResolvedValue(response);
    await expect(
      putSignedUpload({ body: bytes, fetchImpl, headers, url: "https://storage.test/object" })
    ).resolves.toBe(response);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0]?.[1]).toMatchObject({ body: bytes, headers, method: "PUT" });
  });

  it("aborts a stalled PUT and clears its timer", async () => {
    vi.useFakeTimers();
    const fetchImpl = vi.fn((_url: string | URL | Request, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () =>
          reject(new DOMException("Aborted", "AbortError"))
        );
      })
    );
    const request = putSignedUpload({
      body: new ArrayBuffer(1),
      fetchImpl: fetchImpl as typeof fetch,
      headers: {},
      timeoutMs: 25,
      url: "https://storage.test/object"
    });
    const rejection = expect(request).rejects.toMatchObject({ name: "AbortError" });
    await vi.advanceTimersByTimeAsync(25);
    await rejection;
    expect(vi.getTimerCount()).toBe(0);
  });
});
