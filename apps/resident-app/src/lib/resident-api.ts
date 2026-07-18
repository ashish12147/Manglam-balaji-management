import * as Crypto from 'expo-crypto';

import { apiClient, createIdempotencyKey } from '@/lib/api';
import { getRuntimeConfig } from '@/lib/config';
import {
  bytesToBase64,
  COMPLAINT_UPLOAD_MAX_BYTES,
  detectComplaintMimeType,
  isPendingFileScan,
  parseFileScanStatus,
  requireCleanFileScan,
  requirePrivateUploadUrl,
  requireSignedUploadHeaders,
} from '@/lib/upload-contract';
import type {
  ApiPage,
  AuthSessionPayload,
  Complaint,
  ComplaintCategory,
  DailyHelp,
  EmergencyAlert,
  FamilyMember,
  FlatSummary,
  InAppNotification,
  MaintenanceCharge,
  Membership,
  Notice,
  NotificationPreferences,
  OtpChallenge,
  Parcel,
  Payment,
  ResidentProfile,
  UserSession,
  Visit,
  VisitorPreApproval,
} from '@/types/api';

export interface ListOptions {
  cursor?: string;
  limit?: number;
  search?: string;
  status?: string;
}

function query(options: ListOptions = {}): string {
  const params = new URLSearchParams();
  if (options.cursor) params.set('cursor', options.cursor);
  if (options.limit) params.set('limit', String(options.limit));
  if (options.search) params.set('search', options.search);
  if (options.status) params.set('status', options.status);
  const value = params.toString();
  return value ? `?${value}` : '';
}

export interface AuthDeviceInput {
  fingerprint: string;
  platform: 'ANDROID' | 'IOS' | 'WEB' | 'UNKNOWN';
}

export const authApi = {
  requestOtp: (body: { deviceNonce: string; phone: string }) =>
    apiClient.request<OtpChallenge>('/auth/otp/request', {
      auth: false,
      body: { ...body, purpose: 'LOGIN' },
      idempotencyKey: createIdempotencyKey('otp-request'),
      method: 'POST',
      retryAuth: false,
    }),
  verifyOtp: (
    body: {
      challengeId: string;
      code: string;
      device: AuthDeviceInput;
      deviceNonce: string;
      phone: string;
    },
    idempotencyKey: string,
  ) =>
    apiClient.request<AuthSessionPayload>('/auth/otp/verify', {
      auth: false,
      body: { ...body, purpose: 'LOGIN' },
      idempotencyKey,
      method: 'POST',
      retryAuth: false,
    }),
  refresh: (body: { deviceFingerprint: string; refreshToken: string }, idempotencyKey: string) =>
    apiClient.request<AuthSessionPayload>('/auth/refresh', {
      auth: false,
      body,
      idempotencyKey,
      method: 'POST',
      retryAuth: false,
    }),
  logout: () =>
    apiClient.request<void>('/auth/logout', {
      idempotencyKey: createIdempotencyKey('session-logout'),
      method: 'POST',
      retryAuth: false,
    }),
  setupPin: (pin: string) =>
    apiClient.request<void>('/auth/pin', {
      body: { pin },
      idempotencyKey: createIdempotencyKey('pin-setup'),
      method: 'PUT',
    }),
  unlockPin: (body: { device: AuthDeviceInput; phone: string; pin: string }) =>
    apiClient.request<AuthSessionPayload>('/auth/pin/unlock', {
      auth: false,
      body,
      idempotencyKey: createIdempotencyKey('pin-unlock'),
      method: 'POST',
      retryAuth: false,
    }),
};

export const profileApi = {
  me: () => apiClient.request<ResidentProfile>('/users/me'),
  update: (body: { displayName: string; email: string | null }) =>
    apiClient.request<ResidentProfile>('/users/me', { body, method: 'PATCH' }),
  sessions: () => apiClient.request<ApiPage<UserSession>>('/auth/sessions?limit=50'),
  revokeSession: (sessionId: string) =>
    apiClient.request<void>(`/auth/sessions/${sessionId}`, {
      idempotencyKey: createIdempotencyKey('session-revoke'),
      method: 'DELETE',
    }),
};

