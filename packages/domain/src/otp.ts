import { domainError, type DomainError, type Result } from '@manglam/types';

import { digestSecret, generateNumericCode, verifySecret } from './codes.js';

export const OTP_PURPOSES = ['LOGIN', 'STEP_UP', 'PHONE_CHANGE'] as const;
export type OtpPurpose = (typeof OTP_PURPOSES)[number];

export const OTP_POLICY = Object.freeze({
  digits: 6,
  ttlMs: 5 * 60_000,
  maxAttempts: 5,
  resendCooldownMs: 60_000,
  phoneRequestsPer15Minutes: 3,
  phoneRequestsPerHour: 6,
  phoneRequestsPerDay: 10,
  ipOrDeviceRequestsPer15Minutes: 10,
});

export interface OtpChallengeSnapshot {
  readonly id: string;
  readonly phoneE164: string;
  readonly purpose: OtpPurpose;
  readonly deviceNonce: string;
  readonly digest: string;
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly attempts: number;
  readonly maxAttempts: number;
  readonly consumedAt: string | null;
  readonly supersededAt: string | null;
}

export interface IssuedOtpChallenge {
  readonly challenge: OtpChallengeSnapshot;
  readonly deliveryCode: string;
}

const challengeContext = (
  challenge: Pick<OtpChallengeSnapshot, 'id' | 'phoneE164' | 'purpose' | 'deviceNonce'>,
) => [challenge.id, challenge.phoneE164, challenge.purpose, challenge.deviceNonce] as const;

export const createOtpChallenge = (input: {
  readonly id: string;
  readonly phoneE164: string;
  readonly purpose: OtpPurpose;
  readonly deviceNonce: string;
  readonly pepper: string;
  readonly now: string;
}): IssuedOtpChallenge => {
  const deliveryCode = generateNumericCode(OTP_POLICY.digits);
  const expiresAt = new Date(Date.parse(input.now) + OTP_POLICY.ttlMs).toISOString();
  const challengeBase = {
    id: input.id,
    phoneE164: input.phoneE164,
    purpose: input.purpose,
    deviceNonce: input.deviceNonce,
  } as const;

  return {
    deliveryCode,
    challenge: {
      ...challengeBase,
      digest: digestSecret(deliveryCode, challengeContext(challengeBase), input.pepper),
      createdAt: input.now,
      expiresAt,
      attempts: 0,
      maxAttempts: OTP_POLICY.maxAttempts,
      consumedAt: null,
      supersededAt: null,
    },
  };
};

export type OtpVerificationFailure =
  | 'INVALID'
  | 'EXPIRED'
  | 'ATTEMPTS_EXCEEDED'
  | 'SUPERSEDED'
  | 'ALREADY_USED';

export type OtpVerificationDecision =
  | { readonly accepted: true; readonly challenge: OtpChallengeSnapshot }
  | {
      readonly accepted: false;
      readonly reason: OtpVerificationFailure;
      readonly challenge: OtpChallengeSnapshot;
      readonly error: DomainError;
    };

const rejected = (
  reason: OtpVerificationFailure,
  challenge: OtpChallengeSnapshot,
  error: DomainError,
): OtpVerificationDecision => ({ accepted: false, reason, challenge, error });

export const verifyOtpChallenge = (input: {
  readonly challenge: OtpChallengeSnapshot;
  readonly candidate: string;
  readonly pepper: string;
  readonly now: string;
}): OtpVerificationDecision => {
  const { challenge } = input;

  if (challenge.consumedAt !== null) {
    return rejected(
      'ALREADY_USED',
      challenge,
      domainError('OTP_ALREADY_USED', 'This OTP challenge has already been used.', {}),
    );
  }
  if (challenge.supersededAt !== null) {
    return rejected(
      'SUPERSEDED',
      challenge,
      domainError('OTP_SUPERSEDED', 'A newer OTP challenge has replaced this one.', {}),
    );
  }
  if (Date.parse(input.now) >= Date.parse(challenge.expiresAt)) {
    return rejected('EXPIRED', challenge, domainError('OTP_EXPIRED', 'This OTP has expired.', {}));
  }
  if (challenge.attempts >= challenge.maxAttempts) {
    return rejected(
      'ATTEMPTS_EXCEEDED',
      challenge,
      domainError('OTP_ATTEMPTS_EXCEEDED', 'No OTP attempts remain.', {}),
    );
  }

  const attempts = challenge.attempts + 1;
  const attemptedChallenge: OtpChallengeSnapshot = { ...challenge, attempts };
  const validFormat = new RegExp(`^\\d{${OTP_POLICY.digits}}$`).test(input.candidate);
  const matches =
    validFormat &&
    verifySecret(input.candidate, challenge.digest, challengeContext(challenge), input.pepper);

  if (!matches) {
    const attemptsRemaining = challenge.maxAttempts - attempts;
    return rejected(
      attemptsRemaining === 0 ? 'ATTEMPTS_EXCEEDED' : 'INVALID',
      attemptedChallenge,
      domainError(
        attemptsRemaining === 0 ? 'OTP_ATTEMPTS_EXCEEDED' : 'OTP_INVALID',
        attemptsRemaining === 0 ? 'No OTP attempts remain.' : 'The OTP is invalid.',
        { attemptsRemaining },
      ),
    );
  }

  return {
    accepted: true,
    challenge: { ...attemptedChallenge, consumedAt: input.now },
  };
};

export const evaluateOtpResend = (
  lastRequestedAt: string | null,
  now: string,
): { readonly allowed: true } | { readonly allowed: false; readonly retryAfterMs: number } => {
  if (lastRequestedAt === null) return { allowed: true };
  const remaining = OTP_POLICY.resendCooldownMs - (Date.parse(now) - Date.parse(lastRequestedAt));
  return remaining <= 0 ? { allowed: true } : { allowed: false, retryAfterMs: remaining };
};

export const validateOtpProviderForEnvironment = (
  environment: 'development' | 'test' | 'staging' | 'production',
  provider: 'development' | 'external',
): Result<true, DomainError> => {
  if ((environment === 'staging' || environment === 'production') && provider === 'development') {
    return {
      ok: false,
      error: domainError(
        'VALIDATION_FAILED',
        'The development OTP provider is forbidden outside development and test.',
        {},
      ),
    };
  }
  return { ok: true, value: true };
};
