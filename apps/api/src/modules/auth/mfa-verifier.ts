export const MFA_VERIFIER = Symbol('MFA_VERIFIER');

export interface MfaVerificationRequest {
  readonly code: string;
  readonly userId: string;
}

export interface MfaVerifier {
  verify(request: MfaVerificationRequest): Promise<boolean>;
}
