import { type PrismaClient } from '@prisma/client';
import { CommentPayload, publicComments } from './comments.js';
import { subscriptionState } from './subscriptions.js';
import { ActiveUserRow, AuthorRow, DEFAULT_AVATAR, DbInteger, absoluteMediaUrl, isTrue, numberValue, ownedPost, publicPost, safeHttpUrl } from '../shared.js';

export interface ReaderAuthorHeader {
  id: number;
  username: string;
  name: string;
  avatar: string;
  cover: string | null;
  bio: string;
  homepage: string;
  social: Array<{ id: number; name: string; value: string; order: number }>;
  canSubscribe: boolean;
  isSubscribed: boolean;
}

export interface ReaderPostLikeState {
  countLikes: number;
  isLiked: boolean;
  canLike: boolean;
}

export interface ReaderPostView {
  slug: string;
  viewerAuthenticated: boolean;
  postLike: ReaderPostLikeState;
  author: ReaderAuthorHeader;
  canComment: boolean;
  comments: CommentPayload[];
}

export async function readReaderPostView(
  db: PrismaClient,
  slug: string,
  viewerId: number | null,
  ownerView = false,
): Promise<ReaderPostView | null> {
  const post = ownerView && viewerId !== null ? await ownedPost(db, slug, viewerId) : await publicPost(db, slug);
  if (!post) return null;

  const [author] = await db.$queryRaw<Array<{
    id: number;
    username: string;
    name: string;
    isActive: DbInteger;
    profileRole: string | null;
    bio: string | null;
    avatar: string | null;
    cover: string | null;
    homepage: string | null;
  }>>`
    SELECT author.id, author.username, author.first_name AS name,
           CAST(author.is_active AS INTEGER) AS isActive,
           profile.role AS profileRole, profile.bio AS bio, profile.avatar AS avatar,
           profile.cover AS cover, profile.homepage AS homepage
      FROM auth_user AS author
      LEFT JOIN board_profile AS profile ON profile.user_id = author.id
     WHERE author.id = ${post.authorId}
     LIMIT 1
  `;
  if (!author) return null;

  let viewer: ActiveUserRow | null = null;
  if (viewerId !== null && Number.isSafeInteger(viewerId) && viewerId > 0) {
    const [active] = await db.$queryRaw<ActiveUserRow[]>`
      SELECT id, username, CAST(is_active AS INTEGER) AS isActive
        FROM auth_user
       WHERE id = ${viewerId}
       LIMIT 1
    `;
    if (active && isTrue(active.isActive)) viewer = active;
  }

  const authorRow: AuthorRow = {
    id: author.id,
    username: author.username,
    firstName: author.name,
    isActive: author.isActive,
    profileRole: author.profileRole,
  };
  const subscription = await subscriptionState(db, viewer, authorRow);
  const [countLikes, viewerLike] = await Promise.all([
    db.postLike.count({ where: { postId: post.id } }),
    viewer ? db.postLike.findUnique({ where: { postId_userId: { postId: post.id, userId: viewer.id } }, select: { postId: true } }) : null,
  ]);
  const socialRows = await db.$queryRaw<Array<{ id: number; name: string; value: string; order: number }>>`
    SELECT id, name, value, "order" AS "order"
      FROM board_userlinkmeta
     WHERE user_id = ${author.id}
     ORDER BY "order" ASC, id ASC
  `;
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
      avatar: absoluteMediaUrl(author.avatar) ?? DEFAULT_AVATAR,
      cover: absoluteMediaUrl(author.cover),
      bio: author.bio ?? '',
      homepage: safeHttpUrl(author.homepage),
      social: socialRows
        .filter((link) => safeHttpUrl(link.value) !== '')
        .map((link) => ({ ...link, value: safeHttpUrl(link.value), order: numberValue(link.order) })),
      canSubscribe: subscription.canSubscribe,
      isSubscribed: subscription.isSubscribed,
    },
    canComment: commentState.canComment,
    comments: commentState.comments,
  };
}
