import type { SQLiteDatabase } from "expo-sqlite";

import { getOrCreateDatabaseKey } from "@/auth/storage";

const DATABASE_VERSION = 2;

export async function initializeGuardDatabase(db: SQLiteDatabase): Promise<void> {
  const key = await getOrCreateDatabaseKey();
  if (!/^[a-f0-9]{64}$/.test(key)) throw new Error("The local database key is invalid.");

  // SQLCipher requires the key before any read from an existing encrypted database.
  await db.execAsync(`PRAGMA key = '${key}';`);
  await db.execAsync("PRAGMA cipher_memory_security = ON;");
  await db.execAsync("PRAGMA foreign_keys = ON;");
  await db.execAsync("PRAGMA journal_mode = WAL;");

  const row = await db.getFirstAsync<{ user_version: number }>("PRAGMA user_version");
  const currentVersion = row?.user_version ?? 0;
  if (currentVersion > DATABASE_VERSION) {
    throw new Error("This guard app is older than its local database. Update the app before continuing.");
  }

  if (currentVersion < 1) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS snapshot_metadata (
        gate_id TEXT PRIMARY KEY NOT NULL,
        snapshot_id TEXT NOT NULL,
        generated_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS offline_leases (
        gate_id TEXT PRIMARY KEY NOT NULL,
        device_id TEXT NOT NULL,
        lease_issued_at TEXT NOT NULL,
        lease_expires_at TEXT NOT NULL,
        last_accepted_sequence INTEGER NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS offline_sequences (
        device_id TEXT NOT NULL,
        gate_id TEXT NOT NULL,
        next_sequence INTEGER NOT NULL,
        PRIMARY KEY (device_id, gate_id)
      );

      CREATE TABLE IF NOT EXISTS directory_flats (
        gate_id TEXT NOT NULL,
        id TEXT NOT NULL,
        block_code TEXT NOT NULL,
        flat_number TEXT NOT NULL,
        display_label TEXT NOT NULL,
        resident_display_name TEXT,
        expires_at TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        PRIMARY KEY (gate_id, id)
      );

      CREATE INDEX IF NOT EXISTS directory_flats_search_idx
        ON directory_flats (gate_id, block_code, flat_number, display_label);

      CREATE TABLE IF NOT EXISTS daily_help_directory (
        gate_id TEXT NOT NULL,
        id TEXT NOT NULL,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        status TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        PRIMARY KEY (gate_id, id)
      );

      CREATE INDEX IF NOT EXISTS daily_help_search_idx
        ON daily_help_directory (gate_id, name, type, status);

      CREATE TABLE IF NOT EXISTS offline_mutations (
        client_mutation_id TEXT PRIMARY KEY NOT NULL,
        operation TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id TEXT,
        aggregate_id TEXT NOT NULL,
        base_version INTEGER,
        local_sequence INTEGER NOT NULL,
        payload_json TEXT NOT NULL,
        payload_hash TEXT NOT NULL,
        signature TEXT NOT NULL,
        idempotency_key TEXT NOT NULL UNIQUE,
        client_device_id TEXT NOT NULL,
        gate_id TEXT NOT NULL,
        local_created_at TEXT NOT NULL,
        status TEXT NOT NULL CHECK (
          status IN ('LOCAL_PENDING', 'SYNCING', 'SYNCED', 'CONFLICT', 'FAILED')
        ),
        attempt_count INTEGER NOT NULL DEFAULT 0,
        next_attempt_at TEXT,
        last_attempt_at TEXT,
        server_record_id TEXT,
        server_occurred_at TEXT,
        conflict_json TEXT,
        error_code TEXT,
        error_message TEXT,
        correlation_id TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE UNIQUE INDEX IF NOT EXISTS offline_mutations_sequence_idx
        ON offline_mutations (client_device_id, gate_id, local_sequence);
      CREATE INDEX IF NOT EXISTS offline_mutations_ready_idx
        ON offline_mutations (status, next_attempt_at, local_created_at);
      CREATE INDEX IF NOT EXISTS offline_mutations_gate_idx
        ON offline_mutations (gate_id, local_created_at DESC);

      PRAGMA user_version = 2;
    `);
  } else if (currentVersion < 2) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS offline_leases (
        gate_id TEXT PRIMARY KEY NOT NULL,
        device_id TEXT NOT NULL,
        lease_issued_at TEXT NOT NULL,
        lease_expires_at TEXT NOT NULL,
        last_accepted_sequence INTEGER NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS offline_sequences (
        device_id TEXT NOT NULL,
        gate_id TEXT NOT NULL,
        next_sequence INTEGER NOT NULL,
        PRIMARY KEY (device_id, gate_id)
      );

      ALTER TABLE offline_mutations ADD COLUMN aggregate_id TEXT;
      ALTER TABLE offline_mutations ADD COLUMN base_version INTEGER;
      ALTER TABLE offline_mutations ADD COLUMN local_sequence INTEGER;
      ALTER TABLE offline_mutations ADD COLUMN payload_hash TEXT;
      ALTER TABLE offline_mutations ADD COLUMN signature TEXT;

      CREATE UNIQUE INDEX IF NOT EXISTS offline_mutations_sequence_idx
        ON offline_mutations (client_device_id, gate_id, local_sequence)
        WHERE local_sequence IS NOT NULL;

      UPDATE offline_mutations
         SET status = 'FAILED',
             error_code = 'OFFLINE_PROTOCOL_UPGRADED',
             error_message = 'This action was created before signed offline sync was enabled and cannot be sent. Re-enter it after reviewing the local payload.',
             next_attempt_at = NULL
       WHERE status IN ('LOCAL_PENDING', 'SYNCING');

      PRAGMA user_version = 2;
    `);
  }

  const now = new Date().toISOString();
  await db.runAsync(
    `UPDATE offline_mutations
       SET status = 'FAILED',
           error_code = 'SYNC_INTERRUPTED',
           error_message = 'The app closed while this action was synchronizing. It is safe to retry.',
           next_attempt_at = ?,
           updated_at = ?
     WHERE status = 'SYNCING'`,
    now,
    now
  );
}
