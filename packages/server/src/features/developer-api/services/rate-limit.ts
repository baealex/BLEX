export type DeveloperRequestKind = 'read' | 'write';

export interface DeveloperRateLimit {
  read: number;
  write: number;
  windowMs: number;
  /** Keeps memory flat however many tokens are active; the oldest window is dropped first. */
  maxTrackedWindows: number;
  now: () => number;
}

const defaultRateLimit: DeveloperRateLimit = {
  read: 120,
  write: 30,
  windowMs: 60_000,
  maxTrackedWindows: 5_000,
  // Monotonic, so a wall-clock adjustment cannot stretch a window.
  now: () => performance.now(),
};

export function developerRequestKind(method: string): DeveloperRequestKind {
  return method === 'GET' || method === 'HEAD' ? 'read' : 'write';
}

/** Counts each token's reads and writes in separate fixed windows held in memory. */
export function createDeveloperRateLimiter(overrides: Partial<DeveloperRateLimit> = {}) {
  const limits = { ...defaultRateLimit, ...overrides };
  // Windows are inserted as they open, so iteration runs from the oldest to the newest.
  const windows = new Map<string, { resetAt: number; count: number }>();

  /** Records one request and returns how many seconds to wait, or null when it may proceed. */
  return function take(tokenId: number, kind: DeveloperRequestKind): number | null {
    const now = limits.now();
    const key = `${tokenId}:${kind}`;
    const current = windows.get(key);
    if (current && now < current.resetAt) {
      if (current.count >= limits[kind]) return Math.max(1, Math.ceil((current.resetAt - now) / 1_000));
      current.count += 1;
      return null;
    }

    windows.delete(key);
    for (const [oldestKey, oldest] of windows) {
      if (now < oldest.resetAt && windows.size < limits.maxTrackedWindows) break;
      windows.delete(oldestKey);
    }
    windows.set(key, { resetAt: now + limits.windowMs, count: 1 });
    return null;
  };
}
