export const COMPLAINT_UPLOAD_MAX_BYTES = 10 * 1024 * 1024;

export type ComplaintUploadMimeType = 'application/pdf' | 'image/jpeg' | 'image/png' | 'image/webp';

export type FileScanStatus =
  | 'PENDING_UPLOAD'
  | 'UPLOADED'
  | 'QUARANTINED'
  | 'SCANNING'
  | 'CLEAN'
  | 'REJECTED'
  | 'DELETED';

const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const FILE_SCAN_STATUSES = new Set<FileScanStatus>([
  'PENDING_UPLOAD',
  'UPLOADED',
  'QUARANTINED',
  'SCANNING',
  'CLEAN',
  'REJECTED',
  'DELETED',
]);

export function bytesToBase64(value: ArrayBuffer | Uint8Array): string {
  const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
  let encoded = '';
  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index] ?? 0;
    const second = bytes[index + 1] ?? 0;
    const third = bytes[index + 2] ?? 0;
    const combined = (first << 16) | (second << 8) | third;
    encoded += BASE64_ALPHABET[(combined >>> 18) & 63];
    encoded += BASE64_ALPHABET[(combined >>> 12) & 63];
    encoded += index + 1 < bytes.length ? BASE64_ALPHABET[(combined >>> 6) & 63] : '=';
    encoded += index + 2 < bytes.length ? BASE64_ALPHABET[combined & 63] : '=';
  }
  return encoded;
}

export function detectComplaintMimeType(
  value: ArrayBuffer | Uint8Array,
): ComplaintUploadMimeType | null {
  const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
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
    return 'image/png';
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
    return 'image/webp';
  }
  if (
    bytes.length >= 5 &&
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46 &&
    bytes[4] === 0x2d
  ) {
    return 'application/pdf';
  }
  return null;
}

function findHeader(headers: Readonly<Record<string, string>>, name: string): string | null {
  const expected = name.toLowerCase();
  return Object.entries(headers).find(([key]) => key.toLowerCase() === expected)?.[1] ?? null;
}

export function requireSignedUploadHeaders(
  headers: Readonly<Record<string, string>>,
  expected: { bytes: number; checksumSha256: string; mimeType: string },
): Record<string, string> {
  if (findHeader(headers, 'x-amz-checksum-sha256') !== expected.checksumSha256) {
    throw new Error('The signed upload checksum does not match the selected attachment.');
  }
  if (findHeader(headers, 'content-type') !== expected.mimeType) {
    throw new Error('The signed upload type does not match the selected attachment.');
  }
  if (findHeader(headers, 'x-amz-meta-maximum-bytes') !== String(expected.bytes)) {
    throw new Error('The signed upload size does not match the selected attachment.');
  }
  return { ...headers };
}

export function requirePrivateUploadUrl(value: string, production: boolean): string {
  const url = new URL(value);
  const local =
    url.protocol === 'http:' && ['127.0.0.1', '10.0.2.2', 'localhost'].includes(url.hostname);
  if (url.protocol !== 'https:' && (production || !local)) {
    throw new Error('The upload service returned an insecure storage URL.');
  }
  return url.toString();
}

export function parseFileScanStatus(value: unknown): FileScanStatus {
  if (typeof value !== 'string' || !FILE_SCAN_STATUSES.has(value as FileScanStatus)) {
    throw new Error('The upload service returned an unknown scan status.');
  }
  return value as FileScanStatus;
}

export function isPendingFileScan(status: FileScanStatus): boolean {
  return ['PENDING_UPLOAD', 'UPLOADED', 'QUARANTINED', 'SCANNING'].includes(status);
}

export function requireCleanFileScan(status: FileScanStatus): void {
  if (status !== 'CLEAN') {
    throw new Error(
      status === 'REJECTED' || status === 'DELETED'
        ? 'The security scan rejected this attachment.'
        : 'The security scan did not finish in time. Try attaching the file again.',
    );
  }
}
