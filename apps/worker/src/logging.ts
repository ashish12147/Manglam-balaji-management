const SECRET_KEY = /(authorization|cookie|password|secret|token|key|code|phone|email|encrypted)/i;

function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => [
      key,
      SECRET_KEY.test(key) ? '[REDACTED]' : redact(item),
    ]),
  );
}

export interface Logger {
  error(event: string, attributes?: Record<string, unknown>): void;
  info(event: string, attributes?: Record<string, unknown>): void;
  warn(event: string, attributes?: Record<string, unknown>): void;
}

export function createLogger(workerId: string): Logger {
  const write = (level: string, event: string, attributes?: Record<string, unknown>) => {
    process.stdout.write(
      `${JSON.stringify({ level, event, workerId, at: new Date().toISOString(), ...(redact(attributes ?? {}) as Record<string, unknown>) })}\n`,
    );
  };
  return {
    error: (event, attributes) => write('error', event, attributes),
    info: (event, attributes) => write('info', event, attributes),
    warn: (event, attributes) => write('warn', event, attributes),
  };
}
