type Entry<T> = { data: T; cachedAt: number };
const store = new Map<string, Entry<unknown>>();

export function getCached<T>(key: string, ttlMs: number): T | null {
  const entry = store.get(key) as Entry<T> | undefined;
  if (!entry) return null;
  if (Date.now() - entry.cachedAt > ttlMs) return null;
  return entry.data;
}

export function setCached<T>(key: string, data: T): void {
  store.set(key, { data, cachedAt: Date.now() });
}

export function invalidateCache(...keys: string[]): void {
  keys.forEach((k) => store.delete(k));
}
