import { z } from 'zod';

import type { WorkerEnvironment } from '../config.js';
import type { LeasedOutboxEvent, SqlDatabase } from '../outbox/repository.js';
import type {
  MalwareScanner,
  OtpDeliveryProvider,
  PrivateObjectStore,
  PushProvider,
} from '../providers/contracts.js';
import type { ExpoReceiptProvider } from '../providers/expo.js';
import {
  encryptedPayloadSchema,
  type SensitivePayloadCipher,
} from '../security/sensitive-payload-cipher.js';

const uuid = z.string().uuid();
const durablePayload = {
  aggregateId: uuid,
  correlationId: uuid,
  societyId: uuid,
};
const category = z.enum([
  'SECURITY_CRITICAL',
  'VISITOR_APPROVAL',
  'VISITOR_ACTIVITY',
  'EMERGENCY',
  'NOTICE',
  'COMPLAINT',
  'PAYMENT',
  'GENERAL',
]);
const notificationPayload = z
  .object({
    ...durablePayload,
    body: z.string().trim().min(1).max(4000),
    category,
    deliveryId: uuid,
    endpointId: uuid,
    notificationId: uuid,
    title: z.string().trim().min(1).max(200),
  })
  .strict();
const otpEventPayload = z
  .object({
    ...durablePayload,
    delivery: encryptedPayloadSchema,
  })
  .strict();
const otpDeliveryRequest = z
  .object({
    challengeId: uuid,
    expiresAt: z.coerce.date(),
    phoneE164: z.string().regex(/^\+[1-9]\d{7,14}$/),
    plaintextCode: z.string().regex(/^\d{4,10}$/),
    purpose: z.enum(['SIGN_IN', 'PHONE_CHANGE', 'PIN_RESET', 'STEP_UP']),
  })
  .strict();
const filePayload = z
  .object({
    fileId: uuid,
    objectKey: z.string().startsWith('quarantine/'),
    sha256Base64: z.string().regex(/^[A-Za-z0-9+/]{43}=$/),
    societyId: uuid.optional(),
  })
  .strict();
const quarantineCleanupPayload = z
  .object({
    ...durablePayload,
    fileId: uuid,
    objectKey: z.string().startsWith('quarantine/'),
  })
  .strict();
const receiptPayload = z
  .object({
    deliveryId: uuid,
    endpointId: uuid,
    ticketId: z.string().min(8).max(200),
  })
  .strict();
const scheduledPayload = z.object({ societyId: uuid.optional() }).strict();
const auditPayload = z.object({ auditLogId: uuid, societyId: uuid.optional() }).strict();
const endpointToken = z.string().min(16).max(4096);
const endpointProvider = z.enum(['EXPO', 'FCM']);

interface ClaimedPushDeliveryRow {
  encryptedToken: string;
  provider: string;
}

interface DeliveryStateRow {
  attemptCount: number;
  status: string;
}

interface FileUploadRow {
  byteSize: bigint | number | string;
  declaredMimeType: string;
  id: string;
  sha256Digest: string | null;
  status: string;
  storageKey: string;
}

interface PromotionResult {
  cleanupRecorded: boolean;
  transitioned: boolean;
}

interface StatusRow {
  status: string;
}

interface RetainedFileRow {
  id: string;
  storageKey: string;
}

interface TransitionResult {
  transitioned: boolean;
}

export interface WorkerPorts {
  cipher: SensitivePayloadCipher;
  expoReceipts: ExpoReceiptProvider;
  objectStore: PrivateObjectStore;
  otp: OtpDeliveryProvider;
  push: PushProvider;
  scanner: MalwareScanner;
}

export class JobHandler {
  constructor(
    private readonly database: SqlDatabase,
    private readonly ports: WorkerPorts,
    private readonly environment: WorkerEnvironment,
  ) {}

