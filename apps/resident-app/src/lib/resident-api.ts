import { apiClient, createIdempotencyKey } from '@/lib/api';
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

export const authApi = {
  requestOtp: (body: { deviceId: string; phone: string }) =>
    apiClient.request<OtpChallenge>('/auth/otp/request', {
      auth: false,
      body: { ...body, purpose: 'RESIDENT_LOGIN' },
      method: 'POST',
      retryAuth: false,
    }),
  verifyOtp: (body: { challengeId: string; code: string; deviceId: string }) =>
    apiClient.request<AuthSessionPayload>('/auth/otp/verify', {
      auth: false,
      body,
      method: 'POST',
      retryAuth: false,
    }),
  refresh: (body: { deviceId: string; refreshToken: string }) =>
    apiClient.request<AuthSessionPayload>('/auth/refresh', {
      auth: false,
      body,
      method: 'POST',
      retryAuth: false,
    }),
  logout: (refreshToken: string) =>
    apiClient.request<void>('/auth/logout', {
      body: { refreshToken },
      method: 'POST',
      retryAuth: false,
    }),
  setupPin: (pin: string) => apiClient.request<void>('/auth/pin', { body: { pin }, method: 'PUT' }),
  unlockPin: (body: { deviceId: string; phone: string; pin: string }) =>
    apiClient.request<AuthSessionPayload>('/auth/pin/unlock', {
      auth: false,
      body,
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

export const fileApi = {
  createUpload: (body: {
    fileName: string;
    mimeType: string;
    ownerType: 'COMPLAINT';
    size: number;
  }) =>
    apiClient.request<{ fileId: string; headers: Record<string, string>; uploadUrl: string }>(
      '/files/upload-intents',
      { body, method: 'POST' },
    ),
  completeUpload: (fileId: string) =>
    apiClient.request<{ fileId: string; scanStatus: string }>(`/files/${fileId}/complete`, {
      method: 'POST',
    }),
  download: (fileId: string) =>
    apiClient.request<{ expiresAt: string; url: string }>(`/files/${fileId}/download`),
};

export async function uploadComplaintFile(input: {
  fileName: string;
  mimeType: string;
  size: number;
  uri: string;
}): Promise<string> {
  const intent = await fileApi.createUpload({
    fileName: input.fileName,
    mimeType: input.mimeType,
    ownerType: 'COMPLAINT',
    size: input.size,
  });
  const local = await fetch(input.uri);
  if (!local.ok) throw new Error('The selected file could not be read.');
  const response = await fetch(intent.uploadUrl, {
    body: await local.blob(),
    headers: { 'Content-Type': input.mimeType, ...intent.headers },
    method: 'PUT',
  });
  if (!response.ok) throw new Error('The attachment upload was rejected.');
  await fileApi.completeUpload(intent.fileId);
  return intent.fileId;
}
