import { createHash, createHmac } from 'node:crypto';

import {
  DeviceStatus,
  IdempotencyStatus,
  OfflineMutationOperation,
  type DeviceStatus as DeviceStatusType,
  type IdempotencyRecord,
  type OfflineMutation,
  type OfflineMutationOperation as OfflineMutationOperationType,
} from '@manglam/types';

import { constantTimeDigestEqual } from './codes.js';

type JsonValue =
  | null
  | boolean
  | number
  | string
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };

const canonicalize = (value: unknown, seen: Set<object>): string => {
  if (value === null) return 'null';
  if (typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('Canonical payload numbers must be finite.');
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    if (seen.has(value)) throw new TypeError('Canonical payloads cannot be cyclic.');
    seen.add(value);
    const result = `[${value.map((entry) => canonicalize(entry, seen)).join(',')}]`;
    seen.delete(value);
    return result;
  }
  if (typeof value === 'object') {
    const object = value as Record<string, unknown>;
    const prototype = Object.getPrototypeOf(object);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new TypeError('Canonical payloads must contain only JSON objects.');
    }
    if (seen.has(object)) throw new TypeError('Canonical payloads cannot be cyclic.');
    seen.add(object);
    const entries = Object.keys(object)
      .sort()
      .map((key) => {
        if (object[key] === undefined)
          throw new TypeError('Canonical payloads cannot contain undefined.');
        return `${JSON.stringify(key)}:${canonicalize(object[key], seen)}`;
      });
    seen.delete(object);
    return `{${entries.join(',')}}`;
  }
  throw new TypeError('Canonical payloads must contain JSON-compatible values.');
};

export const canonicalJson = (value: JsonValue): string => canonicalize(value, new Set());

export const hashCanonicalPayload = (payload: JsonValue): string =>
  createHash('sha256').update(canonicalJson(payload)).digest('hex');

export type UnsignedOfflineMutation<TPayload extends Readonly<Record<string, unknown>>> = Omit<
  OfflineMutation<TPayload>,
  'signature'
>;

const signaturePayload = <TPayload extends Readonly<Record<string, unknown>>>(
  mutation: UnsignedOfflineMutation<TPayload>,
): JsonValue => ({
  aggregateId: mutation.aggregateId,
  baseVersion: mutation.baseVersion,
  clientMutationId: mutation.clientMutationId,
  clientOccurredAt: mutation.clientOccurredAt,
  deviceId: mutation.deviceId,
  gateId: mutation.gateId,
  localSequence: mutation.localSequence,
  operation: mutation.operation,
  payloadHash: mutation.payloadHash,
});

export const signOfflineMutation = <TPayload extends Readonly<Record<string, unknown>>>(
  mutation: UnsignedOfflineMutation<TPayload>,
  deviceSecret: string,
): string => {
  if (deviceSecret.length < 32)
    throw new Error('Device signing secrets must contain at least 32 characters.');
  return createHmac('sha256', deviceSecret)
    .update(canonicalJson(signaturePayload(mutation)))
    .digest('hex');
};

const ALLOWED_OFFLINE_OPERATIONS: readonly OfflineMutationOperationType[] = [
  OfflineMutationOperation.VISIT_PREPARE,
  OfflineMutationOperation.VISIT_MANUAL_ENTRY,
  OfflineMutationOperation.VISIT_CHECK_OUT,
  OfflineMutationOperation.DAILY_HELP_CHECK_IN,
  OfflineMutationOperation.DAILY_HELP_CHECK_OUT,
  OfflineMutationOperation.EMERGENCY_ACKNOWLEDGE,
];

export interface OfflineDeviceSnapshot {
  readonly id: string;
  readonly status: DeviceStatusType;
  readonly assignedGateIds: readonly string[];
  readonly leaseIssuedAt: string;
  readonly leaseExpiresAt: string;
  readonly lastAcceptedSequence: number;
}

export interface ExistingOfflineMutation {
  readonly clientMutationId: string;
  readonly payloadHash: string;
  readonly operation: OfflineMutationOperationType;
  readonly serverEntityId: string;
}

export type OfflineSyncDecision =
  | { readonly decision: 'ACCEPT'; readonly nextSequence: number }
  | { readonly decision: 'REPLAY'; readonly serverEntityId: string }
  | {
      readonly decision: 'CONFLICT';
      readonly code: 'CLIENT_MUTATION_REUSED' | 'SEQUENCE_CONFLICT' | 'VERSION_CONFLICT';
    }
  | {
      readonly decision: 'REJECT';
      readonly code:
        | 'DEVICE_REVOKED'
        | 'GATE_NOT_ASSIGNED'
        | 'LEASE_EXPIRED'
        | 'OPERATION_NOT_ALLOWED'
        | 'PAYLOAD_HASH_INVALID'
        | 'SIGNATURE_INVALID'
        | 'CLOCK_SKEW';
    };

