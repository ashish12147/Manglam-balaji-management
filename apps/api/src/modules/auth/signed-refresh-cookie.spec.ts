import { describe, expect, it } from 'vitest';

import {
  signRefreshCookie,
  verifyRefreshCookie,
} from './signed-refresh-cookie.js';

const SECRET = 'cookie-secret-that-is-longer-than-thirty-two-characters';
const TOKEN = `2dd4aa10-8fd3-4706-98ae-02b85e1fa5e9.${'x'.repeat(64)}`;

describe('signed refresh cookie', () => {
  it('round trips an opaque refresh token', () => {
    const encoded = signRefreshCookie(TOKEN, SECRET);
    expect(verifyRefreshCookie(encoded, SECRET)).toBe(TOKEN);
  });

  it('rejects tampering, a wrong key, malformed values, and oversized values', () => {
    const encoded = signRefreshCookie(TOKEN, SECRET);
    expect(
      verifyRefreshCookie(`${encoded.slice(0, -1)}A`, SECRET),
    ).toBeNull();
    expect(
      verifyRefreshCookie(
        encoded,
        'different-secret-that-is-also-at-least-thirty-two-characters',
      ),
    ).toBeNull();
    expect(verifyRefreshCookie('v1.not-valid!', SECRET)).toBeNull();
    expect(verifyRefreshCookie('a'.repeat(1_025), SECRET)).toBeNull();
  });
});
