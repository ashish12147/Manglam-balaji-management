import { HttpStatus } from '@nestjs/common';
import { z } from 'zod';

import { ApiError } from '../../common/http/api-error.js';

const cursorPayloadSchema = z
  .object({
    at: z.string().datetime({ offset: true }),
    id: z.string().uuid(),
  })
  .strict();

export interface CursorPayload {
  readonly at: string;
  readonly id: string;
}

export function encodeCursor(payload: CursorPayload): string {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

export function decodeCursor(cursor: string | undefined): CursorPayload | null {
  if (!cursor) {
    return null;
  }

  try {
    const parsed = cursorPayloadSchema.safeParse(
      JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')),
    );
    if (parsed.success) {
      return parsed.data;
    }
  } catch {
    // A malformed opaque cursor is a validation error, not a server failure.
  }

  throw new ApiError({
    code: 'VALIDATION_FAILED',
    details: { field: 'cursor' },
    message: 'The pagination cursor is invalid.',
    status: HttpStatus.BAD_REQUEST,
  });
}

export function pageResult<T extends { createdAt: Date; id: string }>(
  rows: readonly T[],
  limit: number,
): { readonly hasMore: boolean; readonly items: readonly T[]; readonly nextCursor: string | null } {
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const last = items.at(-1);

  return {
    hasMore,
    items,
    nextCursor: last
      ? encodeCursor({ at: last.createdAt.toISOString(), id: last.id })
      : null,
  };
}
