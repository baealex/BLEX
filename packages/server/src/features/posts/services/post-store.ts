import { randomBytes } from 'node:crypto';
import type { CoverImagePosition, CoverLayout, Prisma, PrismaClient } from '@prisma/client';
import { syncPostPublication } from '../../notifications/model.js';
import { descriptionFromHtml, normalizedTags, plainText, readingTime, resolveContent, resolveCoverImage, slugify, validatePostInput } from './post-content.js';
import { AuthoringPostInput, DbDate, POST_URL_MAX, RESERVED_URLS, StoredPost, UserRow, dateAsIso, field } from '../shared.js';

const storedPostSelect = {
  id: true, title: true, subtitle: true, slug: true, image: true, description: true,
  createdAt: true, updatedAt: true, publishedAt: true, deletedAt: true, authorId: true, readTime: true, seriesId: true,
  isHidden: true, isAdvertised: true, commentsBlocked: true,
  coverLayout: true, coverImagePosition: true, coverImageRatio: true,
  author: { select: { username: true, board_profile: { select: { avatar: true } } } },
  series: { select: { name: true, slug: true, isHidden: true } },
  content: { select: { html: true } },
} satisfies Prisma.PostSelect;

export async function loadPost(
  db: PrismaClient,
  where: { username?: string; userId?: number; slug: string },
): Promise<StoredPost | null> {
  const owner = where.userId !== undefined ? { authorId: where.userId } : { author: { username: where.username ?? '' } };
  const row = await db.post.findFirst({ where: { slug: where.slug, deletedAt: null, ...owner }, select: storedPostSelect });
  if (!row) return null;
  return {
    id: row.id, title: row.title, subtitle: row.subtitle, url: row.slug, image: row.image, description: row.description,
    createdDate: row.createdAt, updatedDate: row.updatedAt, publishedDate: row.publishedAt, deletedDate: row.deletedAt,
    authorId: row.authorId, authorUsername: row.author.username, authorAvatar: row.author.board_profile?.avatar ?? null,
    readTime: row.readTime, seriesId: row.seriesId, seriesName: row.series?.name ?? null, seriesUrl: row.series?.slug ?? null,
    seriesHidden: row.series?.isHidden ?? false, contentHtml: row.content?.html ?? '',
    hide: row.isHidden, advertise: row.isAdvertised, blockComment: row.commentsBlocked,
    coverLayout: row.coverLayout, coverImagePosition: row.coverImagePosition, coverImageRatio: row.coverImageRatio,
  };
}

export async function postTags(db: PrismaClient, postId: number): Promise<string[]> {
  const tags = await db.tag.findMany({ where: { posts: { some: { id: postId } } }, orderBy: { name: 'asc' }, select: { name: true } });
  return tags.map(({ name }) => name);
}

export async function draftReservation(db: PrismaClient, postId: number): Promise<string> {
  const post = await db.post.findUnique({ where: { id: postId }, select: { draftScheduledAt: true } });
  return dateAsIso(post?.draftScheduledAt ?? null) ?? '';
}

async function publicSeriesId(db: Prisma.TransactionClient, userId: number, url: string): Promise<number | null> {
  if (!url) return null;
  const series = await db.series.findFirst({ where: { ownerId: userId, slug: url }, select: { id: true } });
  return series?.id ?? null;
}

async function uniqueSlug(tx: Prisma.TransactionClient, title: string, customUrl: string, excludeId?: number): Promise<string> {
  const base = slugify(customUrl || title) || `post-${randomBytes(4).toString('hex')}`;
  let candidate = base.slice(0, POST_URL_MAX);
  let attempt = 0;
  while (RESERVED_URLS.has(candidate) || await tx.post.findFirst({
    where: { slug: candidate, id: { not: excludeId ?? -1 } },
    select: { id: true },
  })) {
    attempt += 1;
    const suffix = randomBytes(4).toString('hex');
    candidate = `${base.slice(0, Math.max(1, POST_URL_MAX - suffix.length - 1))}-${suffix}`;
    if (attempt > 10) throw new Error('Could not reserve a unique post URL.');
  }
  return candidate;
}