  async handle(
    event: Pick<
      LeasedOutboxEvent,
      'aggregateId' | 'attemptCount' | 'correlationId' | 'eventType' | 'payload' | 'societyId'
    >,
  ): Promise<void> {
    switch (event.eventType) {
      case 'notification.dispatch': {
        const payload = notificationPayload.parse(event.payload);
        this.assertPayloadContext(payload, event);
        return this.dispatchNotification(event, payload);
      }
      case 'otp.deliver': {
        const payload = otpEventPayload.parse(event.payload);
        this.assertPayloadContext(payload, event);
        return this.deliverOtp(event.societyId, payload);
      }
      case 'file.scan': {
        const payload = filePayload.parse(event.payload);
        this.assertPayloadSociety(payload.societyId, event.societyId);
        if (payload.fileId !== event.aggregateId) {
          throw new Error('File scan target does not match the durable aggregate.');
        }
        return this.scanFile(event.societyId, event.correlationId, payload);
      }
      case 'file.quarantine-cleanup': {
        const payload = quarantineCleanupPayload.parse(event.payload);
        this.assertPayloadContext(payload, event);
        if (payload.fileId !== event.aggregateId) {
          throw new Error('Quarantine cleanup file does not match the durable aggregate.');
        }
        return this.cleanupQuarantine(event.societyId, payload);
      }
      case 'expo.receipt': {
        const payload = receiptPayload.parse(event.payload);
        if (payload.deliveryId !== event.aggregateId) {
          throw new Error('Expo receipt delivery does not match the durable aggregate.');
        }
        return this.processExpoReceipt(event.societyId, payload);
      }
      case 'visitor.approval-timeout': {
        const payload = scheduledPayload.parse(event.payload);
        this.assertPayloadSociety(payload.societyId, event.societyId);
        return this.expireApprovals(event.societyId);
      }
      case 'visitor.long-visit': {
        const payload = scheduledPayload.parse(event.payload);
        this.assertPayloadSociety(payload.societyId, event.societyId);
        return this.flagLongVisits(event.societyId);
      }
      case 'retention.execute': {
        const payload = scheduledPayload.parse(event.payload);
        this.assertPayloadSociety(payload.societyId, event.societyId);
        return this.applyRetention(event.societyId);
      }
      case 'audit.follow-up': {
        const payload = auditPayload.parse(event.payload);
        this.assertPayloadSociety(payload.societyId, event.societyId);
        if (payload.auditLogId !== event.aggregateId) {
          throw new Error('Audit follow-up target does not match the durable aggregate.');
        }
        return this.auditFollowUp(event.societyId, payload.auditLogId);
      }
      default:
        throw new Error(`Unsupported outbox event type: ${event.eventType}`);
    }
  }

