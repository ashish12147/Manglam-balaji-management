import { createCipheriv, createHash, randomBytes } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import type { WorkerEnvironment } from '../config.js';
import type { LeasedOutboxEvent, SqlDatabase } from '../outbox/repository.js';
import type {
  OtpDeliveryRequest,
  PrivateObjectStore,
  PushRequest,
} from '../providers/contracts.js';
import {
  SensitivePayloadCipher,
  type EncryptedPayload,
} from '../security/sensitive-payload-cipher.js';
import { JobHandler, type WorkerPorts } from './handler.js';

const SOCIETY_ID = '00000000-0000-4000-8000-000000000001';
const OTHER_SOCIETY_ID = '00000000-0000-4000-8000-000000000002';
const DELIVERY_ID = '00000000-0000-4000-8000-000000000003';
const ENDPOINT_ID = '00000000-0000-4000-8000-000000000004';
const NOTIFICATION_ID = '00000000-0000-4000-8000-000000000005';
const FILE_ID = '00000000-0000-4000-8000-000000000006';
const AUDIT_ID = '00000000-0000-4000-8000-000000000007';
const SECRET = 'worker-test-encryption-key-with-32-characters';
const PUSH_TOKEN = 'ExponentPushToken[worker-test-token]';
const SHA256_BASE64 = `${'A'.repeat(43)}=`;
const SHA256_HEX = Buffer.from(SHA256_BASE64, 'base64').toString('hex');

const environment = {
  EXPO_RECEIPT_DELAY_SECONDS: 900,
  RETENTION_BATCH_SIZE: 25,
  S3_BUCKET: 'private-files',
  UPLOAD_ALLOWED_MIME_TYPES: ['image/jpeg'],
  UPLOAD_MAX_BYTES: 1024,
  WORKER_LEASE_SECONDS: 90,
  WORKER_MAX_ATTEMPTS: 3,
} as WorkerEnvironment;

interface SqlCall {
  kind: 'execute' | 'query';
  query: string;
  values: unknown[];
}

interface SetupOptions {
  executeResult?: (query: string, values: unknown[]) => number | undefined;
  expoReceipt?: 'DELIVERED' | 'ENDPOINT_EXPIRED' | 'RETRY';
  objectStore?: Partial<PrivateObjectStore>;
  otpSend?: (request: OtpDeliveryRequest) => Promise<{ providerMessageId: string }>;
  pushSend?: (request: PushRequest) => Promise<{
    accepted: boolean;
    providerMessageId?: string;
    terminalFailureReason?: 'ENDPOINT_EXPIRED' | 'ENDPOINT_INVALID';
  }>;
  queryResult?: (query: string, values: unknown[]) => unknown;
}

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

function event(eventType: string, payload: unknown, societyId = SOCIETY_ID): LeasedOutboxEvent {
  return {
    aggregateId: DELIVERY_ID,
    aggregateType: 'test',
    attemptCount: 1,
    correlationId: NOTIFICATION_ID,
    eventType,
    id: FILE_ID,
    payload,
    societyId,
  };
}

function durable(payload: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    aggregateId: DELIVERY_ID,
    correlationId: NOTIFICATION_ID,
    societyId: SOCIETY_ID,
    ...payload,
  };
}

function notificationPayload(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return durable({
    body: 'Visitor waiting',
    category: 'VISITOR_APPROVAL',
    deliveryId: DELIVERY_ID,
    endpointId: ENDPOINT_ID,
    notificationId: NOTIFICATION_ID,
    title: 'Gate request',
    ...extra,
  });
}

