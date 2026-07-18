import { createCipheriv, createHash, randomBytes } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import type { WorkerEnvironment } from '../config.js';
import type { LeasedOutboxEvent, SqlDatabase } from '../outbox/repository.js';
import type { PrivateObjectStore, PushRequest } from '../providers/contracts.js';
import {
  SensitivePayloadCipher,
  type EncryptedPayload,
} from '../security/sensitive-payload-cipher.js';
import { JobHandler, type WorkerPorts } from './handler.js';

const SOCIETY_ID = '10000000-0000-4000-8000-000000000001';
const DELIVERY_ID = '10000000-0000-4000-8000-000000000002';
const ENDPOINT_ID = '10000000-0000-4000-8000-000000000003';
const NOTIFICATION_ID = '10000000-0000-4000-8000-000000000004';
const FILE_ID = '10000000-0000-4000-8000-000000000005';
const CORRELATION_ID = '10000000-0000-4000-8000-000000000006';
const SECRET = 'failure-path-encryption-key-with-32-characters';
const PUSH_TOKEN = 'ExponentPushToken[failure-path-token]';
const SHA256_BASE64 = `${'A'.repeat(43)}=`;
const SHA256_HEX = Buffer.from(SHA256_BASE64, 'base64').toString('hex');
const QUARANTINE_KEY = 'quarantine/failure-path-file';
const CLEAN_KEY = `private/${SOCIETY_ID}/${FILE_ID}`;

const environment = {
  EXPO_RECEIPT_DELAY_SECONDS: 900,
  S3_BUCKET: 'private-files',
  UPLOAD_ALLOWED_MIME_TYPES: ['image/jpeg'],
  UPLOAD_MAX_BYTES: 1024,
  WORKER_LEASE_SECONDS: 90,
  WORKER_MAX_ATTEMPTS: 3,
} as WorkerEnvironment;

function encrypt(value: unknown): EncryptedPayload {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', createHash('sha256').update(SECRET).digest(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(Buffer.from(JSON.stringify(value), 'utf8')),
    cipher.final(),
  ]);
  return {
    ciphertext: ciphertext.toString('base64url'),
    iv: iv.toString('base64url'),
    tag: cipher.getAuthTag().toString('base64url'),
    version: 1,
  };
}

function event(
  eventType: string,
  payload: unknown,
  options: { aggregateId?: string; attemptCount?: number } = {},
): LeasedOutboxEvent {
  return {
    aggregateId: options.aggregateId ?? (eventType.startsWith('file.') ? FILE_ID : DELIVERY_ID),
    aggregateType: 'test',
    attemptCount: options.attemptCount ?? 1,
    correlationId: CORRELATION_ID,
    eventType,
    id: '10000000-0000-4000-8000-000000000007',
    payload,
    societyId: SOCIETY_ID,
  };
}

function notificationPayload(): Record<string, unknown> {
  return {
    aggregateId: DELIVERY_ID,
    body: 'A visitor is waiting.',
    category: 'VISITOR_APPROVAL',
    correlationId: CORRELATION_ID,
    deliveryId: DELIVERY_ID,
    endpointId: ENDPOINT_ID,
    notificationId: NOTIFICATION_ID,
    societyId: SOCIETY_ID,
    title: 'Gate request',
  };
}

function fileRow(status = 'QUARANTINED', storageKey = QUARANTINE_KEY) {
  return {
    byteSize: 16n,
    declaredMimeType: 'image/jpeg',
    id: FILE_ID,
    sha256Digest: SHA256_HEX,
    status,
    storageKey,
  };
}

function objectStore(overrides: Partial<PrivateObjectStore> = {}): PrivateObjectStore {
  return {
    copy: async () => undefined,
    deletePrivate: async () => undefined,
    deleteQuarantine: async () => undefined,
    inspect: async () => ({
      checksumSha256: SHA256_BASE64,
      contentLength: 16,
      contentType: 'image/jpeg',
    }),
    read: async function* () {
      yield new Uint8Array([1]);
    },
    ...overrides,
  };
}

function handler(
  database: SqlDatabase,
  options: {
    objectStore?: PrivateObjectStore;
    pushSend?: (request: PushRequest) => Promise<{
      accepted: boolean;
      providerMessageId?: string;
    }>;
    scanner?: WorkerPorts['scanner'];
  } = {},
): JobHandler {
  const ports: WorkerPorts = {
    cipher: new SensitivePayloadCipher(SECRET),
    expoReceipts: { get: async () => 'DELIVERED' } as never,
    objectStore: options.objectStore ?? objectStore(),
    otp: { send: async () => ({ providerMessageId: 'otp-id' }) },
    push: {
      send:
        options.pushSend ?? (async () => ({ accepted: true, providerMessageId: 'expo-ticket-id' })),
    },
    scanner: options.scanner ?? { scan: async () => ({ clean: true }) },
  };
  return new JobHandler(database, ports, environment);
}

