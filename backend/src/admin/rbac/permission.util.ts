import { allPermissionKeys } from './permission-catalog';

const knownKeysCache = new Set<string>();

function knownKeys(): Set<string> {
  if (knownKeysCache.size === 0) {
    for (const key of allPermissionKeys()) {
      knownKeysCache.add(key);
    }
  }
  return knownKeysCache;
}

export function hasPermission(keys: string[] | 'all', required: string | string[]): boolean {
  if (keys === 'all' || (Array.isArray(keys) && keys.includes('*'))) {
    return true;
  }
  const need = Array.isArray(required) ? required : [required];
  const set = new Set(keys);
  return need.every((key) => set.has(key));
}

export function isKnownPermissionKey(key: string): boolean {
  return knownKeys().has(key);
}

export function slugifyRoleName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}
