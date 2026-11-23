import type { Prisma, PrismaClient } from '@prisma/client';
import type { FastifyRequest } from 'fastify';
import { anonymizeComments } from '../../engagement/services/deletions.js';
import { containsLiteral } from '../../posts/data/text-match.js';
import { publicPostPath } from '../../posts/public-post.js';
import { ApiResult, isoDate, positiveInteger, recordModeration } from '../shared.js';
import type { AdminModeratedComment, AdminModeratedPost, AdminPagination, AdminPostStatus } from '../types.js';

const pageSize = 20;
const excerptLength = 300;
const likeWildcard = /[%_]/;

type PostFilter = 'all' | AdminPostStatus;

const moderatedPostSelect = {
  id: true,
  slug: true,
  title: true,
  isHidden: true,
  moderation: true,
  moderatedAt: true,
  publishedAt: true,
  deletedAt: true,
  author: { select: { username: true, isActive: true } },
  _count: { select: { comments: true, likes: true } },
} satisfies Prisma.PostSelect;

type ModeratedPostRow = Prisma.PostGetPayload<{ select: typeof moderatedPostSelect }>;

const moderatedCommentSelect = {
  id: true,
  markdown: true,
  parentId: true,
  isEdited: true,
  createdAt: true,
  author: { select: { username: true } },
  post: { select: { slug: true, title: true, author: { select: { username: true } } } },
} satisfies Prisma.CommentSelect;

type ModeratedCommentRow = Prisma.CommentGetPayload<{ select: typeof moderatedCommentSelect }>;

function listParams(request: FastifyRequest) {
  const params = new URL(request.url, 'https://blex.invalid').searchParams;
  return { params, query: (params.get('q') ?? '').trim(), requestedPage: positiveInteger(params.get('page'), 1) };
}

function pageOf(requested: number, total: number): AdminPagination {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(requested, 1), totalPages);
  return { page, pageSize, total, totalPages, hasNext: page < totalPages, hasPrevious: page > 1 };
}

function postStatus(row: Pick<ModeratedPostRow, 'moderation' | 'deletedAt' | 'isHidden'>): AdminPostStatus {
  if (row.moderation) return row.moderation;
  // Lifting a staff decision can reveal that the author has since made the post private.
  return row.deletedAt || row.isHidden ? 'hidden' : 'public';
}

function moderatedPost(row: ModeratedPostRow): AdminModeratedPost {
  return {
    id: row.id,
    title: row.title,
    path: publicPostPath(row.author.username, row.slug),
    author: row.author.username,
    authorActive: row.author.isActive,
    status: postStatus(row),
    commentCount: row._count.comments,
    likeCount: row._count.likes,
    publishedDate: row.publishedAt ? isoDate(row.publishedAt) : null,
    deletedDate: row.moderation === 'trash' && row.moderatedAt ? isoDate(row.moderatedAt) : null,
  };
}

// Drafts, scheduled posts, and anything the author made private stay with the author.
function postFilter(filter: PostFilter, now: Date): Prisma.PostWhereInput {
  const published = { publishedAt: { lte: now } };
  const authorPublic = { ...published, deletedAt: null, isHidden: false, moderation: null };
  if (filter === 'trash') return { ...published, moderation: 'trash' };
  if (filter === 'hidden') return { ...published, moderation: 'hidden' };
  if (filter === 'public') return authorPublic;
  return { OR: [authorPublic, { ...published, moderation: 'hidden' }] };
}

export async function readModeratedPosts(db: PrismaClient, request: FastifyRequest) {
  const { params, query, requestedPage } = listParams(request);
  const requested = params.get('status');
  const filter: PostFilter =
    requested === 'public' || requested === 'hidden' || requested === 'trash' ? requested : 'all';
  const search: Prisma.PostWhereInput = query
    ? { OR: [{ title: { contains: query } }, { author: { username: { contains: query } } }] }
    : {};
  const where = { AND: [postFilter(filter, new Date()), search] };
  const orderBy: Prisma.PostOrderByWithRelationInput[] =
    filter === 'trash' ? [{ moderatedAt: 'desc' }, { id: 'desc' }] : [{ publishedAt: 'desc' }, { id: 'desc' }];

  // Prisma's `contains` cannot escape % or _, so those searches are confirmed here.
  if (likeWildcard.test(query)) {
    const matches = (await db.post.findMany({ where, orderBy, select: moderatedPostSelect })).filter(
      (row) => containsLiteral(row.title, query) || containsLiteral(row.author.username, query),
    );
    const pagination = pageOf(requestedPage, matches.length);
    const rows = matches.slice((pagination.page - 1) * pageSize, pagination.page * pageSize);
    return { posts: rows.map(moderatedPost), pagination };
  }
  const pagination = pageOf(requestedPage, await db.post.count({ where }));
  const rows = await db.post.findMany({
    where,
    orderBy,
    skip: (pagination.page - 1) * pageSize,
    take: pageSize,
    select: moderatedPostSelect,
  });
  return { posts: rows.map(moderatedPost), pagination };
}

const postNotFound = { ok: false as const, code: 'NF', message: 'Post not found.' };

