const FINGERPRINT_PATTERN = /^[a-f0-9]{64}$/i;

export function deviceFingerprintHeaders(fingerprint: string | null): Record<string, string> {
  if (!fingerprint || !FINGERPRINT_PATTERN.test(fingerprint)) {
    throw new Error("The request has no valid 32-byte SecureStore device fingerprint.");
  }
  return { "X-Device-Fingerprint": fingerprint };
}

export function protectedIdentityHeaders(input: {
  accessToken: string | null;
  deviceFingerprint: string | null;
  gateId: string | null;
}): Record<string, string> {
  return {
    ...(input.accessToken ? { Authorization: `Bearer ${input.accessToken}` } : {}),
    ...deviceFingerprintHeaders(input.deviceFingerprint),
    ...(input.gateId ? { "X-Gate-ID": input.gateId } : {})
  };
}
