export function moveColumn<T>(order: T[], fromKey: T, toKey: T): T[] {
  if (fromKey === toKey) {
    return order;
  }

  const fromIndex = order.indexOf(fromKey);
  const toIndex = order.indexOf(toKey);
  if (fromIndex < 0 || toIndex < 0) {
    return order;
  }

  const next = [...order];
  const [item] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, item);
  return next;
}

export function loadColumnOrder<T extends string>(storageKey: string, defaults: readonly T[]): T[] {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) {
      return [...defaults];
    }

    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [...defaults];
    }

    const allowed = new Set(defaults);
    const next = parsed.filter((key): key is T => typeof key === 'string' && allowed.has(key as T));
    for (const key of defaults) {
      if (!next.includes(key)) {
        next.push(key);
      }
    }
    return next;
  } catch {
    return [...defaults];
  }
}

export function saveColumnOrder(storageKey: string, order: readonly string[]): void {
  try {
    localStorage.setItem(storageKey, JSON.stringify(order));
  } catch {
    // Ignore storage failures (private mode, quota, etc.).
  }
}
