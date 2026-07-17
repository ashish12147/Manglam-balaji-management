const INTERNAL_ROUTE_ROOTS = [
  '/complaints',
  '/daily-help',
  '/emergency',
  '/maintenance',
  '/notices',
  '/notifications',
  '/parcels',
  '/profile',
  '/visitor',
] as const;

export function isSafeInternalRoute(value: string): boolean {
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return false;

  try {
    const url = new URL(value, 'https://resident.invalid');
    if (url.origin !== 'https://resident.invalid') return false;
    return INTERNAL_ROUTE_ROOTS.some(
      (root) => url.pathname === root || url.pathname.startsWith(`${root}/`),
    );
  } catch {
    return false;
  }
}

export function isSecureExternalUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password;
  } catch {
    return false;
  }
}
