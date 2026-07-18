import { HttpStatus, type PipeTransform } from '@nestjs/common';
import { type ZodType } from 'zod';

import { ApiError } from './api-error.js';

export class ZodValidationPipe<TOutput, TInput = unknown> implements PipeTransform<
  TInput,
  TOutput
> {
  constructor(private readonly schema: ZodType<TOutput, TInput>) {}

  transform(value: TInput): TOutput {
    const result = this.schema.safeParse(value);

    if (result.success) {
      return result.data;
    }

    throw new ApiError({
      code: 'VALIDATION_ERROR',
      details: {
        issues: result.error.issues.map((issue) => ({
          code: issue.code,
          message: issue.message,
          path: issue.path.join('.'),
        })),
      },
      message: 'The request contains invalid values.',
      status: HttpStatus.BAD_REQUEST,
    });
  }
}
