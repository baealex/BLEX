import formBody from '@fastify/formbody';
import { Prisma, type PrismaClient } from '@prisma/client';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { createNotification } from '../notifications/model.js';
import { timeSince } from '../django-format.js';
import { sanitizeCommentHtml } from '../post-html.js';
import { publicPostPath } from '../posts.js';

export interface ReaderActionUser {
  id: number;
  username: string;
}

export interface ReaderActionsOptions {
  currentUser: (req: FastifyRequest) => Promise<ReaderActionUser | null>;
  validateCsrf: (req: FastifyRequest) => boolean;
}

type DbInteger = number | bigint | boolean | null;
type DbDate = string | Date | null;

interface ActiveUserRow {
  id: number;
  username: string;
  isActive: DbInteger;
}

interface PostRow {
  id: number;
  authorId: number;
  authorUsername: string;
  title: string;
  slug: string;
  blockComment: DbInteger;
}

interface CommentRow {
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

interface AuthorRow {
  id: number;
  username: string;
  firstName: string;
  isActive: DbInteger;
  profileRole: string | null;
}

interface SubscriptionRow {
  id: number;
  username: string;
  firstName: string;
  bio: string | null;
  avatar: string | null;
  isActive: DbInteger;
  profileRole: string | null;
  createdDate: DbDate;
}

interface TelegramRow {
  telegramEnabled: DbInteger;
  botUsername: string;
}

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

const DEFAULT_AVATAR = '/resources/assets/images/default-avatar.jpg';
const DEFAULT_LANGUAGE_DELETED_COMMENT = '<p>삭제된 댓글입니다.</p>';
// A percent-encoded Korean character takes nine bytes, so 10,000 characters need about 90 KiB.
const commentBodyLimit = 128 * 1024;

function done(body: object = {}): Record<string, unknown> {
  return { status: 'DONE', body };
}

function error(code: string, message = ''): Record<string, unknown> {
  return { status: 'ERROR', errorCode: `error:${code}`, errorMessage: message };
}

function numberValue(value: DbInteger | number | bigint): number {
  return Number(value ?? 0);
}

function isTrue(value: DbInteger): boolean {
  return numberValue(value) !== 0;
}

function absoluteMediaUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  return `/resources/media/${path.replace(/^\/+/, '')}`;
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

function commentHtml(text: string): string {
  if (!text) return '';
  const paragraphs = text.replace(/\r\n?/g, '\n').split(/\n{2,}/);
  return paragraphs
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, '<br>')}</p>`)
    .join('\n\n');
}

function asBodyObject(body: unknown): Record<string, unknown> | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  return body as Record<string, unknown>;
}

function textValue(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value === null || value === undefined) return '';
  return String(value);
}

function bodyField(body: Record<string, unknown> | null, key: string): string {
  if (!body) return '';
  const value = body[key];
  if (Array.isArray(value)) return textValue(value.at(-1));
  return textValue(value);
}

function truthyBodyField(body: Record<string, unknown> | null, key: string): boolean {
  if (!body) return false;
  const value = body[key];
  if (Array.isArray(value)) return truthyBodyField({ [key]: value.at(-1) }, key);
  return Boolean(value);
}

function parseStoredDate(value: DbDate): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  const normalized = value.includes('T') ? value : value.replace(' ', 'T');
  const date = new Date(/(?:Z|[+-]\d\d:\d\d)$/i.test(normalized) ? normalized : `${normalized}Z`);
  return Number.isNaN(date.valueOf()) ? null : date;
}

export { timeSince };

function localDateOnly(value: DbDate): string {
  const date = parseStoredDate(value);
  if (!date) return '';
  return new Date(date.valueOf() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function missing(reply: FastifyReply): null {
  reply.code(404).type('text/plain; charset=utf-8').send('Not found');
  return null;
}

function forbidden(reply: FastifyReply): null {
  reply.code(403).type('text/plain; charset=utf-8').send('Forbidden');
  return null;
}

async function activeUser(
  request: FastifyRequest,
  db: PrismaClient,
  options: ReaderActionsOptions,
): Promise<ActiveUserRow | null> {
  const supplied = await options.currentUser(request);
  if (!supplied || !Number.isSafeInteger(supplied.id) || supplied.id < 1) return null;
  const rows = await db.$queryRaw<ActiveUserRow[]>`
    SELECT id, username, CAST(is_active AS INTEGER) AS isActive
    FROM auth_user
    WHERE id = ${supplied.id} AND username = ${supplied.username}
    LIMIT 1
  `;
  const user = rows[0];
  return user && isTrue(user.isActive) ? user : null;
}

async function publicPost(db: PrismaClient, slug: string): Promise<PostRow | null> {
  const rows = await db.$queryRaw<PostRow[]>`
    SELECT post.id AS id,
           post.author_id AS authorId,
           author.username AS authorUsername,
           post.title AS title,
           post.url AS slug,
           CAST(post_config.block_comment AS INTEGER) AS blockComment
    FROM board_post AS post
    JOIN auth_user AS author ON author.id = post.author_id
    JOIN board_postconfig AS post_config ON post_config.post_id = post.id
    WHERE post.url = ${slug}
      AND post.deleted_date IS NULL
      AND post.published_date IS NOT NULL
      AND CAST(post.published_date AS TEXT) <= ${new Date().toISOString().replace('T', ' ').replace('Z', '')}
      AND CAST(post_config.hide AS INTEGER) = 0
    LIMIT 1
  `;
  return rows[0] ?? null;
}

async function commentForViewer(
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

async function publicComments(
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

function serializeComment(
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

async function activeEditor(db: PrismaClient, username: string): Promise<AuthorRow | null> {
  const rows = await db.$queryRaw<AuthorRow[]>`
    SELECT author.id AS id,
           author.username AS username,
           author.first_name AS firstName,
           CAST(author.is_active AS INTEGER) AS isActive,
           profile.role AS profileRole
    FROM auth_user AS author
    LEFT JOIN board_profile AS profile ON profile.user_id = author.id
    WHERE author.username = ${username}
    LIMIT 1
  `;
  return rows[0] ?? null;
}

function canSubscribe(author: AuthorRow): boolean {
  return isTrue(author.isActive) && author.profileRole === 'EDITOR';
}

async function subscriptionState(
  db: PrismaClient,
  viewer: ActiveUserRow | null,
  author: AuthorRow,
): Promise<{ canSubscribe: boolean; isSubscribed: boolean }> {
  const allowed = canSubscribe(author) && viewer?.id !== author.id;
  if (!allowed || !viewer) return { canSubscribe: allowed, isSubscribed: false };
  const rows = await db.$queryRaw<Array<{ present: DbInteger }>>`
    SELECT EXISTS (
      SELECT 1 FROM board_authorsubscription
      WHERE subscriber_id = ${viewer.id} AND author_id = ${author.id}
    ) AS present
  `;
  return { canSubscribe: true, isSubscribed: isTrue(rows[0]?.present ?? 0) };
}

function safeHttpUrl(value: string | null): string {
  const candidate = value?.trim() ?? '';
  if (!/^https?:\/\//i.test(candidate) || /[\x00\r\n\t]/.test(candidate)) return '';
  try {
    const parsed = new URL(candidate);
    return (parsed.protocol === 'http:' || parsed.protocol === 'https:') && parsed.hostname ? candidate : '';
  } catch {
    return '';
  }
}

export async function readReaderPostView(
  db: PrismaClient,
  slug: string,
  viewerId: number | null,
): Promise<ReaderPostView | null> {
  const post = await publicPost(db, slug);
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
  const [likes] = await db.$queryRaw<Array<{ count: number | bigint; isLiked: DbInteger }>>`
    SELECT COUNT(*) AS count,
           CASE WHEN EXISTS (
             SELECT 1 FROM board_post_likes
              WHERE post_id = ${post.id} AND user_id = ${viewer?.id ?? -1}
           ) THEN 1 ELSE 0 END AS isLiked
      FROM board_post_likes
     WHERE post_id = ${post.id}
  `;
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
      countLikes: numberValue(likes?.count ?? 0),
      isLiked: isTrue(likes?.isLiked ?? 0),
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

function requestCsrfAccepted(request: FastifyRequest, options: ReaderActionsOptions): boolean {
  return options.validateCsrf(request);
}

function localReturnTo(value: unknown): string | null {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || /[\r\n]/.test(value)) return null;
  try {
    const target = new URL(value, 'https://blex.local');
    if (target.origin !== 'https://blex.local') return null;
    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return null;
  }
}

function commentReturnTo(value: unknown, commentId: number): string | null {
  const destination = localReturnTo(value);
  if (!destination) return null;
  const target = new URL(destination, 'https://blex.local');
  target.hash = `comment-${commentId}`;
  return `${target.pathname}${target.search}${target.hash}`;
}

export async function mySubscriptions(db: PrismaClient, viewerId: number) {
  const rows = await db.$queryRaw<SubscriptionRow[]>`
    SELECT subscription.id AS id,
           author.username AS username,
           author.first_name AS firstName,
           profile.bio AS bio,
           profile.avatar AS avatar,
           CAST(author.is_active AS INTEGER) AS isActive,
           profile.role AS profileRole,
           CAST(subscription.created_date AS TEXT) AS createdDate
    FROM board_authorsubscription AS subscription
    JOIN auth_user AS author ON author.id = subscription.author_id
    LEFT JOIN board_profile AS profile ON profile.user_id = author.id
    WHERE subscription.subscriber_id = ${viewerId}
    ORDER BY subscription.created_date DESC, subscription.id DESC
  `;
  const telegram = await db.$queryRaw<Array<{ connected: DbInteger }>>`
    SELECT CASE WHEN TRIM(tid) <> '' THEN 1 ELSE 0 END AS connected
    FROM board_telegramsync
    WHERE user_id = ${viewerId}
    LIMIT 1
  `;
  return {
    subscriptions: rows.map((row) => ({
      username: row.username,
      name: row.firstName,
      avatar: absoluteMediaUrl(row.avatar) ?? DEFAULT_AVATAR,
      bio: row.bio ?? '',
      isPublishing: isTrue(row.isActive) && row.profileRole === 'EDITOR',
      subscribedDate: localDateOnly(row.createdDate),
    })),
    isTelegramConnected: isTrue(telegram[0]?.connected ?? 0),
  };
}

export function registerReaderActions(
  app: FastifyInstance,
  db: PrismaClient,
  options: ReaderActionsOptions,
): void {
  app.register(async (routes) => {
    await routes.register(formBody);
    routes.removeContentTypeParser('application/json');
    routes.addContentTypeParser('application/json', { parseAs: 'string' }, (_request, body, doneParse) => {
      try {
        doneParse(null, JSON.parse(body as string));
      } catch {
        // The legacy PUT API falls back to a QueryDict when its JSON body is malformed.
        doneParse(null, body as string);
      }
    });

    routes.post<{ Params: { url: string } }>('/like/:url', async (request, reply) => {
      if (!requestCsrfAccepted(request, options)) return forbidden(reply);
      const user = await activeUser(request, db, options);
      if (!user) {
        return reply.code(401).send({ status: 'error', message: 'Authentication required' });
      }
      const post = await publicPost(db, request.params.url);
      if (!post) return missing(reply);

      const result = await db.$transaction(async (tx) => {
        const removed = await tx.$executeRaw`
          DELETE FROM board_post_likes
          WHERE post_id = ${post.id} AND user_id = ${user.id}
        `;
        let hasLiked = false;
        if (removed > 0) {
          hasLiked = false;
        } else {
          const added = await tx.$executeRaw`
            INSERT INTO board_post_likes (created_date, post_id, user_id)
            VALUES (${new Date().toISOString().replace('T', ' ').replace('Z', '')}, ${post.id}, ${user.id})
            ON CONFLICT(post_id, user_id) DO NOTHING
          `;
          if (added) await createNotification(tx, {
            recipientId: post.authorId, actor: user.username, url: publicPostPath(post.authorUsername, post.slug), title: post.title,
            key: 'post.liked', preference: 'NOTIFY_POSTS_LIKE',
          });
          hasLiked = true;
        }
        const counts = await tx.$queryRaw<Array<{ count: number | bigint }>>`
          SELECT COUNT(*) AS count FROM board_post_likes WHERE post_id = ${post.id}
        `;
        return { hasLiked, countLikes: numberValue(counts[0]?.count ?? 0) };
      });
      const body = asBodyObject(request.body);
      const returnTo = localReturnTo(body?.return_to);
      if (returnTo) return reply.redirect(returnTo, 303);
      return {
        status: 'done',
        count_likes: result.countLikes,
        has_liked: result.hasLiked,
      };
    });

    routes.get<{ Params: { url: string } }>('/v1/posts/:url/comments', async (request) => {
      const user = await activeUser(request, db, options);
      return done(await publicComments(db, request.params.url, user?.id ?? null));
    });

    routes.post('/v1/comments', { bodyLimit: commentBodyLimit }, async (request, reply) => {
      if (!requestCsrfAccepted(request, options)) return forbidden(reply);
      const body = asBodyObject(request.body);
      const slug = typeof request.query === 'object' && request.query !== null
        ? textValue((request.query as Record<string, unknown>).url)
        : '';
      const post = await publicPost(db, slug);
      if (!post) return missing(reply);

      const user = await activeUser(request, db, options);
      if (!user) return error('AT', 'Log in to continue.');
      if (isTrue(post.blockComment)) return error('RJ', 'Comments are disabled for this post.');

      const parentIdText = bodyField(body, 'parent_id');
      let parent: CommentRow | null = null;
      if (parentIdText) {
        if (!/^\d+$/.test(parentIdText) || Number(parentIdText) < 1) return missing(reply);
        parent = await commentForViewer(db, Number(parentIdText), user.id);
        if (!parent) return missing(reply);
        if (parent.postId !== post.id) return error('RJ', 'The parent comment does not belong to this post.');
        if (parent.authorId === null) return error('RJ', 'You cannot reply to a deleted comment.');
        if (parent.parentId !== null) return error('RJ', 'You cannot reply to a reply.');
      }

      const markdown = bodyField(body, 'comment_md');
      const html = commentHtml(markdown);
      const now = new Date().toISOString().replace('T', ' ').replace('Z', '');
      const commentId = await db.$transaction(async (tx) => {
        const [inserted] = await tx.$queryRaw<Array<{ id: number }>>`
          INSERT INTO board_comment
            (text_md, text_html, edited, heart, created_date, author_id, post_id, parent_id)
          VALUES (${markdown}, ${html}, 0, 0, ${now}, ${user.id}, ${post.id}, ${parent?.id ?? null})
          RETURNING id
        `;
        const recipientId = parent?.authorId ?? post.authorId;
        const data = { actor: user.username, url: publicPostPath(post.authorUsername, post.slug), title: post.title, commentId: inserted.id };
        await createNotification(tx, { ...data, recipientId, key: parent ? 'comment.replied' : 'post.commented', preference: 'NOTIFY_POSTS_COMMENT' });
        const mentions = [...new Set([...markdown.matchAll(/(?<![\p{L}\p{N}_@.+\-`*~])@([a-z0-9]{4,15})(?![\p{L}\p{N}_+\-`*~]|\.[a-zA-Z0-9])/gu)].map((match) => match[1]))];
        if (mentions.length) {
          const targets = await tx.$queryRaw<Array<{ id: number }>>`
            SELECT id FROM auth_user AS target WHERE username IN (${Prisma.join(mentions)})
              AND EXISTS(SELECT 1 FROM board_comment WHERE post_id = ${post.id} AND author_id = target.id)
          `;
          for (const target of targets) await createNotification(tx, {
            ...data, recipientId: target.id, key: 'comment.mentioned', preference: 'NOTIFY_MENTION',
          });
        }
        return inserted.id;
      });
      const created = await commentForViewer(db, commentId, user.id);
      if (!created) return reply.code(500).send({ error: 'Could not complete the request' });
      const returnTo = commentReturnTo(body?.return_to, created.id);
      if (returnTo) return reply.redirect(returnTo, 303);
      return done(serializeComment(created, user.id, !isTrue(post.blockComment)));
    });

    routes.route<{ Params: { id: string } }>({
      method: ['GET', 'POST', 'PUT', 'DELETE'],
      url: '/v1/comments/:id',
      bodyLimit: commentBodyLimit,
      handler: async (request, reply) => {
        const id = Number(request.params.id);
        if (!Number.isSafeInteger(id) || id < 1) return missing(reply);
        if (request.method !== 'GET' && !requestCsrfAccepted(request, options)) return forbidden(reply);

        const viewer = await activeUser(request, db, options);
        const comment = await commentForViewer(db, id, viewer?.id ?? null);
        if (!comment) return missing(reply);
        if (!isTrue(comment.postPublic)) return missing(reply);

        if (request.method === 'GET') {
          if (comment.authorId === null) return missing(reply);
          if (!viewer || comment.authorId !== viewer.id) {
            return error('AT', 'You do not have permission to edit this comment.');
          }
          reply.header('Cache-Control', 'private, no-store');
          return done({ textMd: comment.textMd });
        }

        if (request.method === 'PUT' || request.method === 'POST') {
          const body = asBodyObject(request.body);
          if (truthyBodyField(body, 'like')) {
            if (!viewer) return error('NL', 'Log in to continue.');
            if (comment.authorId === viewer.id) return error('AT', 'You cannot like your own comment.');
            if (comment.authorId === null) return error('RJ', 'This comment has been deleted.');
            const recipientId = comment.authorId;

            const result = await db.$transaction(async (tx) => {
              const removed = await tx.$executeRaw`
                DELETE FROM board_comment_likes
                WHERE comment_id = ${comment.id} AND user_id = ${viewer.id}
              `;
              const isLiked = removed === 0;
              if (isLiked) {
                const added = await tx.$executeRaw`
                  INSERT INTO board_comment_likes (comment_id, user_id)
                  VALUES (${comment.id}, ${viewer.id})
                  ON CONFLICT(comment_id, user_id) DO NOTHING
                `;
                if (added) await createNotification(tx, {
                  recipientId, actor: viewer.username, url: publicPostPath(comment.postUsername, comment.postSlug), title: comment.postTitle,
                  commentId: comment.id, key: 'comment.liked', preference: 'NOTIFY_COMMENT_LIKE',
                });
              }
              const counts = await tx.$queryRaw<Array<{ count: number | bigint }>>`
                SELECT COUNT(*) AS count FROM board_comment_likes WHERE comment_id = ${comment.id}
              `;
              return { isLiked, countLikes: numberValue(counts[0]?.count ?? 0) };
            });
            const returnTo = localReturnTo(body?.return_to);
            if (request.method === 'POST' && returnTo) return reply.redirect(returnTo, 303);
            return done({ isLiked: result.isLiked, countLikes: result.countLikes });
          }

          const formEdit = request.method === 'POST' && bodyField(body, 'action') === 'edit';
          if (formEdit || (request.method === 'PUT' && truthyBodyField(body, 'comment'))) {
            if (!viewer || comment.authorId !== viewer.id) {
              return error('AT', 'You do not have permission to edit this comment.');
            }
            const markdown = bodyField(body, 'comment_md');
            await db.$executeRaw`
              UPDATE board_comment
              SET text_md = ${markdown}, text_html = ${commentHtml(markdown)}, edited = 1
              WHERE id = ${comment.id} AND author_id = ${viewer.id}
            `;
            const returnTo = formEdit ? commentReturnTo(body?.return_to, comment.id) : null;
            if (returnTo) return reply.redirect(returnTo, 303);
            return done();
          }

          if (request.method === 'POST' && bodyField(body, 'action') === 'delete') {
            if (!viewer || comment.authorId !== viewer.id) {
              return error('AT', 'You do not have permission to delete this comment.');
            }
            await db.$executeRaw`
              UPDATE board_comment SET author_id = NULL
              WHERE id = ${comment.id} AND author_id = ${viewer.id}
            `;
            const returnTo = localReturnTo(body?.return_to);
            if (returnTo) return reply.redirect(returnTo, 303);
            const deleted = await commentForViewer(db, comment.id, viewer.id);
            return done(deleted ? serializeComment(deleted, viewer.id, !isTrue(deleted.postBlockComment)) : {});
          }

          return missing(reply);
        }

        if (request.method === 'DELETE') {
          if (!viewer || comment.authorId !== viewer.id) {
            return error('AT', 'You do not have permission to delete this comment.');
          }
          await db.$executeRaw`
            UPDATE board_comment SET author_id = NULL
            WHERE id = ${comment.id} AND author_id = ${viewer.id}
          `;
          const deleted = await commentForViewer(db, comment.id, viewer.id);
          return done(deleted ? serializeComment(deleted, viewer.id, !isTrue(deleted.postBlockComment)) : {});
        }

        return missing(reply);
      },
    });

    routes.route<{ Params: { username: string } }>({
      method: ['GET', 'POST', 'DELETE'],
      url: '/v1/users/@:username/subscription',
      handler: async (request, reply) => {
        if (request.method !== 'GET' && !requestCsrfAccepted(request, options)) return forbidden(reply);
        const author = await activeEditor(db, request.params.username);
        if (!author) return missing(reply);
        const viewer = await activeUser(request, db, options);
        const body = asBodyObject(request.body);
        const wantsUnsubscribe = request.method === 'DELETE' || (
          request.method === 'POST' && bodyField(body, 'action') === 'unsubscribe'
        );
        const returnTo = localReturnTo(body?.return_to);

        if (request.method === 'GET') {
          return done(await subscriptionState(db, viewer, author));
        }
        if (!viewer) return error('NL', 'Log in to continue.');

        if (request.method === 'POST' && !wantsUnsubscribe) {
          if (viewer.id === author.id) return error('RJ', 'You cannot subscribe to yourself.');
          if (!canSubscribe(author)) return error('RJ', 'This user does not publish posts.');
          await db.$transaction(async (tx) => {
            const inserted = await tx.$executeRaw`
              INSERT INTO board_authorsubscription (created_date, author_id, subscriber_id)
              VALUES (${new Date().toISOString().replace('T', ' ').replace('Z', '')}, ${author.id}, ${viewer.id})
              ON CONFLICT(subscriber_id, author_id) DO NOTHING
            `;
            if (inserted > 0) {
              await tx.$executeRaw`
                INSERT INTO board_authorsubscriptionlog (action, created_date, author_id, subscriber_id)
                VALUES ('subscribe', ${new Date().toISOString().replace('T', ' ').replace('Z', '')}, ${author.id}, ${viewer.id})
              `;
            }
          });
          const telegram = await db.$queryRaw<TelegramRow[]>`
            SELECT CAST(telegram_enabled AS INTEGER) AS telegramEnabled,
                   telegram_bot_username AS botUsername
            FROM board_integrationsetting
            WHERE id = 1
            LIMIT 1
          `;
          const connected = await db.$queryRaw<Array<{ connected: DbInteger }>>`
            SELECT CASE WHEN TRIM(tid) <> '' THEN 1 ELSE 0 END AS connected
            FROM board_telegramsync
            WHERE user_id = ${viewer.id}
            LIMIT 1
          `;
          const setting = telegram[0];
          const suggestTelegramConnection = Boolean(setting && isTrue(setting.telegramEnabled) &&
            setting.botUsername.trim() !== '' &&
            !isTrue(connected[0]?.connected ?? 0));
          const result = {
            canSubscribe: true,
            isSubscribed: true,
            suggestTelegramConnection,
          };
          if (returnTo) return reply.redirect(returnTo, 303);
          return done(result);
        }

        const canSubscribeAfterDelete = canSubscribe(author) && viewer.id !== author.id;
        await db.$transaction(async (tx) => {
          const deleted = await tx.$executeRaw`
            DELETE FROM board_authorsubscription
            WHERE subscriber_id = ${viewer.id} AND author_id = ${author.id}
          `;
          if (deleted > 0) {
            await tx.$executeRaw`
              INSERT INTO board_authorsubscriptionlog (action, created_date, author_id, subscriber_id)
              VALUES ('unsubscribe', ${new Date().toISOString().replace('T', ' ').replace('Z', '')}, ${author.id}, ${viewer.id})
            `;
          }
        });
        if (returnTo) return reply.redirect(returnTo, 303);
        return done({ canSubscribe: canSubscribeAfterDelete, isSubscribed: false });
      },
    });

    routes.get('/v1/subscriptions', async (request) => {
      const viewer = await activeUser(request, db, options);
      if (!viewer) return error('NL', 'Log in to continue.');
      return done(await mySubscriptions(db, viewer.id));
    });
  });
}
