import {
  EmergencyStatus,
  domainError,
  err,
  type DomainError,
  type EmergencyStatus as EmergencyStatusType,
  type Result,
  type StateTransition,
} from '@manglam/types';

import { applyTransition, hasRequiredText, type TransitionTable } from './state-machine.js';

export const EMERGENCY_TRANSITIONS: TransitionTable<EmergencyStatusType> = Object.freeze({
  ACTIVE: [EmergencyStatus.ACKNOWLEDGED, EmergencyStatus.FALSE_ALARM],
  ACKNOWLEDGED: [EmergencyStatus.RESPONDING, EmergencyStatus.RESOLVED, EmergencyStatus.FALSE_ALARM],
  RESPONDING: [EmergencyStatus.RESOLVED, EmergencyStatus.FALSE_ALARM],
  RESOLVED: [],
  FALSE_ALARM: [],
});

export interface EmergencyTransitionCommand {
  readonly current: EmergencyStatusType;
  readonly target: EmergencyStatusType;
  readonly actorId: string;
  readonly reason?: string;
  readonly responseNote?: string;
  readonly occurredAt: string;
}

export const transitionEmergency = (
  command: EmergencyTransitionCommand,
): Result<StateTransition<EmergencyStatusType>, DomainError> => {
  if (!command.actorId) {
    return err(domainError('EMERGENCY_INVALID_TRANSITION', 'An acting responder is required.', {}));
  }
  if (command.target === EmergencyStatus.RESOLVED && !hasRequiredText(command.responseNote)) {
    return err(domainError('EMERGENCY_INVALID_TRANSITION', 'Resolution details are required.', {}));
  }
  if (command.target === EmergencyStatus.FALSE_ALARM && !hasRequiredText(command.reason)) {
    return err(
      domainError('EMERGENCY_INVALID_TRANSITION', 'A false-alarm reason is required.', {}),
    );
  }

  return applyTransition({
    table: EMERGENCY_TRANSITIONS,
    current: command.current,
    target: command.target,
    occurredAt: command.occurredAt,
    eventPrefix: 'EMERGENCY',
    errorCode: 'EMERGENCY_INVALID_TRANSITION',
    aggregateLabel: 'emergency',
  });
};
