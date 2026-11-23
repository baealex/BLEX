import type {
  ReaderAuthorHeader,
  ReaderPostLikeState,
  ReaderPostView,
} from '../../../../../client/src/contracts/engagement.js';
import { type PrismaClient } from '@prisma/client';
import { publicComments } from './comments.js';
import { subscriptionState } from './subscriptions.js';
import {
  ActiveUserRow,
  AuthorRow,
  DEFAULT_AVATAR,
  absoluteMediaUrl,
  ownedPost,
  publicPost,
  safeHttpUrl,
} from '../shared.js';

export type { ReaderAuthorHeader, ReaderPostLikeState, ReaderPostView };

export async function readReaderPostView(
  db: PrismaClient,
  slug: string,
  viewerId: number | null,
  ownerView = false,
): Promise<ReaderPostView | null> {
  const post = ownerView && viewerId !== null ? await ownedPost(db, slug, viewerId) : await publicPost(db, slug);
  if (!post) return null;

  const author = await db.user.findUnique({
    where: { id: post.authorId },
    select: {
      id: true,
      username: true,
      name: true,
      isActive: true,
      profile: { select: { role: true, bio: true, avatar: true, cover: true, homepage: true } },
    },
  });
  if (!author) return null;

  let viewer: ActiveUserRow | null = null;
  if (viewerId !== null && Number.isSafeInteger(viewerId) && viewerId > 0) {
    viewer = await db.user.findFirst({
      where: { id: viewerId, isActive: true },
      select: { id: true, username: true, isActive: true },
    });
  }

  const authorRow: AuthorRow = {
    id: author.id,
    username: author.username,
    firstName: author.name,
    isActive: author.isActive,
    profileRole: author.profile?.role ?? null,
  };
  const subscription = await subscriptionState(db, viewer, authorRow);
  const [countLikes, viewerLike] = await Promise.all([
    db.postLike.count({ where: { postId: post.id } }),
    viewer
      ? db.postLike.findUnique({
          where: { postId_userId: { postId: post.id, userId: viewer.id } },
          select: { postId: true },
        })
      : null,
  ]);
  const socialRows = await db.socialLink.findMany({
    where: { userId: author.id },
    orderBy: [{ order: 'asc' }, { id: 'asc' }],
    select: { id: true, platform: true, url: true, order: true },
  });
  const commentState = await publicComments(db, slug, viewer?.id ?? null);

  return {
    slug,
    viewerAuthenticated: viewer !== null,
    postLike: {
      countLikes,
      isLiked: viewerLike !== null,
      canLike: viewer !== null,
    },
    author: {
      id: author.id,
      username: author.username,
      name: author.name || author.username,
      avatar: absoluteMediaUrl(author.profile?.avatar) ?? DEFAULT_AVATAR,
      cover: absoluteMediaUrl(author.profile?.cover),
      bio: author.profile?.bio ?? '',
      homepage: safeHttpUrl(author.profile?.homepage ?? null),
      social: socialRows
        .filter((link) => safeHttpUrl(link.url) !== '')
        .map((link) => ({ id: link.id, name: link.platform, value: safeHttpUrl(link.url), order: link.order })),
      canSubscribe: subscription.canSubscribe,
      isSubscribed: subscription.isSubscribed,
    },
    canComment: commentState.canComment,
    comments: commentState.comments,
    totalComments: commentState.totalComments,
    olderCommentsCursor: commentState.olderCommentsCursor,
  };
}
