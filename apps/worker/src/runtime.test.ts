import { describe, expect, it } from 'vitest';

import type { WorkerEnvironment } from './config.js';
import type { JobHandler } from './jobs/handler.js';
import type { Logger } from './logging.js';
import type { SqlDatabase } from './outbox/repository.js';
import type { RedisAccelerator, WakeHandler } from './redis-accelerator.js';
import { WorkerRuntime } from './runtime.js';

const environment = {
  WORKER_BATCH_SIZE: 10,
  WORKER_HEARTBEAT_SECONDS: 300,
  WORKER_ID: 'worker-test',
  WORKER_LEASE_SECONDS: 90,
  WORKER_MAX_ATTEMPTS: 3,
  WORKER_POLL_INTERVAL_MS: 60000,
} as WorkerEnvironment;

const logger: Logger = { error: () => undefined, info: () => undefined, warn: () => undefined };

describe('WorkerRuntime readiness and Redis acceleration', () => {
  it('continues authoritative PostgreSQL polling when Redis is unavailable', async () => {
    let leases = 0;
    const database = {
      $executeRawUnsafe: async () => 1,
      $queryRawUnsafe: async () => {
        leases += 1;
        return [];
      },
    } as SqlDatabase;
    const redis = {
      close: async () => undefined,
      start: async () => false,
    } as unknown as RedisAccelerator;
    const runtime = new WorkerRuntime(database, environment, {} as JobHandler, logger, redis);
    await runtime.start();
    expect(leases).toBe(1);
    expect(runtime.isHealthy).toBe(true);
    await runtime.stop();
  });

  it('does not let a successful heartbeat mask a failed PostgreSQL poll', async () => {
    const database = {
      $executeRawUnsafe: async () => 1,
      $queryRawUnsafe: async () => {
        throw new Error('database poll unavailable');
      },
    } as SqlDatabase;
    const redis = {
      close: async () => undefined,
      start: async () => false,
    } as unknown as RedisAccelerator;
    const runtime = new WorkerRuntime(database, environment, {} as JobHandler, logger, redis);

    await runtime.start();
    expect(runtime.isHealthy).toBe(false);
    await runtime.stop();
  });

  it('turns wake messages into non-overlapping database polls', async () => {
    let wake: WakeHandler | undefined;
    let active = 0;
    let maximumActive = 0;
    let calls = 0;
    const releases: Array<() => void> = [];
    const database = {
      $executeRawUnsafe: async () => 1,
      $queryRawUnsafe: async () => {
        calls += 1;
        if (calls === 1) return [];
        active += 1;
        maximumActive = Math.max(maximumActive, active);
        await new Promise<void>((resolve) => releases.push(resolve));
        active -= 1;
        return [];
      },
    } as SqlDatabase;
    const redis = {
      close: async () => undefined,
      start: async (handler: WakeHandler) => {
        wake = handler;
        return true;
      },
    } as unknown as RedisAccelerator;
    const runtime = new WorkerRuntime(database, environment, {} as JobHandler, logger, redis);
    await runtime.start();

    wake?.();
    wake?.();
    await Promise.resolve();
    expect(maximumActive).toBe(1);
    expect(calls).toBe(2);

    releases.shift()?.();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(maximumActive).toBe(1);
    releases.shift()?.();
    await runtime.stop();
    expect(maximumActive).toBe(1);
  });

  it('closes Redis even when the draining heartbeat fails', async () => {
    let heartbeatCalls = 0;
    let redisClosed = false;
    const database = {
      $executeRawUnsafe: async () => {
        heartbeatCalls += 1;
        if (heartbeatCalls > 1) throw new Error('heartbeat failed');
        return 1;
      },
      $queryRawUnsafe: async () => [],
    } as SqlDatabase;
    const redis = {
      close: async () => {
        redisClosed = true;
      },
      start: async () => true,
    } as unknown as RedisAccelerator;
    const runtime = new WorkerRuntime(database, environment, {} as JobHandler, logger, redis);

    await runtime.start();
    await expect(runtime.stop()).rejects.toThrow('heartbeat failed');
    expect(redisClosed).toBe(true);
  });

  it('persists DRAINING after an in-flight READY heartbeat completes', async () => {
    const states: string[] = [];
    let releaseHeartbeat: (() => void) | undefined;
    const database = {
      $executeRawUnsafe: async (_query: string, ...values: unknown[]) => {
        const state = String(values[1]);
        states.push(state);
        if (states.length === 2) {
          await new Promise<void>((resolve) => {
            releaseHeartbeat = resolve;
          });
        }
        return 1;
      },
      $queryRawUnsafe: async () => [],
    } as SqlDatabase;
    const redis = {
      close: async () => undefined,
      start: async () => true,
    } as unknown as RedisAccelerator;
    const runtime = new WorkerRuntime(database, environment, {} as JobHandler, logger, redis);

    await runtime.start();
    const inFlight = (
      runtime as unknown as { requestHeartbeat(): Promise<void> }
    ).requestHeartbeat();
    await Promise.resolve();
    const stopping = runtime.stop();
    await Promise.resolve();

    expect(states).toEqual(['READY', 'READY']);
    releaseHeartbeat?.();
    await inFlight;
    await stopping;
    expect(states).toEqual(['READY', 'READY', 'DRAINING']);
  });
});
