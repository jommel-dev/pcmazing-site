const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

export async function fetchText(
  url: string,
  options: { timeoutMs: number; accept?: string } = { timeoutMs: 8000 },
): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: options.accept ?? 'text/html,application/json;q=0.9,*/*;q=0.8',
        'User-Agent': DEFAULT_USER_AGENT,
        'Accept-Language': 'en-PH,en;q=0.9',
      },
      redirect: 'follow',
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchJson<T>(
  url: string,
  timeoutMs: number,
): Promise<T> {
  const text = await fetchText(url, {
    timeoutMs,
    accept: 'application/json,text/plain,*/*',
  });
  return JSON.parse(text) as T;
}

export function parsePhpPrice(raw: string | number | null | undefined): number | null {
  if (raw == null) {
    return null;
  }
  if (typeof raw === 'number') {
    return Number.isFinite(raw) && raw >= 0 ? Math.round(raw * 100) / 100 : null;
  }
  const cleaned = String(raw)
    .replace(/[₱PhpPHP,\s]/gi, '')
    .replace(/[^\d.]/g, '');
  const value = Number(cleaned);
  return Number.isFinite(value) && value >= 0 ? Math.round(value * 100) / 100 : null;
}

export function absolutizeUrl(baseOrigin: string, pathOrUrl: string): string {
  try {
    return new URL(pathOrUrl, baseOrigin).toString();
  } catch {
    return pathOrUrl;
  }
}
