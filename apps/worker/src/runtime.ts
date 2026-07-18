import type { WorkerEnvironment } from './config.js';
import { JobHandler } from './jobs/handler.js';
import type { Logger } from './logging.js';
import {
  OutboxRepository,
  WorkerHeartbeatRepository,
  type SqlDatabase,
} from './outbox/repository.js';
import type { RedisAccelerator } from './redis-accelerator.js';
import { errorCode } from './retry.js';

export class WorkerRuntime {
  private draining = false;
  private heartbeatHealthy = false;
  private pollAgain = false;
  private pollHealthy = false;
  private pollPromise: Promise<void> | undefined;
  private heartbeatTimer: NodeJS.Timeout | undefined;
  private pollTimer: NodeJS.Timeout | undefined;

  constructor(
    private readonly database: SqlDatabase,
    private readonly environment: WorkerEnvironment,
    private readonly jobs: JobHandler,
    private readonly logger: Logger,
    private readonly redis: RedisAccelerator,
  ) {}

  get isHealthy(): boolean {
    return this.heartbeatHealthy && this.pollHealthy && !this.draining;
  }

  async start(): Promise<void> {
    await new WorkerHeartbeatRepository(this.database).beat(this.environment.WORKER_ID, 'READY');
    this.heartbeatHealthy = true;
    const redisReady = await this.redis.start(
      () => void this.requestPoll(),
      (error) => this.logRedisError(error),
    );
    if (!redisReady) {
      this.logger.warn('worker.redis_accelerator_unavailable', {
        fallback: 'postgresql_polling',
      });
    }
    await this.requestPoll();
    this.pollTimer = setInterval(
      () => void this.requestPoll(),
      this.environment.WORKER_POLL_INTERVAL_MS,
    );
    this.heartbeatTimer = setInterval(
      () => void this.beat(),
      this.environment.WORKER_HEARTBEAT_SECONDS * 1000,
    );
  }

  async stop(): Promise<void> {
    this.draining = true;
    this.heartbeatHealthy = false;
    this.pollHealthy = false;
    if (this.pollTimer) clearInterval(this.pollTimer);
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    if (this.pollPromise) await this.pollPromise;

    let heartbeatError: unknown;
    try {
      await new WorkerHeartbeatRepository(this.database).beat(
        this.environment.WORKER_ID,
        'DRAINING',
      );
    } catch (error) {
      heartbeatError = error;
      this.logger.error('worker.drain_heartbeat_failed', { errorCode: errorCode(error) });
    }
    await this.redis.close();
    if (heartbeatError) throw heartbeatError;
  }

  async requestPoll(): Promise<void> {
    if (this.draining) return;
    if (this.pollPromise) {
      this.pollAgain = true;
      return this.pollPromise;
    }
    this.pollPromise = this.pollOnce().finally(() => {
      this.pollPromise = undefined;
      if (this.pollAgain && !this.draining) {
        this.pollAgain = false;
        void this.requestPoll();
      }
    });
    return this.pollPromise;
  }

  private async beat(): Promise<void> {
    try {
      await new WorkerHeartbeatRepository(this.database).beat(
        this.environment.WORKER_ID,
        this.draining ? 'DRAINING' : 'READY',
      );
      if (!this.draining) this.heartbeatHealthy = true;
    } catch (error) {
      this.heartbeatHealthy = false;
      this.logger.error('worker.heartbeat_failed', { errorCode: errorCode(error) });
    }
  }

  private async pollOnce(): Promise<void> {
    try {
      const outbox = new OutboxRepository(this.database, this.environment.WORKER_MAX_ATTEMPTS);
      const events = await outbox.lease(
        this.environment.WORKER_BATCH_SIZE,
        this.environment.WORKER_LEASE_SECONDS,
      );
      for (const event of events) {
        try {
          await this.jobs.handle(event);
          await outbox.publish(event);
        } catch (error) {
          try {
            const outcome = await outbox.fail(event, error);
            this.logger.error('worker.event_failed', {
              attempt: event.attemptCount,
              errorCode: errorCode(error),
              eventId: event.id,
              eventType: event.eventType,
              outcome,
            });
          } catch (transitionError) {
            this.logger.error('worker.event_transition_lost', {
              attempt: event.attemptCount,
              errorCode: errorCode(transitionError),
              eventId: event.id,
              eventType: event.eventType,
            });
          }
        }
      }
      this.pollHealthy = true;
    } catch (error) {
      this.pollHealthy = false;
      this.logger.error('worker.poll_failed', { errorCode: errorCode(error) });
    }
  }

  private logRedisError(error: unknown): void {
    this.logger.warn('worker.redis_accelerator_error', {
      errorCode: errorCode(error),
      fallback: 'postgresql_polling',
    });
  }
}
