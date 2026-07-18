import { HttpStatus, Injectable } from '@nestjs/common';
import { IdempotencyStatus } from '@manglam/database';
import { idempotencyKeySchema } from '@manglam/validation';

import { ApiError } from '../../common/http/api-error.js';
import { DatabaseService } from '../../infrastructure/database/database.service.js';
import type { MutationActor } from '../platform/mutation-journal.service.js';
import { MutationJournalService } from '../platform/mutation-journal.service.js';
import { SensitivePayloadCipher } from '../platform/sensitive-payload-cipher.js';

export type ReplayResult<T> =
  | { readonly found: false }
  | { readonly found: true; readonly value: T };

@Injectable()
export class AuthReplayService {
  constructor(
    private readonly database: DatabaseService,
    private readonly journal: MutationJournalService,
    private readonly cipher: SensitivePayloadCipher,
  ) {}

  async find<T>(input: {
    readonly actor: MutationActor;
    readonly idempotencyKey: string;
    readonly operation: string;
    readonly request: unknown;
    readonly societyId: string;
  }): Promise<ReplayResult<T>> {
    const key = idempotencyKeySchema.safeParse(input.idempotencyKey);
    if (!key.success) {
      throw new ApiError({
        code: 'VALIDATION_FAILED',
        details: { field: 'idempotency-key' },
        message: 'A valid Idempotency-Key header is required.',
        status: HttpStatus.BAD_REQUEST,
      });
    }

    const hash = this.journal.hashRequest(input.request);
    const record = await this.database.client.idempotencyRecord.findUnique({
      where: {
        societyId_actorScopeKey_operation_key: {
          actorScopeKey: input.actor.actorScopeKey,
          key: key.data,
          operation: input.operation,
          societyId: input.societyId,
        },
      },
    });
    if (!record) return { found: false };
    if (record.requestHash !== hash) {
      throw new ApiError({
        code: 'IDEMPOTENCY_KEY_REUSED',
        details: { operation: input.operation },
        message: 'This idempotency key was already used for a different request.',
        status: HttpStatus.CONFLICT,
      });
    }
    if (
      record.status === IdempotencyStatus.COMPLETED &&
      record.responseBody !== null
    ) {
      return { found: true, value: this.cipher.decrypt<T>(record.responseBody) };
    }
    if (
      record.status === IdempotencyStatus.IN_PROGRESS &&
      record.lockedUntil !== null &&
      record.lockedUntil > new Date()
    ) {
      throw new ApiError({
        code: 'IDEMPOTENCY_REQUEST_IN_PROGRESS',
        details: { operation: input.operation },
        message: 'The same request is already being processed.',
        status: HttpStatus.CONFLICT,
      });
    }
    return { found: false };
  }
}
