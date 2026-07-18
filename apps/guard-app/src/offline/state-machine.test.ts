import { describe, expect, it } from "vitest";

import {
  applyServerResult,
  canTransition,
  retryDelayMs,
  shouldAttempt,
  transitionQueueState,
  type QueueState
} from "./state-machine";

function queueState(overrides: Partial<QueueState> = {}): QueueState {
  return {
    attemptCount: 0,
    conflict: null,
    errorCode: null,
    errorMessage: null,
    nextAttemptAt: null,
    serverOccurredAt: null,
    serverRecordId: null,
    status: "LOCAL_PENDING",
    ...overrides
  };
}

describe("offline queue state machine", () => {
  it("permits only explicit transitions", () => {
    expect(canTransition("LOCAL_PENDING", "SYNCING")).toBe(true);
    expect(canTransition("SYNCING", "SYNCED")).toBe(true);
    expect(canTransition("SYNCING", "CONFLICT")).toBe(true);
    expect(canTransition("SYNCED", "LOCAL_PENDING")).toBe(false);
    expect(() => transitionQueueState(queueState(), "SYNCED")).toThrow("Illegal sync transition");
  });

  it("increments attempts only when a mutation is claimed", () => {
    const syncing = transitionQueueState(queueState(), "SYNCING");
    expect(syncing.attemptCount).toBe(1);
    expect(syncing.status).toBe("SYNCING");
  });

  it("stores authoritative server identifiers after success", () => {
    const syncing = transitionQueueState(queueState(), "SYNCING");
    const result = applyServerResult(syncing, {
      clientMutationId: "mutation-1",
      serverOccurredAt: "2026-07-17T10:00:00.000Z",
      serverRecordId: "server-1",
      status: "SYNCED"
    });
    expect(result).toMatchObject({
      serverOccurredAt: "2026-07-17T10:00:00.000Z",
      serverRecordId: "server-1",
      status: "SYNCED"
    });
  });

  it("preserves server conflict details until a guard explicitly retries", () => {
    const syncing = transitionQueueState(queueState(), "SYNCING");
    const conflicted = applyServerResult(syncing, {
      clientMutationId: "mutation-1",
      code: "VISIT_ALREADY_CHECKED_OUT",
      message: "The visitor was already checked out at another gate.",
      serverState: { status: "CHECKED_OUT" },
      status: "CONFLICT"
    });
    expect(conflicted.status).toBe("CONFLICT");
    expect(conflicted.conflict).toEqual({ status: "CHECKED_OUT" });
    expect(shouldAttempt(conflicted)).toBe(false);
    const retried = transitionQueueState(conflicted, "LOCAL_PENDING");
    expect(retried.conflict).toBeNull();
  });

  it("backs off retryable failures and leaves permanent failures manual", () => {
    const syncing = transitionQueueState(queueState(), "SYNCING");
    const now = Date.parse("2026-07-17T10:00:00.000Z");
    const retryable = applyServerResult(
      syncing,
      { clientMutationId: "mutation-1", retryable: true, status: "FAILED" },
      now
    );
    expect(retryable.nextAttemptAt).toBe("2026-07-17T10:00:05.000Z");
    expect(shouldAttempt(retryable, now + 4_999)).toBe(false);
    expect(shouldAttempt(retryable, now + 5_000)).toBe(true);

    const permanent = applyServerResult(
      transitionQueueState(queueState(), "SYNCING"),
      { clientMutationId: "mutation-2", retryable: false, status: "FAILED" },
      now
    );
    expect(permanent.nextAttemptAt).toBeNull();
    expect(shouldAttempt(permanent, now + 60_000)).toBe(false);
  });

  it("caps exponential backoff at five minutes", () => {
    expect(retryDelayMs(1)).toBe(5_000);
    expect(retryDelayMs(20)).toBe(300_000);
  });
});