function setup(options: SetupOptions = {}): {
  calls: SqlCall[];
  handler: JobHandler;
  objectOrder: string[];
  otpRequests: OtpDeliveryRequest[];
  ports: WorkerPorts;
  pushRequests: PushRequest[];
} {
  const calls: SqlCall[] = [];
  const objectOrder: string[] = [];
  const otpRequests: OtpDeliveryRequest[] = [];
  const pushRequests: PushRequest[] = [];
  const database: SqlDatabase = {
    $executeRawUnsafe: async (query, ...values) => {
      calls.push({ kind: 'execute', query, values });
      if (query.includes("SET status = 'DELETED'")) objectOrder.push('db-delete');
      return options.executeResult?.(query, values) ?? 1;
    },
    $queryRawUnsafe: async <T>(query: string, ...values: unknown[]): Promise<T> => {
      calls.push({ kind: 'query', query, values });
      const custom = options.queryResult?.(query, values);
      if (custom !== undefined) return custom as T;
      if (query.includes('WITH claimed_delivery AS')) {
        return [
          {
            encryptedToken: JSON.stringify(encrypt(PUSH_TOKEN)),
            provider: 'EXPO',
          },
        ] as T;
      }
      if (query.includes('WITH delivered AS')) return [{ transitioned: true }] as T;
      if (query.includes('WITH failed AS')) return [{ transitioned: true }] as T;
      if (query.includes('FROM otp_challenges')) return [{ id: DELIVERY_ID }] as T;
      if (query.includes('FROM file_uploads') && query.includes('byte_size AS')) {
        return [
          {
            byteSize: 16n,
            declaredMimeType: 'image/jpeg',
            id: FILE_ID,
            sha256Digest: SHA256_HEX,
            status: 'QUARANTINED',
            storageKey: 'quarantine/file',
          },
        ] as T;
      }
      if (query.includes('SELECT file.id, file.storage_key AS')) return [] as T;
      if (query.includes('FROM notification_deliveries AS delivery')) {
        return [{ id: DELIVERY_ID }] as T;
      }
      if (query.includes('FROM audit_logs AS current')) return [{ id: AUDIT_ID }] as T;
      if (query.includes('FROM notification_deliveries') && query.includes('status::text')) {
        return [{ status: 'PENDING' }] as T;
      }
      if (query.includes('FROM file_uploads') && query.includes('status::text')) {
        return [{ status: 'DELETED' }] as T;
      }
      return [] as T;
    },
  };
  const objectStore: PrivateObjectStore = {
    copy: async () => undefined,
    deletePrivate: async (key, societyId) => {
      objectOrder.push(`s3-delete:${societyId}:${key}`);
    },
    deleteQuarantine: async () => undefined,
    inspect: async () => ({
      checksumSha256: SHA256_BASE64,
      contentLength: 16,
      contentType: 'image/jpeg',
    }),
    read: async function* () {
      yield new Uint8Array([1]);
    },
    ...options.objectStore,
  };
  const ports: WorkerPorts = {
    cipher: new SensitivePayloadCipher(SECRET),
    expoReceipts: {
      get: async () => options.expoReceipt ?? 'DELIVERED',
    } as never,
    objectStore,
    otp: {
      send:
        options.otpSend ??
        (async (request) => {
          otpRequests.push(request);
          return { providerMessageId: 'otp-provider-id' };
        }),
    },
    push: {
      send:
        options.pushSend ??
        (async (request) => {
          pushRequests.push(request);
          return { accepted: true, providerMessageId: 'expo-ticket-id' };
        }),
    },
    scanner: { scan: async () => ({ clean: true }) },
  };
  return {
    calls,
    handler: new JobHandler(database, ports, environment),
    objectOrder,
    otpRequests,
    ports,
    pushRequests,
  };
}