export const membershipApi = {
  list: () => apiClient.request<ApiPage<Membership>>('/memberships/me?limit=50'),
  searchFlats: (search: string) =>
    apiClient.request<ApiPage<FlatSummary>>(`/society/flats${query({ limit: 20, search })}`, {
      auth: false,
    }),
  request: (body: { flatId: string; occupancyType: string; relationship: string }) =>
    apiClient.request<Membership>('/memberships/requests', {
      body,
      idempotencyKey: createIdempotencyKey('membership-request'),
      method: 'POST',
    }),
};

export const visitorApi = {
  pendingApprovals: () => apiClient.request<ApiPage<Visit>>('/visitors/approvals/pending?limit=20'),
  decide: (approvalId: string, decision: 'APPROVE' | 'REJECT', reason?: string) =>
    apiClient.request<Visit>(`/visitors/approvals/${approvalId}/decision`, {
      body: { decision, ...(reason ? { reason } : {}) },
      idempotencyKey: createIdempotencyKey(`visitor-${decision.toLowerCase()}`),
      method: 'POST',
    }),
  visits: (options?: ListOptions) =>
    apiClient.request<ApiPage<Visit>>(`/visitors/visits${query(options)}`),
  visit: (id: string) => apiClient.request<Visit>(`/visitors/visits/${id}`),
  preApprovals: (options?: ListOptions) =>
    apiClient.request<ApiPage<VisitorPreApproval>>(`/visitors/pre-approvals${query(options)}`),
  preApprove: (body: {
    category: string;
    expectedAt: string;
    purpose?: string;
    vehicleNumber?: string;
    visitorName: string;
    visitorPhone?: string;
  }) =>
    apiClient.request<VisitorPreApproval>('/visitors/pre-approvals', {
      body,
      idempotencyKey: createIdempotencyKey('visitor-preapproval'),
      method: 'POST',
    }),
  cancelPreApproval: (id: string) =>
    apiClient.request<VisitorPreApproval>(`/visitors/pre-approvals/${id}/cancel`, {
      idempotencyKey: createIdempotencyKey('visitor-cancel'),
      method: 'POST',
    }),
};

export const familyApi = {
  list: (membershipId: string) =>
    apiClient.request<ApiPage<FamilyMember>>(
      `/memberships/${membershipId}/family-members?limit=50`,
    ),
  create: (
    membershipId: string,
    body: { dateOfBirth?: string; name: string; relationship: string },
  ) =>
    apiClient.request<FamilyMember>(`/memberships/${membershipId}/family-members`, {
      body,
      idempotencyKey: createIdempotencyKey('family-create'),
      method: 'POST',
    }),
  update: (
    membershipId: string,
    id: string,
    body: { name?: string; relationship?: string; status?: string },
  ) =>
    apiClient.request<FamilyMember>(`/memberships/${membershipId}/family-members/${id}`, {
      body,
      method: 'PATCH',
    }),
};

export const dailyHelpApi = {
  list: (options?: ListOptions) =>
    apiClient.request<ApiPage<DailyHelp>>(`/daily-help/me${query(options)}`),
  detail: (id: string) => apiClient.request<DailyHelp>(`/daily-help/${id}`),
  directory: (search: string) =>
    apiClient.request<ApiPage<DailyHelp>>(`/daily-help/directory${query({ limit: 20, search })}`),
  assign: (id: string, body: { allowedDays: string[]; notes?: string }) =>
    apiClient.request<DailyHelp>(`/daily-help/${id}/assignments`, {
      body,
      idempotencyKey: createIdempotencyKey('daily-help-assign'),
      method: 'POST',
    }),
  endAssignment: (id: string) =>
    apiClient.request<void>(`/daily-help/${id}/assignments/current/end`, {
      idempotencyKey: createIdempotencyKey('daily-help-end'),
      method: 'POST',
    }),
};

export const parcelApi = {
  list: (options?: ListOptions) =>
    apiClient.request<ApiPage<Parcel>>(`/parcels/me${query(options)}`),
  detail: (id: string) => apiClient.request<Parcel>(`/parcels/${id}`),
  decide: (id: string, decision: 'ALLOW_ENTRY' | 'LEAVE_AT_GATE' | 'REJECT') =>
    apiClient.request<Parcel>(`/parcels/${id}/decision`, {
      body: { decision },
      idempotencyKey: createIdempotencyKey('parcel-decision'),
      method: 'POST',
    }),
};

