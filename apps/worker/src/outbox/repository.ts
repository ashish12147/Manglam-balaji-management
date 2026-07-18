import { errorCode, errorDetail, retryDelayMs } from '../retry.js';

export interface SqlDatabase {
  $executeRawUnsafe(query: string, ...values: unknown[]): Promise<number>;
  $queryRawUnsafe<T>(query: string, ...values: unknown[]): Promise<T>;
}

export interface LeasedOutboxEvent {
  aggregateId: string;
  aggregateType: string;
  attemptCount: number;
  correlationId: string;
  eventType: string;
  id: string;
  payload: unknown;
  societyId: string;
}

interface TransitionResult {
  attempted: boolean;
  transitioned: boolean;
}

const LEASE_SQL = `
  WITH candidates AS (
    SELECT event.id, event.society_id, event.status, event.attempt_count
    FROM outbox_events AS event
    WHERE (event.status IN ('PENDING', 'RETRY') AND event.available_at <= NOW())
       OR (event.status = 'PROCESSING'
           AND event.claimed_at < NOW() - ($2::text || ' seconds')::interval)
    ORDER BY event.available_at ASC, event.created_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT $1
  ), abandoned_attempts AS (
    INSERT INTO outbox_attempts
      (id, society_id, outbox_event_id, attempt, status, error_code, error_detail)
    SELECT gen_random_uuid(), candidate.society_id, candidate.id, candidate.attempt_count,
           CASE WHEN candidate.attempt_count >= $3
                THEN 'DEAD_LETTER'::"OutboxStatus"
                ELSE 'RETRY'::"OutboxStatus" END,
           'LEASE_EXPIRED',
           'Worker lease expired before the processing outcome was persisted.'
    FROM candidates AS candidate
    WHERE candidate.status = 'PROCESSING' AND candidate.attempt_count > 0
      AND NOT EXISTS (
        SELECT 1 FROM outbox_attempts AS attempt
        WHERE attempt.outbox_event_id = candidate.id
          AND attempt.attempt = candidate.attempt_count
      )
    ON CONFLICT (outbox_event_id, attempt) DO NOTHING
    RETURNING outbox_event_id
  ), exhausted AS (
    UPDATE outbox_events AS event
    SET status = 'DEAD_LETTER', claimed_at = NULL,
        last_error_code = 'LEASE_EXPIRED', updated_at = NOW()
    FROM candidates AS candidate
    WHERE event.id = candidate.id
      AND candidate.status = 'PROCESSING'
      AND candidate.attempt_count >= $3
    RETURNING event.id
  ), leased AS (
    UPDATE outbox_events AS event
    SET status = 'PROCESSING', claimed_at = NOW(),
        attempt_count = event.attempt_count + 1, updated_at = NOW()
    FROM candidates AS candidate
    WHERE event.id = candidate.id
      AND NOT (
        candidate.status = 'PROCESSING' AND candidate.attempt_count >= $3
      )
    RETURNING event.id, event.society_id AS "societyId",
      event.aggregate_type AS "aggregateType", event.aggregate_id AS "aggregateId",
      event.event_type AS "eventType", event.payload,
      event.attempt_count AS "attemptCount", event.correlation_id AS "correlationId"
  )
  SELECT * FROM leased`;

const COMPLETE_SQL = `
  WITH transitioned AS (
    UPDATE outbox_events AS event
    SET status = 'PUBLISHED', published_at = NOW(), claimed_at = NULL,
        last_error_code = NULL, updated_at = NOW()
    WHERE event.id = $1
      AND event.society_id = $2
      AND event.status = 'PROCESSING'
      AND event.attempt_count = $3
      AND NOT EXISTS (
        SELECT 1 FROM outbox_attempts
        WHERE outbox_event_id = event.id AND attempt = $3
      )
    RETURNING event.id, event.society_id
  ), attempted AS (
    INSERT INTO outbox_attempts
      (id, society_id, outbox_event_id, attempt, status, error_code, error_detail)
    SELECT gen_random_uuid(), society_id, id, $3, 'PUBLISHED'::"OutboxStatus", NULL, NULL
    FROM transitioned
    RETURNING id
  )
  SELECT EXISTS (SELECT 1 FROM transitioned) AS transitioned,
         EXISTS (SELECT 1 FROM attempted) AS attempted`;

