const redactedValue = '[REDACTED]';

const sensitiveKeyPattern =
  /authorization|cookie|credential|otp|password|pin|private.?key|secret|token/i;

export function redactSensitiveValues(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => redactSensitiveValues(item));
  }

  if (value === null || typeof value !== 'object') {
    return value;
  }

  const redacted: Record<string, unknown> = {};

  for (const [key, item] of Object.entries(value)) {
    redacted[key] = sensitiveKeyPattern.test(key) ? redactedValue : redactSensitiveValues(item);
  }

  return redacted;
}
