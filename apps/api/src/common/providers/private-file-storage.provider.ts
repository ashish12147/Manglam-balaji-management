export const PRIVATE_FILE_STORAGE_PROVIDER = Symbol('PRIVATE_FILE_STORAGE_PROVIDER');

export interface UploadIntent {
  checksumSha256: string;
  contentType: string;
  expiresInSeconds: number;
  maximumBytes: number;
  objectKey: string;
}

export interface SignedUpload {
  expiresAt: Date;
  headers: Record<string, string>;
  method: 'PUT';
  objectKey: string;
  url: string;
}

export interface SignedDownload {
  expiresAt: Date;
  url: string;
}

export interface StoredObjectInfo {
  checksumSha256: string | null;
  contentLength: number;
  contentType: string | null;
  objectKey: string;
}

export interface PrivateFileStorageProvider {
  createDownloadUrl(objectKey: string, expiresInSeconds: number): Promise<SignedDownload>;
  createUploadUrl(intent: UploadIntent): Promise<SignedUpload>;
  deleteQuarantinedObject(objectKey: string): Promise<void>;
  inspectObject(objectKey: string): Promise<StoredObjectInfo>;
}
