import type { Prisma } from '@prisma/client';
import { deleteCommentsForPosts } from '../../engagement/services/deletions.js';

export async function deleteTrashedPost(
  tx: Prisma.TransactionClient,
  id: number,
  authorId: number,
  deletedAt: Date,
): Promise<boolean> {
  const current = await tx.post.findFirst({ where: { id, authorId, deletedAt }, select: { id: true } });
  return Boolean(current) && await deletePosts(tx, { id, authorId }) === 1;
}

/** Schema cascades remove everything a post owns. Comment threads go first because they can be deep or cross posts. */
export async function deletePosts(tx: Prisma.TransactionClient, where: Prisma.PostWhereInput): Promise<number> {
  await deleteCommentsForPosts(tx, where);
  return (await tx.post.deleteMany({ where })).count;
}