  private async dispatchNotification(
    event: Pick<LeasedOutboxEvent, 'attemptCount' | 'societyId'>,
    payload: z.infer<typeof notificationPayload>,
  ): Promise<void> {
    const societyId = event.societyId;
    const claimed = await this.database.$queryRawUnsafe<ClaimedPushDeliveryRow[]>(
      `WITH claimed_delivery AS (
         UPDATE notification_deliveries AS delivery
         SET status = 'PROCESSING', attempt_count = delivery.attempt_count + 1,
             next_attempt_at = NULL, failed_at = NULL, error_code = NULL,
             error_detail = NULL, updated_at = NOW()
         FROM push_endpoints AS endpoint
         WHERE delivery.id = $1 AND delivery.society_id = $2
           AND delivery.push_endpoint_id = $3 AND delivery.notification_id = $4
           AND delivery.attempt_count < $7
           AND (
             (
               delivery.status IN ('PENDING', 'RETRY')
               AND (delivery.next_attempt_at IS NULL OR delivery.next_attempt_at <= NOW())
             )
             OR (
               delivery.status = 'PROCESSING'
               AND $5::integer > 1
               AND delivery.updated_at <=
                   NOW() - ($6::text || ' seconds')::interval
             )
           )
           AND endpoint.id = delivery.push_endpoint_id
           AND endpoint.society_id = delivery.society_id
           AND endpoint.status = 'ACTIVE'
         RETURNING endpoint.encrypted_token AS "encryptedToken",
                   endpoint.provider::text AS provider
       )
       SELECT "encryptedToken", provider FROM claimed_delivery`,
      payload.deliveryId,
      societyId,
      payload.endpointId,
      payload.notificationId,
      event.attemptCount,
      this.environment.WORKER_LEASE_SECONDS,
      this.environment.WORKER_MAX_ATTEMPTS,
    );
    const endpoint = claimed[0];
    if (!endpoint) {
      const states = await this.database.$queryRawUnsafe<DeliveryStateRow[]>(
        `SELECT attempt_count AS "attemptCount", status::text AS status
         FROM notification_deliveries
         WHERE id = $1 AND society_id = $2
           AND push_endpoint_id = $3 AND notification_id = $4`,
        payload.deliveryId,
        societyId,
        payload.endpointId,
        payload.notificationId,
      );
      const state = states[0];
      if (
        state?.status === 'DELIVERED' ||
        state?.status === 'FAILED' ||
        state?.status === 'CANCELLED'
      ) {
        return;
      }
      if (
        state &&
        (state.attemptCount >= this.environment.WORKER_MAX_ATTEMPTS ||
          event.attemptCount >= this.environment.WORKER_MAX_ATTEMPTS)
      ) {
        const exhausted = await this.database.$executeRawUnsafe(
          `UPDATE notification_deliveries
           SET status = 'FAILED', failed_at = NOW(),
               error_code = 'PUSH_ATTEMPTS_EXHAUSTED',
               error_detail = 'Push delivery exhausted its bounded worker attempts.',
               updated_at = NOW()
           WHERE id = $1 AND society_id = $2
             AND push_endpoint_id = $3 AND notification_id = $4
             AND status IN ('PENDING', 'PROCESSING', 'RETRY')`,
          payload.deliveryId,
          societyId,
          payload.endpointId,
          payload.notificationId,
        );
        if (exhausted !== 1) {
          throw new Error('Exhausted push delivery state could not be persisted.');
        }
        return;
      }
      if (state?.status === 'PROCESSING') {
        throw new Error('Push delivery is already processing; duplicate send was suppressed.');
      }
      throw new Error('Eligible active push endpoint for delivery was not found.');
    }

    let provider: z.infer<typeof endpointProvider>;
    let receipt: Awaited<ReturnType<PushProvider['send']>>;
    try {
      const recipientEndpoint = endpointToken.parse(
        this.ports.cipher.decrypt<unknown>(endpoint.encryptedToken),
      );
      provider = endpointProvider.parse(endpoint.provider);
      receipt = await this.ports.push.send({
        body: payload.body,
        category: payload.category,
        data: { notificationId: payload.notificationId },
        dedupeKey: payload.deliveryId,
        provider,
        recipientEndpoint,
        title: payload.title,
      });
    } catch (error) {
      await this.markNotificationForRetry(societyId, payload, 'PUSH_DELIVERY_FAILED');
      throw error;
    }

    if (!receipt.accepted) {
      if (!receipt.terminalFailureReason) {
        await this.markNotificationForRetry(societyId, payload, 'PUSH_REJECTED');
        throw new Error('Push provider rejected delivery without a terminal classification.');
      }
      await this.failNotificationTerminally(societyId, payload, receipt.terminalFailureReason);
      return;
    }
    if (!receipt.providerMessageId) {
      await this.markNotificationForRetry(societyId, payload, 'PUSH_RECEIPT_MISSING');
      throw new Error('Push provider did not return a delivery identifier.');
    }

    const completed = await this.database.$queryRawUnsafe<TransitionResult[]>(
      `WITH delivered AS (
         UPDATE notification_deliveries
         SET status = 'DELIVERED', provider_message_id = $6, delivered_at = NOW(),
             failed_at = NULL, error_code = NULL, error_detail = NULL, updated_at = NOW()
         WHERE id = $1 AND society_id = $2
           AND push_endpoint_id = $3 AND notification_id = $4
           AND status = 'PROCESSING'
         RETURNING id, society_id
       ), endpoint_touched AS (
         UPDATE push_endpoints AS endpoint
         SET last_delivered_at = NOW(), last_failure_at = NULL,
             last_failure_code = NULL, updated_at = NOW()
         FROM delivered
         WHERE endpoint.id = $3 AND endpoint.society_id = $2
           AND endpoint.status = 'ACTIVE'
         RETURNING endpoint.id
       ), receipt_event AS (
         INSERT INTO outbox_events
           (id, society_id, aggregate_type, aggregate_id, event_type, payload,
            status, dedupe_key, available_at, correlation_id, updated_at)
         SELECT gen_random_uuid(), society_id, 'notification_delivery', id, 'expo.receipt',
                jsonb_build_object('deliveryId', id, 'endpointId', $3, 'ticketId', $6),
                'PENDING', 'expo-receipt:' || id::text,
                NOW() + ($7::bigint * interval '1 second'), $8, NOW()
         FROM delivered
         WHERE $5::text = 'EXPO'
         ON CONFLICT (society_id, dedupe_key) DO NOTHING
         RETURNING id
       )
       SELECT EXISTS (SELECT 1 FROM delivered) AS transitioned`,
      payload.deliveryId,
      societyId,
      payload.endpointId,
      payload.notificationId,
      provider,
      receipt.providerMessageId,
      this.environment.EXPO_RECEIPT_DELAY_SECONDS,
      payload.correlationId,
    );
    if (completed[0]?.transitioned !== true) {
      throw new Error('Push delivery state changed before completion could be persisted.');
    }
  }

