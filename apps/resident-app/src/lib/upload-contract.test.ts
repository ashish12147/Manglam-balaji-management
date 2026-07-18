import { describe, expect, it } from 'vitest';

import {
  bytesToBase64,
  detectComplaintMimeType,
  isPendingFileScan,
  parseFileScanStatus,
  requireCleanFileScan,
  requirePrivateUploadUrl,
  requireSignedUploadHeaders,
} from './upload-contract';

describe('resident private upload contract', () => {
  it('detects supported content from bytes instead of trusting the picker', () => {
    expect(detectComplaintMimeType(Uint8Array.from([0xff, 0xd8, 0xff]))).toBe('image/jpeg');
    expect(detectComplaintMimeType(Uint8Array.from([0x25, 0x50, 0x44, 0x46, 0x2d]))).toBe(
      'application/pdf',
    );
    expect(detectComplaintMimeType(Uint8Array.from([1, 2, 3]))).toBeNull();
    expect(
      detectComplaintMimeType(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
    ).toBe('image/png');
    expect(
      detectComplaintMimeType(
        Uint8Array.from([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]),
      ),
    ).toBe('image/webp');
  });

  it('encodes SHA-256 bytes using standard padded base64', () => {
    expect(bytesToBase64(Uint8Array.from([0, 1, 2, 253, 254, 255]))).toBe('AAEC/f7/');
    expect(bytesToBase64(Uint8Array.from([0xff]))).toBe('/w==');
    expect(bytesToBase64(Uint8Array.from([0xff, 0xee]))).toBe('/+4=');
    expect(bytesToBase64(new Uint8Array())).toBe('');
  });

  it('requires every integrity-bound signed upload header', () => {
    const expected = {
      bytes: 123,
      checksumSha256: 'checksum',
      mimeType: 'application/pdf',
    };
    expect(
      requireSignedUploadHeaders(
        {
          'Content-Type': 'application/pdf',
          'X-Amz-Checksum-Sha256': 'checksum',
          'X-Amz-Meta-Maximum-Bytes': '123',
        },
        expected,
      ),
    ).toBeTruthy();
    expect(() =>
      requireSignedUploadHeaders(
        {
          'Content-Type': 'application/pdf',
          'X-Amz-Checksum-Sha256': 'different',
          'X-Amz-Meta-Maximum-Bytes': '123',
        },
        expected,
      ),
    ).toThrow(/checksum/);
    expect(() =>
      requireSignedUploadHeaders(
        {
          'Content-Type': 'image/png',
          'X-Amz-Checksum-Sha256': 'checksum',
          'X-Amz-Meta-Maximum-Bytes': '123',
        },
        expected,
      ),
    ).toThrow(/type/);
    expect(() =>
      requireSignedUploadHeaders(
        {
          'Content-Type': 'application/pdf',
          'X-Amz-Checksum-Sha256': 'checksum',
        },
        expected,
      ),
    ).toThrow(/size/);
    expect(() =>
      requireSignedUploadHeaders(
        {
          'Content-Type': 'application/pdf',
          'X-Amz-Meta-Maximum-Bytes': '123',
        },
        expected,
      ),
    ).toThrow(/checksum/);
  });

  it('allows insecure storage only on a local development endpoint', () => {
    expect(requirePrivateUploadUrl('https://storage.example/file', true)).toMatch(/^https:/);
    expect(requirePrivateUploadUrl('http://10.0.2.2:9000/file', false)).toMatch(/^http:/);
    expect(() => requirePrivateUploadUrl('http://10.0.2.2:9000/file', true)).toThrow(/insecure/);
    expect(() => requirePrivateUploadUrl('http://attacker.example/file', false)).toThrow(
      /insecure/,
    );
    expect(() => requirePrivateUploadUrl('ftp://storage.example/file', false)).toThrow(/insecure/);
    expect(() => requirePrivateUploadUrl('http://localhost.attacker.example/file', false)).toThrow(
      /insecure/,
    );
  });

  it('accepts only a terminal clean scan', () => {
    expect(parseFileScanStatus('SCANNING')).toBe('SCANNING');
    expect(() => parseFileScanStatus('UNKNOWN')).toThrow(/unknown/);
    expect(() => requireCleanFileScan('REJECTED')).toThrow(/rejected/);
    expect(() => requireCleanFileScan('DELETED')).toThrow(/rejected/);
    expect(() => requireCleanFileScan('SCANNING')).toThrow(/did not finish/);
    expect(isPendingFileScan('PENDING_UPLOAD')).toBe(true);
    expect(isPendingFileScan('QUARANTINED')).toBe(true);
    expect(isPendingFileScan('SCANNING')).toBe(true);
    expect(isPendingFileScan('CLEAN')).toBe(false);
    expect(() => requireCleanFileScan('CLEAN')).not.toThrow();
  });
});
