import type { Prisma } from '@prisma/client';
import { deleteCommentsForPosts } from '../../engagement/services/deletions.js';

export async function deleteTrashedPost(
  tx: Prisma.TransactionClient,
  id: number,
  authorId: number,
  deletedDate: string | Date,
): Promise<boolean> {
  // The original Django timestamp can have microsecond precision and is
  // compared as stored until the timestamp columns are migrated.
  const [current] = await tx.$queryRaw<Array<{ id: number }>>`
    SELECT id FROM board_post WHERE id = ${id} AND author_id = ${authorId} AND deleted_date = ${deletedDate}
  `;
  return Boolean(current) && await deletePosts(tx, { id, authorId }) === 1;
}

export async function deletePostRevisions(
  tx: Prisma.TransactionClient,
  where: Prisma.board_edithistoryWhereInput,
): Promise<number> {
  await tx.board_edithistory.updateMany({
    where: { board_edithistory: where },
    data: { restored_from_id: null },
  });
  return (await tx.board_edithistory.deleteMany({ where })).count;
}

/** Applies the Django-era delete rules before removing the posts themselves. */
export async function deletePosts(tx: Prisma.TransactionClient, where: Prisma.PostWhereInput): Promise<number> {
  const related = { board_post: where };
  await tx.board_post_share_link_daily_counts.deleteMany({ where: { board_postsharelink: related } });
  await tx.board_postsharelink.deleteMany({ where: related });
  await deleteCommentsForPosts(tx, where);
  await tx.postContent.deleteMany({ where: { post: where } });
  await tx.postConfig.deleteMany({ where: { post: where } });
  await tx.board_postconfigmeta.deleteMany({ where: related });
  await tx.board_post_tags.deleteMany({ where: related });
  await tx.board_pinnedpost.deleteMany({ where: related });
  await tx.board_post_likes.deleteMany({ where: related });
  await deletePostRevisions(tx, related);
  await tx.board_editrequest.deleteMany({ where: related });
  return (await tx.post.deleteMany({ where })).count;
}
