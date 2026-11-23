const WINDOWS = [
  { durationMs: 60_000, limit: 10 },
  { durationMs: 86_400_000, limit: 200 },
];
const MAX_TRACKED_ACCOUNTS = 10_000;

/** Counts new comments per account. Deleting a comment does not give the allowance back. */
export function createCommentRateLimiter(now: () => number = Date.now) {
  const accounts = new Map<number, Array<{ resetAt: number; count: number }>>();

  /** Records one comment and returns how many seconds to wait, or null when it may proceed. */
  return function take(accountId: number): number | null {
    const time = now();
    const counters = accounts.get(accountId) ?? WINDOWS.map(() => ({ resetAt: 0, count: 0 }));
    let wait = 0;
    WINDOWS.forEach(({ durationMs, limit }, index) => {
      const counter = counters[index]!;
      if (time >= counter.resetAt) {
        counter.resetAt = time + durationMs;
        counter.count = 0;
      }
      if (counter.count >= limit) wait = Math.max(wait, Math.ceil((counter.resetAt - time) / 1000));
    });
    if (!wait) for (const counter of counters) counter.count += 1;
    accounts.delete(accountId);
    accounts.set(accountId, counters);
    if (accounts.size > MAX_TRACKED_ACCOUNTS) accounts.delete(accounts.keys().next().value as number);
    return wait ? Math.max(1, wait) : null;
  };
}
