import { useSQLiteContext } from "expo-sqlite";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

import { ApiError, isApiError, isRetryableApiError } from "@/api/errors";
import { endpoints, type OfflineMutationResult } from "@/api/endpoints";
import { useSession } from "@/auth/session-context";
import { useConnectivity } from "@/connectivity/connectivity-context";
import {
  applyMutationResult,
  claimReadyMutations,
  enqueueMutation,
  getMutation,
  getOfflineLeaseStatus,
  listMutations,
  purgeGateData,
  queueCounts,
  replaceDirectorySnapshot,
  retryMutation,
  searchDailyHelpDirectory,
  searchFlatDirectory,
  type DirectorySearchResult,
  type OfflineLeaseStatus,
  type QueueCounts,
  type StoredMutation
} from "@/offline/repository";
import type { OfflineOperation } from "@/offline/operations";
import type { DailyHelpDirectoryItem, FlatDirectoryItem, SyncStatus } from "@/types/domain";

interface EnqueueInput {
  aggregateId?: string | null;
  baseVersion?: number | null;
  entityId?: string | null;
  entityType: string;
  operation: OfflineOperation;
  payload: Record<string, unknown>;
}

interface SyncContextValue {
  counts: QueueCounts;
  enqueue: (input: EnqueueInput) => Promise<StoredMutation>;
  error: string | null;
  getMutation: (id: string) => Promise<StoredMutation | null>;
  isRefreshingSnapshot: boolean;
  isSyncing: boolean;
  lastCompletedAt: string | null;
  lease: OfflineLeaseStatus;
  listMutations: (status?: SyncStatus) => Promise<StoredMutation[]>;
  refreshSnapshot: (force?: boolean) => Promise<void>;
  retry: (id: string) => Promise<void>;
  searchDailyHelp: (search: string) => Promise<DirectorySearchResult<DailyHelpDirectoryItem>>;
  searchFlats: (search: string) => Promise<DirectorySearchResult<FlatDirectoryItem>>;
  syncNow: () => Promise<void>;
}

const emptyCounts: QueueCounts = {
  CONFLICT: 0,
  FAILED: 0,
  LOCAL_PENDING: 0,
  SYNCED: 0,
  SYNCING: 0
};

const emptyLease: OfflineLeaseStatus = {
  deviceId: null,
  expiresAt: null,
  isExpired: true,
  issuedAt: null,
  lastAcceptedSequence: null
};

