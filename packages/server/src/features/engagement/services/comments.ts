import { type PrismaClient } from '@prisma/client';
import { timeSince } from '../../../compat/django-format.js';
import { sanitizeCommentHtml } from '../../posts/post-html.js';
import { DEFAULT_AVATAR, DbDate, DbInteger, absoluteMediaUrl, isTrue, numberValue } from '../shared.js';

export interface CommentRow {
  id: number;
  textMd: string;
  textHtml: string;
  edited: DbInteger;
  createdDate: DbDate;
  authorId: number | null;
  username: string | null;
  avatar: string | null;
  parentId: number | null;
  likeCount: number | bigint;
  isLiked: DbInteger;
  postId: number;
  postPublic: DbInteger;
  postBlockComment: DbInteger;
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

export async function commentForViewer(
  db: PrismaClient,
  id: number,
  viewerId: number | null,
): Promise<PostCommentRow | null> {
  const viewer = viewerId ?? -1;
  const rows = await db.$queryRaw<PostCommentRow[]>`
    SELECT comment.id AS id,
           comment.text_md AS textMd,
           comment.text_html AS textHtml,
           CAST(comment.edited AS INTEGER) AS edited,
           CAST(comment.created_date AS TEXT) AS createdDate,
           comment.author_id AS authorId,
           author.username AS username,
           profile.avatar AS avatar,
           comment.parent_id AS parentId,
           (SELECT COUNT(*) FROM board_comment_likes AS comment_like
             WHERE comment_like.comment_id = comment.id) AS likeCount,
           CASE WHEN EXISTS (
             SELECT 1 FROM board_comment_likes AS viewer_like
             WHERE viewer_like.comment_id = comment.id AND viewer_like.user_id = ${viewer}
           ) THEN 1 ELSE 0 END AS isLiked,
           post.id AS postId,
           CASE WHEN post.deleted_date IS NULL
                     AND post.published_date IS NOT NULL
                     AND CAST(post.published_date AS TEXT) <= ${new Date().toISOString().replace('T', ' ').replace('Z', '')}
                     AND CAST(post_config.hide AS INTEGER) = 0
                THEN 1 ELSE 0 END AS postPublic,
           post.title AS postTitle, post.url AS postSlug, post_author.username AS postUsername,
           CAST(post_config.block_comment AS INTEGER) AS postBlockComment
    FROM board_comment AS comment
    JOIN board_post AS post ON post.id = comment.post_id
    JOIN auth_user AS post_author ON post_author.id = post.author_id
    JOIN board_postconfig AS post_config ON post_config.post_id = post.id
    LEFT JOIN auth_user AS author ON author.id = comment.author_id
    LEFT JOIN board_profile AS profile ON profile.user_id = author.id
    WHERE comment.id = ${id}
    LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function publicComments(
  db: PrismaClient,
  slug: string,
  viewerId: number | null,
): Promise<{ canComment: boolean; comments: CommentPayload[] }> {
  const posts = await db.$queryRaw<Array<{ id: number; blockComment: DbInteger }>>`
    SELECT post.id AS id, CAST(post_config.block_comment AS INTEGER) AS blockComment
    FROM board_post AS post
    JOIN board_postconfig AS post_config ON post_config.post_id = post.id
    WHERE post.url = ${slug}
      AND post.deleted_date IS NULL
      AND post.published_date IS NOT NULL
      AND CAST(post.published_date AS TEXT) <= ${new Date().toISOString().replace('T', ' ').replace('Z', '')}
      AND CAST(post_config.hide AS INTEGER) = 0
    LIMIT 1
  `;
  const post = posts[0];
  if (!post) return { canComment: false, comments: [] };

  const viewer = viewerId ?? -1;
  const rows = await db.$queryRaw<CommentRow[]>`
    SELECT comment.id AS id,
           comment.text_md AS textMd,
           comment.text_html AS textHtml,
           CAST(comment.edited AS INTEGER) AS edited,
           CAST(comment.created_date AS TEXT) AS createdDate,
           comment.author_id AS authorId,
           author.username AS username,
           profile.avatar AS avatar,
           comment.parent_id AS parentId,
           (SELECT COUNT(*) FROM board_comment_likes AS comment_like
             WHERE comment_like.comment_id = comment.id) AS likeCount,
           CASE WHEN EXISTS (
             SELECT 1 FROM board_comment_likes AS viewer_like
             WHERE viewer_like.comment_id = comment.id AND viewer_like.user_id = ${viewer}
           ) THEN 1 ELSE 0 END AS isLiked,
           comment.post_id AS postId,
           1 AS postPublic,
           CAST(post_config.block_comment AS INTEGER) AS postBlockComment
    FROM board_comment AS comment
    JOIN board_post AS post ON post.id = comment.post_id
    JOIN board_postconfig AS post_config ON post_config.post_id = post.id
    LEFT JOIN auth_user AS author ON author.id = comment.author_id
    LEFT JOIN board_profile AS profile ON profile.user_id = author.id
    WHERE comment.post_id = ${post.id}
      AND (comment.parent_id IS NULL OR comment.parent_id IN (
        SELECT parent.id FROM board_comment AS parent
        WHERE parent.post_id = ${post.id} AND parent.parent_id IS NULL
      ))
    ORDER BY comment.created_date ASC, comment.id ASC
  `;
  const canAcceptReplies = !isTrue(post.blockComment);
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
    : sanitizeCommentHtml(comment.textHtml ?? '');
  return {
    id: comment.id,
    author: deleted ? 'Ghost' : comment.username ?? 'Ghost',
    authorImage: deleted ? null : absoluteMediaUrl(comment.avatar) ?? DEFAULT_AVATAR,
    isMine: mine,
    isEdited: isTrue(comment.edited),
    isDeleted: deleted,
    renderedContent: content,
    createdDate: timeSince(comment.createdDate),
    countLikes: numberValue(comment.likeCount),
    isLiked: isTrue(comment.isLiked),
    permissions: { canEdit, canDelete, canLike, canReply },
    ...(comment.parentId === null ? {} : { parentId: comment.parentId }),
  };
}
