import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type {
  PrivateFileStorageProvider,
  SignedDownload,
  SignedUpload,
  StoredObjectInfo,
  UploadIntent,
} from '../../common/providers/private-file-storage.provider.js';
import type { AppEnvironment } from '../../config/env.schema.js';

const SHA256_BASE64 = /^[A-Za-z0-9+/]{43}=$/;

@Injectable()
export class S3FileStorageService implements PrivateFileStorageProvider {
  private readonly allowedMimeTypes: ReadonlySet<string>;
  private readonly bucket: string;
  private readonly client: S3Client;
  private readonly maximumBytes: number;
  private readonly maximumSignedUrlSeconds: number;

  constructor(config: ConfigService<AppEnvironment, true>) {
    this.allowedMimeTypes = new Set(config.get('UPLOAD_ALLOWED_MIME_TYPES', { infer: true }));
    this.bucket = config.get('S3_BUCKET', { infer: true });
    this.maximumBytes = config.get('UPLOAD_MAX_BYTES', { infer: true });
    this.maximumSignedUrlSeconds = config.get('SIGNED_URL_TTL_SECONDS', {
      infer: true,
    });
    this.client = new S3Client({
      credentials: {
        accessKeyId: config.get('S3_ACCESS_KEY_ID', { infer: true }),
        secretAccessKey: config.get('S3_SECRET_ACCESS_KEY', { infer: true }),
      },
      endpoint: config.get('S3_ENDPOINT', { infer: true }),
      forcePathStyle: config.get('S3_FORCE_PATH_STYLE', { infer: true }),
      region: config.get('S3_REGION', { infer: true }),
    });
  }

  async createUploadUrl(intent: UploadIntent): Promise<SignedUpload> {
    const objectKey = this.requireObjectKey(intent.objectKey, 'quarantine/');
    const expiresIn = this.requireExpiry(intent.expiresInSeconds);

    if (!this.allowedMimeTypes.has(intent.contentType)) {
      throw new Error('The requested content type is not allowed.');
    }
    if (!Number.isSafeInteger(intent.maximumBytes) || intent.maximumBytes <= 0) {
      throw new Error('The upload size limit must be a positive integer.');
    }
    if (intent.maximumBytes > this.maximumBytes) {
      throw new Error('The upload size limit exceeds the configured maximum.');
    }
    if (!SHA256_BASE64.test(intent.checksumSha256)) {
      throw new Error('The SHA-256 checksum must be base64 encoded.');
    }

    const maximumBytes = String(intent.maximumBytes);
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      ChecksumSHA256: intent.checksumSha256,
      ContentType: intent.contentType,
      Key: objectKey,
      Metadata: {
        'maximum-bytes': maximumBytes,
      },
    });
    const url = await getSignedUrl(this.client, command, {
      expiresIn,
      signableHeaders: new Set([
        'content-type',
        'x-amz-checksum-sha256',
        'x-amz-meta-maximum-bytes',
      ]),
    });

    return {
      expiresAt: new Date(Date.now() + expiresIn * 1_000),
      headers: {
        'content-type': intent.contentType,
        'x-amz-checksum-sha256': intent.checksumSha256,
        'x-amz-meta-maximum-bytes': maximumBytes,
      },
      method: 'PUT',
      objectKey,
      url,
    };
  }

  async createDownloadUrl(
    objectKeyInput: string,
    expiresInSeconds: number,
  ): Promise<SignedDownload> {
    const objectKey = this.requireObjectKey(objectKeyInput);
    if (objectKey.startsWith('quarantine/')) {
      throw new Error('Quarantined objects cannot be downloaded.');
    }

    const expiresIn = this.requireExpiry(expiresInSeconds);
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: objectKey,
      ResponseContentDisposition: 'attachment',
      ResponseContentType: 'application/octet-stream',
    });

    return {
      expiresAt: new Date(Date.now() + expiresIn * 1_000),
      url: await getSignedUrl(this.client, command, { expiresIn }),
    };
  }

  async inspectObject(objectKeyInput: string): Promise<StoredObjectInfo> {
    const objectKey = this.requireObjectKey(objectKeyInput);
    const result = await this.client.send(
      new HeadObjectCommand({
        Bucket: this.bucket,
        Key: objectKey,
      }),
    );

    return {
      checksumSha256: result.ChecksumSHA256 ?? null,
      contentLength: result.ContentLength ?? 0,
      contentType: result.ContentType ?? null,
      objectKey,
    };
  }

  async deleteQuarantinedObject(objectKeyInput: string): Promise<void> {
    const objectKey = this.requireObjectKey(objectKeyInput, 'quarantine/');
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: objectKey,
      }),
    );
  }

  private requireExpiry(expiresInSeconds: number): number {
    if (
      !Number.isSafeInteger(expiresInSeconds) ||
      expiresInSeconds < 15 ||
      expiresInSeconds > this.maximumSignedUrlSeconds
    ) {
      throw new Error('The signed URL expiry is outside the configured range.');
    }
    return expiresInSeconds;
  }

  private requireObjectKey(objectKey: string, requiredPrefix?: string): string {
    if (
      objectKey.length < 3 ||
      objectKey.length > 512 ||
      objectKey.startsWith('/') ||
      objectKey.includes('..') ||
      objectKey.includes('\\') ||
      objectKey.includes('//') ||
      /[\u0000-\u001f\u007f]/.test(objectKey) ||
      (requiredPrefix !== undefined && !objectKey.startsWith(requiredPrefix))
    ) {
      throw new Error('The private object key is invalid.');
    }
    return objectKey;
  }
}
