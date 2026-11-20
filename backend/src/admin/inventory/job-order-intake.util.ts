export const JO_ACCESSORY_KEYS = [
  'laptop_unit',
  'desktop_pc',
  'printers',
  'iphone',
  'android',
  'charger',
  'battery',
  'memory_ram',
  'storage',
  'mouse',
  'keyboard',
  'bag_case',
  'optical_drive',
  'cables',
  'others',
] as const;

export type JoAccessoryKey = (typeof JO_ACCESSORY_KEYS)[number];

export type ServiceArrangement = 'in_store' | 'onsite_home' | 'onsite_office';
export type DeviceType =
  | 'laptop'
  | 'desktop'
  | 'printer'
  | 'iphone'
  | 'android'
  | 'others';
export type UnitCondition = 'good' | 'minor' | 'defective' | 'others';

const SERVICE_ARRANGEMENTS = new Set<string>([
  'in_store',
  'onsite_home',
  'onsite_office',
]);
const DEVICE_TYPES = new Set<string>([
  'laptop',
  'desktop',
  'printer',
  'iphone',
  'android',
  'others',
]);
const UNIT_CONDITIONS = new Set<string>([
  'good',
  'minor',
  'defective',
  'others',
]);
const ACCESSORY_KEY_SET = new Set<string>(JO_ACCESSORY_KEYS);

export function normalizeServiceArrangement(
  value?: string | null,
): ServiceArrangement | null {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase();
  if (!normalized) {
    return null;
  }
  return SERVICE_ARRANGEMENTS.has(normalized)
    ? (normalized as ServiceArrangement)
    : null;
}

export function normalizeDeviceType(value?: string | null): DeviceType | null {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase();
  if (!normalized) {
    return null;
  }
  return DEVICE_TYPES.has(normalized) ? (normalized as DeviceType) : null;
}

export function normalizeUnitCondition(
  value?: string | null,
): UnitCondition | null {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase();
  if (!normalized) {
    return null;
  }
  return UNIT_CONDITIONS.has(normalized)
    ? (normalized as UnitCondition)
    : null;
}

export function normalizeAccessories(input?: string[] | null): string[] {
  if (!Array.isArray(input) || input.length === 0) {
    return [];
  }
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of input) {
    const key = String(raw ?? '')
      .trim()
      .toLowerCase();
    if (!ACCESSORY_KEY_SET.has(key) || seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(key);
  }
  return result;
}

export function mapJobStatusToFormChecks(status: string): {
  pending: boolean;
  inProgress: boolean;
  forRelease: boolean;
  completed: boolean;
} {
  const normalized = String(status ?? '')
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ');

  const completed =
    normalized === 'done' ||
    normalized === 'completed' ||
    normalized === 'complete';
  const forRelease =
    normalized === 'for release' ||
    normalized === 'forrelease' ||
    normalized === 'ready for release';
  const inProgress =
    normalized === 'in progress' ||
    normalized === 'inprogress' ||
    normalized === 'ongoing' ||
    normalized === 'processing';
  const pending =
    !completed &&
    !forRelease &&
    !inProgress &&
    (normalized === 'pending' ||
      normalized === 'new' ||
      normalized === 'open' ||
      normalized === '');

  return {
    pending: pending || (!completed && !forRelease && !inProgress),
    inProgress,
    forRelease,
    completed,
  };
}