  private async markNotificationForRetry(
    societyId: string,
    payload: z.infer<typeof notificationPayload>,
    code: string,
  ): Promise<void> {
    const updated = await this.database.$executeRawUnsafe(
      `UPDATE notification_deliveries
       SET status = 'RETRY', next_attempt_at = NOW(), failed_at = NOW(),
           error_code = $5, error_detail = 'Push delivery failed; inspect the outbox attempt.',
           updated_at = NOW()
       WHERE id = $1 AND society_id = $2
         AND push_endpoint_id = $3 AND notification_id = $4
         AND status = 'PROCESSING'`,
      payload.deliveryId,
      societyId,
      payload.endpointId,
      payload.notificationId,
      code,
    );
    if (updated !== 1) throw new Error('Push delivery retry state could not be persisted.');
  }

  private async failNotificationTerminally(
    societyId: string,
    payload: z.infer<typeof notificationPayload>,
    reason: 'ENDPOINT_EXPIRED' | 'ENDPOINT_INVALID',
  ): Promise<void> {
    const result = await this.database.$queryRawUnsafe<TransitionResult[]>(
      `WITH failed AS (
         UPDATE notification_deliveries
         SET status = 'FAILED', failed_at = NOW(), error_code = $5,
             error_detail = 'Push endpoint was rejected by the configured provider.',
             updated_at = NOW()
         WHERE id = $1 AND society_id = $2
           AND push_endpoint_id = $3 AND notification_id = $4
           AND status = 'PROCESSING'
         RETURNING id
       ), revoked AS (
         UPDATE push_endpoints
         SET status = 'REVOKED', last_failure_at = NOW(), last_failure_code = $5,
             updated_at = NOW()
         WHERE id = $3 AND society_id = $2 AND status = 'ACTIVE'
           AND EXISTS (SELECT 1 FROM failed)
         RETURNING id
       )
       SELECT EXISTS (SELECT 1 FROM failed) AS transitioned`,
      payload.deliveryId,
      societyId,
      payload.endpointId,
      payload.notificationId,
      reason,
    );
    if (result[0]?.transitioned !== true) {
      throw new Error('Terminal push delivery state could not be persisted.');
    }
  }

  private async deliverOtp(
    societyId: string,
    payload: z.infer<typeof otpEventPayload>,
  ): Promise<void> {
    const request = otpDeliveryRequest.parse(this.ports.cipher.decrypt<unknown>(payload.delivery));
    if (request.challengeId !== payload.aggregateId) {
      throw new Error('OTP delivery challenge does not match the durable aggregate.');
    }
    if (request.expiresAt.getTime() <= Date.now()) {
      throw new Error('OTP delivery challenge has expired.');
    }
    const challenge = await this.database.$queryRawUnsafe<Array<{ id: string }>>(
      `SELECT id
       FROM otp_challenges
       WHERE id = $1 AND society_id = $2 AND status = 'PENDING'
         AND normalized_phone = $3 AND purpose = $4 AND expires_at > NOW()`,
      request.challengeId,
      societyId,
      request.phoneE164,
      request.purpose,
    );
    if (challenge.length !== 1) throw new Error('Eligible OTP challenge was not found.');
    const result = await this.ports.otp.send(request);
    if (!result.providerMessageId) {
      throw new Error('OTP provider did not provide a message identifier.');
    }
  }

