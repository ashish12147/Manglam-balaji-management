import { describe, expect, it } from 'vitest';

import { isSafeInternalRoute, isSecureExternalUrl } from '@/lib/links';

describe('link safety', () => {
  it('allows known resident routes and rejects external or malformed routes', () => {
    expect(isSafeInternalRoute('/notices/notice-1')).toBe(true);
    expect(isSafeInternalRoute('/complaints/case-1?source=push')).toBe(true);
    expect(isSafeInternalRoute('//evil.example/path')).toBe(false);
    expect(isSafeInternalRoute('/unknown/path')).toBe(false);
    expect(isSafeInternalRoute('https://evil.example')).toBe(false);
  });

  it('allows credential-free HTTPS checkout links only', () => {
    expect(isSecureExternalUrl('https://payments.example/checkout?id=1')).toBe(true);
    expect(isSecureExternalUrl('http://payments.example/checkout')).toBe(false);
    expect(isSecureExternalUrl('https://user:secret@payments.example/checkout')).toBe(false);
    expect(isSecureExternalUrl('upi://pay?pa=merchant')).toBe(false);
  });
});