describe('notification crash recovery', () => {
  it('reclaims only bounded stale PROCESSING delivery on a later outbox lease', async () => {
    const calls: Array<{ query: string; values: unknown[] }> = [];
    const pushes: PushRequest[] = [];
    const database: SqlDatabase = {
      $executeRawUnsafe: async () => 1,
      $queryRawUnsafe: async <T>(query: string, ...values: unknown[]): Promise<T> => {
        calls.push({ query, values });
        if (query.includes('WITH claimed_delivery AS')) {
          return [
            {
              encryptedToken: JSON.stringify(encrypt(PUSH_TOKEN)),
              provider: 'EXPO',
            },
          ] as T;
        }
        if (query.includes('WITH delivered AS')) {
          return [{ transitioned: true }] as T;
        }
        return [] as T;
      },
    };
    const worker = handler(database, {
      pushSend: async (request) => {
        pushes.push(request);
        return { accepted: true, providerMessageId: 'recovered-ticket' };
      },
    });

    await worker.handle(event('notification.dispatch', notificationPayload(), { attemptCount: 2 }));

    const claim = calls.find((call) => call.query.includes('WITH claimed_delivery AS'));
    expect(claim?.query).toContain("delivery.status = 'PROCESSING'");
    expect(claim?.query).toContain('delivery.updated_at <=');
    expect(claim?.query).toContain('delivery.attempt_count < $7');
    expect(claim?.values).toEqual([
      DELIVERY_ID,
      SOCIETY_ID,
      ENDPOINT_ID,
      NOTIFICATION_ID,
      2,
      90,
      3,
    ]);
    expect(pushes).toHaveLength(1);

    const completion = calls.find((call) => call.query.includes('receipt_event AS'));
    expect(completion?.query).toContain('correlation_id');
    expect(completion?.query).toContain('$8');
    expect(completion?.values[7]).toBe(CORRELATION_ID);
    expect(completion?.query).toContain('correlation_id, updated_at');
  });

  it('terminally records an exhausted stale delivery instead of leaving PROCESSING', async () => {
    const executions: Array<{ query: string; values: unknown[] }> = [];
    let pushed = false;
    const database: SqlDatabase = {
      $executeRawUnsafe: async (query, ...values) => {
        executions.push({ query, values });
        return 1;
      },
      $queryRawUnsafe: async <T>(query: string): Promise<T> => {
        if (query.includes('WITH claimed_delivery AS')) return [] as T;
        if (query.includes('attempt_count AS "attemptCount"')) {
          return [{ attemptCount: 3, status: 'PROCESSING' }] as T;
        }
        return [] as T;
      },
    };
    const worker = handler(database, {
      pushSend: async () => {
        pushed = true;
        return { accepted: true, providerMessageId: 'unexpected' };
      },
    });

    await expect(
      worker.handle(event('notification.dispatch', notificationPayload(), { attemptCount: 3 })),
    ).resolves.toBeUndefined();
    expect(pushed).toBe(false);
    expect(executions[0]?.query).toContain("status = 'FAILED'");
    expect(executions[0]?.query).toContain('PUSH_ATTEMPTS_EXHAUSTED');
    expect(executions[0]?.values).toEqual([DELIVERY_ID, SOCIETY_ID, ENDPOINT_ID, NOTIFICATION_ID]);
  });
});