  private async scanFile(
    societyId: string,
    correlationId: string,
    payload: z.infer<typeof filePayload>,
  ): Promise<void> {
    const files = await this.database.$queryRawUnsafe<FileUploadRow[]>(
      `SELECT id, byte_size AS "byteSize", declared_mime_type AS "declaredMimeType",
              sha256_digest AS "sha256Digest", status::text AS status,
              storage_key AS "storageKey"
       FROM file_uploads
       WHERE id = $1 AND society_id = $2 AND bucket = $3`,
      payload.fileId,
      societyId,
      this.environment.S3_BUCKET,
    );
    const file = files[0];
    if (!file || files.length !== 1) throw new Error('Quarantined file record was not found.');
    const cleanKey = `private/${societyId}/${payload.fileId}`;
    if (file.status === 'CLEAN') {
      if (file.storageKey !== cleanKey) {
        throw new Error('Clean file storage key is invalid.');
      }
      return;
    }
    if (file.status === 'REJECTED') {
      if (file.storageKey !== payload.objectKey) {
        throw new Error('Rejected file quarantine key does not match the cleanup event.');
      }
      await this.ports.objectStore.deleteQuarantine(payload.objectKey);
      return;
    }
    if (
      !['UPLOADED', 'QUARANTINED', 'SCANNING'].includes(file.status) ||
      file.storageKey !== payload.objectKey
    ) {
      throw new Error('File is not eligible for quarantine scanning.');
    }
    const metadata = await this.ports.objectStore.inspect(payload.objectKey);
    const contentType = metadata.contentType?.trim().toLowerCase() ?? null;
    const declaredType = file.declaredMimeType.trim().toLowerCase();
    const digestHex = Buffer.from(payload.sha256Base64, 'base64').toString('hex');
    const metadataMatches =
      Number.isSafeInteger(metadata.contentLength) &&
      metadata.contentLength >= 1 &&
      metadata.contentLength <= this.environment.UPLOAD_MAX_BYTES &&
      BigInt(metadata.contentLength) === BigInt(file.byteSize) &&
      metadata.checksumSha256 === payload.sha256Base64 &&
      file.sha256Digest?.toLowerCase() === digestHex &&
      contentType !== null &&
      contentType === declaredType &&
      this.environment.UPLOAD_ALLOWED_MIME_TYPES.map((item) => item.toLowerCase()).includes(
        contentType,
      );
    if (!metadataMatches) {
      await this.rejectFile(
        societyId,
        payload.fileId,
        payload.objectKey,
        'UPLOAD_METADATA_MISMATCH',
      );
      return;
    }

    const claimed = await this.database.$executeRawUnsafe(
      `UPDATE file_uploads
       SET status = 'SCANNING', updated_at = NOW(), version = version + 1
       WHERE id = $1 AND society_id = $2 AND storage_key = $3
         AND status IN ('UPLOADED', 'QUARANTINED', 'SCANNING')`,
      payload.fileId,
      societyId,
      payload.objectKey,
    );
    if (claimed !== 1) throw new Error('Quarantined file could not be claimed.');
    const scan = await this.ports.scanner.scan(this.ports.objectStore.read(payload.objectKey));
    if (!scan.clean) {
      await this.rejectFile(societyId, payload.fileId, payload.objectKey, 'MALWARE_DETECTED');
      return;
    }

    await this.ports.objectStore.copy(payload.objectKey, cleanKey);
    const promoted = await this.database.$queryRawUnsafe<PromotionResult[]>(
      `WITH promoted AS (
         UPDATE file_uploads
         SET status = 'CLEAN', storage_key = $4, detected_mime_type = $5,
             scan_provider = 'clamav', scan_completed_at = NOW(), updated_at = NOW(),
             version = version + 1
         WHERE id = $1 AND society_id = $2 AND storage_key = $3
           AND status = 'SCANNING'
         RETURNING id, society_id
       ), cleanup_event AS (
         INSERT INTO outbox_events
           (id, society_id, aggregate_type, aggregate_id, event_type, payload,
            status, dedupe_key, available_at, correlation_id, updated_at)
         SELECT gen_random_uuid(), society_id, 'file_upload', id,
                'file.quarantine-cleanup',
                jsonb_build_object(
                  'aggregateId', id,
                  'correlationId', $6::uuid,
                  'societyId', society_id,
                  'fileId', id,
                  'objectKey', $3::text
                ),
                'PENDING', 'file-quarantine-cleanup:' || id::text, NOW(), $6::uuid, NOW()
         FROM promoted
         ON CONFLICT (society_id, dedupe_key) DO NOTHING
         RETURNING id
       )
       SELECT EXISTS (SELECT 1 FROM promoted) AS transitioned,
              (
                EXISTS (SELECT 1 FROM cleanup_event)
                OR EXISTS (
                  SELECT 1 FROM outbox_events
                  WHERE society_id = $2
                    AND dedupe_key = 'file-quarantine-cleanup:' || $1::text
                )
              ) AS "cleanupRecorded"`,
      payload.fileId,
      societyId,
      payload.objectKey,
      cleanKey,
      contentType,
      correlationId,
    );
    if (promoted[0]?.transitioned !== true || promoted[0]?.cleanupRecorded !== true) {
      throw new Error(
        'Scanned file promotion and quarantine cleanup could not be persisted atomically.',
      );
    }
  }

