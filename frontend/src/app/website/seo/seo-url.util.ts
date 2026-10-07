export const DEFAULT_SITE_ORIGIN = 'https://www.pcmazing.com';

export function normalizeSiteOrigin(raw: string): string {
  const trimmed = (raw || '').trim().replace(/\/+$/, '');
  return trimmed || DEFAULT_SITE_ORIGIN;
}

/** path must start with / ; strips query/hash */
export function toAbsoluteUrl(origin: string, path: string): string {
  const base = normalizeSiteOrigin(origin);
  const stripped = path.split('?')[0].split('#')[0];
  const clean = (stripped || '/').startsWith('/') ? stripped || '/' : `/${stripped}`;
  if (clean === '/') return base;
  return `${base}${clean}`;
}
