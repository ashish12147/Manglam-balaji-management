import {
  ParcelStatus,
  domainError,
  err,
  type DomainError,
  type ParcelStatus as ParcelStatusType,
  type Result,
  type StateTransition,
} from '@manglam/types';

import { applyTransition, hasRequiredText, type TransitionTable } from './state-machine.js';

export const PARCEL_TRANSITIONS: TransitionTable<ParcelStatusType> = Object.freeze({
  EXPECTED: [ParcelStatus.ARRIVED, ParcelStatus.CANCELLED],
  ARRIVED: [ParcelStatus.HELD_AT_GATE, ParcelStatus.RETURNED, ParcelStatus.CANCELLED],
  HELD_AT_GATE: [ParcelStatus.COLLECTED, ParcelStatus.RETURNED],
  COLLECTED: [],
  RETURNED: [],
  CANCELLED: [],
});

export interface ParcelTransitionCommand {
  readonly current: ParcelStatusType;
  readonly target: ParcelStatusType;
  readonly actorId: string;
  readonly collectionCodeVerified?: boolean;
  readonly reason?: string;
  readonly occurredAt: string;
}

export const transitionParcel = (
  command: ParcelTransitionCommand,
): Result<StateTransition<ParcelStatusType>, DomainError> => {
  if (command.target === ParcelStatus.COLLECTED && command.collectionCodeVerified !== true) {
    return err(
      domainError(
        'PARCEL_COLLECTION_CODE_INVALID',
        'A valid one-time collection code is required.',
        {},
      ),
    );
  }
  if (
    (command.target === ParcelStatus.RETURNED || command.target === ParcelStatus.CANCELLED) &&
    !hasRequiredText(command.reason)
  ) {
    return err(
      domainError('PARCEL_INVALID_TRANSITION', 'A reason is required for this parcel action.', {}),
    );
  }

  return applyTransition({
    table: PARCEL_TRANSITIONS,
    current: command.current,
    target: command.target,
    occurredAt: command.occurredAt,
    eventPrefix: 'PARCEL',
    errorCode: 'PARCEL_INVALID_TRANSITION',
    aggregateLabel: 'parcel',
  });
};
