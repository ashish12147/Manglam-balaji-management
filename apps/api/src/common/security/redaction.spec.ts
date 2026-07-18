import { describe, expect, it } from 'vitest';

import { redactSensitiveValues } from './redaction.js';

describe('redactSensitiveValues', () => {
  it('redacts sensitive keys recursively without mutating safe fields', () => {
    expect(
      redactSensitiveValues({
        authorization: 'Bearer token',
        nested: {
          name: 'Ashish',
          otpCode: '123456',
        },
        rows: [{ cookie: 'session', status: 'ok' }],
      }),
    ).toEqual({
      authorization: '[REDACTED]',
      nested: {
        name: 'Ashish',
        otpCode: '[REDACTED]',
      },
      rows: [{ cookie: '[REDACTED]', status: 'ok' }],
    });
  });
});
