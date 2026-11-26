/** Session-only UI state for restoring the current ATS view after refresh. */
export function readViewState<T>(key: string, fallback: T, allowed?: readonly T[]): T {
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return fallback;
    const value = JSON.parse(raw) as T;
    if (allowed && !allowed.includes(value)) return fallback;
    return value;
  } catch {
    return fallback;
  }
}

export function writeViewState(key: string, value: unknown): void {
  try {
    window.sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage can be unavailable in private browsing; the ATS view still works.
  }
}
