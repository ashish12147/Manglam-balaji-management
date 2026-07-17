import { describe, expect, it } from 'vitest';

import {
  OTP_POLICY,
  constantTimeDigestEqual,
  createOtpChallenge,
  digestSecret,
  evaluateOtpResend,
  generateManualVisitorCode,
  generateQrToken,
  validateOtpProviderForEnvironment,
  verifyOtpChallenge,
  verifySecret,
} from './index.js';

const pepper = 'production-grade-test-pepper-with-32-characters';
const now = '2026-07-17T12:00:00.000Z';

describe('secure code primitives', () => {
  it('generates non-ambiguous manual codes and 128-bit-or-greater QR tokens', () => {
    const manualCodes = new Set(Array.from({ length: 100 }, () => generateManualVisitorCode()));
    expect(manualCodes.size).toBe(100);
    for (const code of manualCodes) expect(code).toMatch(/^[A-HJ-NP-Z2-9]{10}$/);
    expect(Buffer.from(generateQrToken(), 'base64url')).toHaveLength(16);
  });

  it('binds digests to every context field and compares only valid digests', () => {
    const digest = digestSecret('A7BC92PQRS', ['visit-a', 'flat-a'], pepper);
    expect(verifySecret('A7BC92PQRS', digest, ['visit-a', 'flat-a'], pepper)).toBe(true);
    expect(verifySecret('A7BC92PQRS', digest, ['visit-b', 'flat-a'], pepper)).toBe(false);
    expect(constantTimeDigestEqual(digest, digest)).toBe(true);
    expect(constantTimeDigestEqual('not-a-digest', digest)).toBe(false);
  });

  it('rejects weak peppers and unsafe token sizes', () => {
    expect(() => digestSecret('secret', ['context'], 'weak')).toThrow();
    expect(() => generateQrToken(8)).toThrow();
    expect(() => generateManualVisitorCode(4)).toThrow();
  });
});

describe('OTP policy', () => {
  const issue = () =>
    createOtpChallenge({
      id: '019f7097-2547-7e61-9c4b-0373af2333a5',
      phoneE164: '+919876543210',
      purpose: 'LOGIN',
      deviceNonce: 'device-nonce-with-entropy',
      pepper,
      now,
    });

  it('issues a random six-digit challenge with policy TTL and no universal bypass', () => {
    const first = issue();
    expect(first.deliveryCode).toMatch(/^\d{6}$/);
    expect(first.challenge.digest).not.toBe(first.deliveryCode);
    expect(Date.parse(first.challenge.expiresAt) - Date.parse(now)).toBe(OTP_POLICY.ttlMs);
    const wrongCandidate = first.deliveryCode === '000000' ? '000001' : '000000';
    expect(
      verifyOtpChallenge({
        challenge: first.challenge,
        candidate: wrongCandidate,
        pepper,
        now: '2026-07-17T12:01:00.000Z',
      }).accepted,
    ).toBe(false);
  });

  it('consumes the valid code exactly once and increments attempts', () => {
    const issued = issue();
    const accepted = verifyOtpChallenge({
      challenge: issued.challenge,
      candidate: issued.deliveryCode,
      pepper,
      now: '2026-07-17T12:01:00.000Z',
    });
    expect(accepted).toMatchObject({ accepted: true, challenge: { attempts: 1 } });
    if (!accepted.accepted) throw new Error('Expected OTP acceptance');
    expect(
      verifyOtpChallenge({
        challenge: accepted.challenge,
        candidate: issued.deliveryCode,
        pepper,
        now: '2026-07-17T12:01:01.000Z',
      }),
    ).toMatchObject({ accepted: false, reason: 'ALREADY_USED' });
  });

  it('rejects expired, superseded, and exhausted challenges', () => {
    const issued = issue();
    expect(
      verifyOtpChallenge({
        challenge: issued.challenge,
        candidate: issued.deliveryCode,
        pepper,
        now: issued.challenge.expiresAt,
      }),
    ).toMatchObject({ accepted: false, reason: 'EXPIRED' });
    expect(
      verifyOtpChallenge({
        challenge: { ...issued.challenge, supersededAt: '2026-07-17T12:00:30.000Z' },
        candidate: issued.deliveryCode,
        pepper,
        now: '2026-07-17T12:01:00.000Z',
      }),
    ).toMatchObject({ accepted: false, reason: 'SUPERSEDED' });
    expect(
      verifyOtpChallenge({
        challenge: { ...issued.challenge, attempts: OTP_POLICY.maxAttempts },
        candidate: issued.deliveryCode,
        pepper,
        now: '2026-07-17T12:01:00.000Z',
      }),
    ).toMatchObject({ accepted: false, reason: 'ATTEMPTS_EXCEEDED' });
  });

  it('applies resend cooldown and blocks development providers outside local environments', () => {
    expect(evaluateOtpResend(now, '2026-07-17T12:00:30.000Z')).toEqual({
      allowed: false,
      retryAfterMs: 30_000,
    });
    expect(evaluateOtpResend(now, '2026-07-17T12:01:00.000Z')).toEqual({ allowed: true });
    expect(validateOtpProviderForEnvironment('production', 'development').ok).toBe(false);
    expect(validateOtpProviderForEnvironment('development', 'development').ok).toBe(true);
  });
});
