import { describe, expect, it, vi } from 'vitest';

import { S3FileStorageService } from './s3-file-storage.service.js';

const configuration = new Map<string, unknown>([
  ['S3_ACCESS_KEY_ID', 'test-access-key'],
  ['S3_BUCKET', 'manglam-test'],
  ['S3_ENDPOINT', 'http://127.0.0.1:9000'],
  ['S3_FORCE_PATH_STYLE', true],
  ['S3_REGION', 'ap-south-1'],
  ['S3_SECRET_ACCESS_KEY', 'test-secret-key'],
  ['SIGNED_URL_TTL_SECONDS', 60],
  ['UPLOAD_ALLOWED_MIME_TYPES', ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']],
  ['UPLOAD_MAX_BYTES', 10_485_760],
]);

const config = {
  get: vi.fn((key: string) => configuration.get(key)),
};

describe('S3FileStorageService', () => {
  it('rejects public, traversing, or unapproved upload intents before signing', async () => {
    const service = new S3FileStorageService(config as never);
    const baseIntent = {
      checksumSha256: 'A'.repeat(43) + '=',
      contentType: 'image/jpeg',
      expiresInSeconds: 60,
      maximumBytes: 1_024,
    };

    await expect(
      service.createUploadUrl({ ...baseIntent, objectKey: 'public/avatar.jpg' }),
    ).rejects.toThrow(/object key/i);
    await expect(
      service.createUploadUrl({
        ...baseIntent,
        objectKey: 'quarantine/../avatar.jpg',
      }),
    ).rejects.toThrow(/object key/i);
    await expect(
      service.createUploadUrl({
        ...baseIntent,
        contentType: 'text/html',
        objectKey: 'quarantine/avatar.html',
      }),
    ).rejects.toThrow(/content type/i);
  });

  it('rejects downloads while an object is quarantined', async () => {
    const service = new S3FileStorageService(config as never);

    await expect(service.createDownloadUrl('quarantine/visitor.jpg', 60)).rejects.toThrow(
      /quarantined/i,
    );
  });

  it('bounds upload size and signed URL lifetime', async () => {
    const service = new S3FileStorageService(config as never);
    const intent = {
      checksumSha256: 'A'.repeat(43) + '=',
      contentType: 'image/jpeg',
      expiresInSeconds: 61,
      maximumBytes: 10_485_761,
      objectKey: 'quarantine/visitor.jpg',
    };

    await expect(service.createUploadUrl(intent)).rejects.toThrow(/maximum/i);
  });
});