export const noticeApi = {
  list: (options?: ListOptions) =>
    apiClient.request<ApiPage<Notice>>(`/notices/me${query(options)}`),
  detail: (id: string) => apiClient.request<Notice>(`/notices/${id}`),
  markRead: (id: string) =>
    apiClient.request<void>(`/notices/${id}/read`, {
      idempotencyKey: createIdempotencyKey('notice-read'),
      method: 'POST',
    }),
  acknowledge: (id: string) =>
    apiClient.request<void>(`/notices/${id}/acknowledge`, {
      idempotencyKey: createIdempotencyKey('notice-ack'),
      method: 'POST',
    }),
};

export const complaintApi = {
  categories: () =>
    apiClient.request<ApiPage<ComplaintCategory>>('/complaints/categories?limit=100'),
  list: (options?: ListOptions) =>
    apiClient.request<ApiPage<Complaint>>(`/complaints/me${query(options)}`),
  detail: (id: string) => apiClient.request<Complaint>(`/complaints/${id}`),
  create: (body: {
    attachmentFileIds?: string[];
    categoryId: string;
    description: string;
    priority: string;
    subject: string;
  }) =>
    apiClient.request<Complaint>('/complaints', {
      body,
      idempotencyKey: createIdempotencyKey('complaint-create'),
      method: 'POST',
    }),
  comment: (id: string, body: string) =>
    apiClient.request<Complaint>(`/complaints/${id}/comments`, {
      body: { body },
      idempotencyKey: createIdempotencyKey('complaint-comment'),
      method: 'POST',
    }),
  transition: (id: string, action: 'close' | 'reopen') =>
    apiClient.request<Complaint>(`/complaints/${id}/${action}`, {
      idempotencyKey: createIdempotencyKey(`complaint-${action}`),
      method: 'POST',
    }),
};

export const maintenanceApi = {
  charges: (options?: ListOptions) =>
    apiClient.request<ApiPage<MaintenanceCharge>>(`/maintenance/me/charges${query(options)}`),
  charge: (id: string) => apiClient.request<MaintenanceCharge>(`/maintenance/charges/${id}`),
  payments: (options?: ListOptions) =>
    apiClient.request<ApiPage<Payment>>(`/maintenance/me/payments${query(options)}`),
  payment: (id: string) => apiClient.request<Payment>(`/maintenance/payments/${id}`),
  paymentCapabilities: () =>
    apiClient.request<{ onlinePaymentsEnabled: boolean; providerLabel?: string }>(
      '/maintenance/payment-capabilities',
    ),
  startOnlinePayment: () =>
    apiClient.request<{ checkoutUrl: string }>('/maintenance/online-payment/checkout', {
      idempotencyKey: createIdempotencyKey('online-payment-checkout'),
      method: 'POST',
    }),
};

export const emergencyApi = {
  active: () =>
    apiClient.request<ApiPage<EmergencyAlert>>('/emergencies/me?status=ACTIVE&limit=10'),
  history: (options?: ListOptions) =>
    apiClient.request<ApiPage<EmergencyAlert>>(`/emergencies/me${query(options)}`),
  detail: (id: string) => apiClient.request<EmergencyAlert>(`/emergencies/${id}`),
  create: (body: { category: string; details?: string }) =>
    apiClient.request<EmergencyAlert>('/emergencies', {
      body,
      idempotencyKey: createIdempotencyKey('emergency-create'),
      method: 'POST',
    }),
  markFalseAlarm: (id: string, reason: string) =>
    apiClient.request<EmergencyAlert>(`/emergencies/${id}/false-alarm`, {
      body: { reason },
      idempotencyKey: createIdempotencyKey('emergency-false-alarm'),
      method: 'POST',
    }),
};

