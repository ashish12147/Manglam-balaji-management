import { describe, expect, it } from 'vitest';

import {
  OutboxRepository,
  WorkerHeartbeatRepository,
  type LeasedOutboxEvent,
  type SqlDatabase,
} from './repository.js';

const event: LeasedOutboxEvent = {
  aggregateId: '00000000-0000-4000-8000-000000000001',
  aggregateType: 'notice',
  attemptCount: 2,
  correlationId: '00000000-0000-4000-8000-000000000002',
  eventType: 'notification.dispatch',
  id: '00000000-0000-4000-8000-000000000003',
  payload: { delivery: '[SECRET]' },
  societyId: '00000000-0000-4000-8000-000000000004',
};

function database(results: unknown[] = []): {
  calls: Array<{ kind: 'execute' | 'query'; query: string; values: unknown[] }>;
  client: SqlDatabase;
} {
  const calls: Array<{
    kind: 'execute' | 'query';
    query: string;
    values: unknown[];
  }> = [];
  return {
    calls,
    client: {
      $executeRawUnsafe: async (query, ...values) => {
        calls.push({ kind: 'execute', query, values });
        return (results.shift() ?? 1) as number;
      },
      $queryRawUnsafe: async <T>(query: string, ...values: unknown[]): Promise<T> => {
        calls.push({ kind: 'query', query, values });
        return (results.shift() ?? []) as T;
      },
    },
  };
}

describe('OutboxRepository', () => {
  it('leases bounded rows with SKIP LOCKED and persists expired lease attempts', async () => {
    const { calls, client } = database([[]]);
    await new OutboxRepository(client, 3).lease(25, 90);

    expect(calls[0]?.query).toContain('FOR UPDATE SKIP LOCKED');
    expect(calls[0]?.query).toContain('abandoned_attempts AS');
    expect(calls[0]?.query).toContain("'LEASE_EXPIRED'");
    expect(calls[0]?.query).toContain("THEN 'DEAD_LETTER'");
    expect(calls[0]?.values).toEqual([25, 90, 3]);
  });

  it('rejects unsafe lease and retry bounds before touching PostgreSQL', async () => {
    const { calls, client } = database();
    await expect(new OutboxRepository(client, 3).lease(0, 90)).rejects.toThrow('batchSize');
    await expect(new OutboxRepository(client, 3).lease(1, 9)).rejects.toThrow('leaseSeconds');
    expect(() => new OutboxRepository(client, 0)).toThrow('maximumAttempts');
    expect(calls).toHaveLength(0);
  });

  it('publishes and inserts its attempt in one atomic data-modifying CTE', async () => {
    const { calls, client } = database([[{ attempted: true, transitioned: true }]]);
    await new OutboxRepository(client, 3).publish(event);

    expect(calls).toHaveLength(1);
    expect(calls[0]?.query).toContain('WITH transitioned AS');
    expect(calls[0]?.query).toContain('INSERT INTO outbox_attempts');
    expect(calls[0]?.query).toContain('\'PUBLISHED\'::"OutboxStatus"');
    expect(calls[0]?.query).toContain('NOT EXISTS');
    expect(calls[0]?.values).toEqual([event.id, event.societyId, event.attemptCount]);
  });

  it('does not record an attempt when no PROCESSING row was transitioned', async () => {
    const { calls, client } = database([[{ attempted: false, transitioned: false }]]);
    await expect(new OutboxRepository(client, 3).publish(event)).rejects.toThrow('no longer owns');
    expect(calls).toHaveLength(1);
  });

  it('atomically schedules retries and dead-letters exhausted attempts', async () => {
    const first = database([[{ attempted: true, transitioned: true }]]);
    await expect(
      new OutboxRepository(first.client, 3).fail(event, new Error('plaintextCode=123456')),
    ).resolves.toBe('RETRY');
    expect(first.calls[0]?.query).toContain('INSERT INTO outbox_attempts');
    expect(first.calls[0]?.values[3]).toBe('RETRY');
    expect(first.calls[0]?.values[6]).not.toContain('123456');

    const terminal = database([[{ attempted: true, transitioned: true }]]);
    await expect(
      new OutboxRepository(terminal.client, 3).fail(
        { ...event, attemptCount: 3 },
        new Error('provider unavailable'),
      ),
    ).resolves.toBe('DEAD_LETTER');
    expect(terminal.calls[0]?.values[3]).toBe('DEAD_LETTER');
    expect(terminal.calls[0]?.values[4]).toBe(0);
  });
});

describe('WorkerHeartbeatRepository', () => {
  it('requires PostgreSQL to persist the heartbeat row', async () => {
    const success = database([1]);
    await expect(
      new WorkerHeartbeatRepository(success.client).beat('worker-1', 'READY'),
    ).resolves.toBeUndefined();
    expect(success.calls[0]?.values).toEqual(['worker-1', 'READY']);

    const missing = database([0]);
    await expect(
      new WorkerHeartbeatRepository(missing.client).beat('worker-1', 'READY'),
    ).rejects.toThrow('not persisted');
  });
});