describe('JobHandler tenant boundaries', () => {
  it('binds the leased society to approval timeout, long visit, and retention SQL', async () => {
    const { calls, handler } = setup();
    await handler.handle(event('visitor.approval-timeout', { societyId: SOCIETY_ID }));
    await handler.handle(event('visitor.long-visit', { societyId: SOCIETY_ID }));
    await handler.handle(event('retention.execute', { societyId: SOCIETY_ID }));

    const approval = calls.find((call) => call.query.includes('UPDATE visit_approvals'));
    const longVisit = calls.find((call) => call.query.includes('UPDATE visits AS visit'));
    const retention = calls.find((call) => call.query.includes('retention_policies AS policy'));
    expect(approval?.query).toContain('society_id = $1');
    expect(approval?.values).toEqual([SOCIETY_ID]);
    expect(longVisit?.query).toContain('visit.society_id = $1');
    expect(longVisit?.values).toEqual([SOCIETY_ID]);
    expect(retention?.query).toContain('file.society_id = $1');
    expect(retention?.values).toEqual([SOCIETY_ID, 'private-files', 25]);
  });

  it('rejects payload society or aggregate values that disagree with the lease', async () => {
    const first = setup();
    await expect(
      first.handler.handle(
        event('notification.dispatch', notificationPayload({ societyId: OTHER_SOCIETY_ID })),
      ),
    ).rejects.toThrow('society does not match');
    expect(first.calls).toHaveLength(0);

    const second = setup();
    await expect(
      second.handler.handle(
        event('notification.dispatch', notificationPayload({ aggregateId: OTHER_SOCIETY_ID })),
      ),
    ).rejects.toThrow('aggregate does not match');
    expect(second.calls).toHaveLength(0);
  });
});

describe('JobHandler OTP secrecy', () => {
  it('decrypts only payload.delivery and validates its society-bound challenge', async () => {
    const { calls, handler, otpRequests } = setup();
    const delivery = {
      challengeId: DELIVERY_ID,
      expiresAt: '2030-01-01T00:00:00.000Z',
      phoneE164: '+919876543210',
      plaintextCode: '123456',
      purpose: 'SIGN_IN',
    };
    await handler.handle(event('otp.deliver', durable({ delivery: encrypt(delivery) })));

    expect(otpRequests).toEqual([{ ...delivery, expiresAt: new Date(delivery.expiresAt) }]);
    const lookup = calls.find((call) => call.query.includes('FROM otp_challenges'));
    expect(lookup?.values).toEqual([DELIVERY_ID, SOCIETY_ID, '+919876543210', 'SIGN_IN']);
  });

  it('rejects top-level plaintext OTP material', async () => {
    const { handler, otpRequests } = setup();
    await expect(
      handler.handle(
        event(
          'otp.deliver',
          durable({
            delivery: encrypt({
              challengeId: DELIVERY_ID,
              expiresAt: '2030-01-01T00:00:00.000Z',
              phoneE164: '+919876543210',
              plaintextCode: '123456',
              purpose: 'SIGN_IN',
            }),
            plaintextCode: '123456',
          }),
        ),
      ),
    ).rejects.toThrow();
    expect(otpRequests).toHaveLength(0);
  });
});

