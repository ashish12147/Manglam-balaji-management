import type {
  IdempotencyStatus,
  NotificationCategory,
  NotificationChannel,
  OfflineMutationOperation,
  OfflineSyncStatus,
} from './enums.js';

export type UUID = string;
export type ISODateTime = string;

export interface CursorPage<T> {
  readonly items: readonly T[];
  readonly nextCursor: string | null;
  readonly hasMore: boolean;
}

export interface StateTransition<TState extends string> {
  readonly previous: TState | null;
  readonly current: TState;
  readonly event: string;
  readonly occurredAt: ISODateTime;
}

export interface DomainEvent<
  TType extends string,
  TPayload extends Readonly<Record<string, unknown>>,
> {
  readonly id: UUID;
  readonly aggregateId: UUID;
  readonly aggregateType: string;
  readonly sequence: number;
  readonly type: TType;
  readonly payload: TPayload;
  readonly actorId: UUID | null;
  readonly serverOccurredAt: ISODateTime;
  readonly clientOccurredAt: ISODateTime | null;
  readonly correlationId: UUID;
}

export interface NotificationPreference {
  readonly category: NotificationCategory;
  readonly enabledChannels: readonly NotificationChannel[];
}

export interface OfflineMutation<
  TPayload extends Readonly<Record<string, unknown>> = Readonly<Record<string, unknown>>,
> {
  readonly clientMutationId: UUID;
  readonly deviceId: UUID;
  readonly gateId: UUID;
  readonly operation: OfflineMutationOperation;
  readonly aggregateId: UUID;
  readonly localSequence: number;
  readonly baseVersion: number | null;
  readonly clientOccurredAt: ISODateTime;
  readonly payload: TPayload;
  readonly payloadHash: string;
  readonly signature: string;
}

export interface OfflineSyncRecord {
  readonly clientMutationId: UUID;
  readonly status: OfflineSyncStatus;
  readonly serverEntityId: UUID | null;
  readonly conflictCode: string | null;
  readonly lastAttemptAt: ISODateTime | null;
}

export interface IdempotencyRecord<TResponse = unknown> {
  readonly actorId: UUID;
  readonly operation: string;
  readonly key: string;
  readonly requestHash: string;
  readonly status: IdempotencyStatus;
  readonly response: TResponse | null;
  readonly expiresAt: ISODateTime;
}
