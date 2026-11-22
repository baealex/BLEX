import type { Prisma } from '@prisma/client';

/** A post anyone may read: published, not future-dated, not hidden, and not in the trash. */
export function publicPostWhere(now: Date = new Date()) {
  return { deletedAt: null, publishedAt: { lte: now }, isHidden: false } satisfies Prisma.PostWhereInput;
}

/**
 * The same rule for surfaces that never included an imported 3.x post without a settings row:
 * reader actions, activity, related posts, series navigation, share links, and announcements.
 */
export function settledPublicPostWhere(now: Date = new Date()) {
  return { ...publicPostWhere(now), hasSettings: true } satisfies Prisma.PostWhereInput;
}
