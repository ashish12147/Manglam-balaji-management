import {
  MaintenanceChargeStatus,
  PaymentMethod,
  PaymentStatus,
  domainError,
  err,
  ok,
  type DomainError,
  type MaintenanceChargeStatus as MaintenanceChargeStatusType,
  type PaymentMethod as PaymentMethodType,
  type PaymentStatus as PaymentStatusType,
  type Result,
  type StateTransition,
} from '@manglam/types';

import { applyTransition, hasRequiredText, type TransitionTable } from './state-machine.js';

export const PAYMENT_TRANSITIONS: TransitionTable<PaymentStatusType> = Object.freeze({
  PENDING_VERIFICATION: [PaymentStatus.CONFIRMED, PaymentStatus.FAILED],
  CONFIRMED: [PaymentStatus.REVERSED],
  REVERSED: [],
  FAILED: [],
});

const REFERENCE_REQUIRED_METHODS: readonly PaymentMethodType[] = [
  PaymentMethod.UPI,
  PaymentMethod.BANK_TRANSFER,
  PaymentMethod.CHEQUE,
];

export interface PaymentTransitionCommand {
  readonly current: PaymentStatusType;
  readonly target: PaymentStatusType;
  readonly method: PaymentMethodType;
  readonly source: 'MANUAL' | 'PAYMENT_GATEWAY';
  readonly reference?: string;
  readonly providerVerified?: boolean;
  readonly hasReversePermission?: boolean;
  readonly recentAuthentication?: boolean;
  readonly reason?: string;
  readonly occurredAt: string;
}

export const transitionPayment = (
  command: PaymentTransitionCommand,
): Result<StateTransition<PaymentStatusType>, DomainError> => {
  if (
    command.target === PaymentStatus.CONFIRMED &&
    REFERENCE_REQUIRED_METHODS.includes(command.method) &&
    !hasRequiredText(command.reference)
  ) {
    return err(
      domainError('PAYMENT_REFERENCE_REQUIRED', 'A traceable payment reference is required.', {}),
    );
  }
  if (
    command.target === PaymentStatus.CONFIRMED &&
    command.source === 'PAYMENT_GATEWAY' &&
    command.providerVerified !== true
  ) {
    return err(
      domainError(
        'PAYMENT_VERIFICATION_REQUIRED',
        'Gateway confirmation must be verified server-side.',
        {},
      ),
    );
  }
  if (command.target === PaymentStatus.REVERSED) {
    if (command.hasReversePermission !== true || command.recentAuthentication !== true) {
      return err(
        domainError(
          'PAYMENT_INVALID_TRANSITION',
          'Payment reversal requires permission and recent authentication.',
          {},
        ),
      );
    }
    if (!hasRequiredText(command.reason)) {
      return err(domainError('PAYMENT_INVALID_TRANSITION', 'A reversal reason is required.', {}));
    }
  }
  if (command.target === PaymentStatus.FAILED && !hasRequiredText(command.reason)) {
    return err(domainError('PAYMENT_INVALID_TRANSITION', 'A failure reason is required.', {}));
  }

  return applyTransition({
    table: PAYMENT_TRANSITIONS,
    current: command.current,
    target: command.target,
    occurredAt: command.occurredAt,
    eventPrefix: 'PAYMENT',
    errorCode: 'PAYMENT_INVALID_TRANSITION',
    aggregateLabel: 'payment',
  });
};