const SyncContext = createContext<SyncContextValue | null>(null);

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const db = useSQLiteContext();
  const connectivity = useConnectivity();
  const session = useSession();
  const [counts, setCounts] = useState(emptyCounts);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshingSnapshot, setIsRefreshingSnapshot] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastCompletedAt, setLastCompletedAt] = useState<string | null>(null);
  const [lease, setLease] = useState<OfflineLeaseStatus>(emptyLease);
  const syncLock = useRef(false);
  const snapshotLock = useRef(false);

  const gateId = session.metadata?.activeGate?.id ?? null;
  const serverDeviceId = session.metadata?.device.id ?? null;
  const deviceSecret = session.deviceIdentity?.installationSecret ?? null;
  const canOperate =
    session.metadata?.device.status === "ACTIVE" &&
    !!gateId &&
    !!serverDeviceId &&
    !!deviceSecret;

  const refreshLocalState = useCallback(async () => {
    const nextCounts = await queueCounts(db, gateId ?? undefined);
    const nextLease = gateId ? await getOfflineLeaseStatus(db, gateId) : emptyLease;
    setCounts(nextCounts);
    setLease(nextLease);
  }, [db, gateId]);

  useEffect(() => {
    void refreshLocalState();
  }, [refreshLocalState]);

  const refreshSnapshot = useCallback(
    async (force: boolean = false) => {
      if (
        !canOperate ||
        !gateId ||
        !serverDeviceId ||
        !connectivity.isOnline ||
        snapshotLock.current
      ) {
        return;
      }
      if (!force) {
        const current = await searchFlatDirectory(db, gateId, "");
        const generatedAt = current.generatedAt ? new Date(current.generatedAt).getTime() : 0;
        if (!current.isExpired && generatedAt > Date.now() - 15 * 60_000) return;
      }
      snapshotLock.current = true;
      setIsRefreshingSnapshot(true);
      try {
        const snapshot = await endpoints.snapshot(gateId);
        await replaceDirectorySnapshot(db, gateId, serverDeviceId, snapshot);
        await refreshLocalState();
        setError(null);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Directory synchronization failed.");
      } finally {
        snapshotLock.current = false;
        setIsRefreshingSnapshot(false);
      }
    },
    [canOperate, connectivity.isOnline, db, gateId, refreshLocalState, serverDeviceId]
  );

  const syncNow = useCallback(async () => {
    if (
      !canOperate ||
      !gateId ||
      !serverDeviceId ||
      !connectivity.isOnline ||
      syncLock.current
    ) {
      return;
    }
    syncLock.current = true;
    setIsSyncing(true);
    setError(null);
    try {
      for (let batchNumber = 0; batchNumber < 5; batchNumber += 1) {
        const claimed = await claimReadyMutations(db, gateId, 20);
        if (!claimed.length) break;
        try {
          const mutations = claimed.map((mutation) => {
            if (
              !mutation.aggregateId ||
              mutation.localSequence === null ||
              !mutation.payloadHash ||
              !mutation.signature
            ) {
              throw new Error("An unsigned or incomplete offline action was selected for synchronization.");
            }
            return {
              aggregateId: mutation.aggregateId,
              baseVersion: mutation.baseVersion,
              clientMutationId: mutation.clientMutationId,
              clientOccurredAt: mutation.localCreatedAt,
              deviceId: mutation.deviceId,
              gateId: mutation.gateId,
              localSequence: mutation.localSequence,
              operation: mutation.operation,
              payload: mutation.payload,
              payloadHash: mutation.payloadHash,
              signature: mutation.signature
            };
          });
          const response = await endpoints.syncMutations({
            deviceId: serverDeviceId,
            gateId,
            mutations
          });
          const results = new Map(response.results.map((result) => [result.clientMutationId, result]));
          for (const mutation of claimed) {
            const serverResult = results.get(mutation.clientMutationId);
            const result: OfflineMutationResult = serverResult
              ? {
                  ...serverResult,
                  serverRecordId: serverResult.serverRecordId ?? serverResult.serverEntityId ?? null
                }
              : {
                  clientMutationId: mutation.clientMutationId,
                  code: "SYNC_RESULT_MISSING",
                  message: "The server did not return a result for this action.",
                  retryable: true,
                  status: "FAILED"
                };
            await applyMutationResult(db, mutation.clientMutationId, result);
          }
        } catch (caught) {
          if (
            isApiError(caught) &&
            [
              "DEVICE_ENROLLMENT_REQUIRED",
              "DEVICE_LOST",
              "DEVICE_NOT_ACTIVE",
              "DEVICE_REVOKED"
            ].includes(caught.code)
          ) {
            await purgeGateData(db);
            const status =
              caught.code === "DEVICE_LOST"
                ? "LOST"
                : caught.code === "DEVICE_ENROLLMENT_REQUIRED" || caught.code === "DEVICE_NOT_ACTIVE"
                  ? "PENDING"
                  : "REVOKED";
            await session.markDeviceStatus(status);
            throw caught;
          }
          const resultFor = (clientMutationId: string): OfflineMutationResult => ({
            clientMutationId,
            code: isApiError(caught) ? caught.code : "SYNC_REQUEST_FAILED",
            correlationId: isApiError(caught) ? caught.correlationId : null,
            message: caught instanceof Error ? caught.message : "Synchronization failed.",
            retryable: isRetryableApiError(caught) || !(caught instanceof ApiError),
            status: "FAILED"
          });
          for (const mutation of claimed) {
            await applyMutationResult(db, mutation.clientMutationId, resultFor(mutation.clientMutationId));
          }
          throw caught;
        }
      }
      setLastCompletedAt(new Date().toISOString());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Synchronization failed.");
    } finally {
      syncLock.current = false;
      setIsSyncing(false);
      await refreshLocalState();
    }
  }, [
    canOperate,
    connectivity.isOnline,
    db,
    gateId,
    refreshLocalState,
    serverDeviceId,
    session
  ]);

  useEffect(() => {
    if (!connectivity.isOnline || !canOperate) return;
    void refreshSnapshot();
    void syncNow();
    const interval = setInterval(() => void syncNow(), 15_000);
    return () => clearInterval(interval);
  }, [canOperate, connectivity.isOnline, refreshSnapshot, syncNow]);

  const enqueue = useCallback(
    async (input: EnqueueInput) => {
      if (!canOperate || !gateId || !serverDeviceId || !deviceSecret) {
        throw new Error("Select an active registered device and gate before recording an action.");
      }
      const mutation = await enqueueMutation(db, {
        ...input,
        deviceId: serverDeviceId,
        deviceSecret,
        gateId
      });
      await refreshLocalState();
      if (connectivity.isOnline) setTimeout(() => void syncNow(), 0);
      return mutation;
    },
    [
      canOperate,
      connectivity.isOnline,
      db,
      deviceSecret,
      gateId,
      refreshLocalState,
      serverDeviceId,
      syncNow
    ]
  );

  const retry = useCallback(
    async (id: string) => {
      await retryMutation(db, id);
      await refreshLocalState();
      if (connectivity.isOnline) await syncNow();
    },
    [connectivity.isOnline, db, refreshLocalState, syncNow]
  );

  const value = useMemo<SyncContextValue>(
    () => ({
      counts,
      enqueue,
      error,
      getMutation: (id) => getMutation(db, id),
      isRefreshingSnapshot,
      isSyncing,
      lastCompletedAt,
      lease,
      listMutations: (status) => listMutations(db, { gateId: gateId ?? undefined, status }),
      refreshSnapshot,
      retry,
      searchDailyHelp: (search) => {
        if (!gateId) {
          return Promise.resolve({
            expiresAt: null,
            generatedAt: null,
            isExpired: true,
            items: [],
            snapshotId: null
          });
        }
        return searchDailyHelpDirectory(db, gateId, search);
      },
      searchFlats: (search) => {
        if (!gateId) {
          return Promise.resolve({
            expiresAt: null,
            generatedAt: null,
            isExpired: true,
            items: [],
            snapshotId: null
          });
        }
        return searchFlatDirectory(db, gateId, search);
      },
      syncNow
    }),
    [
      counts,
      db,
      enqueue,
      error,
      gateId,
      isRefreshingSnapshot,
      isSyncing,
      lastCompletedAt,
      lease,
      refreshSnapshot,
      retry,
      syncNow
    ]
  );

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

export function useSync(): SyncContextValue {
  const context = useContext(SyncContext);
  if (!context) throw new Error("useSync must be used inside SyncProvider");
  return context;
}
