import {
  AttendanceStatus,
  DailyHelpStatus,
  domainError,
  err,
  type AttendanceStatus as AttendanceStatusType,
  type DailyHelpStatus as DailyHelpStatusType,
  type DomainError,
  type Result,
  type StateTransition,
} from '@manglam/types';

import { applyTransition, hasRequiredText, type TransitionTable } from './state-machine.js';

export const DAILY_HELP_TRANSITIONS: TransitionTable<DailyHelpStatusType> = Object.freeze({
  ACTIVE: [DailyHelpStatus.SUSPENDED, DailyHelpStatus.INACTIVE],
  SUSPENDED: [DailyHelpStatus.ACTIVE, DailyHelpStatus.INACTIVE],
  INACTIVE: [DailyHelpStatus.ACTIVE],
});

export const transitionDailyHelp = (command: {
  readonly current: DailyHelpStatusType;
  readonly target: DailyHelpStatusType;
  readonly reason?: string;
  readonly occurredAt: string;
}): Result<StateTransition<DailyHelpStatusType>, DomainError> => {
  if (
    (command.target === DailyHelpStatus.SUSPENDED || command.target === DailyHelpStatus.INACTIVE) &&
    !hasRequiredText(command.reason)
  ) {
    return err(
      domainError('DAILY_HELP_INVALID_TRANSITION', 'A status-change reason is required.', {}),
    );
  }

  return applyTransition({
    table: DAILY_HELP_TRANSITIONS,
    current: command.current,
    target: command.target,
    occurredAt: command.occurredAt,
    eventPrefix: 'DAILY_HELP',
    errorCode: 'DAILY_HELP_INVALID_TRANSITION',
    aggregateLabel: 'daily-help profile',
  });
};

export const ATTENDANCE_TRANSITIONS: Readonly<
  Record<'NOT_STARTED' | AttendanceStatusType, readonly AttendanceStatusType[]>
> = Object.freeze({
  NOT_STARTED: [AttendanceStatus.CHECKED_IN],
  CHECKED_IN: [AttendanceStatus.CHECKED_OUT, AttendanceStatus.VOIDED],
  CHECKED_OUT: [AttendanceStatus.VOIDED],
  VOIDED: [],
});

export interface AttendanceTransitionCommand {
  readonly current: AttendanceStatusType | null;
  readonly target: AttendanceStatusType;
  readonly actorId: string;
  readonly gateId: string;
  readonly helperActive: boolean;
  readonly hasVoidPermission?: boolean;
  readonly reason?: string;
  readonly occurredAt: string;
}

export const transitionAttendance = (
  command: AttendanceTransitionCommand,
): Result<StateTransition<AttendanceStatusType>, DomainError> => {
  const currentKey = command.current ?? 'NOT_STARTED';
  if (!ATTENDANCE_TRANSITIONS[currentKey].includes(command.target)) {
    return err(
      domainError('ATTENDANCE_INVALID_TRANSITION', 'This attendance transition is not permitted.', {
        current: currentKey,
        target: command.target,
      }),
    );
  }
  if (command.target === AttendanceStatus.CHECKED_IN && !command.helperActive) {
    return err(
      domainError('ATTENDANCE_INVALID_TRANSITION', 'Inactive daily help cannot check in.', {}),
    );
  }
  if (!command.actorId || !command.gateId) {
    return err(domainError('ATTENDANCE_INVALID_TRANSITION', 'Guard and gate are required.', {}));
  }
  if (
    command.target === AttendanceStatus.VOIDED &&
    (command.hasVoidPermission !== true || !hasRequiredText(command.reason))
  ) {
    return err(
      domainError(
        'ATTENDANCE_INVALID_TRANSITION',
        'Voiding attendance requires permission and a reason.',
        {},
      ),
    );
  }

  return {
    ok: true,
    value: {
      previous: command.current,
      current: command.target,
      event: `DAILY_HELP_ATTENDANCE_${command.target}`,
      occurredAt: command.occurredAt,
    },
  };
};
