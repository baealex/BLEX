import type { Prisma } from '@prisma/client';

/** Keeps the comment and its author in storage. Readers only see that it was deleted. */
export async function softDeleteComment(db: Prisma.TransactionClient, commentId: number): Promise<void> {
  await db.comment.updateMany({ where: { id: commentId, deletedAt: null }, data: { deletedAt: new Date() } });
}

export async function deleteCommentsForPosts(tx: Prisma.TransactionClient, posts: Prisma.PostWhereInput) {
  const onDeletedPosts = { post: posts } satisfies Prisma.CommentWhereInput;
  // Follow stored cross-post reply chains when deleting a parent.
  const crossPostReplies = new Set<number>();
  let replies = await tx.comment.findMany({
    where: { NOT: onDeletedPosts, parent: onDeletedPosts },
    select: { id: true },
  });
  const batches: number[][] = [];
  while (replies.length) {
    const ids = replies.map(({ id }) => id).filter((id) => !crossPostReplies.has(id));
    for (const id of ids) crossPostReplies.add(id);
    replies = [];
    for (let offset = 0; offset < ids.length; offset += 500) {
      const batch = ids.slice(offset, offset + 500);
      batches.push(batch);
      const children = await tx.comment.findMany({
        where: { NOT: onDeletedPosts, parentId: { in: batch } },
        select: { id: true },
      });
      for (const child of children) replies.push(child);
    }
  }

  // SQLite stops a cascade after 1,000 levels, so flatten every thread first. This also breaks reply cycles.
  await tx.comment.updateMany({ where: { ...onDeletedPosts, parentId: { not: null } }, data: { parentId: null } });
  for (const batch of batches) await tx.comment.updateMany({ where: { id: { in: batch } }, data: { parentId: null } });
  await tx.comment.deleteMany({ where: onDeletedPosts });
  for (const batch of batches) await tx.comment.deleteMany({ where: { id: { in: batch } } });
}