function scheduledDate(input: string): { value: Date | null; error: string | null } {
  if (!input) return { value: null, error: null };
  const normalized = /(?:Z|[+-]\d\d:\d\d)$/i.test(input) ? input : `${input}+09:00`;
  const value = new Date(normalized);
  if (Number.isNaN(value.valueOf())) return { value: null, error: 'Check the scheduled time.' };
  if (value.valueOf() <= Date.now()) return { value: null, error: 'The scheduled time must be in the future.' };
  return { value, error: null };
}

/** Replaces a post's tags. It never touches `updatedAt`, so callers decide whether the change counts as an edit. */
export async function setPostTags(tx: Prisma.TransactionClient, postId: number, names: string[]): Promise<void> {
  const tags: Array<{ id: number }> = [];
  for (const name of names) {
    tags.push(await tx.tag.upsert({ where: { name }, create: { name }, update: {}, select: { id: true } }));
  }
  await tx.post.update({ where: { id: postId }, data: { tags: { set: tags } }, select: { id: true } });
}

function draftScheduleValue(reservedDate: string): Date | null {
  if (!reservedDate) return null;
  const parsed = scheduledDate(reservedDate);
  if (parsed.error || !parsed.value) throw new PostValidationError('VA', parsed.error ?? 'Check the scheduled time.');
  return parsed.value;
}

const MAX_DRAFTS_PER_USER = 100;

export class PostValidationError extends Error {
  readonly code: string;

  constructor(readonly errorCode: 'VA' | 'RJ' | 'CF' | 'OF', message: string) {
    super(message);
    this.name = 'PostValidationError';
    this.code = errorCode;
  }
}

export interface AuthoringSaveResult {
  id: number;
  url: string;
  publishedDate: string | null;
}

export function comparableDate(value: DbDate): string | null {
  if (value === null) return null;
  const raw = value instanceof Date ? value.toISOString() : value;
  const match = raw.match(/^(\d{4}-\d\d-\d\d)[ T](\d\d:\d\d:\d\d)(?:\.(\d+))?(Z|[+-]\d\d:\d\d)?$/i);
  if (!match) return raw;
  const epoch = Date.parse(`${match[1]}T${match[2]}${match[4] ?? 'Z'}`);
  if (Number.isNaN(epoch)) return raw;
  const second = new Date(epoch).toISOString().slice(0, 19).replace('T', ' ');
  // API and page tokens carry milliseconds, while Django stored microseconds.
  return `${second}.${(match[3] ?? '').padEnd(3, '0').slice(0, 3)}`;
}

export function assertExpectedUpdatedAt(actual: DbDate, expected: string | undefined): void {
  if (expected === undefined) return;
  if (!actual || comparableDate(actual) !== comparableDate(expected)) {
    throw new PostValidationError('CF', 'The post changed after it was read. Reload it before saving.');
  }
}

export interface EditorialSnapshot {
  title: string;
  subtitle: string;
  content: string;
  description: string;
  tags: string[];
  updatedDate: Date | null;
  publishedDate: Date | null;
}

export async function captureEditorialSnapshot(tx: Prisma.TransactionClient, postId: number): Promise<EditorialSnapshot> {
  const row = await tx.post.findUnique({
    where: { id: postId },
    select: {
      title: true, subtitle: true, description: true, updatedAt: true, publishedAt: true,
      content: { select: { html: true } },
      tags: { orderBy: { name: 'asc' }, select: { name: true } },
    },
  });
  if (!row) throw new PostValidationError('RJ', 'The post was not found.');
  return {
    title: row.title, subtitle: row.subtitle, description: row.description, content: row.content?.html ?? '',
    updatedDate: row.updatedAt, publishedDate: row.publishedAt, tags: row.tags.map(({ name }) => name),
  };
}

export function sameEditorialSnapshot(left: EditorialSnapshot, right: EditorialSnapshot): boolean {
  return left.title === right.title && left.subtitle === right.subtitle
    && left.content === right.content && left.description === right.description
    && JSON.stringify(left.tags) === JSON.stringify(right.tags);
}

