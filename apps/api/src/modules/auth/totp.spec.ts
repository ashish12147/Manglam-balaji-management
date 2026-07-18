import { describe, expect, it } from 'vitest';

import { verifyTotpCode } from './totp.js';

const RFC_SECRET = Buffer.from('12345678901234567890', 'ascii');

describe('TOTP verification', () => {
  it.each([
    [59_000, '287082', 1n],
    [1_111_111_109_000, '081804', 37_037_036n],
    [1_234_567_890_000, '005924', 41_152_263n],
  ])('accepts RFC 6238 SHA-1 vectors', (milliseconds, code, step) => {
    expect(
      verifyTotpCode({
        candidate: code,
        lastUsedStep: null,
        now: new Date(milliseconds),
        secret: RFC_SECRET,
      }),
    ).toBe(step);
  });

  it('rejects replay of an already-used time step', () => {
    expect(
      verifyTotpCode({
        candidate: '287082',
        lastUsedStep: 1n,
        now: new Date(59_000),
        secret: RFC_SECRET,
      }),
    ).toBeNull();
  });

  it.each(['28708', '2870820', 'abcdef', '000000'])(
    'rejects malformed or incorrect code %s',
    (candidate) => {
      expect(
        verifyTotpCode({
          candidate,
          lastUsedStep: null,
          now: new Date(59_000),
          secret: RFC_SECRET,
        }),
      ).toBeNull();
    },
  );
});
