export type UploadEnvironment = "development" | "staging" | "production";

export function requireAllowedSignedUploadUrl(
  value: string,
  environment: UploadEnvironment
): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("The signed upload URL is invalid.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("The signed upload URL must use HTTP or HTTPS.");
  }
  if (environment !== "development" && url.protocol !== "https:") {
    throw new Error("Staging and production uploads require an HTTPS signed URL.");
  }
  return url.toString();
}

export async function putSignedUpload(input: {
  body: ArrayBuffer;
  fetchImpl?: typeof fetch;
  headers: Readonly<Record<string, string>>;
  timeoutMs?: number;
  url: string;
}): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), input.timeoutMs ?? 30_000);
  try {
    return await (input.fetchImpl ?? fetch)(input.url, {
      body: input.body,
      headers: { ...input.headers },
      method: "PUT",
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }
}