describe('quarantine rejection ordering', () => {
  it('persists REJECTED before deleting quarantine', async () => {
    const order: string[] = [];
    const database: SqlDatabase = {
      $executeRawUnsafe: async (query) => {
        if (query.includes("status = 'REJECTED'")) order.push('db-rejected');
        return 1;
      },
      $queryRawUnsafe: async <T>(query: string): Promise<T> => {
        if (query.includes('byte_size AS')) return [fileRow()] as T;
        return [] as T;
      },
    };
    const worker = handler(database, {
      objectStore: objectStore({
        deleteQuarantine: async () => {
          order.push('s3-delete');
        },
        inspect: async () => ({
          checksumSha256: SHA256_BASE64,
          contentLength: 17,
          contentType: 'image/jpeg',
        }),
      }),
    });

    await worker.handle(
      event('file.scan', {
        fileId: FILE_ID,
        objectKey: QUARANTINE_KEY,
        sha256Base64: SHA256_BASE64,
        societyId: SOCIETY_ID,
      }),
    );
    expect(order).toEqual(['db-rejected', 's3-delete']);
  });

  it('does not delete quarantine when REJECTED persistence fails', async () => {
    let deleted = false;
    const database: SqlDatabase = {
      $executeRawUnsafe: async (query) => {
        if (query.includes("status = 'REJECTED'")) {
          throw new Error('database unavailable');
        }
        return 1;
      },
      $queryRawUnsafe: async <T>(query: string): Promise<T> =>
        (query.includes('byte_size AS') ? [fileRow()] : []) as T,
    };
    const worker = handler(database, {
      objectStore: objectStore({
        deleteQuarantine: async () => {
          deleted = true;
        },
        inspect: async () => ({
          checksumSha256: SHA256_BASE64,
          contentLength: 17,
          contentType: 'image/jpeg',
        }),
      }),
    });

    await expect(
      worker.handle(
        event('file.scan', {
          fileId: FILE_ID,
          objectKey: QUARANTINE_KEY,
          sha256Base64: SHA256_BASE64,
          societyId: SOCIETY_ID,
        }),
      ),
    ).rejects.toThrow('database unavailable');
    expect(deleted).toBe(false);
  });

  it('retries idempotent quarantine deletion from a durable REJECTED row', async () => {
    let status = 'QUARANTINED';
    let deletions = 0;
    let updates = 0;
    const database: SqlDatabase = {
      $executeRawUnsafe: async (query) => {
        if (query.includes("status = 'REJECTED'")) {
          updates += 1;
          status = 'REJECTED';
        }
        return 1;
      },
      $queryRawUnsafe: async <T>(query: string): Promise<T> =>
        (query.includes('byte_size AS') ? [fileRow(status)] : []) as T,
    };
    const worker = handler(database, {
      objectStore: objectStore({
        deleteQuarantine: async () => {
          deletions += 1;
          if (deletions === 1) throw new Error('S3 unavailable');
        },
        inspect: async () => ({
          checksumSha256: SHA256_BASE64,
          contentLength: 17,
          contentType: 'image/jpeg',
        }),
      }),
    });
    const scanEvent = event('file.scan', {
      fileId: FILE_ID,
      objectKey: QUARANTINE_KEY,
      sha256Base64: SHA256_BASE64,
      societyId: SOCIETY_ID,
    });

    await expect(worker.handle(scanEvent)).rejects.toThrow('S3 unavailable');
    await expect(worker.handle({ ...scanEvent, attemptCount: 2 })).resolves.toBeUndefined();
    expect(updates).toBe(1);
    expect(deletions).toBe(2);
  });
});

describe('durable quarantine cleanup after promotion', () => {
  it('atomically promotes CLEAN and records a cleanup outbox event', async () => {
    const queries: Array<{ query: string; values: unknown[] }> = [];
    let directDelete = false;
    const database: SqlDatabase = {
      $executeRawUnsafe: async () => 1,
      $queryRawUnsafe: async <T>(query: string, ...values: unknown[]): Promise<T> => {
        queries.push({ query, values });
        if (query.includes('byte_size AS')) return [fileRow()] as T;
        if (query.includes('WITH promoted AS')) {
          return [{ cleanupRecorded: true, transitioned: true }] as T;
        }
        return [] as T;
      },
    };
    const worker = handler(database, {
      objectStore: objectStore({
        deleteQuarantine: async () => {
          directDelete = true;
        },
      }),
    });

    await worker.handle(
      event('file.scan', {
        fileId: FILE_ID,
        objectKey: QUARANTINE_KEY,
        sha256Base64: SHA256_BASE64,
        societyId: SOCIETY_ID,
      }),
    );

    const promotion = queries.find((call) => call.query.includes('WITH promoted AS'));
    expect(promotion?.query).toContain("'file.quarantine-cleanup'");
    expect(promotion?.query).toContain('INSERT INTO outbox_events');
    expect(promotion?.query).toContain('correlation_id, updated_at');
    expect(promotion?.query).toContain('$6::uuid, NOW()');
    expect(promotion?.values).toEqual([
      FILE_ID,
      SOCIETY_ID,
      QUARANTINE_KEY,
      CLEAN_KEY,
      'image/jpeg',
      CORRELATION_ID,
    ]);
    expect(directDelete).toBe(false);
  });

  it('retries the dedicated cleanup event without changing CLEAN state', async () => {
    let deletions = 0;
    const database: SqlDatabase = {
      $executeRawUnsafe: async () => 1,
      $queryRawUnsafe: async <T>(query: string): Promise<T> => {
        if (query.includes('storage_key AS "storageKey"')) {
          return [{ status: 'CLEAN', storageKey: CLEAN_KEY }] as T;
        }
        return [] as T;
      },
    };
    const worker = handler(database, {
      objectStore: objectStore({
        deleteQuarantine: async () => {
          deletions += 1;
          if (deletions === 1) throw new Error('S3 unavailable');
        },
      }),
    });
    const cleanupEvent = event(
      'file.quarantine-cleanup',
      {
        aggregateId: FILE_ID,
        correlationId: CORRELATION_ID,
        fileId: FILE_ID,
        objectKey: QUARANTINE_KEY,
        societyId: SOCIETY_ID,
      },
      { aggregateId: FILE_ID },
    );

    await expect(worker.handle(cleanupEvent)).rejects.toThrow('S3 unavailable');
    await expect(worker.handle({ ...cleanupEvent, attemptCount: 2 })).resolves.toBeUndefined();
    expect(deletions).toBe(2);
  });
});