export async function setModeratedPostHidden(
  db: PrismaClient,
  actorId: number,
  postId: number,
  isHidden: unknown,
): Promise<ApiResult<AdminModeratedPost>> {
  if (typeof isHidden !== 'boolean') return { ok: false, code: 'VA', message: 'Check the post visibility.' };
  return db.$transaction(async (tx) => {
    const now = new Date();
    const post = await tx.post.findFirst({
      where: { id: postId, ...postFilter('all', now) },
      select: moderatedPostSelect,
    });
    if (!post) return postNotFound;
    if ((post.moderation === 'hidden') === isHidden) return { ok: true, body: moderatedPost(post) };
    if (isHidden) await tx.pinnedPost.deleteMany({ where: { postId } });
    const decision = isHidden
      ? { moderation: 'hidden' as const, moderatedAt: now }
      : { moderation: null, moderatedAt: null };
    await tx.post.update({ where: { id: postId }, data: decision, select: { id: true } });
    await recordModeration(tx, actorId, 'post', postId, post.title, 2, isHidden ? 'Hid post' : 'Made post visible');
    return { ok: true, body: moderatedPost({ ...post, ...decision }) };
  });
}

export async function moveModeratedPostToTrash(
  db: PrismaClient,
  actorId: number,
  postId: number,
): Promise<ApiResult<AdminModeratedPost>> {
  const moderatedAt = new Date();
  return db.$transaction(async (tx) => {
    const post = await tx.post.findFirst({
      where: { id: postId, ...postFilter('all', moderatedAt) },
      select: moderatedPostSelect,
    });
    if (!post) return postNotFound;
    const decision = { moderation: 'trash' as const, moderatedAt };
    await tx.post.update({ where: { id: postId }, data: decision, select: { id: true } });
    await recordModeration(tx, actorId, 'post', postId, post.title, 2, 'Moved post to trash');
    return { ok: true, body: moderatedPost({ ...post, ...decision }) };
  });
}

export async function restoreModeratedPost(
  db: PrismaClient,
  actorId: number,
  postId: number,
): Promise<ApiResult<AdminModeratedPost>> {
  return db.$transaction(async (tx) => {
    const post = await tx.post.findFirst({
      where: { id: postId, ...postFilter('trash', new Date()) },
      select: moderatedPostSelect,
    });
    if (!post) return postNotFound;
    const decision = { moderation: null, moderatedAt: null };
    await tx.post.update({ where: { id: postId }, data: decision, select: { id: true } });
    await recordModeration(tx, actorId, 'post', postId, post.title, 2, 'Restored post from trash');
    return { ok: true, body: moderatedPost({ ...post, ...decision }) };
  });
}

function moderatedComment(row: ModeratedCommentRow): AdminModeratedComment {
  return {
    id: row.id,
    excerpt: row.markdown.trim().slice(0, excerptLength),
    author: row.author?.username ?? '',
    isReply: row.parentId !== null,
    isEdited: row.isEdited,
    postTitle: row.post.title,
    postPath: publicPostPath(row.post.author.username, row.post.slug),
    createdDate: isoDate(row.createdAt),
  };
}

export async function readModeratedComments(db: PrismaClient, request: FastifyRequest) {
  const { query, requestedPage } = listParams(request);
  const search: Prisma.CommentWhereInput = query
    ? { OR: [{ markdown: { contains: query } }, { author: { username: { contains: query } } }] }
    : {};
  // Comments on drafts cannot exist, and a deleted comment has no author.
  const where: Prisma.CommentWhereInput = { AND: [{ authorId: { not: null } }, search] };
  const orderBy: Prisma.CommentOrderByWithRelationInput[] = [{ createdAt: 'desc' }, { id: 'desc' }];

  if (likeWildcard.test(query)) {
    const matches = (await db.comment.findMany({ where, orderBy, select: moderatedCommentSelect })).filter(
      (row) => containsLiteral(row.markdown, query) || containsLiteral(row.author?.username ?? '', query),
    );
    const pagination = pageOf(requestedPage, matches.length);
    const rows = matches.slice((pagination.page - 1) * pageSize, pagination.page * pageSize);
    return { comments: rows.map(moderatedComment), pagination };
  }
  const pagination = pageOf(requestedPage, await db.comment.count({ where }));
  const rows = await db.comment.findMany({
    where,
    orderBy,
    skip: (pagination.page - 1) * pageSize,
    take: pageSize,
    select: moderatedCommentSelect,
  });
  return { comments: rows.map(moderatedComment), pagination };
}

export async function deleteModeratedComment(
  db: PrismaClient,
  actorId: number,
  commentId: number,
): Promise<ApiResult<{ id: number }>> {
  return db.$transaction(async (tx) => {
    const comment = await tx.comment.findUnique({
      where: { id: commentId },
      select: { id: true, authorId: true, author: { select: { username: true } } },
    });
    if (!comment || comment.authorId === null) return { ok: false, code: 'NF', message: 'Comment not found.' };
    await anonymizeComments(tx, comment.authorId, comment.id);
    await recordModeration(
      tx,
      actorId,
      'comment',
      comment.id,
      `Comment by ${comment.author?.username ?? ''}`,
      3,
      'Deleted comment',
    );
    return { ok: true, body: { id: comment.id } };
  });
}
