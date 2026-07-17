import {
  MembershipStatus,
  domainError,
  err,
  type DomainError,
  type MembershipStatus as MembershipStatusType,
  type Result,
  type StateTransition,
} from '@manglam/types';

import { applyTransition, hasRequiredText, type TransitionTable } from './state-machine.js';

export const MEMBERSHIP_TRANSITIONS: TransitionTable<MembershipStatusType> = Object.freeze({
  PENDING: [MembershipStatus.APPROVED, MembershipStatus.REJECTED],
  APPROVED: [MembershipStatus.SUSPENDED, MembershipStatus.ENDED],
  REJECTED: [],
  SUSPENDED: [MembershipStatus.APPROVED, MembershipStatus.ENDED],
  ENDED: [],
});

export interface MembershipTransitionCommand {
  readonly current: MembershipStatusType;
  readonly target: MembershipStatusType;
  readonly actorId: string;
  readonly reason?: string;
  readonly occupancyEndsAt?: string;
  readonly occurredAt: string;
}

export const transitionMembership = (
  command: MembershipTransitionCommand,
): Result<StateTransition<MembershipStatusType>, DomainError> => {
  if (!command.actorId) {
    return err(
      domainError('MEMBERSHIP_INVALID_TRANSITION', 'An acting administrator is required.', {}),
    );
  }
  if (
    (command.target === MembershipStatus.REJECTED ||
      command.target === MembershipStatus.SUSPENDED ||
      command.target === MembershipStatus.ENDED) &&
    !hasRequiredText(command.reason)
  ) {
    return err(
      domainError('MEMBERSHIP_INVALID_TRANSITION', 'A membership status reason is required.', {}),
    );
  }
  if (command.target === MembershipStatus.ENDED) {
    const endsAt = command.occupancyEndsAt ? Date.parse(command.occupancyEndsAt) : Number.NaN;
    const occurredAt = Date.parse(command.occurredAt);
    if (!Number.isFinite(endsAt) || !Number.isFinite(occurredAt) || endsAt > occurredAt) {
      return err(
        domainError(
          'MEMBERSHIP_INVALID_TRANSITION',
          'Membership end time must be recorded and effective.',
          {},
        ),
      );
    }
  }

  return applyTransition({
    table: MEMBERSHIP_TRANSITIONS,
    current: command.current,
    target: command.target,
    occurredAt: command.occurredAt,
    eventPrefix: 'MEMBERSHIP',
    errorCode: 'MEMBERSHIP_INVALID_TRANSITION',
    aggregateLabel: 'membership',
  });
};

export const isMembershipEffective = (input: {
  readonly status: MembershipStatusType;
  readonly startsAt: string;
  readonly endsAt: string | null;
  readonly at: string;
}): boolean => {
  if (input.status !== MembershipStatus.APPROVED) return false;
  const at = Date.parse(input.at);
  const startsAt = Date.parse(input.startsAt);
  const endsAt = input.endsAt === null ? Number.POSITIVE_INFINITY : Date.parse(input.endsAt);
  return Number.isFinite(at) && Number.isFinite(startsAt) && at >= startsAt && at < endsAt;
};
