import type { Prisma, PrismaClient } from '@prisma/client';
import { timeSince } from '../../../platform/date-format.js';
import { publicPostWhere } from '../../posts/data/visibility.js';
import { sanitizeCommentHtml } from '../../posts/post-html.js';
import { DEFAULT_AVATAR, absoluteMediaUrl } from '../shared.js';

export interface CommentRow {
  id: number;
  markdown: string;
  html: string;
  isEdited: boolean;
  createdAt: Date;
  authorId: number | null;
  username: string | null;
  avatar: string | null;
  parentId: number | null;
  likeCount: number;
  isLiked: boolean;
  postId: number;
  postPublic: boolean;
  postBlockComment: boolean;
}

interface PostCommentRow extends CommentRow { postUsername: string; postTitle: string; postSlug: string }

export interface CommentPayload {
  id: number;
  author: string;
  authorImage: string | null;
  isMine: boolean;
  isEdited: boolean;
  isDeleted: boolean;
  renderedContent: string;
  createdDate: string;
  countLikes: number;
  isLiked: boolean;
  permissions: {
    canEdit: boolean;
    canDelete: boolean;
    canLike: boolean;
    canReply: boolean;
  };
  parentId?: number;
  replies?: CommentPayload[];
}

const DEFAULT_LANGUAGE_DELETED_COMMENT = '<p>삭제된 댓글입니다.</p>';

// A percent-encoded Korean character takes nine bytes, so 10,000 characters need about 90 KiB.
export const commentBodyLimit = 128 * 1024;
export const MAX_COMMENT_LENGTH = 10_000;

/** Browsers submit each textarea line break as CRLF, which the field's maxLength counts as one character. */
export function commentTooLong(text: string): boolean {
  return text.replace(/\r\n/g, '\n').length > MAX_COMMENT_LENGTH;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
  })[character] ?? character);
}

export function commentHtml(text: string): string {
  if (!text) return '';
  const paragraphs = text.replace(/\r\n?/g, '\n').split(/\n{2,}/);
  return paragraphs
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, '<br>')}</p>`)
    .join('\n\n');
}

function commentSelect(viewerId: number | null) {
  return {
    id: true,
    markdown: true,
    html: true,
    isEdited: true,
    createdAt: true,
    authorId: true,
    parentId: true,
    postId: true,
    author: { select: { username: true, profile: { select: { avatar: true } } } },
    likes: { where: { userId: viewerId ?? -1 }, select: { userId: true } },
    _count: { select: { likes: true } },
  } satisfies Prisma.CommentSelect;
}

type SelectedComment = Prisma.CommentGetPayload<{ select: ReturnType<typeof commentSelect> }>;

function commentRow(comment: SelectedComment, postPublic: boolean, postBlockComment: boolean): CommentRow {
  return {
    id: comment.id,
    markdown: comment.markdown,
    html: comment.html,
    isEdited: comment.isEdited,
    createdAt: comment.createdAt,
    authorId: comment.authorId,
    username: comment.author?.username ?? null,
    avatar: comment.author?.profile?.avatar ?? null,
    parentId: comment.parentId,
    likeCount: comment._count.likes,
    isLiked: comment.likes.length > 0,
    postId: comment.postId,
    postPublic,
    postBlockComment,
  };
}

export async function commentForViewer(
  db: PrismaClient,
  id: number,
  viewerId: number | null,
): Promise<PostCommentRow | null> {
  const comment = await db.comment.findUnique({ where: { id }, select: commentSelect(viewerId) });
  if (!comment) return null;
  const post = await db.post.findUnique({
    where: { id: comment.postId },
    select: {
      title: true, slug: true, commentsBlocked: true, deletedAt: true, publishedAt: true, isHidden: true,
      author: { select: { username: true, isActive: true } },
    },
  });
  if (!post) return null;
  const postPublic = post.author.isActive && post.deletedAt === null && post.publishedAt !== null && post.publishedAt <= new Date() && !post.isHidden;
  return {
    ...commentRow(comment, postPublic, post.commentsBlocked),
    postTitle: post.title,
    postSlug: post.slug,
    postUsername: post.author.username,
  };
}

export async function publicComments(
  db: PrismaClient,
  slug: string,
  viewerId: number | null,
): Promise<{ canComment: boolean; comments: CommentPayload[] }> {
  const post = await db.post.findFirst({
    where: { slug, ...publicPostWhere() },
    select: { id: true, commentsBlocked: true },
  });
  if (!post) return { canComment: false, comments: [] };

  const blocked = post.commentsBlocked;
  const comments = await db.comment.findMany({
    // A legacy reply can point at a parent on another post or at another reply. Neither has a place in this tree.
    where: { postId: post.id, OR: [{ parentId: null }, { parent: { postId: post.id, parentId: null } }] },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    select: commentSelect(viewerId),
  });
  const rows = comments.map((comment) => commentRow(comment, true, blocked));
  const canAcceptReplies = !blocked;
  const topLevel: CommentPayload[] = [];
  const parents = new Map<number, CommentPayload>();

  for (const row of rows) {
    const payload = serializeComment(row, viewerId, canAcceptReplies);
    if (row.parentId === null) {
      payload.replies = [];
      parents.set(row.id, payload);
      topLevel.push(payload);
    } else {
      payload.parentId = row.parentId;
      parents.get(row.parentId)?.replies?.push(payload);
    }
  }

  return { canComment: canAcceptReplies, comments: topLevel };
}

export function serializeComment(
  comment: CommentRow,
  viewerId: number | null,
  canAcceptReplies: boolean,
): CommentPayload {
  const deleted = comment.authorId === null;
  const mine = viewerId !== null && comment.authorId === viewerId;
  const canLike = viewerId !== null && !mine && !deleted;
  const canEdit = mine && !deleted;
  const canDelete = mine && !deleted;
  const canReply = viewerId !== null && !deleted && canAcceptReplies;
  const content = deleted
    ? DEFAULT_LANGUAGE_DELETED_COMMENT
    : sanitizeCommentHtml(comment.html);
  return {
    id: comment.id,
    author: deleted ? 'Ghost' : comment.username ?? 'Ghost',
    authorImage: deleted ? null : absoluteMediaUrl(comment.avatar) ?? DEFAULT_AVATAR,
    isMine: mine,
    isEdited: comment.isEdited,
    isDeleted: deleted,
    renderedContent: content,
    createdDate: timeSince(comment.createdAt),
    countLikes: comment.likeCount,
    isLiked: comment.isLiked,
    permissions: { canEdit, canDelete, canLike, canReply },
    ...(comment.parentId === null ? {} : { parentId: comment.parentId }),
  };
}
