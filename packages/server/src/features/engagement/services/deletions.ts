import type { Prisma } from '@prisma/client';

export async function anonymizeComments(
  db: Prisma.TransactionClient,
  authorId: number,
  commentId?: number,
): Promise<void> {
  const where = commentId === undefined ? { author_id: authorId } : { author_id: authorId, id: commentId };
  await db.board_comment.updateMany({ where, data: { author_id: null } });
}

export async function deleteCommentsForPosts(tx: Prisma.TransactionClient, posts: Prisma.PostWhereInput) {
  const onDeletedPosts = { board_post: posts } satisfies Prisma.board_commentWhereInput;
  // Legacy replies can point to a parent on a different post. Follow the
  // thread across those posts, as Django did when deleting a parent.
  const crossPostReplies = new Set<number>();
  let replies = await tx.board_comment.findMany({
    where: { NOT: onDeletedPosts, board_comment: onDeletedPosts },
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
      const children = await tx.board_comment.findMany({
        where: { NOT: onDeletedPosts, parent_id: { in: batch } },
        select: { id: true },
      });
      for (const child of children) replies.push(child);
    }
  }

  // Detach the cross-post replies before deleting in batches, including any
  // cycles. The comments on the deleted posts go in a single statement.
  for (const batch of batches) {
    await tx.board_comment.updateMany({ where: { id: { in: batch } }, data: { parent_id: null } });
    await tx.board_comment_likes.deleteMany({ where: { comment_id: { in: batch } } });
  }
  await tx.board_comment_likes.deleteMany({ where: { board_comment: onDeletedPosts } });
  await tx.board_comment.deleteMany({ where: onDeletedPosts });
  for (const batch of batches) await tx.board_comment.deleteMany({ where: { id: { in: batch } } });
}
