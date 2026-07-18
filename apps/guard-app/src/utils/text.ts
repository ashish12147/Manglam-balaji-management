export function humanizeConstant(value: string): string {
  return value
    .toLowerCase()
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function normalizeSearch(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export function safeFileName(value: string | null | undefined, fallback: string): string {
  const cleaned = value?.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 100);
  return cleaned || fallback;
}
