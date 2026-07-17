import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const url = process.env.TEST_DATABASE_URL;
const describeDatabase = url ? describe : describe.skip;
const skipReason = "TEST_DATABASE_URL is unset; PostgreSQL migration integration tests were intentionally skipped.";
const directory = dirname(fileURLToPath(import.meta.url));
const migration = readFileSync(resolve(directory, "..", "prisma", "migrations", "20260717223000_initial_schema", "migration.sql"), "utf8");
let pool: Pool | undefined;
let schemaName: string | undefined;

describeDatabase(`PostgreSQL migration integration (${url ? "enabled" : skipReason})`, () => {
  beforeAll(async () => {
    pool = new Pool({ connectionString: url, max: 1 });
    schemaName = `mb_it_${randomUUID().replaceAll("-", "")}`;
    const client = await pool.connect();
    try {
      await client.query(`CREATE SCHEMA "${schemaName}"`);
      await client.query(`SET search_path TO "${schemaName}"`);
      await client.query(migration);
    } finally {
      client.release();
    }
  }, 60_000);

  afterAll(async () => {
    if (pool && schemaName) await pool.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
    await pool?.end();
  });

  it("applies the schema and rejects duplicate singleton society records", async () => {
    const client = await pool!.connect();
    try {
      await client.query(`SET search_path TO "${schemaName}"`);
      await client.query(`INSERT INTO societies (id, singleton_key, name) VALUES ($1, 'MANGLAM_BALAJI', 'Integration Society')`, [randomUUID()]);
      await expect(client.query(`INSERT INTO societies (id, singleton_key, name) VALUES ($1, 'MANGLAM_BALAJI', 'Another Society')`, [randomUUID()])).rejects.toThrow();
    } finally { client.release(); }
  });

  it("enforces append-only audit history", async () => {
    const client = await pool!.connect();
    try {
      await client.query(`SET search_path TO "${schemaName}"`);
      const societyId = (await client.query<{ id: string }>(`SELECT id FROM societies LIMIT 1`)).rows[0]!.id;
      const auditId = randomUUID();
      await client.query(`INSERT INTO audit_logs (id, society_id, action, entity_type, correlation_id, entry_hash) VALUES ($1, $2, 'integration.audit', 'audit_log', $3, repeat('0', 64))`, [auditId, societyId, randomUUID()]);
      await expect(client.query(`UPDATE audit_logs SET action = 'mutated' WHERE id = $1`, [auditId])).rejects.toThrow();
    } finally { client.release(); }
  });
});