describe('JobHandler notification delivery', () => {
  it('claims and decrypts a society-bound active endpoint before sending', async () => {
    const { calls, handler, pushRequests } = setup();
    await handler.handle(event('notification.dispatch', notificationPayload()));

    expect(pushRequests[0]).toMatchObject({
      dedupeKey: DELIVERY_ID,
      provider: 'EXPO',
      recipientEndpoint: PUSH_TOKEN,
    });
    const claim = calls.find((call) => call.query.includes('WITH claimed_delivery AS'));
    expect(claim?.query).toContain("endpoint.status = 'ACTIVE'");
    expect(claim?.values).toEqual([
      DELIVERY_ID,
      SOCIETY_ID,
      ENDPOINT_ID,
      NOTIFICATION_ID,
      1,
      90,
      3,
    ]);
    const completion = calls.find((call) => call.query.includes('receipt_event AS'));
    expect(completion?.query).toContain("NOW() + ($7::bigint * interval '1 second')");
    expect(completion?.query).toContain(', $8');
    expect(completion?.values[7]).toBe(NOTIFICATION_ID);
  });

  it('suppresses duplicate delivery when durable state is already terminal', async () => {
    const { handler, pushRequests } = setup({
      queryResult: (query) => {
        if (query.includes('WITH claimed_delivery AS')) return [];
        if (query.includes('FROM notification_deliveries') && query.includes('status::text')) {
          return [{ status: 'DELIVERED' }];
        }
        return undefined;
      },
    });

    await expect(
      handler.handle(event('notification.dispatch', notificationPayload())),
    ).resolves.toBeUndefined();
    expect(pushRequests).toHaveLength(0);
  });

  it('rejects missing, revoked, or cross-society endpoints without sending', async () => {
    const { handler, pushRequests } = setup({
      queryResult: (query) => (query.includes('WITH claimed_delivery AS') ? [] : undefined),
    });

    await expect(
      handler.handle(event('notification.dispatch', notificationPayload())),
    ).rejects.toThrow('not found');
    expect(pushRequests).toHaveLength(0);
  });

  it('persists retry state when the selected provider fails', async () => {
    const { calls, handler } = setup({
      pushSend: async () => {
        throw new Error('provider unavailable');
      },
    });

    await expect(
      handler.handle(event('notification.dispatch', notificationPayload())),
    ).rejects.toThrow('provider unavailable');
    const retry = calls.find(
      (call) => call.kind === 'execute' && call.query.includes("SET status = 'RETRY'"),
    );
    expect(retry?.values).toEqual([
      DELIVERY_ID,
      SOCIETY_ID,
      ENDPOINT_ID,
      NOTIFICATION_ID,
      'PUSH_DELIVERY_FAILED',
    ]);
  });

  it('rejects secret endpoint fields in the outbox payload', async () => {
    const { handler, pushRequests } = setup();
    await expect(
      handler.handle(event('notification.dispatch', notificationPayload({ endpoint: PUSH_TOKEN }))),
    ).rejects.toThrow();
    expect(pushRequests).toHaveLength(0);
  });
});

describe('JobHandler scheduled idempotency and retention', () => {
  it('keeps approval timeout idempotent on repeated scheduler events', async () => {
    const { calls, handler } = setup();
    await handler.handle(event('visitor.approval-timeout', {}));
    await handler.handle(event('visitor.approval-timeout', {}));

    const updates = calls.filter((call) => call.query.includes('UPDATE visit_approvals'));
    expect(updates).toHaveLength(2);
    expect(updates.every((call) => call.query.includes("status = 'PENDING'"))).toBe(true);
    expect(
      updates.every((call) => call.query.includes('ON CONFLICT (approval_id) DO NOTHING')),
    ).toBe(true);
    expect(updates.every((call) => call.values[0] === SOCIETY_ID)).toBe(true);
  });

  it('deletes S3 first and requires an active retention policy before marking deleted', async () => {
    const cleanKey = `private/${SOCIETY_ID}/${FILE_ID}`;
    const { calls, handler, objectOrder } = setup({
      queryResult: (query) =>
        query.includes('SELECT file.id, file.storage_key AS')
          ? [{ id: FILE_ID, storageKey: cleanKey }]
          : undefined,
    });

    await handler.handle(event('retention.execute', {}));
    expect(objectOrder).toEqual([`s3-delete:${SOCIETY_ID}:${cleanKey}`, 'db-delete']);
    const selection = calls.find((call) => call.query.includes('SELECT file.id'));
    const update = calls.find((call) => call.query.includes("SET status = 'DELETED'"));
    expect(selection?.query).toContain('retention_policies AS policy');
    expect(update?.query).toContain('retention_policies AS policy');
    expect(update?.query).toContain("file.purpose <> 'RECEIPT'");
    expect(update?.values).toEqual([FILE_ID, SOCIETY_ID, 'private-files', cleanKey]);
  });

  it('treats a concurrently deleted retention row as an idempotent replay', async () => {
    const cleanKey = `private/${SOCIETY_ID}/${FILE_ID}`;
    const { handler, objectOrder } = setup({
      executeResult: (query) => (query.includes("SET status = 'DELETED'") ? 0 : undefined),
      queryResult: (query) => {
        if (query.includes('SELECT file.id, file.storage_key AS')) {
          return [{ id: FILE_ID, storageKey: cleanKey }];
        }
        if (query.includes('FROM file_uploads') && query.includes('status::text')) {
          return [{ status: 'DELETED' }];
        }
        return undefined;
      },
    });

    await expect(handler.handle(event('retention.execute', {}))).resolves.toBeUndefined();
    expect(objectOrder[0]).toBe(`s3-delete:${SOCIETY_ID}:${cleanKey}`);
  });

  it('never marks a retention row deleted when S3 deletion fails', async () => {
    const cleanKey = `private/${SOCIETY_ID}/${FILE_ID}`;
    const { calls, handler } = setup({
      objectStore: {
        deletePrivate: async () => {
          throw new Error('S3 unavailable');
        },
      },
      queryResult: (query) =>
        query.includes('SELECT file.id, file.storage_key AS')
          ? [{ id: FILE_ID, storageKey: cleanKey }]
          : undefined,
    });

    await expect(handler.handle(event('retention.execute', {}))).rejects.toThrow('S3 unavailable');
    expect(calls.some((call) => call.query.includes("SET status = 'DELETED'"))).toBe(false);
  });
});

