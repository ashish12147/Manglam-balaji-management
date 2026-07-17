import type { IdempotencyRecord, OfflineMutation } from '@manglam/types';
import { describe, expect, it } from 'vitest';

import {
  canonicalJson,
  evaluateIdempotency,
  evaluateOfflineMutation,
  hashCanonicalPayload,
  signOfflineMutation,
  type OfflineDeviceSnapshot,
  type UnsignedOfflineMutation,
} from './index.js';

const deviceSecret = 'guard-device-secret-with-at-least-32-characters';
const now = '2026-07-17T12:00:00.000Z';
type TestPayload = Readonly<Record<string, string | boolean>> & {
  readonly visitorName: string;
  readonly offline: boolean;
};

const payload: TestPayload = { visitorName: 'Ravi', offline: true };

const device: OfflineDeviceSnapshot = {
  id: 'device-a',
  status: 'ACTIVE',
  assignedGateIds: ['gate-a'],
  leaseIssuedAt: '2026-07-17T00:00:00.000Z',
  leaseExpiresAt: '2026-07-18T00:00:00.000Z',
  lastAcceptedSequence: 10,
};

const mutation = (
  overrides: Partial<UnsignedOfflineMutation<typeof payload>> = {},
): OfflineMutation<typeof payload> => {
  const unsigned: UnsignedOfflineMutation<typeof payload> = {
    clientMutationId: 'mutation-a',
    deviceId: 'device-a',
    gateId: 'gate-a',
    operation: 'VISIT_MANUAL_ENTRY',
    aggregateId: 'visit-a',
    localSequence: 11,
    baseVersion: 2,
    clientOccurredAt: '2026-07-17T11:58:00.000Z',
    payload,
    payloadHash: hashCanonicalPayload(payload),
    ...overrides,
  };
  return { ...unsigned, signature: signOfflineMutation(unsigned, deviceSecret) };
};

describe('canonical request hashing', () => {
  it('is stable across object key order and distinct across values', () => {
    expect(canonicalJson({ b: 2, a: 1 })).toBe('{"a":1,"b":2}');
    expect(hashCanonicalPayload({ b: 2, a: 1 })).toBe(hashCanonicalPayload({ a: 1, b: 2 }));
    expect(hashCanonicalPayload({ a: 1 })).not.toBe(hashCanonicalPayload({ a: 2 }));
  });

  it('rejects non-JSON and cyclic values', () => {
    expect(() => hashCanonicalPayload({ invalid: Number.NaN })).toThrow();
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    expect(() => hashCanonicalPayload(cyclic as never)).toThrow();
  });
});

describe('offline mutation policy', () => {
  const decide = (
    candidate: OfflineMutation<typeof payload>,
    overrides: Partial<Parameters<typeof evaluateOfflineMutation<typeof payload>>[0]> = {},
  ) =>
    evaluateOfflineMutation({
      mutation: candidate,
      device,
      deviceSecret,
      now,
      serverAggregateVersion: 2,
      existing: null,
      ...overrides,
    });

  it('accepts a signed, in-lease, assigned-gate mutation once', () => {
    expect(decide(mutation())).toEqual({ decision: 'ACCEPT', nextSequence: 11 });
  });

  it('replays the same client mutation without creating another entity', () => {
    const candidate = mutation();
    expect(
      decide(candidate, {
        existing: {
          clientMutationId: candidate.clientMutationId,
          payloadHash: candidate.payloadHash,
          operation: candidate.operation,
          serverEntityId: 'server-visit-a',
        },
      }),
    ).toEqual({ decision: 'REPLAY', serverEntityId: 'server-visit-a' });
  });

  it('rejects offline resident approval even when correctly signed', () => {
    const candidate = mutation({ operation: 'RESIDENT_VISITOR_APPROVAL' });
    expect(decide(candidate)).toEqual({ decision: 'REJECT', code: 'OPERATION_NOT_ALLOWED' });
  });

  it('rejects revoked devices, foreign gates, expired leases, and forged signatures', () => {
    expect(decide(mutation(), { device: { ...device, status: 'REVOKED' } })).toEqual({
      decision: 'REJECT',
      code: 'DEVICE_REVOKED',
    });
    expect(decide(mutation({ gateId: 'gate-b' }))).toEqual({
      decision: 'REJECT',
      code: 'GATE_NOT_ASSIGNED',
    });
    expect(decide(mutation(), { now: device.leaseExpiresAt })).toEqual({
      decision: 'REJECT',
      code: 'LEASE_EXPIRED',
    });
    expect(decide({ ...mutation(), signature: '0'.repeat(64) })).toEqual({
      decision: 'REJECT',
      code: 'SIGNATURE_INVALID',
    });
  });

  it('surfaces sequence, version, and client-id reuse conflicts explicitly', () => {
    expect(decide(mutation({ localSequence: 10 }))).toEqual({
      decision: 'CONFLICT',
      code: 'SEQUENCE_CONFLICT',
    });
    expect(decide(mutation(), { serverAggregateVersion: 3 })).toEqual({
      decision: 'CONFLICT',
      code: 'VERSION_CONFLICT',
    });
    const candidate = mutation();
    expect(
      decide(candidate, {
        existing: {
          clientMutationId: candidate.clientMutationId,
          payloadHash: '0'.repeat(64),
          operation: candidate.operation,
          serverEntityId: 'server-visit-a',
        },
      }),
    ).toEqual({ decision: 'CONFLICT', code: 'CLIENT_MUTATION_REUSED' });
  });

  it('detects payload tampering before synchronization', () => {
    const candidate = mutation();
    expect(decide({ ...candidate, payload: { ...payload, visitorName: 'Changed' } })).toEqual({
      decision: 'REJECT',
      code: 'PAYLOAD_HASH_INVALID',
    });
  });
});

describe('idempotency decisions', () => {
  const record: IdempotencyRecord<{ paymentId: string }> = {
    actorId: 'actor-a',
    operation: 'payment.record',
    key: 'payment-key-a',
    requestHash: 'a'.repeat(64),
    status: 'COMPLETED',
    response: { paymentId: 'payment-a' },
    expiresAt: '2026-07-18T12:00:00.000Z',
  };

  const decide = (existing: typeof record | null, requestHash = record.requestHash) =>
    evaluateIdempotency({
      actorId: record.actorId,
      operation: record.operation,
      key: record.key,
      requestHash,
      now,
      existing,
    });

  it('claims new keys and replays completed matching requests', () => {
    expect(decide(null)).toEqual({ decision: 'CLAIM' });
    expect(decide(record)).toEqual({ decision: 'REPLAY', response: record.response });
  });

  it('rejects reuse with a different request and identifies in-flight or retryable work', () => {
    expect(decide(record, 'b'.repeat(64))).toEqual({ decision: 'CONFLICT' });
    expect(decide({ ...record, status: 'PROCESSING' })).toEqual({ decision: 'IN_PROGRESS' });
    expect(decide({ ...record, status: 'FAILED' })).toEqual({ decision: 'RETRY' });
  });
});
