import * as Crypto from "expo-crypto";
import type { SQLiteDatabase } from "expo-sqlite";

import type { OfflineMutationResult } from "@/api/endpoints";
import { assertOfflineOperationAllowed, type OfflineOperation } from "@/offline/operations";
import { hashCanonicalPayload, signOfflineMutation } from "@/offline/protocol-crypto";
import { applyServerResult, transitionQueueState, type QueueState } from "@/offline/state-machine";
import type {
  DailyHelpDirectoryItem,
  DirectorySnapshot,
  FlatDirectoryItem,
  OfflineDeviceSnapshot,
  SyncStatus
} from "@/types/domain";

interface MutationRow {
  aggregate_id: string | null;
  attempt_count: number;
  base_version: number | null;
  client_device_id: string;
  client_mutation_id: string;
  conflict_json: string | null;
  correlation_id: string | null;
  entity_id: string | null;
  entity_type: string;
  error_code: string | null;
  error_message: string | null;
  gate_id: string;
  idempotency_key: string;
  last_attempt_at: string | null;
  local_created_at: string;
  local_sequence: number | null;
  next_attempt_at: string | null;
  operation: OfflineOperation;
  payload_hash: string | null;
  payload_json: string;
  server_occurred_at: string | null;
  server_record_id: string | null;
  signature: string | null;
  status: SyncStatus;
  updated_at: string;
}

interface LeaseRow {
  device_id: string;
  gate_id: string;
  last_accepted_sequence: number;
  lease_expires_at: string;
  lease_issued_at: string;
  updated_at: string;
}

export interface StoredMutation extends QueueState {
  aggregateId: string | null;
  baseVersion: number | null;
  clientMutationId: string;
  correlationId: string | null;
  deviceId: string;
  entityId: string | null;
  entityType: string;
  gateId: string;
  idempotencyKey: string;
  lastAttemptAt: string | null;
  localCreatedAt: string;
  localSequence: number | null;
  operation: OfflineOperation;
  payload: Record<string, unknown>;
  payloadHash: string | null;
  signature: string | null;
  updatedAt: string;
}

export interface DirectorySearchResult<T> {
  expiresAt: string | null;
  generatedAt: string | null;
  isExpired: boolean;
  items: T[];
  snapshotId: string | null;
}

export interface OfflineLeaseStatus {
  deviceId: string | null;
  expiresAt: string | null;
  isExpired: boolean;
  issuedAt: string | null;
  lastAcceptedSequence: number | null;
}

export type QueueCounts = Record<SyncStatus, number>;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function parseJson<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function mapMutation(row: MutationRow): StoredMutation {
  return {
    aggregateId: row.aggregate_id,
    attemptCount: row.attempt_count,
    baseVersion: row.base_version,
    clientMutationId: row.client_mutation_id,
    conflict: parseJson(row.conflict_json, null),
    correlationId: row.correlation_id,
    deviceId: row.client_device_id,
    entityId: row.entity_id,
    entityType: row.entity_type,
    errorCode: row.error_code,
    errorMessage: row.error_message,
    gateId: row.gate_id,
    idempotencyKey: row.idempotency_key,
    lastAttemptAt: row.last_attempt_at,
    localCreatedAt: row.local_created_at,
    localSequence: row.local_sequence,
    nextAttemptAt: row.next_attempt_at,
    operation: row.operation,
    payload: parseJson<Record<string, unknown>>(row.payload_json, {}),
    payloadHash: row.payload_hash,
    serverOccurredAt: row.server_occurred_at,
    serverRecordId: row.server_record_id,
    signature: row.signature,
    status: row.status,
    updatedAt: row.updated_at
  };
}

