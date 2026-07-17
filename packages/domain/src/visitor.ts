import {
  ApprovalSource,
  PreApprovalStatus,
  VisitApprovalStatus,
  VisitStatus,
  domainError,
  err,
  ok,
  type DomainError,
  type PreApprovalStatus as PreApprovalStatusType,
  type Result,
  type StateTransition,
  type VisitApprovalStatus as VisitApprovalStatusType,
  type VisitStatus as VisitStatusType,
} from '@manglam/types';

import { applyTransition, hasRequiredText, type TransitionTable } from './state-machine.js';

export const VISIT_TRANSITIONS: TransitionTable<VisitStatusType> = Object.freeze({
  DRAFT: [VisitStatus.EXPECTED, VisitStatus.ARRIVED_AT_GATE, VisitStatus.CANCELLED],
  EXPECTED: [VisitStatus.ARRIVED_AT_GATE, VisitStatus.CANCELLED, VisitStatus.EXPIRED],
  ARRIVED_AT_GATE: [VisitStatus.AWAITING_APPROVAL, VisitStatus.APPROVED, VisitStatus.CANCELLED],
  AWAITING_APPROVAL: [
    VisitStatus.APPROVED,
    VisitStatus.REJECTED,
    VisitStatus.APPROVAL_TIMED_OUT,
    VisitStatus.CANCELLED,
  ],
  APPROVED: [VisitStatus.CHECKED_IN, VisitStatus.CANCELLED, VisitStatus.EXPIRED],
  REJECTED: [VisitStatus.APPROVED],
  APPROVAL_TIMED_OUT: [VisitStatus.APPROVED],
  CHECKED_IN: [VisitStatus.CHECKED_OUT],
  CHECKED_OUT: [],
  CANCELLED: [],
  EXPIRED: [],
});

export type VisitTransitionMode =
  | 'STANDARD'
  | 'PRE_APPROVAL'
  | 'RESIDENT_DECISION'
  | 'OVERRIDE'
  | 'SYSTEM';

export interface VisitTransitionCommand {
  readonly current: VisitStatusType;
  readonly target: VisitStatusType;
  readonly mode: VisitTransitionMode;
  readonly actorId: string;
  readonly gateId?: string;
  readonly guardId?: string;
  readonly reason?: string;
  readonly hasOverridePermission?: boolean;
  readonly recentAuthentication?: boolean;
  readonly preApprovalValid?: boolean;
  readonly occurredAt: string;
}

const invalidVisit = (
  message: string,
  command: VisitTransitionCommand,
): Result<never, DomainError> =>
  err(
    domainError('VISIT_INVALID_TRANSITION', message, {
      current: command.current,
      target: command.target,
    }),
  );

export const transitionVisit = (
  command: VisitTransitionCommand,
): Result<StateTransition<VisitStatusType>, DomainError> => {
  if (command.current === command.target) {
    if (command.target === VisitStatus.CHECKED_IN) {
      return err(
        domainError('VISIT_ALREADY_CHECKED_IN', 'This visit has already been checked in.', {}),
      );
    }
    if (command.target === VisitStatus.CHECKED_OUT) {
      return err(
        domainError('VISIT_ALREADY_CHECKED_OUT', 'This visit has already been checked out.', {}),
      );
    }
  }

  if (command.target === VisitStatus.APPROVED) {
    if (command.current === VisitStatus.ARRIVED_AT_GATE) {
      if (command.mode !== 'PRE_APPROVAL' || command.preApprovalValid !== true) {
        return invalidVisit('Gate approval requires a valid pre-approval.', command);
      }
    } else if (command.current === VisitStatus.AWAITING_APPROVAL) {
      if (command.mode !== 'RESIDENT_DECISION') {
        return invalidVisit('An awaiting visit requires an authorised resident decision.', command);
      }
    } else if (
      command.current === VisitStatus.REJECTED ||
      command.current === VisitStatus.APPROVAL_TIMED_OUT
    ) {
      if (command.mode !== 'OVERRIDE' || command.hasOverridePermission !== true) {
        return err(
          domainError(
            'VISIT_OVERRIDE_NOT_ALLOWED',
            'This visit requires an authorised supervisor override.',
            {
              current: command.current,
            },
          ),
        );
      }
      if (command.recentAuthentication !== true) {
        return err(
          domainError(
            'VISIT_OVERRIDE_NOT_ALLOWED',
            'A recent authentication is required for an override.',
            {},
          ),
        );
      }
      if (!hasRequiredText(command.reason)) {
        return err(
          domainError(
            'VISIT_OVERRIDE_REASON_REQUIRED',
            'A meaningful override reason is required.',
            {},
          ),
        );
      }
    }
  }

  if (
    command.current === VisitStatus.AWAITING_APPROVAL &&
    command.target === VisitStatus.REJECTED
  ) {
    if (command.mode !== 'RESIDENT_DECISION') {
      return invalidVisit('Only an authorised resident decision may reject this visit.', command);
    }
  }
  if (command.target === VisitStatus.APPROVAL_TIMED_OUT && command.mode !== 'SYSTEM') {
    return invalidVisit('Only the configured timeout process may time out an approval.', command);
  }
  if (command.target === VisitStatus.CHECKED_IN || command.target === VisitStatus.CHECKED_OUT) {
    if (!command.gateId || !command.guardId) {
      return invalidVisit('Gate and guard identity are required for entry events.', command);
    }
  }

  return applyTransition({
    table: VISIT_TRANSITIONS,
    current: command.current,
    target: command.target,
    occurredAt: command.occurredAt,
    eventPrefix: 'VISIT',
    errorCode: 'VISIT_INVALID_TRANSITION',
    aggregateLabel: 'visit',
  });
};