export const notificationApi = {
  list: (options?: ListOptions) =>
    apiClient.request<ApiPage<InAppNotification>>(`/notifications${query(options)}`),
  unreadCount: () => apiClient.request<{ count: number }>('/notifications/unread-count'),
  markRead: (id: string) =>
    apiClient.request<void>(`/notifications/${id}/read`, {
      idempotencyKey: createIdempotencyKey('notification-read'),
      method: 'POST',
    }),
  markAllRead: () =>
    apiClient.request<void>('/notifications/read-all', {
      idempotencyKey: createIdempotencyKey('notifications-read-all'),
      method: 'POST',
    }),
  preferences: () => apiClient.request<NotificationPreferences>('/notifications/preferences'),
  updatePreferences: (body: Partial<NotificationPreferences>) =>
    apiClient.request<NotificationPreferences>('/notifications/preferences', {
      body,
      method: 'PATCH',
    }),
  registerPushEndpoint: (body: {
    deviceId: string;
    platform: string;
    provider: 'EXPO';
    token: string;
  }) => apiClient.request<void>('/notifications/push-endpoints', { body, method: 'POST' }),
};

interface FileState {
  fileId: string;
  scanStatus?: unknown;
  status?: unknown;
}

export const fileApi = {
  createUpload: (body: {
    bytes: number;
    checksumSha256: string;
    fileName: string;
    mimeType: string;
    purpose: 'COMPLAINT_ATTACHMENT';
  }) =>
    apiClient.request<{ fileId: string; headers: Record<string, string>; uploadUrl: string }>(
      '/files/upload-intents',
      {
        body,
        idempotencyKey: createIdempotencyKey('complaint-upload-intent'),
        method: 'POST',
      },
    ),
  completeUpload: (fileId: string) =>
    apiClient.request<FileState>(`/files/${fileId}/complete`, {
      idempotencyKey: createIdempotencyKey('complaint-upload-complete'),
      method: 'POST',
    }),
  download: (fileId: string) =>
    apiClient.request<{ expiresAt: string; url: string }>(`/files/${fileId}/download`),
  status: (fileId: string) => apiClient.request<FileState>(`/files/${fileId}`),
};

function scanStatusOf(file: FileState) {
  return parseFileScanStatus(file.scanStatus ?? file.status);
}

async function waitForCleanFile(fileId: string, initial: FileState): Promise<void> {
  let status = scanStatusOf(initial);
  for (let attempt = 0; attempt < 30 && isPendingFileScan(status); attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    status = scanStatusOf(await fileApi.status(fileId));
  }
  requireCleanFileScan(status);
}

export async function uploadComplaintFile(input: {
  fileName: string;
  mimeType: string;
  size: number;
  uri: string;
}): Promise<string> {
  const local = await fetch(input.uri);
  if (!local.ok) throw new Error('The selected file could not be read.');

  const body = await local.arrayBuffer();
  const bytes = body.byteLength;
  if (bytes < 1 || bytes > COMPLAINT_UPLOAD_MAX_BYTES) {
    throw new Error(
      bytes < 1 ? 'The selected attachment is empty.' : 'The attachment must be 10 MB or smaller.',
    );
  }
  if (input.size > 0 && input.size !== bytes) {
    throw new Error('The selected attachment changed while it was being prepared.');
  }

  const mimeType = detectComplaintMimeType(body);
  if (!mimeType) {
    throw new Error('Only valid JPEG, PNG, WebP, or PDF attachments are allowed.');
  }
  const declaredMimeType = input.mimeType.trim().toLowerCase();
  if (declaredMimeType !== 'application/octet-stream' && declaredMimeType !== mimeType) {
    throw new Error('The attachment type does not match its file contents.');
  }

  const checksum = await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, body);
  const checksumSha256 = bytesToBase64(checksum);
  const intent = await fileApi.createUpload({
    bytes,
    checksumSha256,
    fileName: input.fileName,
    mimeType,
    purpose: 'COMPLAINT_ATTACHMENT',
  });
  const uploadUrl = requirePrivateUploadUrl(
    intent.uploadUrl,
    getRuntimeConfig().appEnv === 'production',
  );
  const headers = requireSignedUploadHeaders(intent.headers, {
    bytes,
    checksumSha256,
    mimeType,
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetch(uploadUrl, {
      body,
      headers,
      method: 'PUT',
      signal: controller.signal,
    });
    if (!response.ok) throw new Error('The attachment upload was rejected.');
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('The attachment upload timed out. Try again.');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }

  await waitForCleanFile(intent.fileId, await fileApi.completeUpload(intent.fileId));
  return intent.fileId;
}
