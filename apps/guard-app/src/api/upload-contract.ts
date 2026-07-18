export const PRIVATE_IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export type PrivateImageMimeType = (typeof PRIVATE_IMAGE_MIME_TYPES)[number];

export type FileScanStatus =
  | "PENDING_UPLOAD"
  | "UPLOADED"
  | "QUARANTINED"
  | "SCANNING"
  | "CLEAN"
  | "REJECTED"
  | "DELETED";

const BASE64_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const FILE_SCAN_STATUSES = new Set<FileScanStatus>([
  "PENDING_UPLOAD",
  "UPLOADED",
  "QUARANTINED",
  "SCANNING",
  "CLEAN",
  "REJECTED",
  "DELETED"
]);

export function bytesToBase64(value: ArrayBuffer | Uint8Array): string {
  const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
  let encoded = "";
  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index] ?? 0;
    const second = bytes[index + 1] ?? 0;
    const third = bytes[index + 2] ?? 0;
    const combined = (first << 16) | (second << 8) | third;
    encoded += BASE64_ALPHABET[(combined >>> 18) & 63];
    encoded += BASE64_ALPHABET[(combined >>> 12) & 63];
    encoded += index + 1 < bytes.length ? BASE64_ALPHABET[(combined >>> 6) & 63] : "=";
    encoded += index + 2 < bytes.length ? BASE64_ALPHABET[combined & 63] : "=";
  }
  return encoded;
}

export function detectPrivateImageMimeType(
  value: ArrayBuffer | Uint8Array
): PrivateImageMimeType | null {
  const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp";
  }
  return null;
}

function findHeader(headers: Readonly<Record<string, string>>, name: string): string | null {
  const expected = name.toLowerCase();
  const entry = Object.entries(headers).find(([key]) => key.toLowerCase() === expected);
  return entry?.[1] ?? null;
}

export function requireSignedUploadHeaders(
  headers: Readonly<Record<string, string>> | undefined,
  expected: { bytes: number; checksumSha256: string; mimeType: string }
): Record<string, string> {
  if (!headers) throw new Error("The upload service did not return signed request headers.");
  if (findHeader(headers, "x-amz-checksum-sha256") !== expected.checksumSha256) {
    throw new Error("The signed upload checksum does not match the selected file.");
  }
  if (findHeader(headers, "content-type") !== expected.mimeType) {
    throw new Error("The signed upload content type does not match the selected file.");
  }
  if (findHeader(headers, "x-amz-meta-maximum-bytes") !== String(expected.bytes)) {
    throw new Error("The signed upload byte count does not match the selected file.");
  }
  return { ...headers };
}

export function parseFileScanStatus(input: unknown): FileScanStatus {
  if (typeof input !== "string" || !FILE_SCAN_STATUSES.has(input as FileScanStatus)) {
    throw new Error("The upload service returned an unknown scan status.");
  }
  return input as FileScanStatus;
}

export function isRejectedFileStatus(status: FileScanStatus): boolean {
  return status === "REJECTED" || status === "DELETED";
}

export function isPendingFileStatus(status: FileScanStatus): boolean {
  return status === "PENDING_UPLOAD" || status === "UPLOADED" || status === "QUARANTINED" || status === "SCANNING";
}