function validateSnapshot(
  snapshot: DirectorySnapshot,
  expectedDeviceId: string,
  gateId: string
): { device: OfflineDeviceSnapshot; expiresAt: string } {
  const generatedAt = new Date(snapshot.generatedAt).getTime();
  const serverExpiry = new Date(snapshot.expiresAt).getTime();
  const leaseIssuedAt = new Date(snapshot.device?.leaseIssuedAt).getTime();
  const leaseExpiresAt = new Date(snapshot.device?.leaseExpiresAt).getTime();
  if (
    !snapshot.device ||
    snapshot.device.id !== expectedDeviceId ||
    snapshot.device.status !== "ACTIVE" ||
    !snapshot.device.assignedGateIds.includes(gateId)
  ) {
    throw new Error("The server did not issue an active offline lease for this device and gate.");
  }
  if (
    !Number.isSafeInteger(snapshot.device.lastAcceptedSequence) ||
    snapshot.device.lastAcceptedSequence < 0
  ) {
    throw new Error("The server returned an invalid offline sequence.");
  }
  if (
    Number.isNaN(generatedAt) ||
    Number.isNaN(serverExpiry) ||
    Number.isNaN(leaseIssuedAt) ||
    Number.isNaN(leaseExpiresAt) ||
    serverExpiry <= generatedAt ||
    leaseExpiresAt <= leaseIssuedAt
  ) {
    throw new Error("The server returned an invalid directory or device lease.");
  }
  if (!Array.isArray(snapshot.flats) || !Array.isArray(snapshot.dailyHelp)) {
    throw new Error("The server returned an invalid directory snapshot.");
  }
  const expiresAt = Math.min(
    serverExpiry,
    leaseExpiresAt,
    generatedAt + 24 * 60 * 60_000
  );
  if (expiresAt <= Date.now()) throw new Error("The server returned an already expired offline lease.");
  return { device: snapshot.device, expiresAt: new Date(expiresAt).toISOString() };
}