  private async rejectFile(
    societyId: string,
    fileId: string,
    objectKey: string,
    reason: string,
  ): Promise<void> {
    const updated = await this.database.$executeRawUnsafe(
      `UPDATE file_uploads
       SET status = 'REJECTED', rejection_reason = $4, scan_provider = 'clamav',
           scan_completed_at = NOW(), updated_at = NOW(), version = version + 1
       WHERE id = $1 AND society_id = $2 AND storage_key = $3
         AND status IN ('UPLOADED', 'QUARANTINED', 'SCANNING')`,
      fileId,
      societyId,
      objectKey,
      reason,
    );
    if (updated !== 1) {
      const state = await this.database.$queryRawUnsafe<StatusRow[]>(
        `SELECT status::text AS status
         FROM file_uploads
         WHERE id = $1 AND society_id = $2 AND bucket = $3 AND storage_key = $4`,
        fileId,
        societyId,
        this.environment.S3_BUCKET,
        objectKey,
      );
      if (state[0]?.status !== 'REJECTED') {
        throw new Error('Rejected file state could not be persisted.');
      }
    }
    await this.ports.objectStore.deleteQuarantine(objectKey);
  }

  private async cleanupQuarantine(
    societyId: string,
    payload: z.infer<typeof quarantineCleanupPayload>,
  ): Promise<void> {
    const files = await this.database.$queryRawUnsafe<
      Array<{ status: string; storageKey: string }>
    >(
      `SELECT status::text AS status, storage_key AS "storageKey"
       FROM file_uploads
       WHERE id = $1 AND society_id = $2 AND bucket = $3`,
      payload.fileId,
      societyId,
      this.environment.S3_BUCKET,
    );
    const file = files[0];
    const expectedKey = `private/${societyId}/${payload.fileId}`;
    if (!file || !['CLEAN', 'DELETED'].includes(file.status) || file.storageKey !== expectedKey) {
      throw new Error('Quarantine cleanup target is not a promoted private file.');
    }
    await this.ports.objectStore.deleteQuarantine(payload.objectKey);
  }

  private async processExpoReceipt(
    societyId: string,
    payload: z.infer<typeof receiptPayload>,
  ): Promise<void> {
    const rows = await this.database.$queryRawUnsafe<Array<{ id: string }>>(
      `SELECT delivery.id
       FROM notification_deliveries AS delivery
       JOIN push_endpoints AS endpoint
         ON endpoint.id = delivery.push_endpoint_id
        AND endpoint.society_id = delivery.society_id
       WHERE delivery.id = $1 AND delivery.society_id = $2
         AND endpoint.id = $3 AND endpoint.provider = 'EXPO'
         AND delivery.provider_message_id = $4`,
      payload.deliveryId,
      societyId,
      payload.endpointId,
      payload.ticketId,
    );
    if (rows.length !== 1) throw new Error('Expo delivery receipt target was not found.');
    const result = await this.ports.expoReceipts.get(payload.ticketId);
    if (result === 'DELIVERED') return;
    if (result === 'ENDPOINT_EXPIRED') {
      await this.database.$executeRawUnsafe(
        `WITH failed AS (
           UPDATE notification_deliveries
           SET status = 'FAILED', failed_at = NOW(), error_code = 'ENDPOINT_EXPIRED',
               error_detail = 'Expo reported an expired endpoint.', updated_at = NOW()
           WHERE id = $1 AND society_id = $2 AND push_endpoint_id = $3
             AND status IN ('DELIVERED', 'FAILED')
           RETURNING id
         )
         UPDATE push_endpoints
         SET status = 'REVOKED', last_failure_at = NOW(),
             last_failure_code = 'ENDPOINT_EXPIRED', updated_at = NOW()
         WHERE id = $3 AND society_id = $2 AND status = 'ACTIVE'
           AND EXISTS (SELECT 1 FROM failed)`,
        payload.deliveryId,
        societyId,
        payload.endpointId,
      );
      return;
    }
    throw new Error('Expo receipt is not terminal; retry required.');
  }