export const deriveMaintenanceChargeStatus = (input: {
  readonly totalMinor: number;
  readonly paidMinor: number;
  readonly waivedMinor: number;
  readonly cancelled: boolean;
}): Result<MaintenanceChargeStatusType, DomainError> => {
  const amounts = [input.totalMinor, input.paidMinor, input.waivedMinor];
  if (
    amounts.some((amount) => !Number.isSafeInteger(amount) || amount < 0) ||
    input.totalMinor === 0
  ) {
    return err(
      domainError(
        'PAYMENT_ALLOCATION_INVALID',
        'Charge amounts must be positive integer minor units.',
        {},
      ),
    );
  }
  if (input.cancelled) {
    return input.paidMinor === 0 && input.waivedMinor === 0
      ? ok(MaintenanceChargeStatus.CANCELLED)
      : err(
          domainError(
            'PAYMENT_ALLOCATION_INVALID',
            'A funded charge cannot be destructively cancelled.',
            {},
          ),
        );
  }

  const outstanding = input.totalMinor - input.paidMinor - input.waivedMinor;
  if (outstanding < 0) {
    return err(
      domainError('PAYMENT_ALLOCATION_INVALID', 'Payments and waivers exceed the charge.', {}),
    );
  }
  if (outstanding === 0) {
    return ok(
      input.paidMinor === 0 && input.waivedMinor > 0
        ? MaintenanceChargeStatus.WAIVED
        : MaintenanceChargeStatus.PAID,
    );
  }
  if (input.paidMinor > 0 || input.waivedMinor > 0) {
    return ok(MaintenanceChargeStatus.PARTIALLY_PAID);
  }
  return ok(MaintenanceChargeStatus.UNPAID);
};

export interface OutstandingCharge {
  readonly chargeId: string;
  readonly dueAt: string;
  readonly outstandingMinor: number;
}

export interface PaymentAllocation {
  readonly chargeId: string;
  readonly amountMinor: number;
}

export const allocatePaymentOldestFirst = (
  amountMinor: number,
  charges: readonly OutstandingCharge[],
): Result<readonly PaymentAllocation[], DomainError> => {
  if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) {
    return err(
      domainError('PAYMENT_ALLOCATION_INVALID', 'Payment amount must be positive minor units.', {}),
    );
  }
  if (
    charges.some(
      ({ dueAt, outstandingMinor }) =>
        !Number.isFinite(Date.parse(dueAt)) ||
        !Number.isSafeInteger(outstandingMinor) ||
        outstandingMinor < 0,
    )
  ) {
    return err(domainError('PAYMENT_ALLOCATION_INVALID', 'Outstanding balances are invalid.', {}));
  }
  if (new Set(charges.map(({ chargeId }) => chargeId)).size !== charges.length) {
    return err(domainError('PAYMENT_ALLOCATION_INVALID', 'Charge identifiers must be unique.', {}));
  }
  const totalOutstanding = charges.reduce((sum, charge) => sum + charge.outstandingMinor, 0);
  if (!Number.isSafeInteger(totalOutstanding)) {
    return err(
      domainError('PAYMENT_ALLOCATION_INVALID', 'Outstanding balance total is unsafe.', {}),
    );
  }
  if (amountMinor > totalOutstanding) {
    return err(
      domainError(
        'PAYMENT_ALLOCATION_INVALID',
        'Payment exceeds the selected outstanding balance.',
        {},
      ),
    );
  }

  let remaining = amountMinor;
  const allocations: PaymentAllocation[] = [];
  const ordered = [...charges].sort(
    (left, right) =>
      Date.parse(left.dueAt) - Date.parse(right.dueAt) ||
      left.chargeId.localeCompare(right.chargeId),
  );
  for (const charge of ordered) {
    if (remaining === 0) break;
    const allocated = Math.min(remaining, charge.outstandingMinor);
    if (allocated > 0) {
      allocations.push({ chargeId: charge.chargeId, amountMinor: allocated });
      remaining -= allocated;
    }
  }

  return ok(allocations);
};

export const formatReceiptNumber = (
  societyCode: string,
  fiscalYear: string,
  sequence: number,
): Result<string, DomainError> => {
  const normalizedCode = societyCode.trim().toUpperCase();
  const fiscalMatch = /^(\d{4})-(\d{2})$/.exec(fiscalYear);
  const fiscalYearValid =
    fiscalMatch !== null && Number(fiscalMatch[2]) === (Number(fiscalMatch[1]) + 1) % 100;
  if (!/^[A-Z0-9-]{2,12}$/.test(normalizedCode) || !fiscalYearValid) {
    return err(domainError('VALIDATION_FAILED', 'Receipt prefix or fiscal year is invalid.', {}));
  }
  if (!Number.isSafeInteger(sequence) || sequence <= 0 || sequence > 999_999_999) {
    return err(domainError('VALIDATION_FAILED', 'Receipt sequence is invalid.', {}));
  }
  return ok(`${normalizedCode}/${fiscalYear}/${sequence.toString().padStart(6, '0')}`);
};
