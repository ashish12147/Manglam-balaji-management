import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';

import type { FileObject, PrivateObjectStore } from './contracts.js';

export class S3PrivateObjectStore implements PrivateObjectStore {
  private readonly client: S3Client;

  constructor(
    private readonly bucket: string,
    options: {
      accessKeyId: string;
      endpoint: string;
      forcePathStyle: boolean;
      region: string;
      secretAccessKey: string;
    },
  ) {
    this.client = new S3Client({
      credentials: { accessKeyId: options.accessKeyId, secretAccessKey: options.secretAccessKey },
      endpoint: options.endpoint,
      forcePathStyle: options.forcePathStyle,
      region: options.region,
    });
  }

  async inspect(key: string): Promise<FileObject> {
    this.requireQuarantineKey(key);
    const head = await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
    return {
      checksumSha256: head.ChecksumSHA256 ?? null,
      contentLength: head.ContentLength ?? 0,
      contentType: head.ContentType ?? null,
    };
  }

  async *read(key: string): AsyncIterable<Uint8Array> {
    this.requireQuarantineKey(key);
    const response = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
    );
    if (!response.Body || !(Symbol.asyncIterator in response.Body)) {
      throw new Error('Quarantined object body is unavailable.');
    }
    for await (const chunk of response.Body as AsyncIterable<Uint8Array>) yield chunk;
  }

  async copy(sourceKey: string, destinationKey: string): Promise<void> {
    this.requireQuarantineKey(sourceKey);
    this.requirePrivateKey(destinationKey);
    await this.client.send(
      new CopyObjectCommand({
        Bucket: this.bucket,
        CopySource: `${this.bucket}/${encodeURIComponent(sourceKey).replaceAll('%2F', '/')}`,
        Key: destinationKey,
      }),
    );
  }

  async deleteQuarantine(key: string): Promise<void> {
    this.requireQuarantineKey(key);
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  async deletePrivate(key: string, societyId: string): Promise<void> {
    this.requirePrivateKey(key, societyId);
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  private requireQuarantineKey(key: string): void {
    this.requireSafeKey(key, 'quarantine/');
  }

  private requirePrivateKey(key: string, societyId?: string): void {
    const prefix = societyId ? `private/${societyId}/` : 'private/';
    this.requireSafeKey(key, prefix);
  }

  private requireSafeKey(key: string, prefix: string): void {
    if (
      !key.startsWith(prefix) ||
      key.length <= prefix.length ||
      key.length > 512 ||
      key.includes('..') ||
      key.includes('\\') ||
      key.includes('//') ||
      /[\u0000-\u001f\u007f]/.test(key)
    ) {
      throw new Error('Private object key is invalid.');
    }
  }
}
