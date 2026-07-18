export const offlineOperations = [
  "VISIT_PREPARE",
  "VISIT_MANUAL_ENTRY",
  "VISIT_CHECK_OUT",
  "DAILY_HELP_CHECK_IN",
  "DAILY_HELP_CHECK_OUT",
  "EMERGENCY_ACKNOWLEDGE"
] as const;

export type OfflineOperation = (typeof offlineOperations)[number];

const allowedOperations = new Set<string>(offlineOperations);

const residentDecisionOperations = new Set([
  "RESIDENT_VISITOR_APPROVAL",
  "VISITOR_APPROVE",
  "VISITOR_REJECT",
  "VISITOR_APPROVAL",
  "VISITOR_CHECK_IN_AFTER_APPROVAL"
]);

export function isOfflineOperation(value: string): value is OfflineOperation {
  return allowedOperations.has(value);
}

export function isResidentDecisionOperation(value: string): boolean {
  return residentDecisionOperations.has(value);
}

export function assertOfflineOperationAllowed(value: string): asserts value is OfflineOperation {
  if (isResidentDecisionOperation(value)) {
    throw new Error("Resident approval or rejection cannot be recorded while offline.");
  }
  if (!isOfflineOperation(value)) {
    throw new Error(`Operation ${value} is not permitted in the offline queue.`);
  }
}

export function operationLabel(operation: OfflineOperation): string {
  switch (operation) {
    case "VISIT_PREPARE":
      return "Visitor draft / विज़िटर ड्राफ्ट";
    case "VISIT_MANUAL_ENTRY":
      return "Offline visitor entry / ऑफलाइन विज़िटर एंट्री";
    case "VISIT_CHECK_OUT":
      return "Visitor check-out / विज़िटर निकास";
    case "DAILY_HELP_CHECK_IN":
      return "Daily help check-in / सहायक प्रवेश";
    case "DAILY_HELP_CHECK_OUT":
      return "Daily help check-out / सहायक निकास";
    case "EMERGENCY_ACKNOWLEDGE":
      return "Emergency acknowledgement / आपात स्वीकृति";
  }
}