export async function replaceDirectorySnapshot(
  db: SQLiteDatabase,
  gateId: string,
  expectedDeviceId: string,
  snapshot: DirectorySnapshot
): Promise<void> {
  const { device, expiresAt } = validateSnapshot(snapshot, expectedDeviceId, gateId);
  const updatedAt = new Date().toISOString();
  await db.withExclusiveTransactionAsync(async (transaction) => {
    await transaction.runAsync("DELETE FROM directory_flats WHERE gate_id = ?", gateId);
    await transaction.runAsync("DELETE FROM daily_help_directory WHERE gate_id = ?", gateId);

    for (const flat of snapshot.flats) {
      await transaction.runAsync(
        `INSERT INTO directory_flats (
           gate_id, id, block_code, flat_number, display_label,
           resident_display_name, expires_at, payload_json
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        gateId,
        flat.id,
        flat.blockCode,
        flat.flatNumber,
        flat.displayLabel,
        flat.residentDisplayName ?? null,
        expiresAt,
        JSON.stringify({ ...flat, snapshotExpiresAt: expiresAt })
      );
    }

    for (const helper of snapshot.dailyHelp) {
      await transaction.runAsync(
        `INSERT INTO daily_help_directory (
           gate_id, id, name, type, status, expires_at, payload_json
         ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        gateId,
        helper.id,
        helper.name,
        helper.type,
        helper.status,
        expiresAt,
        JSON.stringify({ ...helper, snapshotExpiresAt: expiresAt })
      );
    }

    await transaction.runAsync(
      `INSERT INTO snapshot_metadata (gate_id, snapshot_id, generated_at, expires_at, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(gate_id) DO UPDATE SET
         snapshot_id = excluded.snapshot_id,
         generated_at = excluded.generated_at,
         expires_at = excluded.expires_at,
         updated_at = excluded.updated_at`,
      gateId,
      snapshot.snapshotId,
      snapshot.generatedAt,
      expiresAt,
      updatedAt
    );
    await transaction.runAsync(
      `INSERT INTO offline_leases (
         gate_id, device_id, lease_issued_at, lease_expires_at,
         last_accepted_sequence, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(gate_id) DO UPDATE SET
         device_id = excluded.device_id,
         lease_issued_at = excluded.lease_issued_at,
         lease_expires_at = excluded.lease_expires_at,
         last_accepted_sequence = excluded.last_accepted_sequence,
         updated_at = excluded.updated_at`,
      gateId,
      device.id,
      device.leaseIssuedAt,
      expiresAt,
      device.lastAcceptedSequence,
      updatedAt
    );
    await transaction.runAsync(
      `INSERT INTO offline_sequences (device_id, gate_id, next_sequence)
       VALUES (?, ?, ?)
       ON CONFLICT(device_id, gate_id) DO UPDATE SET
         next_sequence = MAX(offline_sequences.next_sequence, excluded.next_sequence)`,
      device.id,
      gateId,
      device.lastAcceptedSequence + 1
    );
  });
}

async function snapshotMeta(db: SQLiteDatabase, gateId: string) {
  return db.getFirstAsync<{
    expires_at: string;
    generated_at: string;
    snapshot_id: string;
  }>(
    "SELECT snapshot_id, generated_at, expires_at FROM snapshot_metadata WHERE gate_id = ?",
    gateId
  );
}

export async function getOfflineLeaseStatus(
  db: SQLiteDatabase,
  gateId: string
): Promise<OfflineLeaseStatus> {
  const lease = await db.getFirstAsync<LeaseRow>(
    "SELECT * FROM offline_leases WHERE gate_id = ?",
    gateId
  );
  const expiresAt = lease?.lease_expires_at ?? null;
  return {
    deviceId: lease?.device_id ?? null,
    expiresAt,
    isExpired: !expiresAt || new Date(expiresAt).getTime() <= Date.now(),
    issuedAt: lease?.lease_issued_at ?? null,
    lastAcceptedSequence: lease?.last_accepted_sequence ?? null
  };
}

export async function searchFlatDirectory(
  db: SQLiteDatabase,
  gateId: string,
  search: string
): Promise<DirectorySearchResult<FlatDirectoryItem>> {
  const metadata = await snapshotMeta(db, gateId);
  const expiresAt = metadata?.expires_at ?? null;
  const isExpired = !expiresAt || new Date(expiresAt).getTime() <= Date.now();
  if (isExpired) {
    return {
      expiresAt,
      generatedAt: metadata?.generated_at ?? null,
      isExpired: true,
      items: [],
      snapshotId: metadata?.snapshot_id ?? null
    };
  }

  const like = `%${search.trim().replace(/[%_]/g, "")}%`;
  const rows = await db.getAllAsync<{ payload_json: string }>(
    `SELECT payload_json FROM directory_flats
      WHERE gate_id = ?
        AND (display_label LIKE ? OR block_code LIKE ? OR flat_number LIKE ? OR resident_display_name LIKE ?)
      ORDER BY block_code, flat_number
      LIMIT 50`,
    gateId,
    like,
    like,
    like,
    like
  );
  return {
    expiresAt,
    generatedAt: metadata?.generated_at ?? null,
    isExpired: false,
    items: rows.map((row) => parseJson<FlatDirectoryItem>(row.payload_json, {} as FlatDirectoryItem)),
    snapshotId: metadata?.snapshot_id ?? null
  };
}

export async function searchDailyHelpDirectory(
  db: SQLiteDatabase,
  gateId: string,
  search: string
): Promise<DirectorySearchResult<DailyHelpDirectoryItem>> {
  const metadata = await snapshotMeta(db, gateId);
  const expiresAt = metadata?.expires_at ?? null;
  const isExpired = !expiresAt || new Date(expiresAt).getTime() <= Date.now();
  if (isExpired) {
    return {
      expiresAt,
      generatedAt: metadata?.generated_at ?? null,
      isExpired: true,
      items: [],
      snapshotId: metadata?.snapshot_id ?? null
    };
  }
  const like = `%${search.trim().replace(/[%_]/g, "")}%`;
  const rows = await db.getAllAsync<{ payload_json: string }>(
    `SELECT payload_json FROM daily_help_directory
      WHERE gate_id = ? AND status = 'ACTIVE' AND (name LIKE ? OR type LIKE ?)
      ORDER BY name
      LIMIT 50`,
    gateId,
    like,
    like
  );
  return {
    expiresAt,
    generatedAt: metadata?.generated_at ?? null,
    isExpired: false,
    items: rows.map((row) =>
      parseJson<DailyHelpDirectoryItem>(row.payload_json, {} as DailyHelpDirectoryItem)
    ),
    snapshotId: metadata?.snapshot_id ?? null
  };
}

export async function enqueueMutation(
  db: SQLiteDatabase,
  input: {
    aggregateId?: string | null;
    baseVersion?: number | null;
    deviceId: string;
    deviceSecret: string;
    entityId?: string | null;
    entityType: string;
    gateId: string;
    operation: string;
    payload: Record<string, unknown>;
  }
): Promise<StoredMutation> {
  assertOfflineOperationAllowed(input.operation);
  if (!UUID_PATTERN.test(input.deviceId) || !UUID_PATTERN.test(input.gateId)) {
    throw new Error("The registered device or gate identifier is invalid.");
  }
  if (
    input.baseVersion !== null &&
    input.baseVersion !== undefined &&
    (!Number.isSafeInteger(input.baseVersion) || input.baseVersion < 0)
  ) {
    throw new Error("The offline action has an invalid server version.");
  }

  const clientMutationId = Crypto.randomUUID();
  const aggregateId = input.aggregateId ?? input.entityId ?? clientMutationId;
  if (!UUID_PATTERN.test(aggregateId)) throw new Error("The offline aggregate identifier is invalid.");
  const localCreatedAt = new Date().toISOString();
  let stored: StoredMutation | null = null;

  await db.withExclusiveTransactionAsync(async (transaction) => {
    const lease = await transaction.getFirstAsync<LeaseRow>(
      "SELECT * FROM offline_leases WHERE gate_id = ?",
      input.gateId
    );
    if (
      !lease ||
      lease.device_id !== input.deviceId ||
      new Date(lease.lease_expires_at).getTime() <= Date.now()
    ) {
      throw new Error("The offline device lease is missing or expired. Reconnect and refresh before recording this action.");
    }
    const sequenceRow = await transaction.getFirstAsync<{ next_sequence: number }>(
      "SELECT next_sequence FROM offline_sequences WHERE device_id = ? AND gate_id = ?",
      input.deviceId,
      input.gateId
    );
    const localSequence = Math.max(
      sequenceRow?.next_sequence ?? 1,
      lease.last_accepted_sequence + 1
    );
    if (!Number.isSafeInteger(localSequence) || localSequence <= 0) {
      throw new Error("The offline device sequence is invalid.");
    }
    const payloadHash = await hashCanonicalPayload(input.payload);
    const signature = await signOfflineMutation(
      {
        aggregateId,
        baseVersion: input.baseVersion ?? null,
        clientMutationId,
        clientOccurredAt: localCreatedAt,
        deviceId: input.deviceId,
        gateId: input.gateId,
        localSequence,
        operation: input.operation,
        payloadHash
      },
      input.deviceSecret
    );
    await transaction.runAsync(
      `INSERT INTO offline_mutations (
         client_mutation_id, operation, entity_type, entity_id, aggregate_id,
         base_version, local_sequence, payload_json, payload_hash, signature,
         idempotency_key, client_device_id, gate_id, local_created_at,
         status, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'LOCAL_PENDING', ?, ?)`,
      clientMutationId,
      input.operation,
      input.entityType,
      input.entityId ?? null,
      aggregateId,
      input.baseVersion ?? null,
      localSequence,
      JSON.stringify(input.payload),
      payloadHash,
      signature,
      clientMutationId,
      input.deviceId,
      input.gateId,
      localCreatedAt,
      localCreatedAt,
      localCreatedAt
    );
    await transaction.runAsync(
      `INSERT INTO offline_sequences (device_id, gate_id, next_sequence)
       VALUES (?, ?, ?)
       ON CONFLICT(device_id, gate_id) DO UPDATE SET next_sequence = excluded.next_sequence`,
      input.deviceId,
      input.gateId,
      localSequence + 1
    );
    const row = await transaction.getFirstAsync<MutationRow>(
      "SELECT * FROM offline_mutations WHERE client_mutation_id = ?",
      clientMutationId
    );
    stored = row ? mapMutation(row) : null;
  });
  if (!stored) throw new Error("The offline action was not persisted.");
  return stored;
}

export async function getMutation(db: SQLiteDatabase, id: string): Promise<StoredMutation | null> {
  const row = await db.getFirstAsync<MutationRow>(
    "SELECT * FROM offline_mutations WHERE client_mutation_id = ?",
    id
  );
  return row ? mapMutation(row) : null;
}

export async function listMutations(
  db: SQLiteDatabase,
  filters: { gateId?: string; status?: SyncStatus; limit?: number } = {}
): Promise<StoredMutation[]> {
  const conditions: string[] = [];
  const params: (number | string)[] = [];
  if (filters.gateId) {
    conditions.push("gate_id = ?");
    params.push(filters.gateId);
  }
  if (filters.status) {
    conditions.push("status = ?");
    params.push(filters.status);
  }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  params.push(Math.min(200, Math.max(1, filters.limit ?? 100)));
  const rows = await db.getAllAsync<MutationRow>(
    `SELECT * FROM offline_mutations ${where} ORDER BY local_created_at DESC LIMIT ?`,
    params
  );
  return rows.map(mapMutation);
}

export async function claimReadyMutations(
  db: SQLiteDatabase,
  gateId: string,
  limit: number = 20
): Promise<StoredMutation[]> {
  const now = new Date().toISOString();
  const ids = await db.getAllAsync<{ client_mutation_id: string }>(
    `SELECT mutation.client_mutation_id
       FROM offline_mutations AS mutation
       JOIN offline_leases AS lease ON lease.gate_id = mutation.gate_id
      WHERE mutation.gate_id = ?
        AND lease.device_id = mutation.client_device_id
        AND lease.lease_expires_at > ?
        AND mutation.aggregate_id IS NOT NULL
        AND mutation.local_sequence IS NOT NULL
        AND mutation.payload_hash IS NOT NULL
        AND mutation.signature IS NOT NULL
        AND (
          mutation.status = 'LOCAL_PENDING'
          OR (mutation.status = 'FAILED' AND mutation.next_attempt_at IS NOT NULL AND mutation.next_attempt_at <= ?)
        )
      ORDER BY mutation.local_sequence
      LIMIT ?`,
    gateId,
    now,
    now,
    Math.min(50, Math.max(1, limit))
  );
  if (!ids.length) return [];

  await db.withExclusiveTransactionAsync(async (transaction) => {
    for (const item of ids) {
      await transaction.runAsync(
        `UPDATE offline_mutations
            SET status = 'SYNCING', attempt_count = attempt_count + 1,
                last_attempt_at = ?, next_attempt_at = NULL,
                error_code = NULL, error_message = NULL, updated_at = ?
          WHERE client_mutation_id = ?
            AND status IN ('LOCAL_PENDING', 'FAILED')`,
        now,
        now,
        item.client_mutation_id
      );
    }
  });
  const claimed: StoredMutation[] = [];
  for (const item of ids) {
    const mutation = await getMutation(db, item.client_mutation_id);
    if (mutation?.status === "SYNCING") claimed.push(mutation);
  }
  return claimed;
}

export async function applyMutationResult(
  db: SQLiteDatabase,
  id: string,
  result: OfflineMutationResult
): Promise<void> {
  const current = await getMutation(db, id);
  if (!current) throw new Error(`Offline mutation ${id} was not found.`);
  const next = applyServerResult(current, result);
  const now = new Date().toISOString();
  await db.runAsync(
    `UPDATE offline_mutations SET
       status = ?, next_attempt_at = ?, server_record_id = ?, server_occurred_at = ?,
       conflict_json = ?, error_code = ?, error_message = ?, correlation_id = ?, updated_at = ?
     WHERE client_mutation_id = ? AND status = 'SYNCING'`,
    next.status,
    next.nextAttemptAt,
    next.serverRecordId,
    next.serverOccurredAt,
    next.conflict === null ? null : JSON.stringify(next.conflict),
    next.errorCode,
    next.errorMessage,
    result.correlationId ?? null,
    now,
    id
  );
}

export async function retryMutation(db: SQLiteDatabase, id: string): Promise<void> {
  const current = await getMutation(db, id);
  if (!current) throw new Error("The offline action was not found.");
  if (current.status !== "FAILED" && current.status !== "CONFLICT") {
    throw new Error(`A ${current.status} action cannot be retried.`);
  }
  if (!current.aggregateId || !current.localSequence || !current.payloadHash || !current.signature) {
    throw new Error("This legacy action is unsigned and cannot be retried. Review its payload and enter it again.");
  }
  const next = transitionQueueState(current, "LOCAL_PENDING");
  await db.runAsync(
    `UPDATE offline_mutations
        SET status = ?, next_attempt_at = NULL, conflict_json = NULL,
            error_code = NULL, error_message = NULL, updated_at = ?
      WHERE client_mutation_id = ?`,
    next.status,
    new Date().toISOString(),
    id
  );
}

export async function queueCounts(db: SQLiteDatabase, gateId?: string): Promise<QueueCounts> {
  const counts: QueueCounts = {
    CONFLICT: 0,
    FAILED: 0,
    LOCAL_PENDING: 0,
    SYNCED: 0,
    SYNCING: 0
  };
  const rows = gateId
    ? await db.getAllAsync<{ count: number; status: SyncStatus }>(
        `SELECT status, COUNT(*) AS count FROM offline_mutations
          WHERE gate_id = ? GROUP BY status`,
        gateId
      )
    : await db.getAllAsync<{ count: number; status: SyncStatus }>(
        "SELECT status, COUNT(*) AS count FROM offline_mutations GROUP BY status"
      );
  for (const row of rows) counts[row.status] = row.count;
  return counts;
}

export async function purgeGateData(db: SQLiteDatabase): Promise<void> {
  await db.withExclusiveTransactionAsync(async (transaction) => {
    await transaction.runAsync("DELETE FROM directory_flats");
    await transaction.runAsync("DELETE FROM daily_help_directory");
    await transaction.runAsync("DELETE FROM snapshot_metadata");
    await transaction.runAsync("DELETE FROM offline_leases");
    await transaction.runAsync("DELETE FROM offline_sequences");
    await transaction.runAsync("DELETE FROM offline_mutations");
  });
}
