import {
  ATTENDANCE_STATUSES,
  COMPLAINT_STATUSES,
  DAILY_HELP_STATUSES,
  EMERGENCY_STATUSES,
  MEMBERSHIP_STATUSES,
  PARCEL_STATUSES,
  PAYMENT_STATUSES,
  PRE_APPROVAL_STATUSES,
  VISIT_STATUSES,
  type AttendanceStatus,
  type Result,
  type StateTransition,
} from '@manglam/types';
import { describe, expect, it } from 'vitest';

import {
  ATTENDANCE_TRANSITIONS,
  COMPLAINT_TRANSITIONS,
  DAILY_HELP_TRANSITIONS,
  EMERGENCY_TRANSITIONS,
  MEMBERSHIP_TRANSITIONS,
  PARCEL_TRANSITIONS,
  PAYMENT_TRANSITIONS,
  PRE_APPROVAL_TRANSITIONS,
  VISIT_TRANSITIONS,
  decideVisitApproval,
  transitionAttendance,
  transitionComplaint,
  transitionDailyHelp,
  transitionEmergency,
  transitionMembership,
  transitionParcel,
  transitionPayment,
  transitionPreApproval,
  transitionVisit,
} from './index.js';

const occurredAt = '2026-07-17T12:00:00.000Z';

const verifyMatrix = <TState extends string>(
  states: readonly TState[],
  table: Readonly<Record<TState, readonly TState[]>>,
  transition: (current: TState, target: TState) => Result<StateTransition<TState>, unknown>,
): void => {
  for (const current of states) {
    for (const target of states) {
      const result = transition(current, target);
      expect(result.ok, current + ' -> ' + target).toBe(table[current].includes(target));
    }
  }
};

describe('visitor transition matrix', () => {
  it('accepts every declared visit transition and rejects every other pair', () => {
    verifyMatrix(VISIT_STATUSES, VISIT_TRANSITIONS, (current, target) => {
      let mode: 'STANDARD' | 'PRE_APPROVAL' | 'RESIDENT_DECISION' | 'OVERRIDE' | 'SYSTEM' =
        'STANDARD';
      if (target === 'APPROVED' && current === 'ARRIVED_AT_GATE') mode = 'PRE_APPROVAL';
      if (target === 'APPROVED' && current === 'AWAITING_APPROVAL') mode = 'RESIDENT_DECISION';
      if (target === 'APPROVED' && (current === 'REJECTED' || current === 'APPROVAL_TIMED_OUT')) {
        mode = 'OVERRIDE';
      }
      if (target === 'REJECTED' && current === 'AWAITING_APPROVAL') mode = 'RESIDENT_DECISION';
      if (target === 'APPROVAL_TIMED_OUT') mode = 'SYSTEM';

      return transitionVisit({
        current,
        target,
        mode,
        actorId: 'actor',
        gateId: 'gate',
        guardId: 'guard',
        reason: 'Authorised operational reason',
        hasOverridePermission: true,
        recentAuthentication: true,
        preApprovalValid: true,
        occurredAt,
      });
    });
  });

  it('enforces first-decision-wins on approval races', () => {
    expect(
      decideVisitApproval({
        current: 'PENDING',
        target: 'APPROVED',
        source: 'RESIDENT_APP',
        actorId: 'resident-a',
        occurredAt,
      }).ok,
    ).toBe(true);
    expect(
      decideVisitApproval({
        current: 'APPROVED',
        target: 'REJECTED',
        source: 'RESIDENT_APP',
        actorId: 'resident-b',
        occurredAt,
      }),
    ).toMatchObject({ ok: false, error: { code: 'APPROVAL_ALREADY_DECIDED' } });
  });

  it('requires a valid invitation or fully authorised override', () => {
    expect(
      transitionVisit({
        current: 'ARRIVED_AT_GATE',
        target: 'APPROVED',
        mode: 'PRE_APPROVAL',
        preApprovalValid: false,
        actorId: 'guard',
        occurredAt,
      }).ok,
    ).toBe(false);
    expect(
      transitionVisit({
        current: 'REJECTED',
        target: 'APPROVED',
        mode: 'OVERRIDE',
        actorId: 'supervisor',
        hasOverridePermission: true,
        recentAuthentication: true,
        occurredAt,
      }),
    ).toMatchObject({ ok: false, error: { code: 'VISIT_OVERRIDE_REASON_REQUIRED' } });
  });

  it('covers every pre-approval pair', () => {
    verifyMatrix(PRE_APPROVAL_STATUSES, PRE_APPROVAL_TRANSITIONS, (current, target) =>
      transitionPreApproval({ current, target, occurredAt }),
    );
  });
});