function revisionExcerpt(content: string): string {
  const text = plainText(content);
  const characters = Array.from(text);
  return characters.length > 160 ? `${characters.slice(0, 159).join('')}…` : text;
}

export async function insertRevision(
  tx: Prisma.TransactionClient,
  postId: number,
  snapshot: EditorialSnapshot,
  actorId: number,
  type: 'edit' | 'draft' | 'restore',
  sourceUpdatedAt: Date | null,
  restoredFromId: number | null = null,
): Promise<number> {
  const { id } = await tx.postRevision.create({
    data: {
      postId, actorId, restoredFromId, type, sourceUpdatedAt, createdAt: new Date(),
      title: snapshot.title, subtitle: snapshot.subtitle, description: snapshot.description,
      content: snapshot.content, contentExcerpt: revisionExcerpt(snapshot.content), tags: snapshot.tags,
    },
    select: { id: true },
  });
  return id;
}

async function draftSnapshotDue(tx: Prisma.TransactionClient, postId: number): Promise<boolean> {
  const latest = await tx.postRevision.findFirst({
    where: { postId, type: 'draft' },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    select: { createdAt: true },
  });
  return !latest || Date.now() - latest.createdAt.valueOf() >= 10 * 60 * 1000;
}

export async function createPost(
  db: PrismaClient,
  author: UserRow,
  input: AuthoringPostInput,
  asDraft: boolean,
): Promise<AuthoringSaveResult> {
  const validation = validatePostInput(input, asDraft);
  if (validation) throw new PostValidationError('VA', validation);
  const reserved = asDraft ? { value: null, error: null } : scheduledDate(input.reservedDate);
  if (reserved.error) throw new PostValidationError('VA', reserved.error);
  const html = resolveContent(input);
  if (!asDraft && !html) throw new PostValidationError('VA', 'Enter some content.');
  const title = input.title || 'Untitled';
  const description = input.description || (input.text ? descriptionFromHtml(html) : '');
  const now = new Date();
  const publishAt = asDraft ? null : reserved.value ?? now;
  const coverImage = await resolveCoverImage(db, author.id, input.coverImage, '', input.removeCoverImage);

  return db.$transaction(async (tx) => {
    if (asDraft) {
      const drafts = await tx.post.count({ where: { authorId: author.id, publishedAt: null } });
      if (drafts >= MAX_DRAFTS_PER_USER) {
        throw new PostValidationError('OF', `임시 저장 글은 최대 ${MAX_DRAFTS_PER_USER}개까지 가능합니다.`);
      }
    }
    const slug = await uniqueSlug(tx, title, input.url);
    const seriesId = await publicSeriesId(tx, author.id, input.series);
    const { id: postId } = await tx.post.create({
      data: {
        title, subtitle: input.subtitle, slug, image: coverImage, readTime: readingTime(html), createdAt: now, updatedAt: now,
        authorId: author.id, seriesId, description, publishedAt: publishAt,
        isHidden: input.hide, isAdvertised: input.advertise, commentsBlocked: input.blockComment,
        coverLayout: input.coverLayout as CoverLayout, coverImagePosition: input.coverImagePosition as CoverImagePosition,
        coverImageRatio: input.coverImageRatio,
        draftScheduledAt: asDraft ? draftScheduleValue(input.reservedDate) : null,
        content: { create: { html } },
      },
      select: { id: true },
    });
    await setPostTags(tx, postId, normalizedTags(input.tags));
    if (!asDraft) await syncPostPublication(tx, postId, { announce: true });
    return { id: postId, url: slug, publishedDate: dateAsIso(publishAt) };
  });
}

