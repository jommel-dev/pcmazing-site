export type DatePeriod = 'daily' | 'weekly' | 'monthly' | 'custom';

export type SavedPeriodFilter = {
  period: DatePeriod;
  startDate?: string;
  endDate?: string;
};

const PERIODS: readonly DatePeriod[] = ['daily', 'weekly', 'monthly', 'custom'];

export function loadPeriodFilter(storageKey: string, defaultPeriod: DatePeriod = 'weekly'): SavedPeriodFilter {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) {
      return { period: defaultPeriod };
    }

    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return { period: defaultPeriod };
    }

    const record = parsed as { period?: unknown; startDate?: unknown; endDate?: unknown };
    const period = PERIODS.includes(record.period as DatePeriod) ? (record.period as DatePeriod) : defaultPeriod;
    const startDate = typeof record.startDate === 'string' ? record.startDate : '';
    const endDate = typeof record.endDate === 'string' ? record.endDate : '';

    return { period, startDate, endDate };
  } catch {
    return { period: defaultPeriod };
  }
}

export function savePeriodFilter(storageKey: string, filter: SavedPeriodFilter): void {
  try {
    localStorage.setItem(storageKey, JSON.stringify(filter));
  } catch {
    // Ignore storage failures (private mode, quota, etc.).
  }
}
