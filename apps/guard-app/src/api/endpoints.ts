import * as Crypto from "expo-crypto";

import { api } from "@/api/client";
import { deviceFingerprintHeaders } from "@/api/request-contract";
import type { FileScanStatus } from "@/api/upload-contract";
import type { GuardAuthDevice } from "@/auth/device-contract";
import { hashCanonicalPayload } from "@/offline/protocol-crypto";
import type {
  ActivityEvent,
  CursorPage,
  DailyHelpDetail,
  DailyHelpDirectoryItem,
  DirectorySnapshot,
  EmergencyAlert,
  GuardContextResponse,
  GuardSessionMetadata,
  GuardSignInResponse,
  ParcelSummary,
  RegisteredDevice,
  UploadIntent,
  VisitDetail,
  VisitSummary,
  VisitorCategory
} from "@/types/domain";

export interface DashboardSummary {
  pendingApprovals: number;
  activeEmergencies: number;
  heldParcels: number;
  activeVisits: number;
  recentActivity: ActivityEvent[];
}

export interface OfflineMutationPayload {
  aggregateId: string;
  baseVersion: number | null;
  clientMutationId: string;
  clientOccurredAt: string;
  deviceId: string;
  gateId: string;
  localSequence: number;
  operation: string;
  payload: Record<string, unknown>;
  payloadHash: string;
  signature: string;
}

export interface OfflineMutationResult {
  clientMutationId: string;
  status: "SYNCED" | "CONFLICT" | "FAILED";
  serverEntityId?: string | null;
  serverRecordId?: string | null;
  serverOccurredAt?: string | null;
  serverState?: unknown;
  code?: string;
  message?: string;
  correlationId?: string | null;
  retryable?: boolean;
}

interface GuardCredentialPayload {
  device: GuardAuthDevice;
  employeeCode: string;
  pin: string;
}

function guardPreAuthOptions(device: GuardAuthDevice, idempotencyKey: string) {
  return {
    auth: false as const,
    headers: deviceFingerprintHeaders(device.fingerprint),
    idempotencyKey
  };
}