export const evaluateOfflineMutation = <TPayload extends Readonly<Record<string, unknown>>>(input: {
  readonly mutation: OfflineMutation<TPayload>;
  readonly device: OfflineDeviceSnapshot;
  readonly deviceSecret: string;
  readonly now: string;
  readonly serverAggregateVersion: number | null;
  readonly existing: ExistingOfflineMutation | null;
  readonly maxFutureClockSkewMs?: number;
}): OfflineSyncDecision => {
  const { mutation, device } = input;
  if (device.status !== DeviceStatus.ACTIVE || mutation.deviceId !== device.id) {
    return { decision: 'REJECT', code: 'DEVICE_REVOKED' };
  }
  if (!device.assignedGateIds.includes(mutation.gateId)) {
    return { decision: 'REJECT', code: 'GATE_NOT_ASSIGNED' };
  }
  const now = Date.parse(input.now);
  if (now >= Date.parse(device.leaseExpiresAt)) {
    return { decision: 'REJECT', code: 'LEASE_EXPIRED' };
  }
  if (!ALLOWED_OFFLINE_OPERATIONS.includes(mutation.operation)) {
    return { decision: 'REJECT', code: 'OPERATION_NOT_ALLOWED' };
  }

  let computedPayloadHash: string;
  try {
    computedPayloadHash = hashCanonicalPayload(mutation.payload as JsonValue);
  } catch {
    return { decision: 'REJECT', code: 'PAYLOAD_HASH_INVALID' };
  }
  if (!constantTimeDigestEqual(computedPayloadHash, mutation.payloadHash)) {
    return { decision: 'REJECT', code: 'PAYLOAD_HASH_INVALID' };
  }
  const { signature, ...unsigned } = mutation;
  if (!constantTimeDigestEqual(signOfflineMutation(unsigned, input.deviceSecret), signature)) {
    return { decision: 'REJECT', code: 'SIGNATURE_INVALID' };
  }

  const occurredAt = Date.parse(mutation.clientOccurredAt);
  const maxFutureClockSkewMs = input.maxFutureClockSkewMs ?? 15 * 60_000;
  if (
    !Number.isFinite(occurredAt) ||
    occurredAt < Date.parse(device.leaseIssuedAt) - maxFutureClockSkewMs ||
    occurredAt > now + maxFutureClockSkewMs
  ) {
    return { decision: 'REJECT', code: 'CLOCK_SKEW' };
  }

  if (input.existing !== null) {
    return input.existing.clientMutationId === mutation.clientMutationId &&
      input.existing.payloadHash === mutation.payloadHash &&
      input.existing.operation === mutation.operation
      ? { decision: 'REPLAY', serverEntityId: input.existing.serverEntityId }
      : { decision: 'CONFLICT', code: 'CLIENT_MUTATION_REUSED' };
  }
  if (mutation.localSequence !== device.lastAcceptedSequence + 1) {
    return { decision: 'CONFLICT', code: 'SEQUENCE_CONFLICT' };
  }
  if (
    mutation.baseVersion !== null &&
    input.serverAggregateVersion !== null &&
    mutation.baseVersion !== input.serverAggregateVersion
  ) {
    return { decision: 'CONFLICT', code: 'VERSION_CONFLICT' };
  }
  return { decision: 'ACCEPT', nextSequence: mutation.localSequence };
};

export type IdempotencyDecision<TResponse> =
  | { readonly decision: 'CLAIM' }
  | { readonly decision: 'REPLAY'; readonly response: TResponse }
  | { readonly decision: 'IN_PROGRESS' }
  | { readonly decision: 'RETRY' }
  | { readonly decision: 'CONFLICT' };

export const evaluateIdempotency = <TResponse>(input: {
  readonly actorId: string;
  readonly operation: string;
  readonly key: string;
  readonly requestHash: string;
  readonly now: string;
  readonly existing: IdempotencyRecord<TResponse> | null;
}): IdempotencyDecision<TResponse> => {
  const existing = input.existing;
  if (existing === null || Date.parse(input.now) >= Date.parse(existing.expiresAt)) {
    return { decision: 'CLAIM' };
  }
  if (
    existing.actorId !== input.actorId ||
    existing.operation !== input.operation ||
    existing.key !== input.key ||
    existing.requestHash !== input.requestHash
  ) {
    return { decision: 'CONFLICT' };
  }
  if (existing.status === IdempotencyStatus.PROCESSING) return { decision: 'IN_PROGRESS' };
  if (existing.status === IdempotencyStatus.FAILED) return { decision: 'RETRY' };
  if (existing.response === null) return { decision: 'CONFLICT' };
  return { decision: 'REPLAY', response: existing.response };
};