describe('JobHandler scanner and receipt behavior', () => {
  it('fails closed when malware scanning is unavailable', async () => {
    const state = setup();
    state.ports.scanner = {
      scan: async () => {
        throw new Error('ClamAV unavailable');
      },
    };

    await expect(
      state.handler.handle(
        event('file.scan', {
          fileId: FILE_ID,
          objectKey: 'quarantine/file',
          sha256Base64: SHA256_BASE64,
          societyId: SOCIETY_ID,
        }),
      ),
    ).rejects.toThrow('ClamAV unavailable');
    expect(state.calls.some((call) => call.query.includes("status = 'CLEAN'"))).toBe(false);
  });

  it('rejects mismatched HEAD size, checksum, or type before scanning', async () => {
    let scanned = false;
    const state = setup({
      objectStore: {
        inspect: async () => ({
          checksumSha256: SHA256_BASE64,
          contentLength: 17,
          contentType: 'image/jpeg',
        }),
      },
    });
    state.ports.scanner = {
      scan: async () => {
        scanned = true;
        return { clean: true };
      },
    };

    await state.handler.handle(
      event('file.scan', {
        fileId: FILE_ID,
        objectKey: 'quarantine/file',
        sha256Base64: SHA256_BASE64,
        societyId: SOCIETY_ID,
      }),
    );
    expect(scanned).toBe(false);
    expect(
      state.calls.some(
        (call) =>
          call.query.includes("status = 'REJECTED'") &&
          call.values[3] === 'UPLOAD_METADATA_MISMATCH',
      ),
    ).toBe(true);
  });

  it('revokes an expired Expo endpoint with society-bound SQL', async () => {
    const { calls, handler } = setup({ expoReceipt: 'ENDPOINT_EXPIRED' });
    await handler.handle(
      event('expo.receipt', {
        deliveryId: DELIVERY_ID,
        endpointId: ENDPOINT_ID,
        ticketId: 'ticket-12345',
      }),
    );
    const revoke = calls.find(
      (call) => call.kind === 'execute' && call.query.includes("status = 'REVOKED'"),
    );
    expect(revoke?.values).toEqual([DELIVERY_ID, SOCIETY_ID, ENDPOINT_ID]);
  });
});

describe('JobHandler audit follow-up', () => {
  it('verifies the society-scoped audit chain link', async () => {
    const { calls, handler } = setup();
    await handler.handle(event('audit.follow-up', { auditLogId: AUDIT_ID, societyId: SOCIETY_ID }));
    const lookup = calls.find((call) => call.query.includes('FROM audit_logs AS current'));
    expect(lookup?.query).toContain('current.previous_hash IS NOT DISTINCT FROM');
    expect(lookup?.values).toEqual([AUDIT_ID, SOCIETY_ID]);
  });
});
