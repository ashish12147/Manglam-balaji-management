import { HttpStatus } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { ApiError } from './api-error.js';
import { ZodValidationPipe } from './zod-validation.pipe.js';

describe('ZodValidationPipe', () => {
  const pipe = new ZodValidationPipe(
    z.object({
      phone: z.string().regex(/^\+[1-9]\d{7,14}$/),
    }),
  );

  it('returns parsed data for a valid input', () => {
    expect(pipe.transform({ phone: '+919876543210' })).toEqual({
      phone: '+919876543210',
    });
  });

  it('returns a stable validation error for invalid input', () => {
    try {
      pipe.transform({ phone: '9876543210' });
      throw new Error('Expected validation to fail.');
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).getStatus()).toBe(HttpStatus.BAD_REQUEST);
      expect((error as ApiError).code).toBe('VALIDATION_ERROR');
    }
  });
});
