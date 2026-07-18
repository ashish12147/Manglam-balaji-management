import { describe, expect, it } from "vitest";

import {
  assertOfflineOperationAllowed,
  isOfflineOperation,
  isResidentDecisionOperation
} from "./operations";

describe("offline operation policy", () => {
  it("allows only the reviewed shared-domain gate operations", () => {
    expect(isOfflineOperation("VISIT_PREPARE")).toBe(true);
    expect(isOfflineOperation("VISIT_CHECK_OUT")).toBe(true);
    expect(isOfflineOperation("EMERGENCY_ACKNOWLEDGE")).toBe(true);
    expect(isOfflineOperation("PARCEL_HOLD")).toBe(false);
  });

  it("always rejects a resident decision while offline", () => {
    expect(isResidentDecisionOperation("RESIDENT_VISITOR_APPROVAL")).toBe(true);
    expect(() => assertOfflineOperationAllowed("RESIDENT_VISITOR_APPROVAL")).toThrow(
      "Resident approval or rejection cannot be recorded while offline."
    );
  });

  it("rejects unknown mutations instead of guessing", () => {
    expect(() => assertOfflineOperationAllowed("UNKNOWN_ACTION")).toThrow(
      "is not permitted in the offline queue"
    );
  });
});