const FAIL_SQL = `
  WITH transitioned AS (
    UPDATE outbox_events AS event
    SET status = $4::"OutboxStatus", claimed_at = NULL,
        available_at = NOW() + ($5::bigint * interval '1 millisecond'),
        last_error_code = $6, updated_at = NOW()
    WHERE event.id = $1
      AND event.society_id = $2
      AND event.status = 'PROCESSING'
      AND event.attempt_count = $3
      AND NOT EXISTS (
        SELECT 1 FROM outbox_attempts
        WHERE outbox_event_id = event.id AND attempt = $3
      )
    RETURNING event.id, event.society_id
  ), attempted AS (
    INSERT INTO outbox_attempts
      (id, society_id, outbox_event_id, attempt, status, error_code, error_detail)
    SELECT gen_random_uuid(), society_id, id, $3, $4::"OutboxStatus", $6, $7
    FROM transitioned
    RETURNING id
  )
  SELECT EXISTS (SELECT 1 FROM transitioned) AS transitioned,
         EXISTS (SELECT 1 FROM attempted) AS attempted`;

export class OutboxRepository {
  constructor(
    private readonly database: SqlDatabase,
    private readonly maximumAttempts: number,
  ) {
    if (!Number.isSafeInteger(maximumAttempts) || maximumAttempts < 1 || maximumAttempts > 30) {
      throw new Error('maximumAttempts is outside the allowed range.');
    }
  }

  async lease(batchSize: number, leaseSeconds: number): Promise<LeasedOutboxEvent[]> {
    if (!Number.isSafeInteger(batchSize) || batchSize < 1 || batchSize > 100) {
      throw new Error('batchSize is outside the allowed range.');
    }
    if (!Number.isSafeInteger(leaseSeconds) || leaseSeconds < 10 || leaseSeconds > 900) {
      throw new Error('leaseSeconds is outside the allowed range.');
    }
    return this.database.$queryRawUnsafe<LeasedOutboxEvent[]>(
      LEASE_SQL,
      batchSize,
      leaseSeconds,
      this.maximumAttempts,
    );
  }

  async publish(event: LeasedOutboxEvent): Promise<void> {
    const result = await this.database.$queryRawUnsafe<TransitionResult[]>(
      COMPLETE_SQL,
      event.id,
      event.societyId,
      event.attemptCount,
    );
    this.requireAtomicTransition(result, event);
  }

  async fail(event: LeasedOutboxEvent, error: unknown): Promise<'RETRY' | 'DEAD_LETTER'> {
    const status = event.attemptCount >= this.maximumAttempts ? 'DEAD_LETTER' : 'RETRY';
    const delay = status === 'RETRY' ? retryDelayMs(event.attemptCount) : 0;
    const result = await this.database.$queryRawUnsafe<TransitionResult[]>(
      FAIL_SQL,
      event.id,
      event.societyId,
      event.attemptCount,
      status,
      delay,
      errorCode(error),
      errorDetail(error),
    );
    this.requireAtomicTransition(result, event);
    return status;
  }

  private requireAtomicTransition(result: TransitionResult[], event: LeasedOutboxEvent): void {
    if (result[0]?.transitioned !== true || result[0]?.attempted !== true) {
      throw new Error(
        `Outbox event ${event.id} no longer owns processing attempt ${event.attemptCount}.`,
      );
    }
  }
}

export class WorkerHeartbeatRepository {
  constructor(private readonly database: SqlDatabase) {}

  async beat(workerId: string, state: 'READY' | 'DRAINING' | 'FAILED'): Promise<void> {
    const updated = await this.database.$executeRawUnsafe(
      `INSERT INTO worker_heartbeats (worker_id, state, last_seen_at, updated_at)
       VALUES ($1, $2, NOW(), NOW())
       ON CONFLICT (worker_id) DO UPDATE
       SET state = EXCLUDED.state, last_seen_at = EXCLUDED.last_seen_at, updated_at = NOW()`,
      workerId,
      state,
    );
    if (updated !== 1) throw new Error('Worker heartbeat was not persisted.');
  }
}
