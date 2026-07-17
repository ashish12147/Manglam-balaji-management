import {
  ComplaintStatus,
  domainError,
  err,
  type ComplaintStatus as ComplaintStatusType,
  type DomainError,
  type Result,
  type StateTransition,
} from '@manglam/types';

import { applyTransition, hasRequiredText, type TransitionTable } from './state-machine.js';

export const COMPLAINT_TRANSITIONS: TransitionTable<ComplaintStatusType> = Object.freeze({
  OPEN: [ComplaintStatus.ASSIGNED, ComplaintStatus.CANCELLED],
  ASSIGNED: [ComplaintStatus.IN_PROGRESS, ComplaintStatus.RESOLVED, ComplaintStatus.CANCELLED],
  IN_PROGRESS: [ComplaintStatus.RESOLVED, ComplaintStatus.CANCELLED],
  RESOLVED: [ComplaintStatus.CLOSED, ComplaintStatus.REOPENED],
  CLOSED: [],
  REOPENED: [
    ComplaintStatus.ASSIGNED,
    ComplaintStatus.IN_PROGRESS,
    ComplaintStatus.RESOLVED,
    ComplaintStatus.CANCELLED,
  ],
  CANCELLED: [],
});

export interface ComplaintTransitionCommand {
  readonly current: ComplaintStatusType;
  readonly target: ComplaintStatusType;
  readonly actorId: string;
  readonly assigneeId?: string;
  readonly reason?: string;
  readonly resolutionNote?: string;
  readonly resolvedAt?: string;
  readonly occurredAt: string;
  readonly reopenWindowDays?: number;
}

export const transitionComplaint = (
  command: ComplaintTransitionCommand,
): Result<StateTransition<ComplaintStatusType>, DomainError> => {
  if (command.target === ComplaintStatus.ASSIGNED && !command.assigneeId) {
    return err(domainError('COMPLAINT_INVALID_TRANSITION', 'An assignee is required.', {}));
  }
  if (command.target === ComplaintStatus.RESOLVED && !hasRequiredText(command.resolutionNote)) {
    return err(domainError('COMPLAINT_INVALID_TRANSITION', 'A resolution note is required.', {}));
  }
  if (command.target === ComplaintStatus.CANCELLED && !hasRequiredText(command.reason)) {
    return err(
      domainError('COMPLAINT_INVALID_TRANSITION', 'A cancellation reason is required.', {}),
    );
  }
  if (command.target === ComplaintStatus.REOPENED) {
    if (!hasRequiredText(command.reason) || !command.resolvedAt) {
      return err(
        domainError(
          'COMPLAINT_INVALID_TRANSITION',
          'Reopening requires a reason and resolution time.',
          {},
        ),
      );
    }
    const windowDays = command.reopenWindowDays ?? 7;
    const elapsed = Date.parse(command.occurredAt) - Date.parse(command.resolvedAt);
    if (
      !Number.isFinite(windowDays) ||
      windowDays <= 0 ||
      !Number.isFinite(elapsed) ||
      elapsed < 0 ||
      elapsed > windowDays * 86_400_000
    ) {
      return err(
        domainError(
          'COMPLAINT_REOPEN_WINDOW_EXPIRED',
          'The complaint reopening window has expired.',
          {
            reopenWindowDays: windowDays,
          },
        ),
      );
    }
  }

  return applyTransition({
    table: COMPLAINT_TRANSITIONS,
    current: command.current,
    target: command.target,
    occurredAt: command.occurredAt,
    eventPrefix: 'COMPLAINT',
    errorCode: 'COMPLAINT_INVALID_TRANSITION',
    aggregateLabel: 'complaint',
  });
};
