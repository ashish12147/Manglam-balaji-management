export function formatDateTime(value: string | null | undefined): string {
  if (!value) return 'Not available';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not available';
  return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return 'Not available';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not available';
  return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(date);
}

export function formatCurrency(amount: string, currency = 'INR'): string {
  const value = Number(amount);
  if (Number.isNaN(value)) return amount;
  return new Intl.NumberFormat('en-IN', { currency, style: 'currency' }).format(value);
}

export function toLocalDateTimeInput(value: Date): string {
  const offset = value.getTimezoneOffset() * 60_000;
  return new Date(value.getTime() - offset).toISOString().slice(0, 16);
}

export function countdownLabel(expiresAt: string | null): string | null {
  if (!expiresAt) return null;
  const milliseconds = new Date(expiresAt).getTime() - Date.now();
  if (milliseconds <= 0) return 'Expired';
  return String(Math.ceil(milliseconds / 60_000)) + ' min remaining';
}
