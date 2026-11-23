import type { CommentPayload } from '../../../../../client/src/contracts/engagement.js';
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

interface PostCommentRow extends CommentRow {
  postUsername: string;
  postTitle: string;
  postSlug: string;
}

export type { CommentPayload };

const DEFAULT_LANGUAGE_DELETED_COMMENT = '<p>삭제된 댓글입니다.</p>';

// A percent-encoded Korean character takes nine bytes, so 10,000 characters need about 90 KiB.
export const commentBodyLimit = 128 * 1024;
export const MAX_COMMENT_LENGTH = 10_000;

/**
 * Browsers submit each textarea line break as CRLF, which the field's maxLength counts as one character.
 * The reply form prefixes its target's mention after that limit applies.
 */
export function commentTooLong(text: string): boolean {
  return text.replace(/\r\n/g, '\n').replace(/^@[^\s@]{1,64}\s/, '').length > MAX_COMMENT_LENGTH;
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#x27;',
      })[character] ?? character,
  );
}

export function commentHtml(text: string): string {
  if (!text) return '';
  const paragraphs = text.replace(/\r\n?/g, '\n').split(/\n{2,}/);
  return paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, '<br>')}</p>`).join('\n\n');
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
      title: true,
      slug: true,
      commentsBlocked: true,
      deletedAt: true,
      publishedAt: true,
      isHidden: true,
      moderation: true,
      author: { select: { username: true, isActive: true } },
    },
  });
  if (!post) return null;
  const postPublic =
    post.author.isActive &&
    post.deletedAt === null &&
    post.publishedAt !== null &&
    post.publishedAt <= new Date() &&
    !post.isHidden &&
    post.moderation === null;
  return {
    ...commentRow(comment, postPublic, post.commentsBlocked),
    postTitle: post.title,
    postSlug: post.slug,
    postUsername: post.author.username,
  };
}

// Comments load newest first in pages, so one busy post cannot make every view read all of its text.
const COMMENT_PAGE_ROWS = 100;
const COMMENT_PAGE_BYTES = 512 * 1024;
const COMMENT_BATCH_ROWS = 20;

export interface PublicCommentPage {
  canComment: boolean;
  comments: CommentPayload[];
  totalComments: number;
  olderCommentsCursor: number | null;
}

export async function publicComments(
  db: PrismaClient,
  slug: string,
  viewerId: number | null,
  before: number | null = null,
): Promise<PublicCommentPage> {
  const post = await db.post.findFirst({
    where: { slug, ...publicPostWhere() },
    select: { id: true, commentsBlocked: true },
  });
  if (!post) return { canComment: false, comments: [], totalComments: 0, olderCommentsCursor: null };

  const blocked = post.commentsBlocked;
  // A legacy reply can point at a parent on another post or at another reply. Neither has a place in this tree.
  const where: Prisma.CommentWhereInput = {
    postId: post.id,
    OR: [{ parentId: null }, { parent: { postId: post.id, parentId: null } }],
  };
  const select = commentSelect(viewerId);
  const totalComments = await db.comment.count({ where });
  const loaded = new Map<number, SelectedComment>();
  let bytes = 0;
  let rows = 0;
  let cursor = before;
  let hasOlder = false;
  const keep = (comment: SelectedComment) => {
    if (loaded.has(comment.id)) return;
    loaded.set(comment.id, comment);
    bytes += comment.html.length;
  };
  do {
    const batch = await db.comment.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: COMMENT_BATCH_ROWS + 1,
      ...(cursor === null ? {} : { cursor: { id: cursor }, skip: 1 }),
      select,
    });
    hasOlder = batch.length > COMMENT_BATCH_ROWS;
    const page = batch.slice(0, COMMENT_BATCH_ROWS);
    page.forEach(keep);
    rows += page.length;
    const parentIds = new Set(
      page.flatMap(({ parentId }) => (parentId !== null && !loaded.has(parentId) ? [parentId] : [])),
    );
    if (parentIds.size) {
      const parents = await db.comment.findMany({ where: { id: { in: [...parentIds] }, postId: post.id }, select });
      parents.forEach(keep);
    }
    cursor = page.at(-1)?.id ?? cursor;
  } while (hasOlder && rows < COMMENT_PAGE_ROWS && bytes < COMMENT_PAGE_BYTES);

  const ordered = [...loaded.values()].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id - b.id);
  const canAcceptReplies = !blocked;
  const topLevel: CommentPayload[] = [];
  const parents = new Map<number, CommentPayload>();

  for (const row of ordered.map((comment) => commentRow(comment, true, blocked))) {
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

  return {
    canComment: canAcceptReplies,
    comments: topLevel,
    totalComments,
    olderCommentsCursor: hasOlder ? cursor : null,
  };
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
  const content = deleted ? DEFAULT_LANGUAGE_DELETED_COMMENT : sanitizeCommentHtml(comment.html);
  return {
    id: comment.id,
    author: deleted ? 'Ghost' : (comment.username ?? 'Ghost'),
    authorImage: deleted ? null : (absoluteMediaUrl(comment.avatar) ?? DEFAULT_AVATAR),
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
