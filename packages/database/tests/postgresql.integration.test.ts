import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

interface QueryResult<T> {
  readonly rows: T[];
}

interface PostgreSqlClient {
  query<T = Record<string, unknown>>(
    statement: string,
    values?: unknown[],
  ): Promise<QueryResult<T>>;
  release(): void;
}

interface PostgreSqlPool {
  connect(): Promise<PostgreSqlClient>;
  end(): Promise<void>;
  query(statement: string): Promise<unknown>;
}

interface PostgreSqlPoolConstructor {
  new (config: { connectionString: string; max: number }): PostgreSqlPool;
}

const postgreSqlModuleName: string = 'pg';
const url = process.env.TEST_DATABASE_URL;
const describeDatabase = url ? describe : describe.skip;
const skipReason =
  'TEST_DATABASE_URL is unset; PostgreSQL migration integration tests were intentionally skipped.';
const directory = dirname(fileURLToPath(import.meta.url));
const migration = readFileSync(
  resolve(
    directory,
    '..',
    'prisma',
    'migrations',
    '20260717223000_initial_schema',
    'migration.sql',
  ),
  'utf8',
);
const workerSecurityMigration = readFileSync(
  resolve(
    directory,
    '..',
    'prisma',
    'migrations',
    '20260718000000_worker_runtime_contract',
    'migration.sql',
  ),
  'utf8',
);
let pool: PostgreSqlPool | undefined;
let schemaName: string | undefined;

describeDatabase(`PostgreSQL migration integration (${url ? 'enabled' : skipReason})`, () => {
  beforeAll(async () => {
    const module = (await import(postgreSqlModuleName)) as { Pool: PostgreSqlPoolConstructor };
    const { Pool } = module;
    pool = new Pool({ connectionString: url!, max: 1 });
    schemaName = `mb_it_${randomUUID().replaceAll('-', '')}`;
    const client = await pool.connect();
    try {
      await client.query(`CREATE SCHEMA "${schemaName}"`);
      await client.query(`SET search_path TO "${schemaName}"`);
      await client.query(migration);
      await client.query(workerSecurityMigration);
    } finally {
      client.release();
    }
  }, 60_000);

  afterAll(async () => {
    if (pool && schemaName) await pool.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
    await pool?.end();
  });

  it('applies the schema and rejects duplicate singleton society records', async () => {
    const client = await pool!.connect();
    try {
      await client.query(`SET search_path TO "${schemaName}"`);
      await client.query(
        `INSERT INTO societies (id, singleton_key, name) VALUES ($1, 'MANGLAM_BALAJI', 'Integration Society')`,
        [randomUUID()],
      );
      await expect(
        client.query(
          `INSERT INTO societies (id, singleton_key, name) VALUES ($1, 'MANGLAM_BALAJI', 'Another Society')`,
          [randomUUID()],
        ),
      ).rejects.toThrow();
    } finally {
      client.release();
    }
  });

  it('enforces append-only audit history', async () => {
    const client = await pool!.connect();
    try {
      await client.query(`SET search_path TO "${schemaName}"`);
      const societyId = (await client.query<{ id: string }>(`SELECT id FROM societies LIMIT 1`))
        .rows[0]!.id;
      const auditId = randomUUID();
      await client.query(
        `INSERT INTO audit_logs (id, society_id, action, entity_type, correlation_id, entry_hash) VALUES ($1, $2, 'integration.audit', 'audit_log', $3, repeat('0', 64))`,
        [auditId, societyId, randomUUID()],
      );
      await expect(
        client.query(`UPDATE audit_logs SET action = 'mutated' WHERE id = $1`, [auditId]),
      ).rejects.toThrow();
    } finally {
      client.release();
    }
  });
  it('enforces tenant-scoped retention and worker heartbeat states', async () => {
    const client = await pool!.connect();
    try {
      await client.query(`SET search_path TO "${schemaName}"`);
      const societyId = (await client.query<{ id: string }>(`SELECT id FROM societies LIMIT 1`))
        .rows[0]!.id;
      await client.query(
        `INSERT INTO retention_policies (society_id, entity_type, retention_days) VALUES ($1, 'file_upload', 30)`,
        [societyId],
      );
      await expect(
        client.query(
          `INSERT INTO retention_policies (society_id, entity_type, retention_days) VALUES ($1, 'file_upload', 60)`,
          [societyId],
        ),
      ).rejects.toThrow();

      const providers = await client.query<{ provider: string }>(
        'SELECT unnest(enum_range(NULL::"PushProvider"))::TEXT AS provider',
      );
      expect(providers.rows.map(({ provider }) => provider)).toEqual(['FCM', 'EXPO', 'WEB_PUSH']);

      await client.query(
        `INSERT INTO worker_heartbeats (worker_id, state) VALUES ('integration-worker', 'READY')`,
      );
      await expect(
        client.query(
          `INSERT INTO worker_heartbeats (worker_id, state) VALUES ('bad-worker', 'UNKNOWN')`,
        ),
      ).rejects.toThrow();
    } finally {
      client.release();
    }
  });

  it('enforces MFA replay, digest telemetry, and guard enrollment invariants', async () => {
    const client = await pool!.connect();
    try {
      await client.query(`SET search_path TO "${schemaName}"`);
      const societyId = (await client.query<{ id: string }>(`SELECT id FROM societies LIMIT 1`))
        .rows[0]!.id;
      const userId = randomUUID();
      await client.query(
        `INSERT INTO users (id, society_id, normalized_phone, phone_digest, display_name, status) VALUES ($1, $2, '+919999999999', repeat('a', 64), 'Integration Admin', 'ACTIVE')`,
        [userId, societyId],
      );
      const credentialId = randomUUID();
      await client.query(
        `INSERT INTO mfa_credentials (id, society_id, user_id, status, secret_ciphertext, secret_nonce, secret_auth_tag, confirmed_at) VALUES ($1, $2, $3, 'ACTIVE', decode('01', 'hex'), decode(repeat('02', 12), 'hex'), decode(repeat('03', 16), 'hex'), NOW())`,
        [credentialId, societyId, userId],
      );
      await client.query(`UPDATE mfa_credentials SET last_used_time_step = 10 WHERE id = $1`, [
        credentialId,
      ]);
      await expect(
        client.query(`UPDATE mfa_credentials SET last_used_time_step = 10 WHERE id = $1`, [
          credentialId,
        ]),
      ).rejects.toThrow();

      await expect(
        client.query(
          `INSERT INTO authentication_attempts (society_id, subject_digest, method, outcome, retention_until) VALUES ($1, 'plaintext-email', 'ADMIN_PASSWORD', 'FAILURE', NOW() + interval '30 days')`,
          [societyId],
        ),
      ).rejects.toThrow();

      const deviceId = randomUUID();
      await client.query(
        `INSERT INTO devices (id, society_id, fingerprint_digest) VALUES ($1, $2, repeat('b', 64))`,
        [deviceId, societyId],
      );
      await expect(
        client.query(
          `INSERT INTO guard_devices (society_id, device_id, status) VALUES ($1, $2, 'PENDING')`,
          [societyId, deviceId],
        ),
      ).rejects.toThrow();
      await expect(
        client.query(
          `INSERT INTO guard_devices (society_id, device_id, status, enrollment_token_digest, enrollment_expires_at)
           VALUES ($1, $2, 'PENDING', repeat('c', 64), NOW() + interval '15 minutes')`,
          [randomUUID(), deviceId],
        ),
      ).rejects.toThrow();
    } finally {
      client.release();
    }
  });
});