export async function updatePost(
  db: PrismaClient,
  author: UserRow,
  post: StoredPost,
  input: AuthoringPostInput,
  options: {
    allowEmptyBody: boolean;
    publishDraft?: boolean;
    updateDraft?: boolean;
    expectedUpdatedDate?: Date;
    preserveTags?: boolean;
    preserveExistingHtml?: boolean;
    clearContent?: boolean;
  },
): Promise<AuthoringSaveResult> {
  const validation = validatePostInput(input, options.allowEmptyBody);
  if (validation) throw new PostValidationError('VA', validation);
  const isStoredDraft = post.publishedDate === null;
  const html = options.preserveExistingHtml
    ? post.contentHtml
    : input.text ? resolveContent(input) : options.clearContent ? '' : null;
  if (!options.allowEmptyBody && !html) throw new PostValidationError('VA', 'Enter some content.');
  if (html !== null && !options.allowEmptyBody && !html) throw new PostValidationError('VA', 'Enter some content.');
  const schedule = input.reservedDate ? scheduledDate(input.reservedDate) : { value: null, error: null };
  if (schedule.error) throw new PostValidationError('VA', schedule.error);
  const title = input.title || (options.allowEmptyBody ? 'Untitled' : post.title);
  const description = input.description;
  const now = new Date();
  const coverImage = await resolveCoverImage(db, author.id, input.coverImage, post.image, input.removeCoverImage);
  const requestedUrl = input.url ? slugify(input.url) : post.url;
  if (!isStoredDraft && requestedUrl !== post.url) {
    throw new PostValidationError('RJ', 'The URL of a published or scheduled post cannot be changed.');
  }
  if (isStoredDraft && requestedUrl !== post.url && !options.publishDraft && !options.updateDraft) {
    throw new PostValidationError('RJ', 'The URL cannot be changed.');
  }
  if (options.publishDraft && !html && !post.contentHtml) {
    throw new PostValidationError('VA', 'Enter some content.');
  }
  const isScheduledPost = Boolean(post.publishedDate && post.publishedDate.valueOf() > Date.now());
  if (input.reservedDate && !isStoredDraft && !isScheduledPost) {
    throw new PostValidationError('RJ', 'Only scheduled posts can have their scheduled time changed.');
  }
  if (input.reservedDate && isStoredDraft && options.publishDraft && !schedule.value) {
    throw new PostValidationError('VA', 'Check the scheduled time.');
  }

  return db.$transaction(async (tx) => {
    const previousSnapshot = await captureEditorialSnapshot(tx, post.id);
    const previousUpdatedDate = post.updatedDate;
    const shouldRecordDraftSnapshot = isStoredDraft
      && Boolean(options.updateDraft || options.publishDraft)
      && await draftSnapshotDue(tx, post.id);
    const seriesId = await publicSeriesId(tx, author.id, input.series);
    const nextUrl = isStoredDraft && requestedUrl !== post.url
      ? await uniqueSlug(tx, title, requestedUrl, post.id)
      : post.url;
    const nextPublishDate = options.publishDraft
      ? schedule.value ?? now
      : isScheduledPost && schedule.value ? schedule.value : post.publishedDate;
    const { count: changed } = await tx.post.updateMany({
      where: { id: post.id, authorId: author.id, deletedAt: null, updatedAt: options.expectedUpdatedDate ?? post.updatedDate },
      data: {
        title, subtitle: input.subtitle, slug: nextUrl, image: coverImage, seriesId, description,
        readTime: html === null ? readingTime(post.contentHtml) : readingTime(html),
        updatedAt: now, publishedAt: nextPublishDate,
        isHidden: input.hide, isAdvertised: input.advertise, commentsBlocked: input.blockComment,
        coverLayout: input.coverLayout as CoverLayout, coverImagePosition: input.coverImagePosition as CoverImagePosition,
        coverImageRatio: input.coverImageRatio,
      },
    });
    if (changed === 0) {
      throw new PostValidationError('CF', 'The post changed after it was read. Reload it before saving.');
    }
    if (options.updateDraft || options.publishDraft) {
      const draftScheduledAt = options.updateDraft ? draftScheduleValue(input.reservedDate) : null;
      await tx.post.update({ where: { id: post.id }, data: { draftScheduledAt }, select: { id: true } });
    }
    if (html !== null) {
      await tx.postContent.upsert({ where: { postId: post.id }, create: { postId: post.id, html }, update: { html } });
    }
    if (input.hide && !post.hide) await tx.pinnedPost.deleteMany({ where: { postId: post.id } });
    if (!options.preserveTags) await setPostTags(tx, post.id, normalizedTags(input.tags));
    if (options.publishDraft || post.hide !== input.hide || (isScheduledPost && Boolean(input.reservedDate))) {
      await syncPostPublication(tx, post.id, { announce: Boolean(options.publishDraft) });
    }
    const currentSnapshot = await captureEditorialSnapshot(tx, post.id);
    if (!sameEditorialSnapshot(previousSnapshot, currentSnapshot)) {
      if (isStoredDraft && shouldRecordDraftSnapshot) {
        await insertRevision(tx, post.id, previousSnapshot, author.id, 'draft', previousUpdatedDate);
      } else if (!isStoredDraft) {
        await insertRevision(tx, post.id, previousSnapshot, author.id, 'edit', previousUpdatedDate);
      }
    }
    return { id: post.id, url: nextUrl, publishedDate: dateAsIso(nextPublishDate) };
  });
}

