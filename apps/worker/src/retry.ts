const MAXIMUM_RETRY_DELAY_MS = 3_600_000;

export function retryDelayMs(attempt: number, random: () => number = Math.random): number {
  if (!Number.isSafeInteger(attempt) || attempt < 1) {
    throw new Error('attempt must be a positive integer.');
  }
  const jitter = random();
  if (!Number.isFinite(jitter) || jitter < 0 || jitter > 1) {
    throw new Error('random jitter must be between zero and one.');
  }
  const exponential = Math.min(MAXIMUM_RETRY_DELAY_MS, 1_000 * 2 ** (attempt - 1));
  return Math.min(MAXIMUM_RETRY_DELAY_MS, Math.floor(exponential * (0.5 + jitter)));
}

export function errorCode(error: unknown): string {
  const explicitCode =
    error && typeof error === 'object' && 'code' in error
      ? (error as { code?: unknown }).code
      : undefined;
  const raw =
    typeof explicitCode === 'string' && explicitCode.length > 0
      ? explicitCode
      : error instanceof Error && error.name !== 'Error'
        ? error.name
        : 'WORKER_FAILURE';
  return (
    raw
      .replace(/[^A-Za-z0-9_]/g, '_')
      .toUpperCase()
      .slice(0, 80) || 'WORKER_FAILURE'
  );
}

export function errorDetail(_error: unknown): string {
  return 'Worker handler failed; inspect secret-safe logs using the outbox event id.';
}
