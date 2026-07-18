import type { OfflineMutationResult } from "@/api/endpoints";
import type { SyncStatus } from "@/types/domain";

export interface QueueState {
  attemptCount: number;
  conflict: unknown | null;
  errorCode: string | null;
  errorMessage: string | null;
  nextAttemptAt: string | null;
  serverOccurredAt: string | null;
  serverRecordId: string | null;
  status: SyncStatus;
}

const transitions: Record<SyncStatus, ReadonlySet<SyncStatus>> = {
  CONFLICT: new Set(["LOCAL_PENDING"]),
  FAILED: new Set(["LOCAL_PENDING", "SYNCING"]),
  LOCAL_PENDING: new Set(["SYNCING"]),
  SYNCED: new Set(),
  SYNCING: new Set(["CONFLICT", "FAILED", "SYNCED"])
};

export function canTransition(from: SyncStatus, to: SyncStatus): boolean {
  return transitions[from].has(to);
}

export function transitionQueueState(current: QueueState, next: SyncStatus): QueueState {
  if (!canTransition(current.status, next)) {
    throw new Error(`Illegal sync transition: ${current.status} -> ${next}`);
  }
  return {
    ...current,
    attemptCount: next === "SYNCING" ? current.attemptCount + 1 : current.attemptCount,
    conflict: next === "LOCAL_PENDING" ? null : current.conflict,
    errorCode: next === "LOCAL_PENDING" || next === "SYNCING" ? null : current.errorCode,
    errorMessage: next === "LOCAL_PENDING" || next === "SYNCING" ? null : current.errorMessage,
    nextAttemptAt: next === "LOCAL_PENDING" || next === "SYNCING" ? null : current.nextAttemptAt,
    status: next
  };
}

export function retryDelayMs(attemptCount: number): number {
  return Math.min(5 * 60_000, Math.max(5_000, 5_000 * 2 ** Math.max(0, attemptCount - 1)));
}

export function applyServerResult(
  current: QueueState,
  result: OfflineMutationResult,
  nowMs: number = Date.now()
): QueueState {
  if (current.status !== "SYNCING") {
    throw new Error(`A server result cannot be applied while mutation is ${current.status}.`);
  }

  if (result.status === "SYNCED") {
    return {
      ...transitionQueueState(current, "SYNCED"),
      conflict: null,
      errorCode: null,
      errorMessage: null,
      nextAttemptAt: null,
      serverOccurredAt: result.serverOccurredAt ?? null,
      serverRecordId: result.serverRecordId ?? null
    };
  }

  if (result.status === "CONFLICT") {
    return {
      ...transitionQueueState(current, "CONFLICT"),
      conflict: result.serverState ?? null,
      errorCode: result.code ?? "SYNC_CONFLICT",
      errorMessage: result.message ?? "The server record changed before this action was synchronized.",
      nextAttemptAt: null
    };
  }

  const nextAttemptAt = result.retryable
    ? new Date(nowMs + retryDelayMs(current.attemptCount)).toISOString()
    : null;
  return {
    ...transitionQueueState(current, "FAILED"),
    errorCode: result.code ?? "SYNC_FAILED",
    errorMessage: result.message ?? "The server did not accept this offline action.",
    nextAttemptAt
  };
}

export function shouldAttempt(state: QueueState, nowMs: number = Date.now()): boolean {
  if (state.status === "LOCAL_PENDING") return true;
  if (state.status !== "FAILED" || !state.nextAttemptAt) return false;
  const retryAt = new Date(state.nextAttemptAt).getTime();
  return !Number.isNaN(retryAt) && retryAt <= nowMs;
}
