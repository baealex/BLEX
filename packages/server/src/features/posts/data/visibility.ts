import type { Prisma } from '@prisma/client';

/** A post anyone may read: published, not future-dated, not hidden, and not in the trash. */
export function publicPostWhere(now: Date = new Date()) {
  return { deletedAt: null, publishedAt: { lte: now }, isHidden: false } satisfies Prisma.PostWhereInput;
}
