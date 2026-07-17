import { createHash } from 'node:crypto';

function normalize(value: unknown): unknown {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === 'bigint') {
    return value.toString();
  }

  if (Array.isArray(value)) {
    return value.map(normalize);
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, normalize(item)]),
    );
  }

  return value;
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(normalize(value));
}

export function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

export function requestHash(value: unknown): string {
  return sha256(canonicalJson(value));
}