export const VISIT_APPROVAL_TRANSITIONS: TransitionTable<VisitApprovalStatusType> = Object.freeze({
  PENDING: [
    VisitApprovalStatus.APPROVED,
    VisitApprovalStatus.REJECTED,
    VisitApprovalStatus.TIMED_OUT,
    VisitApprovalStatus.CANCELLED,
    VisitApprovalStatus.OVERRIDDEN,
  ],
  APPROVED: [],
  REJECTED: [],
  TIMED_OUT: [],
  CANCELLED: [],
  OVERRIDDEN: [],
});

export interface ApprovalDecisionCommand {
  readonly current: VisitApprovalStatusType;
  readonly target: Exclude<VisitApprovalStatusType, 'PENDING'>;
  readonly source: (typeof ApprovalSource)[keyof typeof ApprovalSource];
  readonly actorId: string | null;
  readonly reason?: string;
  readonly occurredAt: string;
}

export const decideVisitApproval = (
  command: ApprovalDecisionCommand,
): Result<StateTransition<VisitApprovalStatusType>, DomainError> => {
  if (command.current !== VisitApprovalStatus.PENDING) {
    return err(
      domainError(
        'APPROVAL_ALREADY_DECIDED',
        'The first terminal approval decision has already won.',
        {
          current: command.current,
          attempted: command.target,
        },
      ),
    );
  }
  if (
    command.target === VisitApprovalStatus.OVERRIDDEN &&
    (command.source !== ApprovalSource.GUARD_OVERRIDE ||
      !command.actorId ||
      !hasRequiredText(command.reason))
  ) {
    return err(
      domainError(
        'VISIT_OVERRIDE_REASON_REQUIRED',
        'An override requires an actor and reason.',
        {},
      ),
    );
  }

  return applyTransition({
    table: VISIT_APPROVAL_TRANSITIONS,
    current: command.current,
    target: command.target,
    occurredAt: command.occurredAt,
    eventPrefix: 'VISIT_APPROVAL',
    errorCode: 'APPROVAL_ALREADY_DECIDED',
    aggregateLabel: 'visit approval',
  });
};

export const PRE_APPROVAL_TRANSITIONS: TransitionTable<PreApprovalStatusType> = Object.freeze({
  ACTIVE: [
    PreApprovalStatus.CONSUMED,
    PreApprovalStatus.CANCELLED,
    PreApprovalStatus.EXPIRED,
    PreApprovalStatus.SUSPENDED,
  ],
  CONSUMED: [],
  CANCELLED: [],
  EXPIRED: [],
  SUSPENDED: [PreApprovalStatus.ACTIVE, PreApprovalStatus.CANCELLED, PreApprovalStatus.EXPIRED],
});

export const transitionPreApproval = (input: {
  readonly current: PreApprovalStatusType;
  readonly target: PreApprovalStatusType;
  readonly occurredAt: string;
}): Result<StateTransition<PreApprovalStatusType>, DomainError> =>
  applyTransition({
    table: PRE_APPROVAL_TRANSITIONS,
    current: input.current,
    target: input.target,
    occurredAt: input.occurredAt,
    eventPrefix: 'PRE_APPROVAL',
    errorCode: 'VISIT_INVALID_TRANSITION',
    aggregateLabel: 'pre-approval',
  });

export const isLongVisit = (
  checkedInAt: string,
  now: string,
  thresholdMinutes: number,
): boolean => {
  if (!Number.isFinite(thresholdMinutes) || thresholdMinutes <= 0) {
    return false;
  }
  const elapsed = Date.parse(now) - Date.parse(checkedInAt);
  return Number.isFinite(elapsed) && elapsed >= thresholdMinutes * 60_000;
};
