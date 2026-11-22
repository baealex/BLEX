import type { Prisma } from '@prisma/client';

/**
 * A post anyone may read: published, not future-dated, not hidden, not in the trash, and by an active author.
 * Combine it with another `author` filter through `AND`, because spreading that key would replace this one.
 */
export function publicPostWhere(now: Date = new Date()) {
  return { deletedAt: null, publishedAt: { lte: now }, isHidden: false, author: { isActive: true } } satisfies Prisma.PostWhereInput;
}