describe('complaint transition matrix', () => {
  it('accepts only declared complaint transitions', () => {
    verifyMatrix(COMPLAINT_STATUSES, COMPLAINT_TRANSITIONS, (current, target) =>
      transitionComplaint({
        current,
        target,
        actorId: 'actor',
        assigneeId: 'staff',
        reason: 'Resident requested this change',
        resolutionNote: 'Work completed and verified',
        resolvedAt: '2026-07-16T12:00:00.000Z',
        occurredAt,
      }),
    );
  });

  it('requires resolution evidence and enforces the reopen window', () => {
    expect(
      transitionComplaint({
        current: 'IN_PROGRESS',
        target: 'RESOLVED',
        actorId: 'staff',
        occurredAt,
      }).ok,
    ).toBe(false);
    expect(
      transitionComplaint({
        current: 'RESOLVED',
        target: 'REOPENED',
        actorId: 'resident',
        reason: 'Problem returned',
        resolvedAt: '2026-07-01T12:00:00.000Z',
        occurredAt,
      }),
    ).toMatchObject({ ok: false, error: { code: 'COMPLAINT_REOPEN_WINDOW_EXPIRED' } });
  });
});

describe('payment transition matrix', () => {
  it('accepts only verification, failure, and compensating reversal paths', () => {
    verifyMatrix(PAYMENT_STATUSES, PAYMENT_TRANSITIONS, (current, target) =>
      transitionPayment({
        current,
        target,
        method: 'CASH',
        source: 'MANUAL',
        hasReversePermission: true,
        recentAuthentication: true,
        reason: 'Verified finance correction',
        occurredAt,
      }),
    );
  });

  it('never confirms an unverified gateway callback', () => {
    expect(
      transitionPayment({
        current: 'PENDING_VERIFICATION',
        target: 'CONFIRMED',
        method: 'UPI',
        source: 'PAYMENT_GATEWAY',
        reference: 'provider-123',
        providerVerified: false,
        occurredAt,
      }),
    ).toMatchObject({ ok: false, error: { code: 'PAYMENT_VERIFICATION_REQUIRED' } });
  });
});

describe('emergency and parcel transition matrices', () => {
  it('accepts only declared emergency transitions', () => {
    verifyMatrix(EMERGENCY_STATUSES, EMERGENCY_TRANSITIONS, (current, target) =>
      transitionEmergency({
        current,
        target,
        actorId: 'responder',
        reason: 'Confirmed false alarm',
        responseNote: 'Response completed and resident is safe',
        occurredAt,
      }),
    );
  });

  it('accepts only declared parcel transitions', () => {
    verifyMatrix(PARCEL_STATUSES, PARCEL_TRANSITIONS, (current, target) =>
      transitionParcel({
        current,
        target,
        actorId: 'guard',
        collectionCodeVerified: true,
        reason: 'Returned by resident request',
        occurredAt,
      }),
    );
  });

  it('prevents collection without one-time-code verification', () => {
    expect(
      transitionParcel({
        current: 'HELD_AT_GATE',
        target: 'COLLECTED',
        actorId: 'guard',
        collectionCodeVerified: false,
        occurredAt,
      }),
    ).toMatchObject({ ok: false, error: { code: 'PARCEL_COLLECTION_CODE_INVALID' } });
  });
});

describe('daily-help transition matrices', () => {
  it('covers every profile status pair', () => {
    verifyMatrix(DAILY_HELP_STATUSES, DAILY_HELP_TRANSITIONS, (current, target) =>
      transitionDailyHelp({
        current,
        target,
        reason: 'Administrator recorded status reason',
        occurredAt,
      }),
    );
  });

  it('covers every attendance pair including the initial check-in', () => {
    const currentStates: readonly (AttendanceStatus | null)[] = [null, ...ATTENDANCE_STATUSES];
    for (const current of currentStates) {
      for (const target of ATTENDANCE_STATUSES) {
        const result = transitionAttendance({
          current,
          target,
          actorId: 'guard',
          gateId: 'gate',
          helperActive: true,
          hasVoidPermission: true,
          reason: 'Supervisor correction',
          occurredAt,
        });
        const key = current ?? 'NOT_STARTED';
        expect(result.ok, key + ' -> ' + target).toBe(ATTENDANCE_TRANSITIONS[key].includes(target));
      }
    }
  });

  it('blocks inactive-helper entry and unauthorised voiding', () => {
    expect(
      transitionAttendance({
        current: null,
        target: 'CHECKED_IN',
        actorId: 'guard',
        gateId: 'gate',
        helperActive: false,
        occurredAt,
      }).ok,
    ).toBe(false);
    expect(
      transitionAttendance({
        current: 'CHECKED_IN',
        target: 'VOIDED',
        actorId: 'guard',
        gateId: 'gate',
        helperActive: true,
        hasVoidPermission: false,
        reason: 'Correction',
        occurredAt,
      }).ok,
    ).toBe(false);
  });
});

describe('membership transition matrix', () => {
  it('accepts only declared membership transitions', () => {
    verifyMatrix(MEMBERSHIP_STATUSES, MEMBERSHIP_TRANSITIONS, (current, target) =>
      transitionMembership({
        current,
        target,
        actorId: 'admin',
        reason: 'Verified occupancy change',
        occupancyEndsAt: occurredAt,
        occurredAt,
      }),
    );
  });
});