  private async expireApprovals(societyId: string): Promise<void> {
    await this.database.$executeRawUnsafe(
      `WITH expired AS (
         UPDATE visit_approvals
         SET status = 'TIMED_OUT', decided_at = NOW(), updated_at = NOW(),
             version = version + 1
         WHERE society_id = $1 AND status = 'PENDING' AND expires_at <= NOW()
         RETURNING id, society_id, visit_id
       ), decisions AS (
         INSERT INTO visit_approval_decisions
           (id, society_id, approval_id, decision, source, reason, correlation_id)
         SELECT gen_random_uuid(), society_id, id, 'TIMED_OUT', 'SYSTEM',
                'Approval deadline elapsed.', gen_random_uuid()
         FROM expired
         ON CONFLICT (approval_id) DO NOTHING
         RETURNING approval_id
       ), visits_changed AS (
         UPDATE visits AS visit
         SET status = 'APPROVAL_TIMED_OUT', version = version + 1, updated_at = NOW()
         FROM (SELECT DISTINCT visit_id FROM expired) AS item
         WHERE visit.id = item.visit_id AND visit.society_id = $1
           AND visit.status = 'AWAITING_APPROVAL'
         RETURNING visit.id, visit.society_id
       )
       INSERT INTO visit_events
         (id, society_id, visit_id, sequence, event_type, previous_status,
          new_status, correlation_id)
       SELECT gen_random_uuid(), changed.society_id, changed.id,
              COALESCE((SELECT MAX(sequence) FROM visit_events
                        WHERE visit_id = changed.id AND society_id = $1), 0) + 1,
              'APPROVAL_TIMED_OUT', 'AWAITING_APPROVAL', 'APPROVAL_TIMED_OUT',
              gen_random_uuid()
       FROM visits_changed AS changed`,
      societyId,
    );
  }

  private async flagLongVisits(societyId: string): Promise<void> {
    await this.database.$executeRawUnsafe(
      `WITH flagged AS (
         UPDATE visits AS visit
         SET long_visit_flagged_at = NOW(), version = version + 1, updated_at = NOW()
         FROM society_settings AS settings
         WHERE visit.society_id = $1
           AND settings.society_id = visit.society_id
           AND visit.status = 'CHECKED_IN'
           AND visit.checked_out_at IS NULL
           AND visit.long_visit_flagged_at IS NULL
           AND visit.checked_in_at <= NOW() -
             make_interval(mins => settings.long_visit_threshold_minutes)
         RETURNING visit.id, visit.society_id, visit.status
       )
       INSERT INTO visit_events
         (id, society_id, visit_id, sequence, event_type, previous_status,
          new_status, correlation_id)
       SELECT gen_random_uuid(), flagged.society_id, flagged.id,
              COALESCE((SELECT MAX(sequence) FROM visit_events
                        WHERE visit_id = flagged.id AND society_id = $1), 0) + 1,
              'LONG_VISIT_FLAGGED', flagged.status, flagged.status, gen_random_uuid()
       FROM flagged`,
      societyId,
    );
  }

