import { randomUUID } from 'node:crypto';

import { describe, expect, it } from 'vitest';

const missing = [
  !process.env.TEST_DATABASE_URL && 'TEST_DATABASE_URL is not configured',
  !process.env.TEST_REDIS_URL && 'TEST_REDIS_URL is not configured',
]
  .filter(Boolean)
  .join('; ');

describe('worker PostgreSQL and Redis integration', () => {
  const integration = missing ? it.skip : it;

  integration(
    missing || 'performs a real lease, retry, publish, attempt, and Redis wake flow',
    async () => {
      const databaseModuleName = '@manglam/database';
      const [{ createDatabaseClient }, { Redis }, { OutboxRepository }, { RedisAccelerator }] =
        await Promise.all([
          import(/* @vite-ignore */ databaseModuleName),
          import('ioredis'),
          import('../src/outbox/repository.js'),
          import('../src/redis-accelerator.js'),
        ]);
      const database = createDatabaseClient({
        applicationName: 'manglam-worker-integration-test',
        connectionString: process.env.TEST_DATABASE_URL,
      });
      const redisProbe = new Redis(process.env.TEST_REDIS_URL!, {
        connectTimeout: 2000,
        maxRetriesPerRequest: 1,
      });
      const accelerator = new RedisAccelerator(
        process.env.TEST_REDIS_URL!,
        `worker-test:${randomUUID()}`,
      );
      const societyId = randomUUID();
      const eventId = randomUUID();
      let connected = false;
      let eventInserted = false;
      let societyInserted = false;

      try {
        await database.$connect();
        connected = true;
        await expect(redisProbe.ping()).resolves.toBe('PONG');
        await database.$executeRawUnsafe(
          `INSERT INTO societies (id, singleton_key, name, updated_at)
           VALUES ($1, $2, 'Worker integration test', NOW())`,
          societyId,
          `WK_${societyId.slice(0, 20)}`,
        );
        societyInserted = true;
        await database.$executeRawUnsafe(
          `INSERT INTO outbox_events
            (id, society_id, aggregate_type, aggregate_id, event_type, payload,
             dedupe_key, correlation_id, updated_at)
           VALUES ($1, $2, 'integration', $1, 'integration.test', '{}'::jsonb,
                   $3, $4, NOW())`,
          eventId,
          societyId,
          `worker-integration:${eventId}`,
          randomUUID(),
        );
        eventInserted = true;

        const repository = new OutboxRepository(database, 3);
        const firstLease = await repository.lease(1, 30);
        expect(firstLease).toHaveLength(1);
        expect(firstLease[0]).toMatchObject({
          attemptCount: 1,
          id: eventId,
          societyId,
        });
        await repository.fail(firstLease[0]!, new Error('integration retry'));
        await database.$executeRawUnsafe(
          `UPDATE outbox_events
           SET available_at = NOW()
           WHERE id = $1 AND society_id = $2`,
          eventId,
          societyId,
        );

        const secondLease = await repository.lease(1, 30);
        expect(secondLease[0]).toMatchObject({
          attemptCount: 2,
          id: eventId,
          societyId,
        });
        await repository.publish(secondLease[0]!);
        const state = (await database.$queryRawUnsafe(
          `SELECT event.status::text AS status,
                  COUNT(attempt.id)::bigint AS attempts
           FROM outbox_events AS event
           LEFT JOIN outbox_attempts AS attempt
             ON attempt.outbox_event_id = event.id
           WHERE event.id = $1 AND event.society_id = $2
           GROUP BY event.status`,
          eventId,
          societyId,
        )) as Array<{ attempts: bigint; status: string }>;
        expect(state).toEqual([{ attempts: 2n, status: 'PUBLISHED' }]);

        let resolveWake: (() => void) | undefined;
        let rejectWake: ((error: unknown) => void) | undefined;
        const wakeReceived = new Promise<void>((resolve, reject) => {
          resolveWake = resolve;
          rejectWake = reject;
        });
        await expect(
          accelerator.start(
            () => resolveWake?.(),
            (error) => rejectWake?.(error),
          ),
        ).resolves.toBe(true);
        const timeout = setTimeout(
          () => rejectWake?.(new Error('Redis wake message was not consumed.')),
          2000,
        );
        try {
          const published = await accelerator.publishWake((error) => rejectWake?.(error));
          expect(published).toBe(true);
          await wakeReceived;
        } finally {
          clearTimeout(timeout);
        }
      } finally {
        const cleanupErrors: unknown[] = [];
        const cleanup = async (action: () => Promise<void>): Promise<void> => {
          try {
            await action();
          } catch (error) {
            cleanupErrors.push(error);
          }
        };
        await cleanup(() => accelerator.close());
        await cleanup(async () => {
          if (redisProbe.status === 'ready') await redisProbe.quit();
          else redisProbe.disconnect(false);
        });
        if (connected && eventInserted) {
          await cleanup(async () => {
            await database.$executeRawUnsafe(
              `DELETE FROM outbox_attempts WHERE outbox_event_id = $1`,
              eventId,
            );
          });
          await cleanup(async () => {
            await database.$executeRawUnsafe(
              `DELETE FROM outbox_events WHERE id = $1 AND society_id = $2`,
              eventId,
              societyId,
            );
          });
        }
        if (connected && societyInserted) {
          await cleanup(async () => {
            await database.$executeRawUnsafe(`DELETE FROM societies WHERE id = $1`, societyId);
          });
        }
        if (connected) await cleanup(() => database.$disconnect());
        if (cleanupErrors.length > 0) {
          throw new AggregateError(cleanupErrors, 'Worker integration cleanup failed.');
        }
      }
    },
    15000,
  );
});
