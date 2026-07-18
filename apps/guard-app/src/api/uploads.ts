import * as Crypto from "expo-crypto";

import { ApiError } from "@/api/errors";
import { endpoints } from "@/api/endpoints";
import {
  bytesToBase64,
  detectPrivateImageMimeType,
  isRejectedFileStatus,
  parseFileScanStatus,
  requireSignedUploadHeaders,
  type FileScanStatus
} from "@/api/upload-contract";
import { putSignedUpload, requireAllowedSignedUploadUrl } from "@/api/upload-transport";
import { env } from "@/config/env";
import { safeFileName } from "@/utils/text";

const maximumBytes = 5 * 1024 * 1024;

export interface LocalImage {
  fileName?: string | null;
  fileSize?: number;
  mimeType?: string | null;
  uri: string;
}

export interface UploadedPrivateImage {
  fileId: string;
  scanStatus: FileScanStatus;
}

export async function uploadPrivateImage(
  image: LocalImage,
  purpose: "VISITOR_PHOTO" | "PARCEL_PHOTO"
): Promise<UploadedPrivateImage> {
  if (image.fileSize !== undefined && (!Number.isSafeInteger(image.fileSize) || image.fileSize < 1)) {
    throw new ApiError({
      code: "LOCAL_FILE_SIZE_INVALID",
      message: "The selected photograph has an invalid byte count.",
      status: 0
    });
  }
  if (image.fileSize !== undefined && image.fileSize > maximumBytes) {
    throw new ApiError({
      code: "FILE_TOO_LARGE",
      message: "The photograph must be 5 MB or smaller.",
      status: 0
    });
  }

  const localResponse = await fetch(image.uri);
  if (!localResponse.ok) {
    throw new ApiError({
      code: "LOCAL_FILE_UNREADABLE",
      message: "The selected photograph could not be read.",
      status: 0
    });
  }
  const body = await localResponse.arrayBuffer();
  const bytes = body.byteLength;
  if (bytes < 1 || bytes > maximumBytes) {
    throw new ApiError({
      code: bytes < 1 ? "LOCAL_FILE_EMPTY" : "FILE_TOO_LARGE",
      message: bytes < 1 ? "The selected photograph is empty." : "The photograph must be 5 MB or smaller.",
      status: 0
    });
  }
  if (image.fileSize !== undefined && image.fileSize !== bytes) {
    throw new ApiError({
      code: "LOCAL_FILE_SIZE_CHANGED",
      message: "The selected photograph changed while it was being prepared. Take it again.",
      status: 0
    });
  }

  const mimeType = detectPrivateImageMimeType(body);
  if (!mimeType) {
    throw new ApiError({
      code: "FILE_TYPE_NOT_ALLOWED",
      message: "The selected bytes are not a valid JPEG, PNG, or WebP photograph.",
      status: 0
    });
  }
  if (image.mimeType && image.mimeType !== mimeType) {
    throw new ApiError({
      code: "FILE_TYPE_MISMATCH",
      message: "The selected photograph type does not match its file contents.",
      status: 0
    });
  }

  const checksum = await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, body);
  const checksumSha256 = bytesToBase64(checksum);
  const intent = await endpoints.createUploadIntent(
    {
      bytes,
      checksumSha256,
      fileName: safeFileName(image.fileName, `gate-photo-${Date.now()}.jpg`),
      mimeType,
      purpose
    },
    Crypto.randomUUID()
  );

  let signedHeaders: Record<string, string>;
  let uploadUrl: string;
  try {
    signedHeaders = requireSignedUploadHeaders(intent.headers, {
      bytes,
      checksumSha256,
      mimeType
    });
    uploadUrl = requireAllowedSignedUploadUrl(intent.uploadUrl, env.appEnvironment);
  } catch (caught) {
    throw new ApiError({
      code: "UPLOAD_INTENT_MISMATCH",
      message: caught instanceof Error ? caught.message : "The upload authorization did not match the file.",
      status: 0
    });
  }

  let uploadResponse: Response;
  try {
    uploadResponse = await putSignedUpload({
      body,
      headers: signedHeaders,
      timeoutMs: 30_000,
      url: uploadUrl
    });
  } catch (caught) {
    const timedOut = caught instanceof Error && caught.name === "AbortError";
    throw new ApiError({
      code: timedOut ? "UPLOAD_TIMEOUT" : "UPLOAD_NETWORK_FAILED",
      details: caught,
      message: timedOut
        ? "The secure photo upload timed out. Try again."
        : "The secure photo upload could not reach storage. Try again.",
      status: 0
    });
  }
  if (!uploadResponse.ok) {
    throw new ApiError({
      code: "UPLOAD_FAILED",
      message: "The photograph could not be uploaded. Try again.",
      status: uploadResponse.status
    });
  }

  const completion = await endpoints.completeUpload(intent.fileId, Crypto.randomUUID());
  let scanStatus: FileScanStatus;
  try {
    scanStatus = parseFileScanStatus(completion.scanStatus ?? completion.status);
  } catch (caught) {
    throw new ApiError({
      code: "UPLOAD_STATUS_UNKNOWN",
      message: caught instanceof Error ? caught.message : "The upload scan status could not be verified.",
      status: 0
    });
  }
  if (isRejectedFileStatus(scanStatus)) {
    throw new ApiError({
      code: "UPLOAD_SCAN_REJECTED",
      message: "The security scan rejected this photograph. Take a new photo and try again.",
      status: 422
    });
  }
  return { fileId: intent.fileId, scanStatus };
}