export async function trashPost(
  db: PrismaClient,
  author: UserRow,
  post: StoredPost,
  expectedUpdatedDate?: Date,
): Promise<string> {
  const deletedAt = new Date();
  await db.$transaction(async (tx) => {
    const { count } = await tx.post.updateMany({
      where: { id: post.id, authorId: author.id, deletedAt: null, ...(expectedUpdatedDate ? { updatedAt: expectedUpdatedDate } : {}) },
      data: { deletedAt },
    });
    if (expectedUpdatedDate !== undefined && count === 0) {
      throw new PostValidationError('CF', 'The post changed after it was read. Reload it before deleting.');
    }
    await syncPostPublication(tx, post.id);
  });
  return deletedAt.toISOString();
}

export function postPublic(post: StoredPost): boolean {
  return post.deletedDate === null && post.publishedDate !== null && post.publishedDate.valueOf() <= Date.now() && !post.hide;
}

export async function updatePostSettings(
  db: PrismaClient,
  author: UserRow,
  post: StoredPost,
  query: Record<string, unknown>,
  body: Record<string, unknown>,
): Promise<Record<string, unknown> | null> {
  const now = new Date();
  if (field(query.hide)) {
    const hide = !post.hide;
    await db.$transaction(async (tx) => {
      if (hide) await tx.pinnedPost.deleteMany({ where: { postId: post.id } });
      await tx.post.update({ where: { id: post.id }, data: { isHidden: hide, updatedAt: now }, select: { id: true } });
      await syncPostPublication(tx, post.id);
    });
    return { isHide: hide };
  }
  if (field(query.tag)) {
    await db.$transaction(async (tx) => {
      const previous = await captureEditorialSnapshot(tx, post.id);
      await setPostTags(tx, post.id, normalizedTags(field(body.tag)));
      if (sameEditorialSnapshot(previous, await captureEditorialSnapshot(tx, post.id))) return;
      await tx.post.update({ where: { id: post.id }, data: { updatedAt: now }, select: { id: true } });
      if (post.publishedDate !== null) await insertRevision(tx, post.id, previous, author.id, 'edit', post.updatedDate);
    });
    return { tag: normalizedTags(field(body.tag)).join(',') };
  }
  if (field(query.series)) {
    const seriesId = await publicSeriesId(db, author.id, field(body.series));
    await db.post.update({ where: { id: post.id }, data: { seriesId, updatedAt: now }, select: { id: true } });
    const series = seriesId === null ? null : await db.series.findUnique({ where: { id: seriesId }, select: { slug: true } });
    return { series: series?.slug ?? null };
  }
  if (field(query.reservedDate)) {
    const value = field(body.reservedDate);
    const parsed = scheduledDate(value);
    if (!value || parsed.error || !parsed.value) throw new PostValidationError('VA', parsed.error ?? 'Check the scheduled time.');
    if (!post.publishedDate || post.publishedDate.valueOf() <= Date.now()) {
      throw new PostValidationError('RJ', 'Only scheduled posts can have their scheduled time changed.');
    }
    await db.$transaction(async (tx) => {
      await tx.post.updateMany({ where: { id: post.id, authorId: author.id }, data: { publishedAt: parsed.value, updatedAt: now } });
      await syncPostPublication(tx, post.id);
    });
    return {};
  }
  return null;
}
