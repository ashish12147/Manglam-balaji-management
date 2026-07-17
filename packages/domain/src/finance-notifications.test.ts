import { describe, expect, it } from 'vitest';

import {
  NOTIFICATION_RULES,
  allocatePaymentOldestFirst,
  deriveMaintenanceChargeStatus,
  formatReceiptNumber,
  isLongVisit,
  isMembershipEffective,
  isNotificationPreferenceMutable,
  notificationRetryDelayMs,
  resolveNotificationDelivery,
} from './index.js';

describe('maintenance calculations', () => {
  it.each([
    [{ totalMinor: 10_000, paidMinor: 0, waivedMinor: 0, cancelled: false }, 'UNPAID'],
    [{ totalMinor: 10_000, paidMinor: 1, waivedMinor: 0, cancelled: false }, 'PARTIALLY_PAID'],
    [{ totalMinor: 10_000, paidMinor: 10_000, waivedMinor: 0, cancelled: false }, 'PAID'],
    [{ totalMinor: 10_000, paidMinor: 0, waivedMinor: 10_000, cancelled: false }, 'WAIVED'],
    [{ totalMinor: 10_000, paidMinor: 0, waivedMinor: 0, cancelled: true }, 'CANCELLED'],
  ] as const)('derives charge status from integer minor units', (input, expected) => {
    expect(deriveMaintenanceChargeStatus(input)).toEqual({ ok: true, value: expected });
  });

  it('rejects over-allocation and destructive cancellation of funded charges', () => {
    expect(
      deriveMaintenanceChargeStatus({
        totalMinor: 10_000,
        paidMinor: 10_001,
        waivedMinor: 0,
        cancelled: false,
      }).ok,
    ).toBe(false);
    expect(
      deriveMaintenanceChargeStatus({
        totalMinor: 10_000,
        paidMinor: 1_000,
        waivedMinor: 0,
        cancelled: true,
      }).ok,
    ).toBe(false);
  });

  it('allocates payments deterministically to oldest dues', () => {
    expect(
      allocatePaymentOldestFirst(12_000, [
        { chargeId: 'new', dueAt: '2026-07-31T00:00:00.000Z', outstandingMinor: 10_000 },
        { chargeId: 'old', dueAt: '2026-06-30T00:00:00.000Z', outstandingMinor: 10_000 },
      ]),
    ).toEqual({
      ok: true,
      value: [
        { chargeId: 'old', amountMinor: 10_000 },
        { chargeId: 'new', amountMinor: 2_000 },
      ],
    });
    expect(
      allocatePaymentOldestFirst(20_001, [
        { chargeId: 'only', dueAt: '2026-06-30T00:00:00.000Z', outstandingMinor: 20_000 },
      ]).ok,
    ).toBe(false);
  });

  it('formats stable unique receipt sequence values', () => {
    expect(formatReceiptNumber('mbs', '2026-27', 42)).toEqual({
      ok: true,
      value: 'MBS/2026-27/000042',
    });
    expect(formatReceiptNumber('!', '2026', 0).ok).toBe(false);
  });
});

describe('notification criticality', () => {
  it('does not allow critical or time-sensitive categories to be disabled', () => {
    for (const category of ['SECURITY_CRITICAL', 'EMERGENCY', 'VISITOR_APPROVAL'] as const) {
      expect(isNotificationPreferenceMutable(category)).toBe(false);
      const delivery = resolveNotificationDelivery({
        category,
        preferredChannels: [],
        availableChannels: ['PUSH', 'REALTIME'],
      });
      expect(delivery.channels).toEqual(['IN_APP', 'PUSH', 'REALTIME']);
      expect(delivery.preferenceOverridden).toBe(true);
    }
  });

  it('honours optional preferences while preserving in-app history', () => {
    expect(
      resolveNotificationDelivery({
        category: 'NOTICE',
        preferredChannels: [],
        availableChannels: ['PUSH'],
      }),
    ).toMatchObject({ channels: ['IN_APP'], preferenceOverridden: false });
  });

  it('uses bounded exponential retry and stops after the category limit', () => {
    const rule = NOTIFICATION_RULES.EMERGENCY;
    expect(notificationRetryDelayMs('EMERGENCY', 1)).toBe(rule.baseRetryMs);
    expect(notificationRetryDelayMs('EMERGENCY', rule.maxDeliveryAttempts)).toBeNull();
    expect(notificationRetryDelayMs('GENERAL', 99)).toBeNull();
  });
});

describe('time-sensitive projections', () => {
  it('requires approved, date-effective membership', () => {
    const base = {
      startsAt: '2026-07-01T00:00:00.000Z',
      endsAt: '2026-08-01T00:00:00.000Z',
      at: '2026-07-17T00:00:00.000Z',
    } as const;
    expect(isMembershipEffective({ ...base, status: 'APPROVED' })).toBe(true);
    expect(isMembershipEffective({ ...base, status: 'SUSPENDED' })).toBe(false);
    expect(isMembershipEffective({ ...base, status: 'APPROVED', at: base.endsAt })).toBe(false);
  });

  it('flags long visits only at or beyond a valid positive threshold', () => {
    expect(isLongVisit('2026-07-17T10:00:00.000Z', '2026-07-17T12:00:00.000Z', 120)).toBe(true);
    expect(isLongVisit('2026-07-17T10:00:00.000Z', '2026-07-17T11:59:59.000Z', 120)).toBe(false);
    expect(isLongVisit('invalid', '2026-07-17T12:00:00.000Z', 120)).toBe(false);
  });
});