export const endpoints = {
  acknowledgeEmergency: (id: string, version: number, idempotencyKey: string) =>
    api.post<EmergencyAlert>(`/emergencies/${id}/acknowledge`, { version }, { idempotencyKey }),
  activity: (filters: { category?: string; cursor?: string } = {}) =>
    api.get<CursorPage<ActivityEvent>>("/guards/activity", { query: filters }),
  activeEmergencies: () =>
    api.get<CursorPage<EmergencyAlert>>("/emergencies", {
      query: { scope: "gate", status: "ACTIVE,ACKNOWLEDGED,RESPONDING" }
    }),
  completeUpload: (fileId: string, idempotencyKey: string) =>
    api.post<{ fileId: string; scanStatus?: FileScanStatus; status?: FileScanStatus }>(
      `/files/${fileId}/complete`,
      {},
      { idempotencyKey }
    ),
  createParcel: (
    payload: {
      flatId: string;
      courierName?: string;
      description?: string;
      photoFileId?: string;
    },
    idempotencyKey: string
  ) => api.post<ParcelSummary>("/parcels", payload, { idempotencyKey }),
  createUploadIntent: (
    payload: {
      bytes: number;
      checksumSha256: string;
      fileName: string;
      mimeType: string;
      purpose: "VISITOR_PHOTO" | "PARCEL_PHOTO";
    },
    idempotencyKey: string
  ) => api.post<UploadIntent>("/files/upload-intents", payload, { idempotencyKey }),
  createVisitorRequest: (
    payload: {
      category: VisitorCategory;
      flatId: string;
      name: string;
      phone?: string;
      vehicleNumber?: string;
      purpose?: string;
      photoFileId?: string;
    },
    idempotencyKey: string
  ) => api.post<VisitDetail>("/visitors/requests", payload, { idempotencyKey }),
  dailyHelp: (query?: string) =>
    api.get<CursorPage<DailyHelpDirectoryItem>>("/daily-help/gate", { query: { query } }),
  dailyHelpAttendance: (id: string, action: "check-in" | "check-out", idempotencyKey: string) =>
    api.post<DailyHelpDetail>(`/daily-help/${id}/attendance/${action}`, {}, { idempotencyKey }),
  dailyHelpDetail: (id: string) => api.get<DailyHelpDetail>(`/daily-help/${id}`),
  dashboard: () => api.get<DashboardSummary>("/guards/dashboard"),
  deviceStatus: () => api.get<RegisteredDevice>("/guards/devices/current"),
  emergencyDetail: (id: string) => api.get<EmergencyAlert>(`/emergencies/${id}`),
  enrollGuardDevice: (
    payload: GuardCredentialPayload & { enrollmentToken: string },
    idempotencyKey: string
  ) =>
    api.post<GuardSignInResponse>(
      "/auth/guard/enroll",
      payload,
      guardPreAuthOptions(payload.device, idempotencyKey)
    ),
  guardContext: () => api.get<GuardContextResponse>("/guards/me/context"),
  login: (payload: GuardCredentialPayload, idempotencyKey: string) =>
    api.post<GuardSignInResponse>(
      "/auth/guard/sign-in",
      payload,
      guardPreAuthOptions(payload.device, idempotencyKey)
    ),
  logout: (idempotencyKey: string) => api.post<void>("/auth/logout", {}, { idempotencyKey }),
  markEmergencyResponding: (id: string, version: number, note: string, idempotencyKey: string) =>
    api.post<EmergencyAlert>(`/emergencies/${id}/respond`, { note, version }, { idempotencyKey }),
  parcelDetail: (id: string) => api.get<ParcelSummary>(`/parcels/${id}`),
  parcelList: (status?: string) =>
    api.get<CursorPage<ParcelSummary>>("/parcels/gate", { query: { status } }),
  parcelTransition: (id: string, action: "collect" | "return", idempotencyKey: string) =>
    api.post<ParcelSummary>(`/parcels/${id}/${action}`, {}, { idempotencyKey }),
  registerPushEndpoint: (
    payload: {
      deviceId: string;
      platform: string;
      provider: "EXPO";
      token: string;
    },
    idempotencyKey: string
  ) => api.post<void>("/notifications/push-endpoints", payload, { idempotencyKey }),
  selectGate: (gateId: string, idempotencyKey: string) =>
    api.post<GuardSessionMetadata>(`/guards/me/gates/${gateId}/select`, {}, { idempotencyKey }),
  snapshot: (gateId: string) =>
    api.get<DirectorySnapshot>("/offline-sync/snapshot", {
      query: { gateId },
      timeoutMs: 30_000
    }),
  syncMutations: async (payload: {
    deviceId: string;
    gateId: string;
    mutations: OfflineMutationPayload[];
  }) => {
    const body = {
      deviceId: payload.deviceId,
      gateId: payload.gateId,
      mutations: payload.mutations
    };
    const batchDigest = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      payload.mutations.map((item) => item.clientMutationId).join(":")
    );
    const requestHash = await hashCanonicalPayload(body);
    return api.post<{ results: OfflineMutationResult[] }>("/offline-sync/mutations", body, {
      headers: { "X-Request-Hash": requestHash },
      idempotencyKey: `sync:${batchDigest}`
    });
  },
  verifyParcelCode: (code: string, idempotencyKey: string) =>
    api.post<ParcelSummary>("/parcels/codes/verify", { code }, { idempotencyKey }),
  verifyVisitorCode: (code: string, idempotencyKey: string) =>
    api.post<VisitDetail>("/visitors/codes/verify", { code }, { idempotencyKey }),
  visitDetail: (id: string) => api.get<VisitDetail>(`/visitors/${id}`),
  visitorList: (status?: string) =>
    api.get<CursorPage<VisitSummary>>("/visitors/gate", { query: { status } }),
  visitorTransition: (
    id: string,
    action: "check-in" | "check-out",
    version: number,
    idempotencyKey: string
  ) => api.post<VisitDetail>(`/visitors/${id}/${action}`, { version }, { idempotencyKey }),
  visitorOverride: (id: string, reason: string, version: number, idempotencyKey: string) =>
    api.post<VisitDetail>(`/visitors/${id}/override`, { reason, version }, { idempotencyKey })
};