  private async applyRetention(societyId: string): Promise<void> {
    const files = await this.database.$queryRawUnsafe<RetainedFileRow[]>(
      `SELECT file.id, file.storage_key AS "storageKey"
       FROM file_uploads AS file
       JOIN LATERAL (
         SELECT policy.retention_days
         FROM retention_policies AS policy
         WHERE policy.society_id = file.society_id
           AND policy.entity_type = 'file_upload'
           AND policy.active = true
           AND (policy.file_purpose = file.purpose OR policy.file_purpose IS NULL)
         ORDER BY (policy.file_purpose IS NOT NULL) DESC
         LIMIT 1
       ) AS policy ON true
       WHERE file.society_id = $1 AND file.bucket = $2 AND file.status = 'CLEAN'
         AND file.purpose <> 'RECEIPT' AND file.retention_until IS NOT NULL
         AND file.retention_until <= NOW()
         AND COALESCE(file.uploaded_at, file.created_at) <=
             NOW() - make_interval(days => policy.retention_days)
         AND file.storage_key LIKE ('private/' || $1::text || '/%')
       ORDER BY file.retention_until ASC, file.id ASC
       LIMIT $3`,
      societyId,
      this.environment.S3_BUCKET,
      this.environment.RETENTION_BATCH_SIZE,
    );
    for (const file of files) {
      await this.ports.objectStore.deletePrivate(file.storageKey, societyId);
      const updated = await this.database.$executeRawUnsafe(
        `UPDATE file_uploads AS file
         SET status = 'DELETED', updated_at = NOW(), version = version + 1
         WHERE file.id = $1 AND file.society_id = $2 AND file.bucket = $3
           AND file.storage_key = $4 AND file.status = 'CLEAN'
           AND file.purpose <> 'RECEIPT' AND file.retention_until IS NOT NULL
           AND file.retention_until <= NOW()
           AND EXISTS (
             SELECT 1 FROM retention_policies AS policy
             WHERE policy.society_id = file.society_id
               AND policy.entity_type = 'file_upload' AND policy.active = true
               AND (policy.file_purpose = file.purpose OR policy.file_purpose IS NULL)
               AND COALESCE(file.uploaded_at, file.created_at) <=
                   NOW() - make_interval(days => policy.retention_days)
           )`,
        file.id,
        societyId,
        this.environment.S3_BUCKET,
        file.storageKey,
      );
      if (updated === 1) continue;
      const state = await this.database.$queryRawUnsafe<StatusRow[]>(
        `SELECT status::text AS status
         FROM file_uploads
         WHERE id = $1 AND society_id = $2 AND bucket = $3 AND storage_key = $4`,
        file.id,
        societyId,
        this.environment.S3_BUCKET,
        file.storageKey,
      );
      if (state[0]?.status !== 'DELETED') {
        throw new Error('Retained file state changed before deletion completed.');
      }
    }
  }

  private async auditFollowUp(societyId: string, auditLogId: string): Promise<void> {
    const rows = await this.database.$queryRawUnsafe<Array<{ id: string }>>(
      `SELECT current.id
       FROM audit_logs AS current
       LEFT JOIN LATERAL (
         SELECT previous.entry_hash
         FROM audit_logs AS previous
         WHERE previous.society_id = current.society_id
           AND (previous.occurred_at, previous.id) < (current.occurred_at, current.id)
         ORDER BY previous.occurred_at DESC, previous.id DESC
         LIMIT 1
       ) AS previous ON true
       WHERE current.id = $1 AND current.society_id = $2
         AND current.previous_hash IS NOT DISTINCT FROM previous.entry_hash`,
      auditLogId,
      societyId,
    );
    if (rows.length !== 1) throw new Error('Audit follow-up integrity check failed.');
  }

  private assertPayloadContext(
    payload: { aggregateId: string; correlationId: string; societyId: string },
    event: Pick<LeasedOutboxEvent, 'aggregateId' | 'correlationId' | 'societyId'>,
  ): void {
    this.assertPayloadSociety(payload.societyId, event.societyId);
    if (payload.aggregateId !== event.aggregateId) {
      throw new Error('Outbox payload aggregate does not match the leased event aggregate.');
    }
    if (payload.correlationId !== event.correlationId) {
      throw new Error('Outbox payload correlation does not match the leased event correlation.');
    }
  }

  private assertPayloadSociety(payloadSocietyId: string | undefined, eventSocietyId: string): void {
    if (payloadSocietyId !== undefined && payloadSocietyId !== eventSocietyId) {
      throw new Error('Outbox payload society does not match the leased event society.');
    }
  }
}
