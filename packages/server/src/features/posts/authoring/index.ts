import { renderApplicationDocument } from '../../../application/document.js';
import { randomBytes } from 'node:crypto';
import formBody from '@fastify/formbody';
import { createElement as h } from 'react';
import { Prisma, type PrismaClient } from '@prisma/client';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { SiteHeader, SiteTheme } from '../../../appearance/shell.js';
import { syncPostPublication } from '../../notifications/model.js';
import multipart from '@fastify/multipart';
import { ContentUploadError, contentUploadLimit, saveContentFile } from '../../media/content-media.js';
import { djangoIso, localDate, localDateTimeText, timeSince } from '../../../compat/django-format.js';
import { Parser } from 'htmlparser2';
import { readDraftPreview, readPostPresentation } from '../public-post.js';
import { postContentSecurityPolicy, renderPublicPostPage } from '../pages/public-post-page.js';
import { sanitizePostHtml } from '../post-html.js';
import { renderSettingsShell } from '../../../application/settings-shell.js';
import { markdownToHtml, htmlToMarkdown } from './markdown.js';
import { done, failure as failed } from '../../../platform/response.js';

export interface AuthoringUser {
  id: number;
  username: string;
  isStaff?: boolean;
  notifyCount?: number;
  hasConnectedTelegram?: boolean;
}

export interface AuthoringOptions {
  currentUser: (req: FastifyRequest) => Promise<AuthoringUser | null>;
  validateCsrf: (req: FastifyRequest) => boolean;
  siteUrl: URL;
  mediaRoot?: string;
  editorAssets?: { script: string; css: string[] };
}

type DbBoolean = number | bigint | boolean | null;
type DbDate = string | Date | null;

interface UserRow extends AuthoringUser {
  isActive: DbBoolean;
  role: string | null;
}

interface SeriesOption {
  id: number;
  name: string;
  url: string;
}

interface FormTemplate {
  id: number;
  title: string;
  content: string;
}

interface StoredPost {
  id: number;
  title: string;
  subtitle: string;
  url: string;
  image: string;
  description: string;
  createdDate: DbDate;
  updatedDate: DbDate;
  publishedDate: DbDate;
  deletedDate: DbDate;
  authorId: number;
  authorUsername: string;
  authorAvatar: string | null;
  readTime: number;
  seriesId: number | null;
  seriesName: string | null;
  seriesUrl: string | null;
  seriesHidden: DbBoolean;
  contentHtml: string;
  hide: DbBoolean;
  advertise: DbBoolean;
  blockComment: DbBoolean;
  coverLayout: string;
  coverImagePosition: string;
  coverImageRatio: string;
}

interface StoredDraftSummary {
  url: string;
  title: string;
  image: string;
  createdDate: DbDate;
  updatedDate: DbDate;
}

interface ManagedPostRow {
  id: number;
  url: string;
  title: string;
  image: string;
  publishedDate: DbDate;
  updatedDate: DbDate;
  hide: DbBoolean;
  countLikes: number | bigint;
  countComments: number | bigint;
  readTime: number;
  tag: string;
  series: string;
}

interface TrashedPostRow {
  id: number;
  url: string;
  title: string;
  image: string;
  publishedDate: DbDate;
  updatedDate: DbDate;
  deletedDate: DbDate;
  hide: DbBoolean;
}

export interface AuthoringPostInput {
  title: string;
  subtitle: string;
  text: string;
  contentType: string;
  description: string;
  url: string;
  tags: string;
  series: string;
  hide: boolean;
  advertise: boolean;
  blockComment: boolean;
  coverLayout: string;
  coverImagePosition: string;
  coverImageRatio: string;
  coverImage?: string;
  removeCoverImage: boolean;
  reservedDate: string;
}

interface EditorModel {
  action: string;
  csrfToken: string;
  content: string;
  contentType: 'markdown' | 'html';
  description: string;
  errorMessage: string;
  successMessage: string;
  savedDraft: boolean;
  isDraft: boolean;
  isEdit: boolean;
  postUrl: string;
  series: string;
  seriesOptions: SeriesOption[];
  tags: string;
  title: string;
  username: string;
  subtitle: string;
  hide: boolean;
  blockComment: boolean;
  coverLayout: string;
  coverImagePosition: string;
  coverImageRatio: string;
  reservedDate: string;
  showSchedule: boolean;
  formTitle: string;
  coverImageUrl: string;
}

const h1 = h;
const POST_TITLE_MAX = 65;
const POST_SUBTITLE_MAX = 120;
const POST_DESCRIPTION_MAX = 250;
const POST_URL_MAX = 65;
const TAG_MAX = 50;
const RESERVED_URLS = new Set(['about', 'posts', 'series']);
const COVER_LAYOUTS = new Set(['default', 'split', 'overlay', 'none']);
const COVER_POSITIONS = new Set(['left', 'right']);
const COVER_RATIOS = new Set(['auto', '16:9', '4:3', '1:1', '3:4']);

function numberValue(value: number | bigint | boolean | null | undefined): number {
  return Number(value ?? 0);
}

function isTrue(value: DbBoolean): boolean {
  return numberValue(value) !== 0;
}

function field(value: unknown): string {
  if (Array.isArray(value)) return field(value.at(-1));
  if (value === undefined || value === null) return '';
  return typeof value === 'string' ? value : String(value);
}

function inputField(body: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = field(body[key]);
    if (value) return value;
  }
  return '';
}

function optionalField(body: Record<string, unknown>, key: string): string | undefined {
  if (!Object.hasOwn(body, key)) return undefined;
  return field(body[key]);
}

function booleanField(value: unknown): boolean {
  if (Array.isArray(value)) return booleanField(value.at(-1));
  if (typeof value === 'boolean') return value;
  return ['1', 'true', 'yes', 'on'].includes(field(value).toLowerCase());
}

function bodyObject(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return {};
  return body as Record<string, unknown>;
}

function queryObject(request: FastifyRequest): Record<string, unknown> {
  return request.query && typeof request.query === 'object'
    ? request.query as Record<string, unknown>
    : {};
}

function nowString(): string {
  return new Date().toISOString().replace('T', ' ').replace('Z', '');
}

function dateAsIso(value: DbDate): string | null {
  return djangoIso(value);
}

function localDateTime(value: DbDate): string {
  const iso = dateAsIso(value);
  if (!iso) return '';
  const date = new Date(iso);
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Seoul',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).format(date).replace(' ', 'T');
}

function dateTimeLocalValue(value: string | DbDate): string {
  if (!value) return '';
  if (value instanceof Date) return localDateTime(value);
  const normalized = value.includes('T') ? value : value.replace(' ', 'T');
  // Django stores datetime columns as UTC-naive text in SQLite. Draft schedule
  // metadata is normalized to the same representation before it is saved.
  const withTimezone = /(?:Z|[+-]\d\d:\d\d)$/i.test(normalized) ? normalized : `${normalized}Z`;
  const date = new Date(withTimezone);
  return Number.isNaN(date.valueOf()) ? normalized.slice(0, 16) : localDateTime(date);
}

class ManagementQueryError extends Error {}

function managementPage(value: unknown): number {
  const raw = field(value) || '1';
  if (!/^\d+$/.test(raw) || Number(raw) < 1 || !Number.isSafeInteger(Number(raw))) {
    throw new ManagementQueryError('Check the page.');
  }
  return Number(raw);
}

function managementDate(value: DbDate, scheduled = false): string {
  const iso = dateAsIso(value);
  if (!iso) return '';
  const date = new Date(iso);
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: 'long', day: 'numeric',
    ...(scheduled ? { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' as const } : {}),
  }).format(date);
}

async function getManagedPosts(
  db: PrismaClient,
  author: UserRow,
  query: Record<string, unknown>,
  scheduled: boolean,
  legacyApi = false,
): Promise<{ posts: Array<Record<string, unknown>>; username: string; page: number; lastPage: number; totalCount: number }> {
  const page = managementPage(query.page);
  const filters: Prisma.Sql[] = [
    Prisma.sql`post.author_id = ${author.id}`,
    Prisma.sql`post.deleted_date IS NULL`,
    scheduled
      ? Prisma.sql`post.published_date > ${nowString()}`
      : Prisma.sql`post.published_date IS NOT NULL AND post.published_date <= ${nowString()}`,
  ];
  const tag = field(query.tag);
  const series = field(query.series);
  const search = field(query.search);
  const visibility = field(query.visibility);
  const requestedOrder = field(query.order) || '-published_date';
  if (tag) filters.push(Prisma.sql`EXISTS (
    SELECT 1 FROM board_post_tags AS filter_link JOIN board_tag AS filter_tag ON filter_tag.id = filter_link.tag_id
     WHERE filter_link.post_id = post.id AND filter_tag.value = ${tag}
  )`);
  if (series) filters.push(Prisma.sql`series.url = ${series}`);
  if (search) filters.push(Prisma.sql`post.title LIKE ${`%${search}%`}`);
  if (visibility === 'public') filters.push(Prisma.sql`COALESCE(config.hide, 0) = 0`);
  else if (visibility === 'hidden') filters.push(Prisma.sql`COALESCE(config.hide, 0) <> 0`);

  const sortField = requestedOrder.startsWith('-') ? requestedOrder.slice(1) : requestedOrder;
  const sortColumns: Record<string, string> = {
    title: 'post.title',
    read_time: 'post.read_time',
    published_date: 'post.published_date',
    updated_date: 'post.updated_date',
    count_likes: 'countLikes',
    count_comments: 'countComments',
  };
  const column = sortColumns[sortField];
  if (!column) throw new ManagementQueryError('Unsupported post-management order.');
  const direction = requestedOrder.startsWith('-') ? 'DESC' : 'ASC';
  const orderBy = Prisma.raw(`${column} ${direction}, post.id DESC`);
  const where = Prisma.join(filters, ' AND ');
  const totals = await db.$queryRaw<Array<{ total: number | bigint }>>`
    SELECT COUNT(*) AS total FROM board_post AS post
      LEFT JOIN board_postconfig AS config ON config.post_id = post.id
      LEFT JOIN board_series AS series ON series.id = post.series_id
     WHERE ${where}
  `;
  const totalCount = numberValue(totals[0]?.total);
  const lastPage = totalCount === 0 ? 1 : Math.ceil(totalCount / 10);
  if (page > lastPage) throw new ManagementQueryError('Check the page.');
  const rows = await db.$queryRaw<ManagedPostRow[]>`
    SELECT post.id AS id, post.url AS url, post.title AS title, post.image AS image,
           CAST(post.published_date AS TEXT) AS publishedDate,
           CAST(post.updated_date AS TEXT) AS updatedDate,
           CAST(config.hide AS INTEGER) AS hide,
           (SELECT COUNT(*) FROM board_post_likes AS likes WHERE likes.post_id = post.id) AS countLikes,
           (SELECT COUNT(*) FROM board_comment AS comments WHERE comments.post_id = post.id) AS countComments,
           post.read_time AS readTime,
           COALESCE((SELECT group_concat(tag_rows.value, ',') FROM (
             SELECT tag.value AS value FROM board_post_tags AS link
               JOIN board_tag AS tag ON tag.id = link.tag_id
              WHERE link.post_id = post.id ORDER BY link.tag_id
           ) AS tag_rows), '') AS tag,
           COALESCE(series.url, '') AS series
      FROM board_post AS post
      LEFT JOIN board_postconfig AS config ON config.post_id = post.id
      LEFT JOIN board_series AS series ON series.id = post.series_id
     WHERE ${where}
     ORDER BY ${orderBy}
     LIMIT 10 OFFSET ${(page - 1) * 10}
  `;
  return {
    username: author.username,
    page,
    lastPage,
    totalCount,
    posts: rows.map((post) => ({
      url: post.url,
      title: post.title,
      image: legacyApi ? post.image || null : mediaUrl(post.image),
      createdDate: legacyApi
        ? scheduled ? localDateTimeText(post.publishedDate) : localDate(post.publishedDate)
        : managementDate(post.publishedDate, scheduled),
      updatedDate: legacyApi ? localDate(post.updatedDate) : managementDate(post.updatedDate),
      isHide: isTrue(post.hide),
      countLikes: numberValue(post.countLikes),
      countComments: numberValue(post.countComments),
      readTime: post.readTime,
      tag: post.tag,
      series: post.series,
    })),
  };
}

async function getTrashRows(
  db: PrismaClient,
  author: UserRow,
  page: number,
): Promise<{ posts: Array<Record<string, unknown>>; pagination: { page: number; totalCount: number; lastPage: number }; retention: { mode: 'manual' } }> {
  const totals = await db.$queryRaw<Array<{ total: number | bigint }>>`
    SELECT COUNT(*) AS total FROM board_post WHERE author_id = ${author.id} AND deleted_date IS NOT NULL
  `;
  const totalCount = numberValue(totals[0]?.total);
  const lastPage = Math.max(1, Math.ceil(totalCount / 10));
  if (page < 1 || page > lastPage) throw new ManagementQueryError('Check the trash page.');
  const rows = await db.$queryRaw<TrashedPostRow[]>`
    SELECT post.id AS id, post.url AS url, post.title AS title, post.image AS image,
           CAST(post.published_date AS TEXT) AS publishedDate,
           CAST(post.updated_date AS TEXT) AS updatedDate,
           CAST(post.deleted_date AS TEXT) AS deletedDate,
           CAST(config.hide AS INTEGER) AS hide
      FROM board_post AS post LEFT JOIN board_postconfig AS config ON config.post_id = post.id
     WHERE post.author_id = ${author.id} AND post.deleted_date IS NOT NULL
     ORDER BY post.deleted_date DESC, post.id DESC
     LIMIT 10 OFFSET ${(page - 1) * 10}
  `;
  const now = nowString();
  return {
    posts: rows.map((post) => {
      const sourceStatus = !post.publishedDate
        ? 'draft'
        : String(post.publishedDate) > String(post.deletedDate) ? 'scheduled' : 'published';
      const scheduleElapsed = sourceStatus === 'scheduled' && String(post.publishedDate) <= now;
      return {
        url: post.url,
        title: post.title,
        image: mediaUrl(post.image),
        sourceStatus,
        publishedDate: dateAsIso(post.publishedDate),
        updatedDate: dateAsIso(post.updatedDate),
        deletedDate: dateAsIso(post.deletedDate),
        scheduleElapsed,
        isHide: isTrue(post.hide),
      };
    }),
    pagination: { page, totalCount, lastPage },
    retention: { mode: 'manual' },
  };
}

async function loadTrashedPost(db: PrismaClient, author: UserRow, slug: string): Promise<TrashedPostRow | null> {
  const rows = await db.$queryRaw<TrashedPostRow[]>`
    SELECT post.id AS id, post.url AS url, post.title AS title, post.image AS image,
           CAST(post.published_date AS TEXT) AS publishedDate,
           CAST(post.updated_date AS TEXT) AS updatedDate,
           CAST(post.deleted_date AS TEXT) AS deletedDate,
           CAST(config.hide AS INTEGER) AS hide
      FROM board_post AS post LEFT JOIN board_postconfig AS config ON config.post_id = post.id
     WHERE post.author_id = ${author.id} AND post.url = ${slug} AND post.deleted_date IS NOT NULL
     LIMIT 1
  `;
  return rows[0] ?? null;
}

function trashStatus(post: TrashedPostRow): 'draft' | 'scheduled' | 'published' {
  if (!post.publishedDate) return 'draft';
  return new Date(dateAsIso(post.publishedDate) ?? 0).valueOf() > Date.now() ? 'scheduled' : 'published';
}

async function restoreTrashedPost(
  db: PrismaClient,
  author: UserRow,
  post: TrashedPostRow,
  expectedDeletedDate: string,
): Promise<'draft' | 'scheduled' | 'published'> {
  if (!post.deletedDate || comparableDate(post.deletedDate) !== comparableDate(expectedDeletedDate)) {
    throw new PostValidationError('RJ', 'The trash state changed. Refresh the list and try again.');
  }
  await db.$transaction(async (tx) => {
    const changed = await tx.$executeRaw`
      UPDATE board_post SET deleted_date = NULL
       WHERE id = ${post.id} AND author_id = ${author.id} AND deleted_date = ${post.deletedDate}
    `;
    if (numberValue(changed) === 0) throw new PostValidationError('RJ', 'The trash state changed. Refresh the list and try again.');
    await syncPostPublication(tx, post.id);
  });
  return trashStatus(post);
}

async function permanentlyDeleteTrashedPost(
  db: PrismaClient,
  author: UserRow,
  post: TrashedPostRow,
  expectedDeletedDate: string,
): Promise<number> {
  if (!post.deletedDate || comparableDate(post.deletedDate) !== comparableDate(expectedDeletedDate)) {
    throw new PostValidationError('RJ', 'The trash state changed. Refresh the list and try again.');
  }
  const comments = Prisma.sql`
    WITH RECURSIVE thread(id) AS (
      SELECT id FROM board_comment WHERE post_id = ${post.id}
      UNION SELECT child.id FROM board_comment AS child JOIN thread ON child.parent_id = thread.id
    ) SELECT id FROM thread
  `;
  await db.$transaction(async (tx) => {
    const [current] = await tx.$queryRaw<unknown[]>`
      SELECT 1 FROM board_post WHERE id = ${post.id} AND author_id = ${author.id} AND deleted_date = ${post.deletedDate}
    `;
    if (!current) throw new PostValidationError('RJ', 'The trash state changed. Refresh the list and try again.');
    // Django applied these CASCADE and SET_NULL policies in its ORM.
    const changes = [
      Prisma.sql`DELETE FROM board_post_share_link_daily_counts WHERE link_id IN (SELECT id FROM board_postsharelink WHERE post_id = ${post.id})`,
      Prisma.sql`DELETE FROM board_postsharelink WHERE post_id = ${post.id}`,
      Prisma.sql`DELETE FROM board_comment_likes WHERE comment_id IN (${comments})`,
      Prisma.sql`DELETE FROM board_comment WHERE id IN (${comments})`,
      Prisma.sql`DELETE FROM board_postcontent WHERE post_id = ${post.id}`,
      Prisma.sql`DELETE FROM board_postconfig WHERE post_id = ${post.id}`,
      Prisma.sql`DELETE FROM board_postconfigmeta WHERE post_id = ${post.id}`,
      Prisma.sql`DELETE FROM board_post_tags WHERE post_id = ${post.id}`,
      Prisma.sql`DELETE FROM board_pinnedpost WHERE post_id = ${post.id}`,
      Prisma.sql`DELETE FROM board_post_likes WHERE post_id = ${post.id}`,
      Prisma.sql`UPDATE board_edithistory SET restored_from_id = NULL
        WHERE restored_from_id IN (SELECT id FROM board_edithistory WHERE post_id = ${post.id})`,
      Prisma.sql`DELETE FROM board_edithistory WHERE post_id = ${post.id}`,
      Prisma.sql`DELETE FROM board_editrequest WHERE post_id = ${post.id}`,
      Prisma.sql`DELETE FROM board_post WHERE id = ${post.id}`,
    ];
    for (const command of changes) await tx.$executeRaw(command);
  }, { timeout: 15_000 });
  return post.id;
}

function mediaUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  return `/resources/media/${value.replace(/^\/+/, '')}`;
}

function coverUrlFromStored(value: string): string {
  if (!value || /^https?:\/\//i.test(value)) return '';
  return `/resources/media/${value.split('/').map(encodeURIComponent).join('/')}`;
}

function storedCoverPath(value: string): string {
  if (!value.startsWith('/resources/media/') || /[\\\u0000-\u001f\u007f?#]/.test(value)) {
    throw new PostValidationError('VA', 'Choose an image URL from the upload page.');
  }
  let path: string;
  try {
    path = value.slice('/resources/media/'.length).split('/').map(decodeURIComponent).join('/');
  } catch {
    throw new PostValidationError('VA', 'Choose an image URL from the upload page.');
  }
  const segments = path.split('/');
  if (segments.length < 2 || segments.some((part) => !part || part === '.' || part === '..' || !/^[A-Za-z0-9._-]+$/.test(part)) ||
      !/\.(?:jpe?g|png|gif)$/i.test(segments.at(-1) ?? '')) {
    throw new PostValidationError('VA', 'Choose an image URL from the upload page.');
  }
  return path;
}

async function resolveCoverImage(
  db: PrismaClient,
  userId: number,
  requested: string | undefined,
  current: string,
  remove: boolean,
): Promise<string> {
  if (remove) return '';
  if (!requested?.trim()) return current;
  const path = storedCoverPath(requested.trim());
  if (path === current) return current;
  const owned = await db.$queryRaw<Array<{ path: string }>>`
    SELECT path FROM board_imagecache WHERE path = ${path} AND user_id = ${userId} LIMIT 1
  `;
  if (!owned[0]) throw new PostValidationError('VA', 'Choose an image you uploaded.');
  return path;
}

function plainText(html: string): string {
  return sanitizePostHtml(html)
    .replace(/<br\s*\/?\s*>/gi, ' ')
    .replace(/<\/(?:p|h[1-6]|li|blockquote|div)>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/** Django's strip_tags followed by truncatewords(50). */
function descriptionFromHtml(html: string): string {
  let text = '';
  const parser = new Parser({ ontext: (chunk) => { text += chunk; } }, { decodeEntities: false });
  parser.write(html);
  parser.end();
  const words = text.split(/\s+/u).filter(Boolean);
  return words.length > 50 ? `${words.slice(0, 50).join(' ')}…` : words.join(' ');
}

function readingTime(html: string): number {
  const words = plainText(html).trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

function slugify(value: string): string {
  return value.normalize('NFKC').toLocaleLowerCase('ko-KR')
    .replace(/[^\p{L}\p{N}_\s-]/gu, '')
    .trim()
    .replace(/[\s-]+/g, '-');
}

function normalizedTags(value: string): string[] {
  const prepared = slugify(value.replace(/[,_]/g, '-'));
  return [...new Set(prepared.split('-').filter(Boolean))];
}

function validatePostInput(input: AuthoringPostInput, allowEmptyBody: boolean): string | null {
  const length = (value: string) => Array.from(value).length;
  if (!allowEmptyBody && !input.title.trim()) return 'Enter a title.';
  if (length(input.title) > POST_TITLE_MAX) return `Titles can be up to ${POST_TITLE_MAX} characters.`;
  if (length(input.subtitle) > POST_SUBTITLE_MAX) return `Subtitles can be up to ${POST_SUBTITLE_MAX} characters.`;
  if (length(input.description) > POST_DESCRIPTION_MAX) return `Descriptions can be up to ${POST_DESCRIPTION_MAX} characters.`;
  if (length(slugify(input.url)) > POST_URL_MAX) return `Post URLs can be up to ${POST_URL_MAX} characters.`;
  if (normalizedTags(input.tags).some((tag) => Array.from(tag).length > TAG_MAX)) {
    return `Each tag can be up to ${TAG_MAX} characters.`;
  }
  if (!allowEmptyBody && !input.text.trim()) return 'Enter some content.';
  if (!COVER_LAYOUTS.has(input.coverLayout)) return 'This cover style is not supported.';
  if (!COVER_POSITIONS.has(input.coverImagePosition)) return 'This cover image position is not supported.';
  if (!COVER_RATIOS.has(input.coverImageRatio)) return 'This cover image ratio is not supported.';
  return null;
}

export function parseAuthoringPostInput(body: Record<string, unknown>): AuthoringPostInput {
  const text = inputField(body, 'content_html', 'content', 'text_html', 'text_md', 'content_markdown', 'markdown');
  const contentType = field(body.content_type) || (body.content_markdown !== undefined || body.markdown !== undefined ? 'markdown' : 'html');
  const tagsValue = Array.isArray(body.tag) ? body.tag : Array.isArray(body.tags) ? body.tags : undefined;
  return {
    title: field(body.title),
    subtitle: field(body.subtitle),
    text,
    contentType,
    description: inputField(body, 'description', 'meta_description'),
    url: field(body.url) || field(body.custom_url),
    tags: tagsValue ? tagsValue.map(field).join(',') : inputField(body, 'tag', 'tags'),
    series: field(body.series) || field(body.series_url),
    hide: booleanField(body.is_hide ?? body.hide),
    advertise: booleanField(body.is_advertise ?? body.advertise),
    blockComment: booleanField(body.block_comment),
    coverLayout: field(body.cover_layout) || 'default',
    coverImagePosition: field(body.cover_image_position) || 'right',
    coverImageRatio: field(body.cover_image_ratio) || 'auto',
    coverImage: Object.hasOwn(body, 'cover_image_url') ? field(body.cover_image_url) : undefined,
    removeCoverImage: booleanField(body.remove_cover_image),
    reservedDate: field(body.reserved_date),
  };
}

function resolveContent(input: AuthoringPostInput): string {
  return input.contentType === 'markdown'
    ? markdownToHtml(input.text)
    : sanitizePostHtml(input.text);
}

function cookieValue(request: FastifyRequest, name: string): string {
  const cookie = request.headers.cookie;
  if (!cookie) return '';
  for (const part of cookie.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0 || part.slice(0, separator).trim() !== name) continue;
    const value = part.slice(separator + 1).trim();
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }
  return '';
}

function notFound(reply: FastifyReply): null {
  reply.code(404).type('text/plain; charset=utf-8').send('Not found');
  return null;
}

function forbidden(reply: FastifyReply): null {
  reply.code(403).type('text/plain; charset=utf-8').send('Forbidden');
  return null;
}

function managementNotFound(reply: FastifyReply, message = '페이지를 찾을 수 없습니다.') {
  return reply.code(404).type('text/plain; charset=utf-8').send(message);
}

function managementForbidden(reply: FastifyReply) {
  return reply.code(403).type('text/plain; charset=utf-8').send('요청 권한을 확인할 수 없습니다.');
}

function editorRedirect(reply: FastifyReply, loggedIn: boolean): null {
  reply.redirect(loggedIn ? '/' : '/login', 302);
  return null;
}

async function currentAccount(
  request: FastifyRequest,
  db: PrismaClient,
  options: AuthoringOptions,
): Promise<UserRow | null> {
  const user = await options.currentUser(request);
  if (!user || !Number.isSafeInteger(user.id) || user.id < 1) return null;
  const rows = await db.$queryRaw<UserRow[]>`
    SELECT author.id AS id,
           author.username AS username,
           CAST(author.is_active AS INTEGER) AS isActive,
           profile.role AS role
    FROM auth_user AS author
    LEFT JOIN board_profile AS profile ON profile.user_id = author.id
    WHERE author.id = ${user.id} AND author.username = ${user.username}
    LIMIT 1
  `;
  const account = rows[0];
  return account && numberValue(account.isActive) === 1
    ? { ...account, isStaff: user.isStaff, notifyCount: user.notifyCount, hasConnectedTelegram: user.hasConnectedTelegram }
    : null;
}

async function editorAccount(
  request: FastifyRequest,
  reply: FastifyReply,
  db: PrismaClient,
  options: AuthoringOptions,
  api: boolean,
  hideAnonymous = false,
): Promise<UserRow | null> {
  const account = await currentAccount(request, db, options);
  if (!account) {
    if (api && !hideAnonymous) reply.send(failed('NL', 'Login required.'));
    else if (api && hideAnonymous) notFound(reply);
    else editorRedirect(reply, false);
    return null;
  }
  if (account.role !== 'EDITOR') {
    if (api) reply.send(failed('RJ', 'Author access is required.'));
    else editorRedirect(reply, true);
    return null;
  }
  return account;
}

async function getSeriesOptions(db: PrismaClient, userId: number): Promise<SeriesOption[]> {
  return db.$queryRaw<SeriesOption[]>`
    SELECT id, name, url FROM board_series
    WHERE owner_id = ${userId}
    ORDER BY updated_date DESC, id DESC
  `;
}

async function loadPost(
  db: PrismaClient,
  where: { username?: string; userId?: number; slug: string },
): Promise<StoredPost | null> {
  const rows = where.userId !== undefined
    ? await db.$queryRaw<StoredPost[]>`
        SELECT post.id AS id, post.title AS title, post.subtitle AS subtitle, post.url AS url,
               post.image AS image, post.meta_description AS description,
               CAST(post.created_date AS TEXT) AS createdDate,
               CAST(post.updated_date AS TEXT) AS updatedDate,
               CAST(post.published_date AS TEXT) AS publishedDate,
               CAST(post.deleted_date AS TEXT) AS deletedDate,
               post.author_id AS authorId, author.username AS authorUsername,
               profile.avatar AS authorAvatar, post.read_time AS readTime,
               post.series_id AS seriesId, series.name AS seriesName, series.url AS seriesUrl,
               CAST(series.hide AS INTEGER) AS seriesHidden,
               COALESCE(content.content_html, '') AS contentHtml,
               CAST(config.hide AS INTEGER) AS hide,
               CAST(config.advertise AS INTEGER) AS advertise,
               CAST(config.block_comment AS INTEGER) AS blockComment,
               COALESCE(config.cover_layout, 'default') AS coverLayout,
               COALESCE(config.cover_image_position, 'right') AS coverImagePosition,
               COALESCE(config.cover_image_ratio, 'auto') AS coverImageRatio
        FROM board_post AS post
        JOIN auth_user AS author ON author.id = post.author_id
        LEFT JOIN board_profile AS profile ON profile.user_id = author.id
        LEFT JOIN board_postconfig AS config ON config.post_id = post.id
        LEFT JOIN board_postcontent AS content ON content.post_id = post.id
        LEFT JOIN board_series AS series ON series.id = post.series_id
        WHERE post.url = ${where.slug} AND post.author_id = ${where.userId}
          AND post.deleted_date IS NULL
        LIMIT 1
      `
    : await db.$queryRaw<StoredPost[]>`
        SELECT post.id AS id, post.title AS title, post.subtitle AS subtitle, post.url AS url,
               post.image AS image, post.meta_description AS description,
               CAST(post.created_date AS TEXT) AS createdDate,
               CAST(post.updated_date AS TEXT) AS updatedDate,
               CAST(post.published_date AS TEXT) AS publishedDate,
               CAST(post.deleted_date AS TEXT) AS deletedDate,
               post.author_id AS authorId, author.username AS authorUsername,
               profile.avatar AS authorAvatar, post.read_time AS readTime,
               post.series_id AS seriesId, series.name AS seriesName, series.url AS seriesUrl,
               CAST(series.hide AS INTEGER) AS seriesHidden,
               COALESCE(content.content_html, '') AS contentHtml,
               CAST(config.hide AS INTEGER) AS hide,
               CAST(config.advertise AS INTEGER) AS advertise,
               CAST(config.block_comment AS INTEGER) AS blockComment,
               COALESCE(config.cover_layout, 'default') AS coverLayout,
               COALESCE(config.cover_image_position, 'right') AS coverImagePosition,
               COALESCE(config.cover_image_ratio, 'auto') AS coverImageRatio
        FROM board_post AS post
        JOIN auth_user AS author ON author.id = post.author_id
        LEFT JOIN board_profile AS profile ON profile.user_id = author.id
        LEFT JOIN board_postconfig AS config ON config.post_id = post.id
        LEFT JOIN board_postcontent AS content ON content.post_id = post.id
        LEFT JOIN board_series AS series ON series.id = post.series_id
        WHERE post.url = ${where.slug} AND author.username = ${where.username ?? ''}
          AND post.deleted_date IS NULL
        LIMIT 1
      `;
  return rows[0] ?? null;
}

async function postTags(db: PrismaClient, postId: number): Promise<string[]> {
  const rows = await db.$queryRaw<Array<{ value: string }>>`
    SELECT tag.value AS value
    FROM board_tag AS tag
    JOIN board_post_tags AS link ON link.tag_id = tag.id
    WHERE link.post_id = ${postId}
    ORDER BY tag.value
  `;
  return rows.map((row) => row.value);
}

async function draftReservation(db: PrismaClient, postId: number): Promise<string> {
  const rows = await db.$queryRaw<Array<{ value: string }>>`
    SELECT value FROM board_postconfigmeta
    WHERE post_id = ${postId} AND name = 'draft_reserved_date'
    ORDER BY id DESC LIMIT 1
  `;
  // BLEX 4 stores this value as UTC without an offset and Django stored an ISO offset.
  return dateAsIso(rows[0]?.value ?? null) ?? '';
}

async function publicSeriesId(db: Prisma.TransactionClient, userId: number, url: string): Promise<number | null> {
  if (!url) return null;
  const rows = await db.$queryRaw<Array<{ id: number }>>`
    SELECT id FROM board_series WHERE owner_id = ${userId} AND url = ${url} LIMIT 1
  `;
  return rows[0]?.id ?? null;
}

async function uniqueSlug(tx: Prisma.TransactionClient, title: string, customUrl: string, excludeId?: number): Promise<string> {
  const base = slugify(customUrl || title) || `post-${randomBytes(4).toString('hex')}`;
  let candidate = base.slice(0, POST_URL_MAX);
  let attempt = 0;
  while (RESERVED_URLS.has(candidate) || (await tx.$queryRaw<Array<{ id: number }>>`
    SELECT id FROM board_post WHERE url = ${candidate} AND id <> ${excludeId ?? -1} LIMIT 1
  `).length > 0) {
    attempt += 1;
    const suffix = randomBytes(4).toString('hex');
    candidate = `${base.slice(0, Math.max(1, POST_URL_MAX - suffix.length - 1))}-${suffix}`;
    if (attempt > 10) throw new Error('Could not reserve a unique post URL.');
  }
  return candidate;
}

function scheduledDate(input: string): { value: string | null; error: string | null } {
  if (!input) return { value: null, error: null };
  const normalized = /(?:Z|[+-]\d\d:\d\d)$/i.test(input) ? input : `${input}+09:00`;
  const value = new Date(normalized);
  if (Number.isNaN(value.valueOf())) return { value: null, error: 'Check the scheduled time.' };
  if (value.valueOf() <= Date.now()) return { value: null, error: 'The scheduled time must be in the future.' };
  return { value: value.toISOString().replace('T', ' ').replace('Z', ''), error: null };
}

async function syncTags(tx: Prisma.TransactionClient, postId: number, text: string): Promise<void> {
  await tx.$executeRaw`DELETE FROM board_post_tags WHERE post_id = ${postId}`;
  for (const value of normalizedTags(text)) {
    await tx.$executeRaw`
      INSERT INTO board_tag (value) VALUES (${value})
      ON CONFLICT(value) DO NOTHING
    `;
    const tags = await tx.$queryRaw<Array<{ id: number }>>`
      SELECT id FROM board_tag WHERE value = ${value} LIMIT 1
    `;
    if (!tags[0]) continue;
    await tx.$executeRaw`
      INSERT INTO board_post_tags (post_id, tag_id) VALUES (${postId}, ${tags[0].id})
      ON CONFLICT(post_id, tag_id) DO NOTHING
    `;
  }
}

async function syncDraftReservation(tx: Prisma.TransactionClient, postId: number, reservedDate: string): Promise<void> {
  if (!reservedDate) {
    await tx.$executeRaw`
      DELETE FROM board_postconfigmeta WHERE post_id = ${postId} AND name = 'draft_reserved_date'
    `;
    return;
  }
  const parsed = scheduledDate(reservedDate);
  if (parsed.error || !parsed.value) throw new PostValidationError('VA', parsed.error ?? 'Check the scheduled time.');
  const now = nowString();
  const existing = await tx.$queryRaw<Array<{ id: number }>>`
    SELECT id FROM board_postconfigmeta
    WHERE post_id = ${postId} AND name = 'draft_reserved_date'
    ORDER BY id DESC LIMIT 1
  `;
  if (existing[0]) {
    await tx.$executeRaw`
      UPDATE board_postconfigmeta SET value = ${parsed.value}, updated_date = ${now}
      WHERE id = ${existing[0].id}
    `;
  } else {
    await tx.$executeRaw`
      INSERT INTO board_postconfigmeta (name, value, created_date, updated_date, post_id)
      VALUES ('draft_reserved_date', ${parsed.value}, ${now}, ${now}, ${postId})
    `;
  }
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

function comparableDate(value: DbDate): string | null {
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

function assertExpectedUpdatedAt(actual: DbDate, expected: string | undefined): void {
  if (expected === undefined) return;
  if (!actual || comparableDate(actual) !== comparableDate(expected)) {
    throw new PostValidationError('CF', 'The post changed after it was read. Reload it before saving.');
  }
}

interface EditorialSnapshot {
  title: string;
  subtitle: string;
  content: string;
  description: string;
  tags: string[];
  updatedDate: DbDate;
  publishedDate: DbDate;
}

type EditorialSnapshotRow = Omit<EditorialSnapshot, 'tags'>;

async function captureEditorialSnapshot(tx: Prisma.TransactionClient, postId: number): Promise<EditorialSnapshot> {
  const rows = await tx.$queryRaw<EditorialSnapshotRow[]>`
    SELECT post.title AS title, post.subtitle AS subtitle, post.meta_description AS description,
           COALESCE(content.content_html, '') AS content,
           CAST(post.updated_date AS TEXT) AS updatedDate,
           CAST(post.published_date AS TEXT) AS publishedDate
      FROM board_post AS post LEFT JOIN board_postcontent AS content ON content.post_id = post.id
     WHERE post.id = ${postId} LIMIT 1
  `;
  const row = rows[0];
  if (!row) throw new PostValidationError('RJ', 'The post was not found.');
  const tags = await tx.$queryRaw<Array<{ value: string }>>`
    SELECT tag.value AS value FROM board_post_tags AS link JOIN board_tag AS tag ON tag.id = link.tag_id
     WHERE link.post_id = ${postId} ORDER BY tag.value
  `;
  return { ...row, tags: tags.map((tag) => tag.value) };
}

function sameEditorialSnapshot(left: EditorialSnapshot, right: EditorialSnapshot): boolean {
  return left.title === right.title && left.subtitle === right.subtitle
    && left.content === right.content && left.description === right.description
    && JSON.stringify(left.tags) === JSON.stringify(right.tags);
}

function revisionExcerpt(content: string): string {
  const text = plainText(content);
  const characters = Array.from(text);
  return characters.length > 160 ? `${characters.slice(0, 159).join('')}…` : text;
}

async function insertRevision(
  tx: Prisma.TransactionClient,
  postId: number,
  snapshot: EditorialSnapshot,
  actorId: number,
  changeType: 'edit' | 'draft' | 'restore',
  sourceUpdatedDate: DbDate,
  restoredFromId: number | null = null,
): Promise<number> {
  const now = nowString();
  const rows = await tx.$queryRaw<Array<{ id: number }>>`
    INSERT INTO board_edithistory (
      post_id, actor_id, restored_from_id, title, subtitle, content, content_excerpt,
      description, tags, source_updated_date, change_type, created_date
    ) VALUES (
      ${postId}, ${actorId}, ${restoredFromId}, ${snapshot.title}, ${snapshot.subtitle},
      ${snapshot.content}, ${revisionExcerpt(snapshot.content)}, ${snapshot.description},
      ${JSON.stringify(snapshot.tags)}, ${sourceUpdatedDate}, ${changeType}, ${now}
    ) RETURNING id
  `;
  if (!rows[0]) throw new Error('The revision row was not created.');
  return rows[0].id;
}

async function draftSnapshotDue(tx: Prisma.TransactionClient, postId: number): Promise<boolean> {
  const rows = await tx.$queryRaw<Array<{ createdDate: DbDate }>>`
    SELECT CAST(created_date AS TEXT) AS createdDate FROM board_edithistory
     WHERE post_id = ${postId} AND change_type = 'draft'
     ORDER BY created_date DESC, id DESC LIMIT 1
  `;
  const latest = rows[0]?.createdDate;
  return !latest || Date.now() - new Date(dateAsIso(latest) ?? 0).valueOf() >= 10 * 60 * 1000;
}

async function createPost(
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
  const now = nowString();
  const publishAt = asDraft ? null : reserved.value ?? now;
  const coverImage = await resolveCoverImage(db, author.id, input.coverImage, '', input.removeCoverImage);

  return db.$transaction(async (tx) => {
    if (asDraft) {
      const [drafts] = await tx.$queryRaw<Array<{ total: number | bigint }>>`
        SELECT COUNT(*) AS total FROM board_post WHERE author_id = ${author.id} AND published_date IS NULL
      `;
      if (Number(drafts?.total ?? 0) >= MAX_DRAFTS_PER_USER) {
        throw new PostValidationError('OF', `임시 저장 글은 최대 ${MAX_DRAFTS_PER_USER}개까지 가능합니다.`);
      }
    }
    const slug = await uniqueSlug(tx, title, input.url);
    const seriesId = await publicSeriesId(tx, author.id, input.series);
    const inserted = await tx.$queryRaw<Array<{ id: number }>>`
      INSERT INTO board_post (
        title, subtitle, url, image, image_hash, read_time, created_date, updated_date,
        author_id, series_id, meta_description, published_date, deleted_date
      ) VALUES (
        ${title}, ${input.subtitle}, ${slug}, ${coverImage}, '', ${readingTime(html)}, ${now}, ${now},
        ${author.id}, ${seriesId}, ${description}, ${publishAt}, NULL
      ) RETURNING id
    `;
    const postId = inserted[0]?.id;
    if (!postId) throw new Error('The post row was not created.');
    await tx.$executeRaw`
      INSERT INTO board_postcontent (post_id, content_html) VALUES (${postId}, ${html})
    `;
    await tx.$executeRaw`
      INSERT INTO board_postconfig (
        post_id, hide, advertise, block_comment, cover_layout, cover_image_position, cover_image_ratio
      ) VALUES (
        ${postId}, ${input.hide ? 1 : 0}, ${input.advertise ? 1 : 0}, ${input.blockComment ? 1 : 0},
        ${input.coverLayout}, ${input.coverImagePosition}, ${input.coverImageRatio}
      )
    `;
    await syncTags(tx, postId, input.tags);
    if (asDraft && input.reservedDate) await syncDraftReservation(tx, postId, input.reservedDate);
    if (!asDraft) await syncPostPublication(tx, postId, { announce: true });
    return { id: postId, url: slug, publishedDate: publishAt };
  });
}

async function updatePost(
  db: PrismaClient,
  author: UserRow,
  post: StoredPost,
  input: AuthoringPostInput,
  options: {
    allowEmptyBody: boolean;
    publishDraft?: boolean;
    updateDraft?: boolean;
    expectedUpdatedDate?: DbDate;
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
  const now = nowString();
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
  const existingPublishedAt = dateAsIso(post.publishedDate);
  const isScheduledPost = Boolean(existingPublishedAt && new Date(existingPublishedAt).valueOf() > Date.now());
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
  const existingPublishDate = post.publishedDate instanceof Date
    ? post.publishedDate.toISOString().replace('T', ' ').replace('Z', '')
    : post.publishedDate;
    const nextPublishDate = options.publishDraft
      ? schedule.value ?? now
      : isScheduledPost && schedule.value ? schedule.value : existingPublishDate;
    const expectedUpdatedDate = options.expectedUpdatedDate ?? post.updatedDate;
    const writeGuard = expectedUpdatedDate === undefined
      ? Prisma.empty
      : Prisma.sql`AND updated_date = ${expectedUpdatedDate}`;
    const changed = await tx.$executeRaw`
      UPDATE board_post
      SET title = ${title}, subtitle = ${input.subtitle}, url = ${nextUrl}, image = ${coverImage},
          series_id = ${seriesId},
          meta_description = ${description},
          read_time = ${html === null ? readingTime(post.contentHtml) : readingTime(html)},
          updated_date = ${now},
          published_date = ${nextPublishDate}
      WHERE id = ${post.id} AND author_id = ${author.id} AND deleted_date IS NULL ${writeGuard}
    `;
    if (numberValue(changed) === 0) {
      throw new PostValidationError('CF', 'The post changed after it was read. Reload it before saving.');
    }
    if (html !== null) {
      const contentRows = await tx.$queryRaw<Array<{ id: number }>>`
        SELECT id FROM board_postcontent WHERE post_id = ${post.id} LIMIT 1
      `;
      if (contentRows[0]) {
        await tx.$executeRaw`
          UPDATE board_postcontent SET content_html = ${html} WHERE post_id = ${post.id}
        `;
      } else {
        await tx.$executeRaw`
          INSERT INTO board_postcontent (post_id, content_html) VALUES (${post.id}, ${html})
        `;
      }
    }
    const configRows = await tx.$queryRaw<Array<{ id: number }>>`
      SELECT id FROM board_postconfig WHERE post_id = ${post.id} LIMIT 1
    `;
    if (configRows[0]) {
      await tx.$executeRaw`
        UPDATE board_postconfig
        SET hide = ${input.hide ? 1 : 0}, advertise = ${input.advertise ? 1 : 0},
            block_comment = ${input.blockComment ? 1 : 0}, cover_layout = ${input.coverLayout},
            cover_image_position = ${input.coverImagePosition}, cover_image_ratio = ${input.coverImageRatio}
        WHERE post_id = ${post.id}
      `;
    } else {
      await tx.$executeRaw`
        INSERT INTO board_postconfig (
          post_id, hide, advertise, block_comment, cover_layout, cover_image_position, cover_image_ratio
        ) VALUES (
          ${post.id}, ${input.hide ? 1 : 0}, ${input.advertise ? 1 : 0}, ${input.blockComment ? 1 : 0},
          ${input.coverLayout}, ${input.coverImagePosition}, ${input.coverImageRatio}
        )
      `;
    }
    if (input.hide && !isTrue(post.hide)) await tx.$executeRaw`DELETE FROM board_pinnedpost WHERE post_id = ${post.id}`;
    if (!options.preserveTags) await syncTags(tx, post.id, input.tags);
    if (options.updateDraft && input.reservedDate) await syncDraftReservation(tx, post.id, input.reservedDate);
    if (options.updateDraft && !input.reservedDate) await syncDraftReservation(tx, post.id, '');
    if (options.publishDraft) {
      await tx.$executeRaw`
        DELETE FROM board_postconfigmeta WHERE post_id = ${post.id} AND name = 'draft_reserved_date'
      `;
    }
    if (options.publishDraft || isTrue(post.hide) !== input.hide || (isScheduledPost && Boolean(input.reservedDate))) {
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

async function trashPost(
  db: PrismaClient,
  author: UserRow,
  post: StoredPost,
  expectedUpdatedDate?: DbDate,
): Promise<string> {
  const deletedDate = nowString();
  await db.$transaction(async (tx) => {
    const writeGuard = expectedUpdatedDate === undefined
      ? Prisma.empty
      : Prisma.sql`AND updated_date = ${expectedUpdatedDate}`;
    const changed = await tx.$executeRaw`
      UPDATE board_post SET deleted_date = ${deletedDate}
      WHERE id = ${post.id} AND author_id = ${author.id} AND deleted_date IS NULL ${writeGuard}
    `;
    if (expectedUpdatedDate !== undefined && numberValue(changed) === 0) {
      throw new PostValidationError('CF', 'The post changed after it was read. Reload it before deleting.');
    }
    await syncPostPublication(tx, post.id);
  });
  return deletedDate.replace(' ', 'T') + 'Z';
}

async function sendEditorPage(
  reply: FastifyReply,
  model: EditorModel,
  statusCode = 200,
  editorAssets?: AuthoringOptions['editorAssets'],
): Promise<void> {
  reply.code(statusCode)
    .type('text/html; charset=utf-8')
    .header('Cache-Control', 'private, no-store')
    .header('X-Robots-Tag', 'noindex, nofollow')
    .header('X-Frame-Options', 'DENY')
    .send(renderEditorPage(model, editorAssets));
}

function editorIcon(name: 'drafts' | 'preview' | 'settings' | 'image' | 'close' | 'publish') {
  const paths: Record<typeof name, string[]> = {
    drafts: ['M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z', 'M14 2v6h6', 'M8 13h8', 'M8 17h8'],
    preview: ['M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z', 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z'],
    settings: ['M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z', 'M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-1.7 2.9-.2-.1a1.7 1.7 0 0 0-1.9.3l-.1.1h-3.4l-.1-.2a1.7 1.7 0 0 0-1.6-1.1 1.7 1.7 0 0 0-1.6 1.1l-.1.2H5.7l-.1-.1a1.7 1.7 0 0 0-1.9-.3l-.2.1-1.7-2.9.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.4-1V9.6l.2-.1a1.7 1.7 0 0 0 1.1-1.6 1.7 1.7 0 0 0-1.1-1.6l-.2-.1 1.7-2.9.2.1a1.7 1.7 0 0 0 1.9-.3l.1-.1h3.4l.1.2a1.7 1.7 0 0 0 1.6 1.1 1.7 1.7 0 0 0 1.6-1.1l.1-.2h3.4l.1.1a1.7 1.7 0 0 0 1.9.3l.2-.1 1.7 2.9-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.4 1v3.4l-.2.1a1.7 1.7 0 0 0-1.1 1.6 1.7 1.7 0 0 0 1.1 1.6l.2.1z'],
    image: ['M4 3h16a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z', 'm3 16 5-5 4 4 3-3 6 6', 'M8.5 8.5h.01'],
    close: ['m18 6-12 12', 'm6 6 12 12'],
    publish: ['m22 2-7 20-4-9-9-4 20-7z', 'M22 2 11 13'],
  };
  return h1('svg', { viewBox: '0 0 24 24', width: 20, height: 20, fill: 'none', stroke: 'currentColor', strokeWidth: 1.75, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true },
    ...paths[name].map((d) => h1('path', { key: d, d })));
}

function renderEditorPage(model: EditorModel, editorAssets?: AuthoringOptions['editorAssets']): string {
  const formAction = model.isEdit ? `/@${encodeURIComponent(model.username)}/${encodeURIComponent(model.postUrl)}/edit` : '/write';
const title = model.isEdit ? model.isDraft ? '임시 포스트 수정' : '포스트 수정' : model.isDraft ? '임시 포스트' : '새 포스트';
  const postPath = `/@${encodeURIComponent(model.username)}/${encodeURIComponent(model.postUrl)}`;
  const seriesOptions = [h1('option', { value: '' }, '시리즈 없음'), ...model.seriesOptions.map((series) =>
    h1('option', { value: series.url }, `${series.name} · ${series.url}`))];
  const coverLayouts = [
    ['default', '기본', '제목 다음에 이미지가 자연스럽게 이어집니다.'],
    ['split', '분할', '제목과 대표 이미지를 좌우로 배치합니다.'],
    ['overlay', '이미지 배경', '이미지를 넓게 깔고 제목을 위에 올립니다.'],
    ['none', '커버 숨김', '대표 이미지는 목록과 공유에만 사용합니다.'],
  ];
  const body = h1('html', { lang: 'ko' },
    h1('head', null,
      h1('meta', { charSet: 'utf-8' }),
      h1('meta', { name: 'viewport', content: 'width=device-width, initial-scale=1' }),
      h1('meta', { name: 'robots', content: 'noindex,nofollow' }),
      h1('title', null, `${title} - BLEX`),
      h1(SiteTheme),
      ...(editorAssets?.css ?? []).map((href) => h1('link', { rel: 'stylesheet', href })),
    ),
    h1('body', null,
      h1(SiteHeader, { viewer: { username: model.username, hasEditorRole: true, csrfToken: model.csrfToken }, editorPage: true }),
      h1('div', { className: 'post-editor-page pt-8 pb-40 px-4 md:px-6' },
        h1('div', { className: 'post-detail-layout' },
          h1('aside', { className: 'post-detail-sidebar', 'aria-hidden': true }),
          h1('main', { className: 'post-detail-main' },
            h1('h1', { className: 'sr-only' }, title),
            model.formTitle ? h1('p', { className: 'editor-template-note' }, `“${model.formTitle}” 글 양식을 불러왔습니다.`) : null,
            model.successMessage ? h1('p', { className: 'editor-notice editor-notice-success', role: 'status' }, model.successMessage) : null,
            model.isDraft ? h1('p', { className: 'editor-draft-note' }, '임시 글은 본인에게만 보입니다. 발행하기 전까지는 공개되지 않습니다.') : null,
            model.errorMessage ? h1('p', { className: 'editor-notice editor-notice-error', role: 'alert' }, model.errorMessage) : null,
            h1('form', { id: 'post-editor-form', className: 'post-editor-form', method: 'post', action: formAction },
              h1('input', { type: 'hidden', name: 'csrfmiddlewaretoken', value: model.csrfToken }),
              model.isDraft && !model.isEdit ? h1('input', { type: 'hidden', name: 'draft_url', value: model.postUrl }) : null,
              h1('input', { type: 'hidden', name: 'content_type', value: model.contentType }),
              h1('section', {
                className: 'post-editor-cover',
                'data-cover-layout': model.coverLayout,
                'data-cover-image-position': model.coverImagePosition,
                'data-cover-image-ratio': model.coverImageRatio,
              },
              h1('div', { className: 'post-editor-cover-copy' },
                h1('label', { className: 'sr-only', htmlFor: 'editor-title' }, '제목'),
                h1('input', {
                  id: 'editor-title', className: 'editor-title-input', name: 'title', type: 'text',
                  required: !model.isDraft, maxLength: POST_TITLE_MAX, defaultValue: model.title,
                  placeholder: '제목을 입력하세요', autoComplete: 'off',
                }),
                h1('label', { className: 'sr-only', htmlFor: 'editor-subtitle' }, '부제목'),
                h1('input', {
                  id: 'editor-subtitle', className: 'editor-subtitle-input', name: 'subtitle', type: 'text',
                  maxLength: POST_SUBTITLE_MAX, defaultValue: model.subtitle,
                  placeholder: '부제목 (선택사항)', autoComplete: 'off',
                }),
              ),
              h1('div', { className: 'post-editor-cover-image', 'data-cover-empty': !model.coverImageUrl },
                model.coverImageUrl ? h1('img', { id: 'editor-cover-preview', src: model.coverImageUrl, alt: '', 'data-no-filter': true }) : null,
                h1('button', { type: 'button', className: 'editor-cover-picker', 'data-editor-cover-upload': true, 'aria-label': '대표 이미지 추가 또는 변경' },
                  editorIcon('image'),
                  h1('span', null, model.coverImageUrl ? '대표 이미지 변경' : '대표 이미지 추가'),
                  h1('small', null, '이미지 파일을 선택해 올리기')),
                h1('input', {
                  type: 'file', className: 'editor-cover-file-input', accept: 'image/jpeg,image/png,image/gif,image/webp',
                  'data-editor-cover-file': true,
                }),
                h1('span', { className: 'editor-cover-upload-status', role: 'status', 'aria-live': 'polite', 'data-editor-cover-status': true }),
              )),
              h1('details', { className: 'editor-help' },
                h1('summary', null, h1('span', { className: 'editor-help-icon', 'aria-hidden': true }, '✦'), '에디터 사용법'),
                h1('div', { className: 'editor-help-content' },
                  h1('p', null, '본문 도구 모음에서 제목, 목록, 링크, 이미지, 표를 넣을 수 있습니다.'),
                  h1('p', null, '이미지는 도구 모음에서 올리거나 본문에 붙여 넣고 끌어 놓을 수 있습니다.'),
                  h1('p', null, '원본 HTML이나 Markdown을 직접 고치려면 “소스로 편집”을 선택하세요.')),
              ),
              h1('div', { className: 'editor-body-area' },
                h1('div', {
                  id: 'blex-editor-tools',
                  'data-storage-key': `blex-editor:${model.username}:${model.postUrl || 'new'}`,
                  'data-saved': model.savedDraft ? 'true' : undefined,
                  'data-content-type': model.contentType,
                }),
                h1('label', { className: 'editor-source-field' },
                  h1('span', { 'data-editor-source-label': '' }, model.contentType === 'html' ? '본문 소스' : '마크다운 본문'),
                  h1('textarea', {
                    name: 'text_md', required: !model.isDraft,
                    placeholder: '내용을 입력하세요', defaultValue: model.content,
                    'aria-label': model.contentType === 'html' ? '본문 소스' : '마크다운 본문',
                  })),
              ),
              h1('label', { className: 'editor-tags-field' },
                h1('span', null, '태그'),
                h1('input', { name: 'tag', type: 'text', defaultValue: model.tags, placeholder: '태그를 입력하고 쉼표로 구분하세요', autoComplete: 'off' })),
              h1('input', { type: 'hidden', name: 'block_comment', value: 'false' }),
              h1('dialog', { id: 'editor-settings-dialog', className: 'editor-settings-dialog', 'aria-labelledby': 'editor-settings-title' },
                h1('div', { className: 'editor-settings-header' },
                  h1('div', null,
                    h1('h2', { id: 'editor-settings-title' }, '게시 설정'),
                    h1('p', null, '공개 방식과 검색·공유 정보를 관리합니다.')),
                  h1('button', { type: 'button', className: 'editor-icon-button', 'data-editor-close-settings': true, 'aria-label': '닫기' }, editorIcon('close')),
                ),
                h1('div', { className: 'editor-settings-scroll' },
                  h1('section', { className: 'editor-settings-section' },
                    h1('h3', null, '발행 설정'),
                    model.showSchedule ? h1('label', { className: 'editor-setting-card' },
                      h1('span', { className: 'editor-setting-copy' },
                        h1('strong', null, '예약 발행'),
                        h1('small', null, '비워 두면 바로 발행됩니다.')),
                      h1('input', { type: 'datetime-local', name: 'reserved_date', defaultValue: model.reservedDate, 'data-schedule-control': true }),
                    ) : h1('p', { className: 'editor-setting-hint' }, '이미 공개된 글은 편집 중인 상태로 유지됩니다.'),
                    h1('label', { className: 'editor-setting-toggle' },
                      h1('span', null, h1('strong', null, '비공개'), h1('small', null, '주소를 아는 사람만 볼 수 있습니다.')),
                      h1('input', { type: 'checkbox', name: 'hide', value: 'on', defaultChecked: model.hide })),
                    h1('label', { className: 'editor-setting-toggle' },
                      h1('span', null, h1('strong', null, '댓글 차단'), h1('small', null, '독자가 새 댓글과 답글을 작성할 수 없습니다.')),
                      h1('input', { type: 'checkbox', name: 'block_comment', value: 'on', defaultChecked: model.blockComment })),
                  ),
                  h1('section', { className: 'editor-settings-section' },
                    h1('h3', null, '분류'),
                    h1('label', null, '시리즈', h1('select', { name: 'series', defaultValue: model.series }, ...seriesOptions)),
                  ),
                  h1('section', { className: 'editor-settings-section' },
                    h1('h3', null, '커버 스타일'),
                    h1('div', { className: 'editor-cover-layout-options', role: 'group', 'aria-label': '커버 스타일' },
                      ...coverLayouts.map(([value, label, description]) => h1('label', { key: value, className: 'editor-cover-layout-option' },
                        h1('input', { type: 'radio', name: 'cover_layout', value, defaultChecked: model.coverLayout === value }),
                        h1('span', null, h1('strong', null, label), h1('small', null, description))))),
                    h1('div', { className: 'editor-setting-grid' },
                      h1('label', null, '이미지 위치', h1('select', { name: 'cover_image_position', defaultValue: model.coverImagePosition },
                        h1('option', { value: 'right' }, '오른쪽'), h1('option', { value: 'left' }, '왼쪽'))),
                      h1('label', null, '이미지 비율', h1('select', { name: 'cover_image_ratio', defaultValue: model.coverImageRatio },
                        h1('option', { value: 'auto' }, '원본 비율'), h1('option', { value: '16:9' }, '16:9'),
                        h1('option', { value: '4:3' }, '4:3'), h1('option', { value: '1:1' }, '1:1'),
                        h1('option', { value: '3:4' }, '3:4'))),
                    ),
                    h1('label', { className: 'editor-cover-url-field' }, '대표 이미지 URL',
                      h1('input', { name: 'cover_image_url', type: 'text', inputMode: 'url', defaultValue: model.coverImageUrl, placeholder: '/resources/media/…', 'data-cover-url': true }),
                      h1('span', { className: 'editor-setting-hint' }, '이미지를 먼저 올린 뒤 주소를 붙여 넣으세요.'),
                      h1('a', { href: '/write/images', target: '_blank', rel: 'noopener noreferrer' }, '이미지·동영상 올리기')),
                    h1('label', { className: 'editor-setting-toggle editor-remove-image' },
                      h1('span', null, h1('strong', null, '대표 이미지 삭제'), h1('small', null, '공유와 목록에서 이 이미지를 사용하지 않습니다.')),
                      h1('input', { type: 'checkbox', name: 'remove_cover_image', value: 'on' })),
                  ),
                  h1('section', { className: 'editor-settings-section' },
                    h1('h3', null, '검색 및 공유'),
                    h1('label', null, 'URL', h1('input', { name: 'url', maxLength: POST_URL_MAX, defaultValue: model.postUrl, placeholder: '자동 생성' })),
                    h1('label', null, '검색·공유 설명', h1('textarea', { name: 'meta_description', maxLength: POST_DESCRIPTION_MAX, defaultValue: model.description, placeholder: '포스트를 소개하는 설명을 입력하세요' })),
                  ),
                  model.isEdit ? h1('section', { className: 'editor-settings-section' },
                    h1('h3', null, '이 글 관리'),
                    h1('nav', { className: 'editor-settings-links', 'aria-label': '글 도구' },
                      !model.isDraft ? h1('a', { href: `${postPath}/revisions` }, '수정 기록') : null,
                      !model.isDraft ? h1('a', { href: `${postPath}/timelapse` }, '작성 타임라인') : null,
                      h1('a', { href: '/settings/posts' }, '글 관리'),
                      h1('a', { href: '/settings/forms' }, '글 양식'),
                      h1('a', { href: '/settings/developer-api' }, '개발자 API'),
                      h1('a', { href: '/docs/developer-api/quickstart' }, 'API 빠른 시작')),
                  ) : h1('section', { className: 'editor-settings-section' },
                    h1('h3', null, '도움말'),
                    h1('nav', { className: 'editor-settings-links', 'aria-label': '글 작성 도움말' },
                      h1('a', { href: '/settings/drafts' }, '임시 글 열기'),
                      h1('a', { href: '/settings/forms' }, '글 양식'),
                      h1('a', { href: '/settings/developer-api' }, '개발자 API'),
                      h1('a', { href: '/docs/developer-api/quickstart' }, 'API 빠른 시작')),
                  ),
                ),
                h1('div', { className: 'editor-settings-footer' },
                  h1('button', { type: 'button', className: 'editor-settings-done', 'data-editor-close-settings': true }, '완료')),
              ),
              h1('div', { className: 'editor-action-dock' },
                h1('div', { className: 'editor-action-bar', 'aria-label': '글 작업' },
                  !model.isEdit ? h1('a', { href: '/settings/drafts', className: 'editor-action-icon', 'aria-label': '임시 글', title: '임시 글' }, editorIcon('drafts')) : null,
                  h1('button', { type: 'button', className: 'editor-action-icon', 'data-editor-preview': true, 'aria-label': '미리보기', title: '미리보기' }, editorIcon('preview')),
                  h1('button', { type: 'button', className: 'editor-action-icon', 'data-editor-open-settings': true, 'aria-label': '게시 설정', title: '게시 설정' }, editorIcon('settings')),
                  h1('span', { className: 'editor-action-separator', 'aria-hidden': true }),
                  h1('span', { className: 'editor-save-status', role: 'status', 'aria-live': 'polite', 'data-editor-save-status': true }, '이 기기에 복구 저장'),
                  (!model.isEdit || model.isDraft) ? h1('button', { type: 'submit', className: 'editor-action-secondary', name: 'action', value: 'draft', formNoValidate: true }, '임시 저장') : null,
                  h1('button', { type: 'submit', className: 'editor-action-publish', name: 'action', value: 'publish' },
                    editorIcon('publish'), model.isEdit && !model.isDraft ? '수정사항 저장' : '발행'),
                  model.isEdit ? h1('button', { type: 'submit', className: 'editor-action-delete', name: 'action', value: 'delete', formNoValidate: true }, '휴지통') : null,
                ),
              ),
            ),
            model.isDraft && model.postUrl ? h1('p', { className: 'editor-preview-link' }, h1('a', { href: `/write/preview/${encodeURIComponent(model.postUrl)}` }, '별도 화면에서 미리보기')) : null,
          ),
          h1('aside', { className: 'post-detail-sidebar', 'aria-hidden': true }),
        ),
      ),
      editorAssets?.script ? h1('script', { type: 'module', src: editorAssets.script, 'data-blex-page-module': 'editor' }) : null,
    ),
  );
  return renderApplicationDocument(body);
}

type ManagementTab = 'published' | 'scheduled' | 'drafts' | 'trash';

interface ManagementPageModel {
  username: string;
  isStaff?: boolean;
  notifyCount?: number;
  hasConnectedTelegram?: boolean;
  csrfToken: string;
  tab: ManagementTab;
  page: number;
  lastPage: number;
  totalCount: number;
  posts: Array<Record<string, unknown>>;
  drafts: StoredDraftSummary[];
  trash: Array<Record<string, unknown>>;
  filters: { search: string; tag: string; series: string; visibility: string; order: string };
}

function managementPageHref(tab: ManagementTab, page: number, filters: ManagementPageModel['filters']): string {
  const params = new URLSearchParams();
  if (tab !== 'published') params.set('tab', tab);
  if (page > 1) params.set('page', String(page));
  for (const [key, value] of Object.entries(filters)) if (value) params.set(key, value);
  const query = params.toString();
  return `/settings/posts${query ? `?${query}` : ''}`;
}

const managementCss = [
  ".post-management .management-tabs{display:flex;flex-wrap:wrap;gap:.45rem;border-bottom:1px solid var(--color-line-light);padding-bottom:.75rem}",
  ".post-management .management-tabs a{display:inline-flex;min-height:2.5rem;align-items:center;border-radius:.65rem;padding:.5rem .8rem;color:var(--color-content-secondary);font-size:.875rem;font-weight:550;text-decoration:none}",
  ".post-management .management-tabs a:hover,.post-management .management-tabs a[aria-current=page]{background:var(--color-surface-subtle);color:var(--color-content)}",
  ".post-management .management-tabs a[aria-current=page]{font-weight:650}",
  ".post-management .filters{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,12rem),1fr));gap:.85rem}",
  ".post-management .filter-field{display:grid;min-width:0;gap:.35rem}",
  ".post-management .filter-field label{font-size:.75rem}",
  ".post-management .post-list{display:grid;gap:.75rem}",
  ".post-management .post-item{display:flex;min-width:0;flex-wrap:wrap;align-items:flex-start;justify-content:space-between;gap:1rem;border:1px solid var(--color-line-light);border-radius:.9rem;background:var(--color-surface);padding:1rem}",
  ".post-management .post-copy{min-width:0;flex:1 1 18rem}",
  ".post-management .post-title{margin:0;overflow-wrap:anywhere;font-size:1rem;font-weight:650;line-height:1.45}",
  ".post-management .post-title a{color:var(--color-content);text-decoration:none}",
  ".post-management .post-title a:hover{text-decoration:underline;text-underline-offset:.2em}",
  ".post-management .post-meta{margin:.4rem 0 0;color:var(--color-content-secondary);font-size:.8rem;line-height:1.55}",
  ".post-management .post-actions{display:flex;flex:0 1 auto;flex-wrap:wrap;align-items:center;gap:.45rem}",
  ".post-management .post-actions form{display:inline-flex;margin:0}",
  ".post-management .post-actions .button,.post-management .post-actions button{display:inline-flex;min-height:2.5rem;align-items:center;justify-content:center;border:1px solid var(--color-line);border-radius:.65rem;background:var(--color-surface);padding:.45rem .75rem;color:var(--color-content-secondary);font:inherit;font-size:.8rem;font-weight:550;text-decoration:none;cursor:pointer}",
  ".post-management .post-actions .button:hover,.post-management .post-actions button:hover{background:var(--color-surface-subtle);color:var(--color-content)}",
  ".post-management .post-actions .danger-button{border-color:var(--color-danger-line);color:var(--color-danger)}",
  ".post-management .post-actions .danger-button:hover{background:var(--color-danger-surface)}",
  ".post-management .confirm{display:inline-flex;align-items:center;gap:.35rem;color:var(--color-content-secondary);font-size:.75rem}",
  ".post-management .notice{border-radius:.75rem;background:var(--color-warning-surface);padding:.75rem .9rem;color:var(--color-content-secondary);font-size:.85rem}",
  ".post-management .empty{margin:0;border:1px dashed var(--color-line);border-radius:.85rem;padding:2.5rem 1rem;color:var(--color-content-secondary);text-align:center}",
  ".post-management .pagination{display:flex;justify-content:space-between;gap:1rem;margin-top:1rem}",
  ".post-management .pagination a{display:inline-flex;min-height:2.5rem;align-items:center;border:1px solid var(--color-line);border-radius:.65rem;background:var(--color-surface);padding:.45rem .75rem;color:var(--color-content-secondary);font-size:.85rem;text-decoration:none}",
  "@media(max-width:42rem){.post-management .post-item{flex-direction:column}.post-management .post-actions{width:100%}}",
].join('');

function renderManagementPage(model: ManagementPageModel): string {
  const tabLinks: Array<[ManagementTab, string, string]> = [
    ['published', '발행 포스트', '/settings/posts'],
    ['scheduled', '예약 포스트', '/settings/posts?tab=scheduled'],
    ['drafts', '임시 포스트', '/settings/posts?tab=drafts'],
    ['trash', '휴지통', '/settings/posts?tab=trash'],
  ];
  const selectedTab = model.tab;
  const activePosts = model.posts.map((post) => {
    const slug = String(post.url ?? '');
    const title = String(post.title || '제목 없는 포스트');
    const editUrl = '/@' + encodeURIComponent(model.username) + '/' + encodeURIComponent(slug) + '/edit';
    const detailUrl = '/@' + encodeURIComponent(model.username) + '/' + encodeURIComponent(slug);
    return h1('article', { className: 'post-item', key: slug },
      h1('div', { className: 'post-copy' },
        h1('h2', { className: 'post-title' }, h1('a', { href: editUrl }, title)),
        h1('p', { className: 'post-meta' },
          model.tab === 'scheduled' ? '예약 발행 ' + String(post.createdDate ?? '') : '발행 ' + String(post.createdDate ?? ''),
          ' · 수정 ' + String(post.updatedDate ?? ''),
          ' · 좋아요 ' + String(post.countLikes ?? 0) + ' · 댓글 ' + String(post.countComments ?? 0),
          ' · ' + Number(post.readTime ?? 0) + '분 읽기',
        ),
        h1('p', { className: 'post-meta' },
          '태그: ' + String(post.tag || '없음') + ' · 시리즈: ' + String(post.series || '선택 안 함') + ' · 공개 상태: ' + (post.isHide ? '숨김' : '공개'),
        ),
      ),
      h1('div', { className: 'post-actions' },
        h1('a', { className: 'button', href: editUrl }, '편집'),
        model.tab === 'scheduled'
          ? h1('form', { method: 'post', action: '/settings/posts/' + encodeURIComponent(slug) + '/schedule/cancel' },
              h1('input', { type: 'hidden', name: 'csrfmiddlewaretoken', value: model.csrfToken }),
              h1('button', { type: 'submit' }, '예약 취소'))
          : h1('a', { className: 'button', href: detailUrl }, '보기'),
        h1('form', { method: 'post', action: '/settings/posts/' + encodeURIComponent(slug) + '/visibility' },
          h1('input', { type: 'hidden', name: 'csrfmiddlewaretoken', value: model.csrfToken }),
          h1('button', { type: 'submit' }, post.isHide ? '공개하기' : '숨기기')),
        h1('form', { method: 'post', action: '/settings/posts/' + encodeURIComponent(slug) + '/trash' },
          h1('input', { type: 'hidden', name: 'csrfmiddlewaretoken', value: model.csrfToken }),
          h1('button', { className: 'danger-button', type: 'submit' }, '휴지통으로 이동')),
      ),
    );
  });
  const draftItems = model.drafts.map((draft) => h1('article', { className: 'post-item', key: draft.url },
    h1('div', { className: 'post-copy' },
      h1('h2', { className: 'post-title' }, h1('a', { href: '/write?draft=' + encodeURIComponent(draft.url) }, draft.title || '제목 없는 포스트')),
      h1('p', { className: 'post-meta' }, '마지막 수정 ' + managementDate(draft.updatedDate)),
    ),
    h1('div', { className: 'post-actions' },
      h1('a', { className: 'button', href: '/write?draft=' + encodeURIComponent(draft.url) }, '계속 쓰기'),
      h1('a', { className: 'button', href: '/write/preview/' + encodeURIComponent(draft.url) }, '미리보기'),
      h1('form', { method: 'post', action: '/settings/drafts/' + encodeURIComponent(draft.url) + '/trash' },
        h1('input', { type: 'hidden', name: 'csrfmiddlewaretoken', value: model.csrfToken }),
        h1('button', { className: 'danger-button', type: 'submit' }, '휴지통으로 이동')),
    ),
  ));
  const trashItems = model.trash.map((post) => {
    const slug = String(post.url ?? '');
    const rawDeletedDate = String(post.deletedDate ?? '');
    const deletedDate = managementDate(rawDeletedDate, true);
    const status = String(post.sourceStatus ?? 'draft');
    const statusLabel = status === 'scheduled' ? '예약 포스트' : status === 'published' ? '발행 포스트' : '임시 포스트';
    return h1('article', { className: 'post-item', key: slug + ':' + rawDeletedDate },
      h1('div', { className: 'post-copy' },
        h1('h2', { className: 'post-title' }, String(post.title || '제목 없는 포스트')),
        h1('p', { className: 'post-meta' }, '휴지통 이동 ' + deletedDate + ' · 이전 상태 ' + statusLabel + (post.isHide ? ' · 숨김' : '')),
        post.scheduleElapsed ? h1('p', { className: 'notice' }, '예약 시각이 지나 복원하면 발행 상태가 됩니다. 기존 비공개 설정은 그대로 유지됩니다.') : null,
      ),
      h1('div', { className: 'post-actions' },
        h1('form', { method: 'post', action: '/settings/posts/trash/' + encodeURIComponent(slug) + '/restore' },
          h1('input', { type: 'hidden', name: 'csrfmiddlewaretoken', value: model.csrfToken }),
          h1('input', { type: 'hidden', name: 'expected_deleted_date', value: rawDeletedDate }),
          h1('button', { type: 'submit' }, '복원')),
        h1('form', { method: 'post', action: '/settings/posts/trash/' + encodeURIComponent(slug) + '/purge' },
          h1('input', { type: 'hidden', name: 'csrfmiddlewaretoken', value: model.csrfToken }),
          h1('input', { type: 'hidden', name: 'expected_deleted_date', value: rawDeletedDate }),
          h1('label', { className: 'confirm' }, h1('input', { type: 'checkbox', name: 'confirm_permanent', value: 'yes', required: true }), '영구 삭제를 확인합니다'),
          h1('button', { className: 'danger-button', type: 'submit' }, '영구 삭제')),
      ),
    );
  });
  const rows = selectedTab === 'drafts' ? draftItems : selectedTab === 'trash' ? trashItems : activePosts;
  const empty = rows.length === 0 ? h1('p', { className: 'empty' }, selectedTab === 'trash' ? '휴지통이 비어 있습니다.' : selectedTab === 'drafts' ? '임시 포스트가 없습니다.' : selectedTab === 'scheduled' ? '예약 포스트가 없습니다.' : '발행 포스트가 없습니다.') : null;
  const filters = model.tab === 'published' || model.tab === 'scheduled'
    ? h1('form', { className: 'filters', method: 'get', action: '/settings/posts' },
        model.tab !== 'published' ? h1('input', { type: 'hidden', name: 'tab', value: model.tab }) : null,
        h1('div', { className: 'filter-field' }, h1('label', { htmlFor: 'management-search' }, '포스트 제목 검색'), h1('input', { id: 'management-search', name: 'search', defaultValue: model.filters.search, placeholder: '포스트 제목 검색...' })),
        h1('div', { className: 'filter-field' }, h1('label', { htmlFor: 'management-tag' }, '태그'), h1('input', { id: 'management-tag', name: 'tag', defaultValue: model.filters.tag, placeholder: '태그 이름' })),
        h1('div', { className: 'filter-field' }, h1('label', { htmlFor: 'management-series' }, '시리즈'), h1('input', { id: 'management-series', name: 'series', defaultValue: model.filters.series, placeholder: '시리즈 URL' })),
        h1('div', { className: 'filter-field' }, h1('label', { htmlFor: 'management-visibility' }, '공개 상태'), h1('select', { id: 'management-visibility', name: 'visibility', defaultValue: model.filters.visibility },
          h1('option', { value: '' }, '모든 공개 상태'), h1('option', { value: 'public' }, '공개'), h1('option', { value: 'hidden' }, '숨김'))),
        h1('div', { className: 'filter-field' }, h1('label', { htmlFor: 'management-order' }, '정렬'), h1('select', { id: 'management-order', name: 'order', defaultValue: model.filters.order },
          ...[['-published_date', '최신순'], ['published_date', '오래된 순'], ['-updated_date', '최근 수정순'], ['updated_date', '오래전 수정순'], ['title', '제목 오름차순'], ['-title', '제목 내림차순'], ['-count_likes', '좋아요 많은 순'], ['count_likes', '좋아요 적은 순'], ['-count_comments', '댓글 많은 순'], ['count_comments', '댓글 적은 순'], ['read_time', '짧은 글 순'], ['-read_time', '긴 글 순']].map(([value, label]) => h1('option', { key: value, value }, label)))),
        h1('div', { className: 'col-span-full flex justify-end' }, h1('button', { type: 'submit' }, '필터 적용')),
      ) : null;
  const pagination = model.lastPage > 1 ? h1('nav', { className: 'pagination', 'aria-label': '페이지 이동' },
    model.page > 1 ? h1('a', { href: managementPageHref(model.tab, model.page - 1, model.filters) }, '이전') : null,
    h1('span', { className: 'muted' }, model.page + ' / ' + model.lastPage + '페이지'),
    model.page < model.lastPage ? h1('a', { href: managementPageHref(model.tab, model.page + 1, model.filters) }, '다음') : null,
  ) : null;
  const pageTitle = selectedTab === 'trash' ? '휴지통' : selectedTab === 'drafts' ? '임시 포스트' : selectedTab === 'scheduled' ? '예약 포스트' : '포스트 관리';
  const content = h1('div', { className: 'post-management space-y-4' },
    h1('style', null, managementCss),
    h1('nav', { className: 'management-tabs', 'aria-label': '포스트 상태' }, ...tabLinks.map(([value, label, href]) => h1('a', {
      key: value, href, ...(value === selectedTab ? { 'aria-current': 'page' } : {}),
    }, label))),
    selectedTab === 'trash' ? h1('p', { className: 'muted' }, '휴지통의 포스트는 자동으로 삭제되지 않습니다.') : null,
    filters ? h1('section', { className: 'panel', 'aria-label': '포스트 필터' }, filters) : null,
    h1('section', { className: 'panel' },
      rows.length ? h1('p', { className: 'muted mb-4' }, '총 ' + model.totalCount + '개') : null,
      rows.length ? h1('div', { className: 'post-list' }, ...rows) : empty,
      pagination,
    ),
  );
  return renderSettingsShell({
    mode: 'personal', title: pageTitle, currentPath: '/settings/posts',
    user: { username: model.username, hasEditorRole: true, isStaff: model.isStaff, unreadCount: model.notifyCount }, csrfToken: model.csrfToken,
    canUseTelegramIntegration: model.hasConnectedTelegram,
    headerAction: h1('a', { className: 'inline-flex min-h-10 items-center rounded-lg bg-action px-3 py-2 text-sm font-semibold text-content-inverted no-underline hover:bg-action-hover', href: '/write' }, '새 포스트 작성'),
    content,
  });
}

function h2Safe(value: string) {
  return h1('h2', null, value);
}

function inputFromEditorForm(body: Record<string, unknown>): AuthoringPostInput {
  return {
    ...parseAuthoringPostInput(body),
    text: field(body.text_md) || field(body.content_html),
    contentType: field(body.content_type) || (Object.hasOwn(body, 'text_md') ? 'markdown' : 'html'),
    description: field(body.meta_description),
    url: field(body.url),
    tags: field(body.tag),
    series: field(body.series),
    hide: booleanField(body.hide),
    blockComment: booleanField(body.block_comment),
    coverLayout: field(body.cover_layout) || 'default',
    coverImagePosition: field(body.cover_image_position) || 'right',
    coverImageRatio: field(body.cover_image_ratio) || 'auto',
    coverImage: Object.hasOwn(body, 'cover_image_url') ? field(body.cover_image_url) : undefined,
    removeCoverImage: booleanField(body.remove_cover_image),
  };
}

// The 3.x editor posts whole documents; Django accepted them up to the proxy limit.
const editorBodyLimit = 13 * 1024 * 1024;

interface EditorForm {
  body: Record<string, unknown>;
  image?: { buffer: Buffer; filename: string };
}

async function readEditorForm(request: FastifyRequest): Promise<EditorForm> {
  if (!String(request.headers['content-type'] ?? '').toLowerCase().startsWith('multipart/form-data')) {
    return { body: bodyObject(request.body) };
  }
  const body: Record<string, unknown> = {};
  let image: EditorForm['image'];
  for await (const part of request.parts()) {
    if (part.type === 'file') {
      const buffer = await part.toBuffer();
      if (part.fieldname === 'image' && part.filename && buffer.length) image = { buffer, filename: part.filename };
    } else body[part.fieldname] = part.value;
  }
  request.body = body;
  return { body, image };
}

/** Maps the 3.x editor's series id and cover file onto the fields the save path understands. */
async function prepareEditorFields(db: PrismaClient, options: AuthoringOptions, account: UserRow, form: EditorForm): Promise<string | null> {
  const { body, image } = form;
  if (Object.hasOwn(body, 'content_html') && !Object.hasOwn(body, 'text_md')) {
    const seriesId = field(body.series);
    const [series] = /^\d+$/.test(seriesId)
      ? await db.$queryRaw<Array<{ url: string }>>`SELECT url FROM board_series WHERE id = ${Number(seriesId)} AND owner_id = ${account.id} LIMIT 1`
      : [];
    body.series = series?.url ?? '';
  }
  if (image) {
    try {
      body.cover_image_url = await saveContentFile(db, options.mediaRoot, account.id, image);
    } catch (error) {
      if (error instanceof ContentUploadError) return error.message;
      throw error;
    }
  } else if (booleanField(body.image_delete) || booleanField(body.remove_image)) body.remove_cover_image = 'true';
  return null;
}

function editorKeepsOriginalContent(post: StoredPost, body: Record<string, unknown>): boolean {
  if (!Object.hasOwn(body, 'text_md')) return false;
  return field(body.text_md) === (field(body.content_type) === 'html' ? post.contentHtml : htmlToMarkdown(post.contentHtml));
}

async function editorKeepsOriginalTags(db: PrismaClient, post: StoredPost, body: Record<string, unknown>): Promise<boolean> {
  return Object.hasOwn(body, 'tag') && field(body.tag) === (await postTags(db, post.id)).join(', ');
}

function editorModel(
  account: UserRow,
  csrfToken: string,
  seriesOptions: SeriesOption[],
  values: Partial<EditorModel> = {},
): EditorModel {
  return {
    action: 'publish',
    csrfToken,
    content: '',
    contentType: 'markdown',
    description: '',
    errorMessage: '',
    successMessage: '',
    savedDraft: false,
    isDraft: false,
    isEdit: false,
    postUrl: '',
    series: '',
    seriesOptions,
    tags: '',
    title: '',
    username: account.username,
    subtitle: '',
    hide: false,
    blockComment: false,
    coverLayout: 'default',
    coverImagePosition: 'right',
    coverImageRatio: 'auto',
    reservedDate: '',
    showSchedule: true,
    formTitle: '',
    coverImageUrl: '',
    ...values,
  };
}

function apiPostBase(post: StoredPost, contentHtml: string): Record<string, unknown> {
  return {
    image: mediaUrl(post.image),
    title: post.title,
    subtitle: post.subtitle,
    url: post.url,
    description: post.description,
    publishedDate: dateAsIso(post.publishedDate),
    updatedDate: dateAsIso(post.updatedDate),
    isScheduled: Boolean(post.publishedDate && new Date(dateAsIso(post.publishedDate) ?? 0).valueOf() > Date.now()),
    series: post.seriesId !== null && post.seriesUrl
      ? { id: String(post.seriesId), name: post.seriesName ?? '', url: post.seriesUrl }
      : null,
    contentHtml,
    textHtml: contentHtml,
    isHide: isTrue(post.hide),
    isAdvertise: isTrue(post.advertise),
    blockComment: isTrue(post.blockComment),
    coverLayout: post.coverLayout,
    coverImagePosition: post.coverImagePosition,
    coverImageRatio: post.coverImageRatio,
  };
}

function hasPostContent(body: Record<string, unknown>): boolean {
  return ['content_html', 'content', 'text_html', 'text_md', 'content_markdown', 'markdown']
    .some((key) => Object.hasOwn(body, key));
}

async function preservePostOmissions(
  db: PrismaClient,
  post: StoredPost,
  body: Record<string, unknown>,
  input: AuthoringPostInput,
): Promise<AuthoringPostInput> {
  const hasText = hasPostContent(body);
  const tags = await postTags(db, post.id);
  const isScheduled = Boolean(dateAsIso(post.publishedDate) && new Date(dateAsIso(post.publishedDate)!).valueOf() > Date.now());
  const reservedDate = Object.hasOwn(body, 'reserved_date')
    ? input.reservedDate
    : post.publishedDate === null
      ? await draftReservation(db, post.id)
      : isScheduled ? dateAsIso(post.publishedDate) ?? '' : '';
  return {
    ...input,
    title: Object.hasOwn(body, 'title') ? input.title : post.title,
    subtitle: Object.hasOwn(body, 'subtitle') ? input.subtitle : post.subtitle,
    text: hasText ? input.text : '',
    description: Object.hasOwn(body, 'description') || Object.hasOwn(body, 'meta_description')
      ? input.description
      : hasText ? descriptionFromHtml(resolveContent(input)) : post.description,
    url: Object.hasOwn(body, 'custom_url') || Object.hasOwn(body, 'url') ? input.url : post.url,
    tags: Object.hasOwn(body, 'tags') || Object.hasOwn(body, 'tag') ? input.tags : tags.join(','),
    series: Object.hasOwn(body, 'series_url') || Object.hasOwn(body, 'series') ? input.series : post.seriesUrl ?? '',
    hide: Object.hasOwn(body, 'is_hide') || Object.hasOwn(body, 'hide') ? input.hide : isTrue(post.hide),
    advertise: Object.hasOwn(body, 'is_advertise') || Object.hasOwn(body, 'advertise') ? input.advertise : isTrue(post.advertise),
    blockComment: Object.hasOwn(body, 'block_comment') ? input.blockComment : isTrue(post.blockComment),
    coverLayout: Object.hasOwn(body, 'cover_layout') ? input.coverLayout : post.coverLayout,
    coverImagePosition: Object.hasOwn(body, 'cover_image_position') ? input.coverImagePosition : post.coverImagePosition,
    coverImageRatio: Object.hasOwn(body, 'cover_image_ratio') ? input.coverImageRatio : post.coverImageRatio,
    reservedDate,
  };
}

function postPublic(post: StoredPost): boolean {
  const published = dateAsIso(post.publishedDate);
  return post.deletedDate === null && published !== null && new Date(published).valueOf() <= Date.now() && !isTrue(post.hide);
}

async function updatePostSettings(
  db: PrismaClient,
  author: UserRow,
  post: StoredPost,
  query: Record<string, unknown>,
  body: Record<string, unknown>,
): Promise<Record<string, unknown> | null> {
  const now = nowString();
  if (field(query.hide)) {
    const hide = !isTrue(post.hide);
    await db.$transaction(async (tx) => {
      await tx.$executeRaw`
        UPDATE board_postconfig SET hide = ${hide ? 1 : 0} WHERE post_id = ${post.id}
      `;
      if (hide) await tx.$executeRaw`DELETE FROM board_pinnedpost WHERE post_id = ${post.id}`;
      await tx.$executeRaw`UPDATE board_post SET updated_date = ${now} WHERE id = ${post.id}`;
      await syncPostPublication(tx, post.id);
    });
    return { isHide: hide };
  }
  if (field(query.tag)) {
    await db.$transaction(async (tx) => {
      const previous = await captureEditorialSnapshot(tx, post.id);
      await syncTags(tx, post.id, field(body.tag));
      if (sameEditorialSnapshot(previous, await captureEditorialSnapshot(tx, post.id))) return;
      await tx.$executeRaw`UPDATE board_post SET updated_date = ${now} WHERE id = ${post.id}`;
      if (post.publishedDate !== null) await insertRevision(tx, post.id, previous, author.id, 'edit', post.updatedDate);
    });
    return { tag: normalizedTags(field(body.tag)).join(',') };
  }
  if (field(query.series)) {
    const seriesId = await publicSeriesId(db, author.id, field(body.series));
    await db.$executeRaw`UPDATE board_post SET series_id = ${seriesId}, updated_date = ${now} WHERE id = ${post.id}`;
    const rows = seriesId === null ? [] : await db.$queryRaw<Array<{ url: string }>>`
      SELECT url FROM board_series WHERE id = ${seriesId} LIMIT 1
    `;
    return { series: rows[0]?.url ?? null };
  }
  if (field(query.reserved_date)) {
    const value = field(body.reserved_date);
    const parsed = scheduledDate(value);
    if (!value || parsed.error || !parsed.value) throw new PostValidationError('VA', parsed.error ?? 'Check the scheduled time.');
    const storedDate = dateAsIso(post.publishedDate);
    if (!storedDate || new Date(storedDate).valueOf() <= Date.now()) {
      throw new PostValidationError('RJ', 'Only scheduled posts can have their scheduled time changed.');
    }
    await db.$transaction(async (tx) => {
      await tx.$executeRaw`
        UPDATE board_post SET published_date = ${parsed.value}, updated_date = ${now}
        WHERE id = ${post.id} AND author_id = ${author.id}
      `;
      await syncPostPublication(tx, post.id);
    });
    return {};
  }
  return null;
}

async function verifiedEditor(db: PrismaClient, editor: AuthoringUser): Promise<UserRow> {
  const rows = await db.$queryRaw<UserRow[]>`
    SELECT author.id AS id, author.username AS username,
           CAST(author.is_active AS INTEGER) AS isActive, profile.role AS role
      FROM auth_user AS author
      LEFT JOIN board_profile AS profile ON profile.user_id = author.id
     WHERE author.id = ${editor.id} AND author.username = ${editor.username}
     LIMIT 1
  `;
  const author = rows[0];
  if (!author || numberValue(author.isActive) !== 1 || author.role !== 'EDITOR') {
    throw new PostValidationError('RJ', 'Author access is required.');
  }
  return author;
}

async function ownedPostByReference(
  db: PrismaClient,
  author: UserRow,
  reference: string | number,
): Promise<StoredPost> {
  let slug: string;
  if (typeof reference === 'number') {
    if (!Number.isSafeInteger(reference) || reference < 1) throw new PostValidationError('VA', 'Check the post ID.');
    const rows = await db.$queryRaw<Array<{ url: string }>>`
      SELECT url FROM board_post
       WHERE id = ${reference} AND author_id = ${author.id} AND deleted_date IS NULL
       LIMIT 1
    `;
    slug = rows[0]?.url ?? '';
  } else {
    slug = reference;
  }
  const post = slug ? await loadPost(db, { userId: author.id, slug }) : null;
  if (!post) throw new PostValidationError('RJ', 'The post was not found.');
  return post;
}

/**
 * Create a post with the same persistence and sanitization path as `/v1/posts`.
 * Accepted body fields include title, subtitle, content/text_md/content_markdown,
 * content_type, description/meta_description, url/custom_url, tags/tag, series,
 * hide/is_hide, advertise/is_advertise, block_comment, cover settings and reserved_date.
 */
export async function createAuthorPost(
  db: PrismaClient,
  editor: AuthoringUser,
  body: Record<string, unknown>,
  asDraft = false,
): Promise<AuthoringSaveResult> {
  const author = await verifiedEditor(db, editor);
  return createPost(db, author, parseAuthoringPostInput(body), asDraft);
}

/** Update an owned post using PATCH semantics and an optional optimistic timestamp. */
export async function updateAuthorPost(
  db: PrismaClient,
  editor: AuthoringUser,
  reference: string | number,
  body: Record<string, unknown>,
  expectedUpdatedAt?: string,
): Promise<AuthoringSaveResult> {
  const author = await verifiedEditor(db, editor);
  const post = await ownedPostByReference(db, author, reference);
  assertExpectedUpdatedAt(post.updatedDate, expectedUpdatedAt);
  const input = await preservePostOmissions(db, post, body, parseAuthoringPostInput(body));
  const isDraft = post.publishedDate === null;
  const hasContent = hasPostContent(body);
  if (!isDraft && Object.hasOwn(body, 'title') && !input.title) throw new PostValidationError('VA', 'Enter a title.');
  if (!isDraft && hasContent && !input.text.trim()) throw new PostValidationError('VA', 'Enter some content.');
  return updatePost(db, author, post, input, {
    allowEmptyBody: isDraft || !hasContent,
    clearContent: isDraft && hasContent && !input.text,
    updateDraft: isDraft,
    preserveTags: !Object.hasOwn(body, 'tags') && !Object.hasOwn(body, 'tag'),
    expectedUpdatedDate: expectedUpdatedAt === undefined ? undefined : post.updatedDate,
  });
}

/** Publish an owned draft, preserving omitted fields and optionally scheduling it. */
export async function publishAuthorDraft(
  db: PrismaClient,
  editor: AuthoringUser,
  reference: string | number,
  body: Record<string, unknown> = {},
  expectedUpdatedAt?: string,
): Promise<AuthoringSaveResult> {
  const author = await verifiedEditor(db, editor);
  const post = await ownedPostByReference(db, author, reference);
  if (post.publishedDate !== null) throw new PostValidationError('RJ', 'Only drafts can be published here.');
  assertExpectedUpdatedAt(post.updatedDate, expectedUpdatedAt);
  const input = await preservePostOmissions(db, post, body, parseAuthoringPostInput(body));
  if (!input.text) {
    input.text = post.contentHtml;
    input.contentType = 'html';
  }
  return updatePost(db, author, post, input, {
    allowEmptyBody: false,
    publishDraft: true,
    preserveTags: !Object.hasOwn(body, 'tags') && !Object.hasOwn(body, 'tag'),
    expectedUpdatedDate: expectedUpdatedAt === undefined ? undefined : post.updatedDate,
  });
}

/** Soft-delete an owned post, optionally rejecting a stale `updated_at` value. */
export async function deleteAuthorPost(
  db: PrismaClient,
  editor: AuthoringUser,
  reference: string | number,
  expectedUpdatedAt?: string,
): Promise<{ id: number; url: string; deletedDate: string }> {
  const author = await verifiedEditor(db, editor);
  const post = await ownedPostByReference(db, author, reference);
  assertExpectedUpdatedAt(post.updatedDate, expectedUpdatedAt);
  const deletedDate = await trashPost(db, author, post, expectedUpdatedAt === undefined ? undefined : post.updatedDate);
  return { id: post.id, url: post.url, deletedDate };
}

interface StoredRevision {
  id: number;
  title: string;
  subtitle: string;
  content: string;
  contentExcerpt: string | null;
  description: string;
  tags: string;
  changeType: string;
  actor: string | null;
  restoredFromId: number | null;
  sourceUpdatedDate: DbDate;
  createdDate: DbDate;
}

function revisionTags(raw: string): string[] {
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) ? value.filter((tag): tag is string => typeof tag === 'string') : [];
  } catch {
    return [];
  }
}

function revisionSummary(revision: StoredRevision): Record<string, unknown> {
  return {
    id: revision.id,
    title: revision.title,
    subtitle: revision.subtitle,
    contentExcerpt: revision.contentExcerpt ?? '',
    tags: revisionTags(revision.tags),
    changeType: revision.changeType,
    canRestore: revision.changeType !== 'legacy',
    actor: revision.actor,
    restoredFromId: revision.restoredFromId,
    sourceUpdatedDate: dateAsIso(revision.sourceUpdatedDate),
    createdDate: dateAsIso(revision.createdDate),
  };
}

async function loadRevision(
  db: PrismaClient,
  postId: number,
  revisionId: number,
): Promise<StoredRevision | null> {
  const rows = await db.$queryRaw<StoredRevision[]>`
    SELECT history.id AS id, history.title AS title, history.subtitle AS subtitle,
           history.content AS content, history.content_excerpt AS contentExcerpt,
           history.description AS description, history.tags AS tags,
           history.change_type AS changeType, actor.username AS actor,
           history.restored_from_id AS restoredFromId,
           CAST(history.source_updated_date AS TEXT) AS sourceUpdatedDate,
           CAST(history.created_date AS TEXT) AS createdDate
      FROM board_edithistory AS history
      LEFT JOIN auth_user AS actor ON actor.id = history.actor_id
     WHERE history.post_id = ${postId} AND history.id = ${revisionId}
       AND history.change_type <> 'draft'
     LIMIT 1
  `;
  return rows[0] ?? null;
}

async function deleteRevision(db: PrismaClient, postId: number, revisionId: number): Promise<boolean> {
  return db.$transaction(async (tx) => {
    const [target] = await tx.$queryRaw<unknown[]>`
      SELECT 1 FROM board_edithistory WHERE post_id = ${postId} AND id = ${revisionId} AND change_type <> 'draft'
    `;
    if (!target) return false;
    await tx.$executeRaw`UPDATE board_edithistory SET restored_from_id = NULL WHERE restored_from_id = ${revisionId}`;
    await tx.$executeRaw`DELETE FROM board_edithistory WHERE id = ${revisionId}`;
    return true;
  });
}

async function restoreRevision(
  db: PrismaClient,
  author: UserRow,
  post: StoredPost,
  revision: StoredRevision,
  expectedUpdatedAt: string,
): Promise<{ updatedDate: string; restored: boolean }> {
  if (revision.changeType === 'legacy') throw new PostValidationError('RJ', 'Legacy revisions cannot be restored safely.');
  assertExpectedUpdatedAt(post.updatedDate, expectedUpdatedAt);
  const target: EditorialSnapshot = {
    title: revision.title,
    subtitle: revision.subtitle,
    content: sanitizePostHtml(revision.content),
    description: revision.description,
    tags: revisionTags(revision.tags).sort(),
    updatedDate: null,
    publishedDate: null,
  };
  const now = nowString();
  const restoredDate = await db.$transaction(async (tx) => {
    const current = await captureEditorialSnapshot(tx, post.id);
    if (sameEditorialSnapshot(current, target)) return current.updatedDate;
    await insertRevision(tx, post.id, current, author.id, 'restore', current.updatedDate, revision.id);
    const changed = await tx.$executeRaw`
      UPDATE board_post
         SET title = ${target.title}, subtitle = ${target.subtitle}, meta_description = ${target.description},
             read_time = ${readingTime(target.content)}, updated_date = ${now}
       WHERE id = ${post.id} AND author_id = ${author.id} AND deleted_date IS NULL
         AND updated_date = ${post.updatedDate}
    `;
    if (numberValue(changed) === 0) throw new PostValidationError('CF', 'Another request changed this post. Refresh and try again.');
    const contentRows = await tx.$queryRaw<Array<{ id: number }>>`
      SELECT id FROM board_postcontent WHERE post_id = ${post.id} LIMIT 1
    `;
    if (contentRows[0]) {
      await tx.$executeRaw`UPDATE board_postcontent SET content_html = ${target.content} WHERE post_id = ${post.id}`;
    } else {
      await tx.$executeRaw`INSERT INTO board_postcontent (post_id, content_html) VALUES (${post.id}, ${target.content})`;
    }
    await tx.$executeRaw`DELETE FROM board_post_tags WHERE post_id = ${post.id}`;
    for (const value of target.tags) {
      await tx.$executeRaw`INSERT INTO board_tag (value) VALUES (${value}) ON CONFLICT(value) DO NOTHING`;
      const tags = await tx.$queryRaw<Array<{ id: number }>>`SELECT id FROM board_tag WHERE value = ${value} LIMIT 1`;
      if (tags[0]) await tx.$executeRaw`
        INSERT INTO board_post_tags (post_id, tag_id) VALUES (${post.id}, ${tags[0].id})
        ON CONFLICT(post_id, tag_id) DO NOTHING
      `;
    }
    return now;
  });
  return { updatedDate: dateAsIso(restoredDate) ?? now.replace(' ', 'T') + 'Z', restored: restoredDate === now };
}

interface TimelapseFrame {
  title: string;
  contentHtml: string;
  savedAt: string;
  stage: 'draft' | 'published';
}

interface TimelapseResult {
  frames: TimelapseFrame[];
  totalCount: number;
  publishedAt: string | null;
}

async function buildTimelapse(db: PrismaClient, post: StoredPost): Promise<TimelapseResult> {
  const histories = await db.$queryRaw<Array<{
    title: string; content: string; changeType: string; sourceUpdatedDate: DbDate; createdDate: DbDate;
  }>>`
    SELECT title, content, change_type AS changeType,
           CAST(source_updated_date AS TEXT) AS sourceUpdatedDate,
           CAST(created_date AS TEXT) AS createdDate
      FROM board_edithistory WHERE post_id = ${post.id}
     ORDER BY created_date DESC, id DESC
  `;
  const newestFirst: Array<Omit<TimelapseFrame, 'savedAt'> & { savedDate: string }> = [{
    title: post.title,
    contentHtml: post.contentHtml,
    savedDate: dateAsIso(post.updatedDate) ?? nowString().replace(' ', 'T') + 'Z',
    stage: post.publishedDate ? 'published' : 'draft',
  }];
  for (const history of histories) {
    const later = newestFirst.at(-1)!;
    newestFirst.push({
      title: history.title === '_NO_CHANGED_' ? later.title : history.title,
      contentHtml: history.content === '_NO_CHANGED_' ? later.contentHtml : history.content,
      savedDate: dateAsIso(history.sourceUpdatedDate ?? history.createdDate) ?? '',
      stage: history.changeType === 'draft' ? 'draft' : 'published',
    });
  }
  const chronological = newestFirst.reverse();
  const collapsed: typeof chronological = [];
  for (const frame of chronological) {
    const previous = collapsed.at(-1);
    if (previous && previous.title === frame.title && previous.contentHtml === frame.contentHtml) continue;
    collapsed.push(frame);
  }
  const frames = collapsed.length <= 80
    ? collapsed
    : [...new Set(Array.from({ length: 80 }, (_value, index) => Math.round(index * (collapsed.length - 1) / 79)))].map((index) => collapsed[index]!);
  return {
    frames: frames.map((frame) => ({
      title: frame.title,
      contentHtml: sanitizePostHtml(frame.contentHtml),
      savedAt: frame.savedDate,
      stage: frame.stage,
    })),
    totalCount: collapsed.length,
    publishedAt: dateAsIso(post.publishedDate),
  };
}

interface RevisionHistoryPageModel {
  username: string;
  slug: string;
  title: string;
  updatedDate: string;
  csrfToken: string;
  page: number;
  lastPage: number;
  totalCount: number;
  revisions: StoredRevision[];
  notice: string;
}

const historyPageCss = `
  :root { color-scheme: light dark; font: 16px/1.65 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color:CanvasText; background:Canvas; }
  * { box-sizing:border-box; }
  body { margin:0; }
  a { color:inherit; text-underline-offset:.2em; }
  header, main { max-width:70rem; margin:auto; padding:1rem 1.25rem; }
  header { display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:.75rem; border-bottom:1px solid color-mix(in srgb,CanvasText 16%,Canvas); }
  header a { font-weight:700; text-decoration:none; }
  nav { display:flex; flex-wrap:wrap; gap:.8rem; }
  main { max-width:58rem; padding-top:clamp(1.5rem,4vw,3rem); }
  h1 { line-height:1.2; letter-spacing:-.025em; }
  .meta { color:GrayText; font-size:.9rem; }
  .notice { border-left:3px solid color-mix(in srgb,CanvasText 35%,Canvas); padding:.45rem .8rem; }
  .revision, .frame { margin:1rem 0; border:1px solid color-mix(in srgb,CanvasText 18%,Canvas); border-radius:.75rem; }
  summary { cursor:pointer; padding:1rem; }
  summary span { display:block; color:GrayText; font-size:.88rem; }
  .revision-body, .frame-body { padding:0 1rem 1rem; overflow-wrap:anywhere; }
  .revision-body > div, .frame-body > div { line-height:1.8; }
  .forms { display:flex; flex-wrap:wrap; gap:.6rem; margin-top:1rem; }
  button { min-height:2.75rem; border:1px solid color-mix(in srgb,CanvasText 24%,Canvas); border-radius:.55rem; padding:.55rem .8rem; background:Canvas; color:CanvasText; font:inherit; cursor:pointer; }
  .danger { color:#b42318; }
  .pager { display:flex; justify-content:center; gap:1rem; padding:1.5rem; }
  .empty { margin:3rem 0; text-align:center; color:GrayText; }
  @media(max-width:36rem) { header { align-items:flex-start; flex-direction:column; } }
`;

function renderRevisionHistoryPage(model: RevisionHistoryPageModel): string {
  const postPath = `/@${encodeURIComponent(model.username)}/${encodeURIComponent(model.slug)}`;
  const pagination = model.lastPage > 1 ? h1('nav', { className: 'pager', 'aria-label': '페이지 이동' },
    model.page > 1 ? h1('a', { href: `${postPath}/revisions?page=${model.page - 1}` }, '이전') : null,
    h1('span', null, `${model.page} / ${model.lastPage}`),
    model.page < model.lastPage ? h1('a', { href: `${postPath}/revisions?page=${model.page + 1}` }, '다음') : null,
  ) : null;
  const rows = model.revisions.map((revision) => {
    const label = revision.changeType === 'restore' ? '복원 전 기록'
      : revision.changeType === 'legacy' ? '이전 기록'
        : '수정 전 기록';
    const revisionTitle = revision.title === '_NO_CHANGED_' ? '제목 기록 없음' : revision.title || '제목 없는 글';
    const content = revision.content === '_NO_CHANGED_' ? '' : sanitizePostHtml(revision.content);
    const date = dateAsIso(revision.sourceUpdatedDate ?? revision.createdDate);
    const revisionPath = `${postPath}/revisions/${revision.id}`;
    return h1('details', { className: 'revision', key: revision.id },
      h1('summary', null,
        h1('strong', null, revisionTitle),
        h1('span', null, `${label} · ${managementDate(revision.sourceUpdatedDate ?? revision.createdDate)} · ${revision.actor ? `@${revision.actor}` : '작성자 없음'}`)),
      h1('div', { className: 'revision-body' },
        date ? h1('time', { className: 'meta', dateTime: date }, date) : null,
        revision.contentExcerpt ? h1('p', { className: 'meta' }, revision.contentExcerpt) : null,
        content ? h1('div', { dangerouslySetInnerHTML: { __html: content } }) : h1('p', { className: 'meta' }, '이전 본문은 보관되지 않았습니다.'),
        h1('div', { className: 'forms' },
          revision.changeType !== 'legacy' ? h1('form', { method: 'post', action: `${revisionPath}/restore` },
            h1('input', { type: 'hidden', name: 'csrfmiddlewaretoken', value: model.csrfToken }),
            h1('input', { type: 'hidden', name: 'expected_updated_date', value: model.updatedDate }),
            h1('button', { type: 'submit' }, '이 기록으로 복원')) : null,
          h1('form', { method: 'post', action: `${revisionPath}/delete` },
            h1('input', { type: 'hidden', name: 'csrfmiddlewaretoken', value: model.csrfToken }),
            h1('input', { type: 'hidden', name: 'expected_updated_date', value: model.updatedDate }),
            h1('label', null, h1('input', { type: 'checkbox', name: 'confirm_delete', value: 'yes', required: true }), '기록 삭제 확인'),
            h1('button', { className: 'danger', type: 'submit' }, '기록 삭제')),
        ),
      ),
    );
  });
  return renderApplicationDocument(h1('html', { lang: 'ko' },
    h1('head', null,
      h1('meta', { charSet: 'utf-8' }),
      h1('meta', { name: 'viewport', content: 'width=device-width, initial-scale=1' }),
      h1('meta', { name: 'color-scheme', content: 'light dark' }),
      h1('meta', { name: 'robots', content: 'noindex,nofollow' }),
      h1('title', null, `수정 기록 · ${model.title} · BLEX`),
      h1('style', null, historyPageCss),
    ),
    h1('body', null,
      h1('header', null,
        h1('a', { href: `${postPath}/edit` }, '글 편집'),
        h1('nav', null,
          h1('a', { href: `${postPath}/timelapse` }, '작성 타임라인'),
          h1('a', { href: '/settings/posts' }, '글 관리'))),
      h1('main', null,
        h1('h1', null, '수정 기록'),
        h1('p', { className: 'meta' }, `${model.title} · ${model.totalCount}개 기록 · 무제한 보관`),
        model.notice ? h1('p', { className: 'notice', role: 'status' }, model.notice) : null,
        rows.length ? h1('section', { 'aria-label': '수정 기록 목록' }, ...rows) : h1('p', { className: 'empty' }, '저장된 수정 기록이 없습니다.'),
        pagination,
      ),
    ),
  ));
}

function renderTimelapsePage(username: string, post: StoredPost, timelapse: TimelapseResult): string {
  const postPath = `/@${encodeURIComponent(username)}/${encodeURIComponent(post.url)}`;
  const frames = timelapse.frames.map((frame, index) => h1('details', { className: 'frame', key: `${frame.savedAt}:${index}`, open: index === timelapse.frames.length - 1 },
    h1('summary', null,
      h1('strong', null, frame.title || '제목 없는 글'),
      h1('span', null, `${frame.stage === 'draft' ? '임시 저장' : '발행 글'} · ${managementDate(frame.savedAt)}`)),
    h1('div', { className: 'frame-body' },
      h1('div', { dangerouslySetInnerHTML: { __html: sanitizePostHtml(frame.contentHtml) } })),
  ));
  return renderApplicationDocument(h1('html', { lang: 'ko' },
    h1('head', null,
      h1('meta', { charSet: 'utf-8' }),
      h1('meta', { name: 'viewport', content: 'width=device-width, initial-scale=1' }),
      h1('meta', { name: 'color-scheme', content: 'light dark' }),
      h1('meta', { name: 'robots', content: 'noindex,nofollow' }),
      h1('title', null, `작성 타임라인 · ${post.title} · BLEX`),
      h1('style', null, historyPageCss),
    ),
    h1('body', null,
      h1('header', null,
        h1('a', { href: `${postPath}/edit` }, '글 편집'),
        h1('nav', null,
          h1('a', { href: `${postPath}/revisions` }, '수정 기록'),
          h1('a', { href: '/settings/posts' }, '글 관리'))),
      h1('main', null,
        h1('h1', null, '작성 타임라인'),
        h1('p', { className: 'meta' }, `${post.title} · ${timelapse.totalCount}개 장면`),
        timelapse.totalCount > timelapse.frames.length
          ? h1('p', { className: 'notice' }, `오래된 기록을 포함해 ${timelapse.totalCount}개 중 ${timelapse.frames.length}개 장면을 표시합니다.`)
          : null,
        frames.length ? h1('section', { 'aria-label': '작성 기록 목록' }, ...frames) : h1('p', { className: 'empty' }, '표시할 작성 기록이 없습니다.'),
      ),
    ),
  ));
}

function sendPrivateHistoryPage(reply: FastifyReply, html: string, statusCode = 200): FastifyReply {
  return reply.code(statusCode).type('text/html; charset=utf-8')
    .header('Cache-Control', 'private, no-store')
    .header('X-Robots-Tag', 'noindex, nofollow')
    .header('X-Frame-Options', 'DENY')
    .send(html);
}

export function registerAuthoring(
  app: FastifyInstance,
  db: PrismaClient,
  options: AuthoringOptions,
): void {
  app.register(async (routes) => {
    await routes.register(formBody);
    await routes.register(multipart, { limits: { files: 1, fileSize: contentUploadLimit, fields: 40, fieldSize: editorBodyLimit, parts: 41 } });
    // Large editor bodies are only parsed for a signed-in session.
    const sessionBeforeBody = async (request: FastifyRequest, reply: FastifyReply) => {
      if (request.method === 'GET' || request.method === 'HEAD' || await options.currentUser(request)) return;
      if (request.url.startsWith('/v1/')) return reply.send(failed('NL', 'Login required.'));
      editorRedirect(reply, false);
      return reply;
    };
    routes.removeContentTypeParser('application/json');
    routes.addContentTypeParser('application/json', { parseAs: 'string' }, (_request, body, doneParse) => {
      try {
        doneParse(null, JSON.parse(body as string));
      } catch {
        doneParse(null, {});
      }
    });

    routes.route({
      method: ['GET', 'POST'],
      url: '/write',
      bodyLimit: editorBodyLimit,
      onRequest: sessionBeforeBody,
      handler: async (request, reply) => {
        const account = await editorAccount(request, reply, db, options, false);
        if (!account) return reply;
        const seriesOptions = await getSeriesOptions(db, account.id);
        const csrfToken = cookieValue(request, 'csrftoken');
        if (request.method === 'GET') {
          const query = queryObject(request);
          const draftUrl = field(query.draft);
          const draft = draftUrl ? await loadPost(db, { userId: account.id, slug: draftUrl }) : null;
          const isDraft = Boolean(draft && draft.publishedDate === null);
          const formIdValue = field(query.form);
          let template: FormTemplate | null = null;
          if (!draftUrl && formIdValue) {
            if (!/^\d+$/.test(formIdValue) || !Number.isSafeInteger(Number(formIdValue)) || Number(formIdValue) < 1) {
              return notFound(reply);
            }
            const forms = await db.$queryRaw<FormTemplate[]>`
              SELECT id, title, content FROM board_form WHERE id = ${Number(formIdValue)} AND user_id = ${account.id} LIMIT 1
            `;
            template = forms[0] ?? null;
            if (!template) return notFound(reply);
          }
          const tags = draft ? await postTags(db, draft.id) : [];
          const content = draft
            ? draft.contentHtml
            : template?.content ?? '';
          const preview = draft && isDraft && !draft.deletedDate
            ? await draftReservation(db, draft.id)
            : '';
          await sendEditorPage(reply, editorModel(account, csrfToken, seriesOptions, {
            isDraft,
            contentType: isDraft ? 'html' : 'markdown',
            savedDraft: isDraft && field(query.saved) === '1',
            postUrl: isDraft ? draft!.url : '',
            title: isDraft ? draft!.title : '',
            subtitle: isDraft ? draft!.subtitle : '',
            content,
            successMessage: isDraft && field(query.saved) === '1' ? '임시 글을 저장했습니다.' : '',
            description: isDraft ? draft!.description : '',
            tags: tags.join(', '),
            series: isDraft ? draft!.seriesUrl ?? '' : '',
            hide: isDraft ? isTrue(draft!.hide) : false,
            blockComment: isDraft ? isTrue(draft!.blockComment) : false,
            coverLayout: isDraft ? draft!.coverLayout : 'default',
            coverImagePosition: isDraft ? draft!.coverImagePosition : 'right',
            coverImageRatio: isDraft ? draft!.coverImageRatio : 'auto',
            coverImageUrl: isDraft ? coverUrlFromStored(draft!.image) : '',
            reservedDate: isDraft ? dateTimeLocalValue(preview) : '',
            formTitle: template?.title ?? '',
            errorMessage: preview ? `저장된 예약 시간: ${preview}` : '',
          }), 200, options.editorAssets);
          return reply;
        }

        const form = await readEditorForm(request);
        if (!options.validateCsrf(request)) return forbidden(reply);
        const body = form.body;
        const uploadError = await prepareEditorFields(db, options, account, form);
        if (uploadError) return reply.redirect(field(body.draft_url) ? `/write?draft=${encodeURIComponent(field(body.draft_url))}` : '/write', 303);
        const input = inputFromEditorForm(body);
        const savesDraft = field(body.is_draft) === 'true';
        const action = field(body.action) || (savesDraft ? 'draft' : 'publish');
        const draftUrl = field(body.draft_url);
        let existingDraft: StoredPost | null = null;
        if (draftUrl) {
          existingDraft = await loadPost(db, { userId: account.id, slug: draftUrl });
          if (!existingDraft || existingDraft.publishedDate !== null) return notFound(reply);
        }
        if (action === 'delete' && existingDraft) {
          await trashPost(db, account, existingDraft);
          return reply.redirect(`/@${encodeURIComponent(account.username)}`, 302);
        }
        try {
          let saved: AuthoringSaveResult;
          if (action === 'draft') {
            saved = existingDraft
              ? await updatePost(db, account, existingDraft, input, {
                allowEmptyBody: true,
                updateDraft: true,
                preserveExistingHtml: editorKeepsOriginalContent(existingDraft, body),
                preserveTags: await editorKeepsOriginalTags(db, existingDraft, body),
              })
              : await createPost(db, account, input, true);
            if (savesDraft) return reply.redirect(`/@${encodeURIComponent(account.username)}/${encodeURIComponent(saved.url)}/edit`, 302);
            return reply.redirect(`/write?draft=${encodeURIComponent(saved.url)}&saved=1`, 302);
          }
          if (existingDraft) {
            saved = await updatePost(db, account, existingDraft, input, {
              allowEmptyBody: false,
              publishDraft: true,
              preserveExistingHtml: editorKeepsOriginalContent(existingDraft, body),
              preserveTags: await editorKeepsOriginalTags(db, existingDraft, body),
            });
          } else {
            saved = await createPost(db, account, input, false);
          }
          return reply.redirect(`/@${encodeURIComponent(account.username)}/${encodeURIComponent(saved.url)}`, 302);
        } catch (error) {
          const message = error instanceof PostValidationError ? error.message : '글을 저장하지 못했습니다.';
          const currentDraft = existingDraft;
          await sendEditorPage(reply, editorModel(account, csrfToken, seriesOptions, {
            isDraft: action === 'draft' || Boolean(currentDraft),
            postUrl: currentDraft?.url ?? field(body.url),
            title: field(body.title),
            subtitle: field(body.subtitle),
            content: field(body.text_md),
            contentType: field(body.content_type) === 'html' ? 'html' : 'markdown',
            description: field(body.meta_description),
            tags: field(body.tag),
            series: field(body.series),
            coverImageUrl: field(body.cover_image_url),
            hide: booleanField(body.hide),
            blockComment: booleanField(body.block_comment),
            reservedDate: field(body.reserved_date),
            errorMessage: message,
          }), 400, options.editorAssets);
          return reply;
        }
      },
    });

    routes.route<{ Params: { username: string; slug: string } }>({
      method: ['GET', 'POST'],
      url: '/@:username/:slug/edit',
      bodyLimit: editorBodyLimit,
      onRequest: sessionBeforeBody,
      handler: async (request, reply) => {
        const account = await editorAccount(request, reply, db, options, false);
        if (!account) return reply;
        if (request.method === 'GET') {
          const post = await loadPost(db, { username: request.params.username, slug: request.params.slug });
          if (!post || post.authorId !== account.id) return notFound(reply);
          const tags = await postTags(db, post.id);
          const csrfToken = cookieValue(request, 'csrftoken');
          await sendEditorPage(reply, editorModel(account, csrfToken, await getSeriesOptions(db, account.id), {
            isEdit: true,
            isDraft: post.publishedDate === null,
            contentType: 'html',
            postUrl: post.url,
            title: post.title,
            subtitle: post.subtitle,
            content: post.contentHtml,
            description: post.description,
            tags: tags.join(', '),
            series: post.seriesUrl ?? '',
            hide: isTrue(post.hide),
            blockComment: isTrue(post.blockComment),
            coverLayout: post.coverLayout,
            coverImagePosition: post.coverImagePosition,
            coverImageRatio: post.coverImageRatio,
            coverImageUrl: coverUrlFromStored(post.image),
            reservedDate: post.publishedDate === null
              ? dateTimeLocalValue(await draftReservation(db, post.id))
              : dateTimeLocalValue(post.publishedDate),
            showSchedule: post.publishedDate === null || Boolean(
              dateAsIso(post.publishedDate) && new Date(dateAsIso(post.publishedDate)!).valueOf() > Date.now(),
            ),
          }), 200, options.editorAssets);
          return reply;
        }

        const form = await readEditorForm(request);
        if (!options.validateCsrf(request)) return forbidden(reply);
        const post = await loadPost(db, { username: request.params.username, slug: request.params.slug });
        if (!post || post.authorId !== account.id) return notFound(reply);
        const body = form.body;
        const isAsyncSubmit = request.headers['x-blex-editor-submit'] === 'async';
        const action = field(body.delete) === 'true' ? 'delete' : field(body.action) || 'publish';
        if (action === 'delete') {
          await trashPost(db, account, post);
          return reply.redirect(`/@${encodeURIComponent(account.username)}`, 302);
        }
        const uploadError = await prepareEditorFields(db, options, account, form);
        if (uploadError) return isAsyncSubmit ? failed('RJ', uploadError) : reply.redirect(`/@${encodeURIComponent(account.username)}/${encodeURIComponent(post.url)}/edit`, 303);
        const parsedInput = inputFromEditorForm(body);
        // The editor form has no advertising control, so an omitted flag keeps the stored value.
        const keepsAdvertise = !Object.hasOwn(body, 'is_advertise') && !Object.hasOwn(body, 'advertise');
        const input = keepsAdvertise ? { ...parsedInput, advertise: isTrue(post.advertise) } : parsedInput;
        if (isAsyncSubmit) {
          // A 3.x edit that omits the series or tags keeps the stored values.
          if (!field(body.series)) input.series = post.seriesUrl ?? '';
        }
        try {
          if (isAsyncSubmit) {
            await updatePost(db, account, post, input, {
              allowEmptyBody: post.publishedDate === null,
              updateDraft: post.publishedDate === null,
              preserveTags: !field(body.tag),
            });
            return done({ url: `/@${encodeURIComponent(account.username)}/${encodeURIComponent(post.url)}` });
          }
          if (post.publishedDate === null && action === 'publish') {
            const saved = await updatePost(db, account, post, input, {
              allowEmptyBody: false,
              publishDraft: true,
              preserveExistingHtml: editorKeepsOriginalContent(post, body),
              preserveTags: await editorKeepsOriginalTags(db, post, body),
            });
            return reply.redirect(`/@${encodeURIComponent(account.username)}/${encodeURIComponent(saved.url)}`, 302);
          }
          await updatePost(db, account, post, input, {
            allowEmptyBody: post.publishedDate === null,
            updateDraft: post.publishedDate === null,
            preserveExistingHtml: editorKeepsOriginalContent(post, body),
            preserveTags: await editorKeepsOriginalTags(db, post, body),
          });
          return reply.redirect(`/@${encodeURIComponent(account.username)}/${encodeURIComponent(post.url)}/edit`, 302);
        } catch (error) {
          if (isAsyncSubmit && error instanceof PostValidationError) return failed(error.code, error.message);
          const message = error instanceof PostValidationError ? error.message : '글을 저장하지 못했습니다.';
          await sendEditorPage(reply, editorModel(account, cookieValue(request, 'csrftoken'), await getSeriesOptions(db, account.id), {
            isEdit: true,
            isDraft: post.publishedDate === null,
            postUrl: post.url,
            title: field(body.title),
            subtitle: field(body.subtitle),
            content: field(body.text_md),
            contentType: field(body.content_type) === 'html' ? 'html' : 'markdown',
            description: field(body.meta_description),
            tags: field(body.tag),
            series: field(body.series),
            coverImageUrl: field(body.cover_image_url),
            hide: booleanField(body.hide),
            blockComment: booleanField(body.block_comment),
            reservedDate: field(body.reserved_date),
            showSchedule: post.publishedDate === null || Boolean(
              dateAsIso(post.publishedDate) && new Date(dateAsIso(post.publishedDate)!).valueOf() > Date.now(),
            ),
            errorMessage: message,
          }), 400, options.editorAssets);
          return reply;
        }
      },
    });

    routes.get<{ Params: { slug: string } }>('/write/preview/:slug', async (request, reply) => {
      const account = await currentAccount(request, db, options);
      if (!account || account.role !== 'EDITOR') return notFound(reply);
      const post = await readDraftPreview(db, account.id, request.params.slug);
      if (!post) return notFound(reply);
      const presentation = await readPostPresentation(db, post);
      const csrf = cookieValue(request, 'csrftoken');
      return reply.type('text/html; charset=utf-8')
        .header('Cache-Control', 'private, no-store')
        .header('X-Robots-Tag', 'noindex, nofollow')
        .header('Content-Security-Policy', postContentSecurityPolicy)
        .send(renderPublicPostPage(post, presentation, options.siteUrl, null, csrf, false, {
          username: post.username, hasEditorRole: true, isStaff: Boolean(Number(post.isStaff)), unreadCount: Number(post.unreadCount),
        }, [], { bio: post.authorBio, homepage: post.authorHomepage }));
    });

    routes.post('/v1/posts', async (request, reply) => {
      if (!options.validateCsrf(request)) return forbidden(reply);
      const user = await currentAccount(request, db, options);
      if (!user) return notFound(reply);
      if (user.role !== 'EDITOR') return failed('RJ', 'Author access is required.');
      try {
        const post = await createPost(db, user, parseAuthoringPostInput(bodyObject(request.body)), false);
        return done({ url: post.url });
      } catch (error) {
        if (error instanceof PostValidationError) return failed(error.code, error.message);
        request.log.error(error);
        return failed('RJ', 'Could not create the post.');
      }
    });

    routes.route<{ Params: { username: string; url: string } }>({
      method: ['GET', 'POST', 'PUT', 'DELETE'],
      url: '/v1/users/@:username/posts/:url',
      handler: async (request, reply) => {
        if (request.method === 'GET') {
          const post = await loadPost(db, { username: request.params.username, slug: request.params.url });
          if (!post) return notFound(reply);
          const viewer = await currentAccount(request, db, options);
          const mode = field(queryObject(request).mode);
          if (mode === 'edit') {
            if (!viewer || viewer.role !== 'EDITOR' || viewer.id !== post.authorId) return notFound(reply);
            const content = sanitizePostHtml(post.contentHtml);
            const tags = await postTags(db, post.id);
            return done({ ...apiPostBase(post, content), tags });
          }
          if (mode !== 'view' || (!postPublic(post) && viewer?.id !== post.authorId)) return notFound(reply);
          const tags = await postTags(db, post.id);
          const counts = await db.$queryRaw<Array<{ likes: number | bigint; comments: number | bigint; liked: DbBoolean }>>`
            SELECT (SELECT COUNT(*) FROM board_post_likes WHERE post_id = ${post.id}) AS likes,
                   (SELECT COUNT(*) FROM board_comment WHERE post_id = ${post.id}) AS comments,
                   CASE WHEN EXISTS (
                     SELECT 1 FROM board_post_likes
                     WHERE post_id = ${post.id} AND user_id = ${viewer?.id ?? -1}
                   ) THEN 1 ELSE 0 END AS liked
          `;
          return done({
            url: post.url,
            title: post.title,
            image: post.image,
            description: post.description,
            readTime: post.readTime,
            series: post.seriesUrl && !isTrue(post.seriesHidden) ? { url: post.seriesUrl, name: post.seriesName } : null,
            createdDate: localDateTime(post.publishedDate),
            updatedDate: localDateTime(post.updatedDate),
            authorImage: post.authorAvatar ?? '',
            author: post.authorUsername,
            renderedContent: sanitizePostHtml(post.contentHtml),
            countLikes: numberValue(counts[0]?.likes),
            countComments: numberValue(counts[0]?.comments),
            isAd: isTrue(post.advertise),
            coverLayout: post.coverLayout,
            coverImagePosition: post.coverImagePosition,
            coverImageRatio: post.coverImageRatio,
            tags,
            isLiked: isTrue(counts[0]?.liked ?? 0),
          });
        }

        const user = await editorAccount(request, reply, db, options, true);
        if (!user) return reply;
        if (!options.validateCsrf(request)) return forbidden(reply);
        const authors = await db.$queryRaw<Array<{ id: number }>>`
          SELECT id FROM auth_user WHERE username = ${request.params.username} LIMIT 1
        `;
        if (!authors[0] || authors[0].id !== user.id) return notFound(reply);
        const post = await loadPost(db, { userId: user.id, slug: request.params.url });
        if (!post) return notFound(reply);
        const body = bodyObject(request.body);

        if (request.method === 'DELETE') {
          const deletedDate = await trashPost(db, user, post);
          return done({ trashed: true, deletedDate });
        }
        if (request.method === 'PUT') {
          try {
            const result = await updatePostSettings(db, user, post, queryObject(request), body);
            return result ? done(result) : notFound(reply);
          } catch (error) {
            if (error instanceof PostValidationError) return failed(error.code, error.message);
            throw error;
          }
        }

        let input = parseAuthoringPostInput(body);
        try {
          if (post.publishedDate === null) input = await preservePostOmissions(db, post, body, input);
          else {
            if (!Object.hasOwn(body, 'cover_layout')) input.coverLayout = post.coverLayout;
            if (!Object.hasOwn(body, 'cover_image_position')) input.coverImagePosition = post.coverImagePosition;
            if (!Object.hasOwn(body, 'cover_image_ratio')) input.coverImageRatio = post.coverImageRatio;
            if (!Object.hasOwn(body, 'block_comment')) input.blockComment = isTrue(post.blockComment);
          }
          await updatePost(db, user, post, input, {
            allowEmptyBody: post.publishedDate === null,
            updateDraft: post.publishedDate === null,
          });
          return done();
        } catch (error) {
          if (error instanceof PostValidationError) return failed(error.code, error.message);
          request.log.error(error);
          return failed('RJ', 'Could not update the post.');
        }
      },
    });

    routes.route({
      method: ['GET', 'POST'],
      url: '/v1/drafts',
      bodyLimit: editorBodyLimit,
      onRequest: sessionBeforeBody,
      handler: async (request, reply) => {
        const user = await editorAccount(request, reply, db, options, true);
        if (!user) return reply;
        if (request.method === 'GET') {
          const drafts = await db.$queryRaw<StoredDraftSummary[]>`
            SELECT url, title, image,
                   CAST(created_date AS TEXT) AS createdDate,
                   CAST(updated_date AS TEXT) AS updatedDate
            FROM board_post
            WHERE author_id = ${user.id} AND deleted_date IS NULL AND published_date IS NULL
            ORDER BY updated_date DESC, id DESC
          `;
          return done({ drafts: drafts.map((draft) => ({
            url: draft.url,
            title: draft.title,
            image: draft.image || null,
            createdDate: draft.createdDate ? timeSince(draft.createdDate) : null,
            updatedDate: localDate(draft.updatedDate),
          })) });
        }
        const form = await readEditorForm(request);
        if (!options.validateCsrf(request)) return forbidden(reply);
        try {
          const uploadError = await prepareEditorFields(db, options, user, form);
          if (uploadError) return failed('RJ', uploadError);
          const post = await createPost(db, user, parseAuthoringPostInput(form.body), true);
          return done({ url: post.url });
        } catch (error) {
          if (error instanceof PostValidationError) return failed(error.code, error.message);
          request.log.error(error);
          return failed('RJ', 'Could not save the draft.');
        }
      },
    });

    routes.route<{ Params: { url: string } }>({
      method: ['GET', 'PUT', 'DELETE'],
      url: '/v1/drafts/:url',
      bodyLimit: editorBodyLimit,
      onRequest: sessionBeforeBody,
      handler: async (request, reply) => {
        const user = await editorAccount(request, reply, db, options, true);
        if (!user) return reply;
        const post = await loadPost(db, { userId: user.id, slug: request.params.url });
        if (!post || post.publishedDate !== null) return notFound(reply);
        if (request.method === 'GET') {
          const tags = await postTags(db, post.id);
          return done({
            url: post.url,
            title: post.title,
            subtitle: post.subtitle,
            contentHtml: sanitizePostHtml(post.contentHtml),
            textMd: sanitizePostHtml(post.contentHtml),
            rawContent: sanitizePostHtml(post.contentHtml),
            tags: tags.join(','),
            description: post.description,
            image: mediaUrl(post.image),
            coverLayout: post.coverLayout,
            coverImagePosition: post.coverImagePosition,
            coverImageRatio: post.coverImageRatio,
            isHide: isTrue(post.hide),
            isAdvertise: isTrue(post.advertise),
            blockComment: isTrue(post.blockComment),
            reservedDate: await draftReservation(db, post.id),
            series: post.seriesUrl ? { url: post.seriesUrl, name: post.seriesName } : null,
            createdDate: timeSince(post.createdDate),
          });
        }
        const form = request.method === 'DELETE' ? { body: {} } : await readEditorForm(request);
        if (!options.validateCsrf(request)) return forbidden(reply);
        if (request.method === 'DELETE') {
          const deletedDate = await trashPost(db, user, post);
          return done({ trashed: true, deletedDate });
        }
        try {
          const uploadError = await prepareEditorFields(db, options, user, form);
          if (uploadError) return failed('RJ', uploadError);
          const body = form.body;
          await updatePost(db, user, post, await preservePostOmissions(db, post, body, parseAuthoringPostInput(body)), {
            allowEmptyBody: true,
            updateDraft: true,
            preserveTags: !Object.hasOwn(body, 'tags') && !Object.hasOwn(body, 'tag'),
          });
          return done({ url: post.url });
        } catch (error) {
          if (error instanceof PostValidationError) return failed(error.code, error.message);
          request.log.error(error);
          return failed('RJ', 'Could not update the draft.');
        }
      },
    });

    routes.route<{ Params: { username: string; url: string; action: 'cancel' | 'publish-now' } }>({
      method: 'POST',
      url: '/v1/users/@:username/posts/:url/schedule/:action',
      handler: async (request, reply) => {
        const user = await editorAccount(request, reply, db, options, true);
        if (!user) return reply;
        if (!options.validateCsrf(request)) return forbidden(reply);
        const post = await loadPost(db, { username: request.params.username, slug: request.params.url });
        if (!post || post.authorId !== user.id) return notFound(reply);
        const published = dateAsIso(post.publishedDate);
        if (!published || new Date(published).valueOf() <= Date.now()) {
          return failed('RJ', 'This action is only available for scheduled posts.');
        }
        if (request.params.action !== 'cancel' && request.params.action !== 'publish-now') return notFound(reply);
        const publishDate = request.params.action === 'cancel' ? null : nowString();
        const updated = nowString();
        await db.$transaction(async (tx) => {
          await tx.$executeRaw`
            UPDATE board_post SET published_date = ${publishDate}, updated_date = ${updated}
            WHERE id = ${post.id} AND author_id = ${user.id}
          `;
          await syncPostPublication(tx, post.id, { announce: true });
        });
        return done(request.params.action === 'cancel'
          ? { url: post.url, status: 'draft' }
          : { url: post.url, status: 'published', publishedDate: publishDate?.replace(' ', 'T') + 'Z' });
      },
    });

    const renderManagement = async (
      request: FastifyRequest,
      reply: FastifyReply,
      forcedTab?: ManagementTab,
    ) => {
      const account = await currentAccount(request, db, options);
      if (!account) return editorRedirect(reply, false);
      if (account.role !== 'EDITOR') return managementNotFound(reply);
      const query = queryObject(request);
      let tab = forcedTab ?? field(query.tab) as ManagementTab;
      if (!['published', 'scheduled', 'drafts', 'trash'].includes(tab)) tab = 'published';
      const filters = {
        search: field(query.search),
        tag: field(query.tag),
        series: field(query.series),
        visibility: field(query.visibility),
        order: field(query.order) || '-published_date',
      };
      let page = 1;
      let lastPage = 1;
      let totalCount = 0;
      let posts: Array<Record<string, unknown>> = [];
      let drafts: StoredDraftSummary[] = [];
      let trash: Array<Record<string, unknown>> = [];
      try {
        if (tab === 'published' || tab === 'scheduled') {
          const result = await getManagedPosts(db, account, query, tab === 'scheduled');
          ({ posts, page, lastPage, totalCount } = result);
        } else if (tab === 'drafts') {
          drafts = await db.$queryRaw<StoredDraftSummary[]>`
            SELECT url, title, image, CAST(created_date AS TEXT) AS createdDate,
                   CAST(updated_date AS TEXT) AS updatedDate
              FROM board_post
             WHERE author_id = ${account.id} AND deleted_date IS NULL AND published_date IS NULL
             ORDER BY updated_date DESC, id DESC
          `;
          totalCount = drafts.length;
        } else {
          page = managementPage(query.page);
          const result = await getTrashRows(db, account, page);
          trash = result.posts;
          lastPage = result.pagination.lastPage;
          totalCount = result.pagination.totalCount;
        }
      } catch (error) {
        if (error instanceof ManagementQueryError) return managementNotFound(reply, '포스트 목록 조건을 확인해 주세요.');
        throw error;
      }
      reply.code(200).type('text/html; charset=utf-8')
        .header('Cache-Control', 'private, no-store')
        .header('X-Robots-Tag', 'noindex, nofollow')
        .header('X-Frame-Options', 'DENY')
        .send(renderManagementPage({
          username: account.username,
          isStaff: account.isStaff,
          notifyCount: account.notifyCount,
          hasConnectedTelegram: account.hasConnectedTelegram,
          csrfToken: cookieValue(request, 'csrftoken'),
          tab,
          page,
          lastPage,
          totalCount,
          posts,
          drafts,
          trash,
          filters,
        }));
      return reply;
    };

    routes.get('/settings/posts', (request, reply) => renderManagement(request, reply));
    routes.get('/settings/posts/trash', (request, reply) => renderManagement(request, reply, 'trash'));
    routes.get('/settings/posts/scheduled', (request, reply) => renderManagement(request, reply, 'scheduled'));
    routes.get('/settings/drafts', (request, reply) => renderManagement(request, reply, 'drafts'));

    routes.get('/v1/setting/posts', async (request, reply) => {
      const account = await editorAccount(request, reply, db, options, true);
      if (!account) return reply;
      try {
        const { page: _page, ...body } = await getManagedPosts(db, account, queryObject(request), false, true);
        return done(body);
      } catch (error) {
        if (error instanceof ManagementQueryError) return notFound(reply);
        throw error;
      }
    });
    routes.get('/v1/setting/tag', async (request, reply) => {
      const account = await editorAccount(request, reply, db, options, true);
      if (!account) return reply;
      const tags = await db.$queryRaw<Array<{ name: string | null; count: number | bigint }>>`
        SELECT tag.value AS name, COUNT(tag.value) AS count
          FROM board_post AS post
          LEFT JOIN board_post_tags AS link ON link.post_id = post.id
          LEFT JOIN board_tag AS tag ON tag.id = link.tag_id
         WHERE post.author_id = ${account.id} AND post.deleted_date IS NULL
         GROUP BY tag.value
         ORDER BY count DESC
      `;
      return done({
        username: account.username,
        tags: tags.map((tag) => ({ name: tag.name, count: numberValue(tag.count) })),
      });
    });
    routes.get('/v1/setting/reserved-posts', async (request, reply) => {
      const account = await editorAccount(request, reply, db, options, true);
      if (!account) return reply;
      try {
        const { page: _page, ...body } = await getManagedPosts(db, account, queryObject(request), true, true);
        return done(body);
      } catch (error) {
        if (error instanceof ManagementQueryError) return notFound(reply);
        throw error;
      }
    });
    routes.route<{ Params: { url?: string } }>({
      method: ['GET', 'DELETE'],
      url: '/v1/setting/trash-posts/:url?',
      handler: async (request, reply) => {
        const account = await editorAccount(request, reply, db, options, true);
        if (!account) return reply;
        if (request.method === 'GET') {
          let page: number;
          try {
            page = managementPage(queryObject(request).page);
            return done(await getTrashRows(db, account, page));
          } catch (error) {
            if (error instanceof ManagementQueryError) return failed('VA', error.message);
            throw error;
          }
        }
        if (!options.validateCsrf(request)) return forbidden(reply);
        const slug = request.params.url;
        const expected = field(queryObject(request).expectedDeletedDate ?? queryObject(request).expected_deleted_date);
        if (!slug || !expected) return failed('VA', 'Check the current trash state.');
        const post = await loadTrashedPost(db, account, slug);
        if (!post) return notFound(reply);
        try {
          const id = await permanentlyDeleteTrashedPost(db, account, post, expected);
          return done({ deleted: true, id });
        } catch (error) {
          if (error instanceof PostValidationError) return failed(error.code, error.message);
          throw error;
        }
      },
    });
    routes.post<{ Params: { url: string } }>('/v1/setting/trash-posts/:url/restore', async (request, reply) => {
      const account = await editorAccount(request, reply, db, options, true);
      if (!account) return reply;
      if (!options.validateCsrf(request)) return forbidden(reply);
      const body = bodyObject(request.body);
      const expected = field(body.expected_deleted_date ?? body.expectedDeletedDate);
      if (!expected) return failed('VA', 'Check the current trash state.');
      const post = await loadTrashedPost(db, account, request.params.url);
      if (!post) return notFound(reply);
      try {
        const status = await restoreTrashedPost(db, account, post, expected);
        return done({ url: post.url, status, restored: true });
      } catch (error) {
        if (error instanceof PostValidationError) return failed(error.code, error.message);
        throw error;
      }
    });

    routes.post<{ Params: { slug: string } }>('/settings/posts/:slug/visibility', async (request, reply) => {
      const account = await currentAccount(request, db, options);
      if (!account) return editorRedirect(reply, false);
      if (account.role !== 'EDITOR') return managementNotFound(reply);
      if (!options.validateCsrf(request)) return managementForbidden(reply);
      const post = await loadPost(db, { userId: account.id, slug: request.params.slug });
      if (!post) return managementNotFound(reply, '포스트를 찾을 수 없습니다.');
      await db.$transaction(async (tx) => {
        await tx.$executeRaw`UPDATE board_postconfig SET hide = ${isTrue(post.hide) ? 0 : 1} WHERE post_id = ${post.id}`;
        await syncPostPublication(tx, post.id);
      });
      return reply.redirect('/settings/posts', 303);
    });
    routes.post<{ Params: { slug: string } }>('/settings/posts/:slug/trash', async (request, reply) => {
      const account = await currentAccount(request, db, options);
      if (!account) return editorRedirect(reply, false);
      if (account.role !== 'EDITOR') return managementNotFound(reply);
      if (!options.validateCsrf(request)) return managementForbidden(reply);
      const post = await loadPost(db, { userId: account.id, slug: request.params.slug });
      if (!post) return managementNotFound(reply, '포스트를 찾을 수 없습니다.');
      await trashPost(db, account, post);
      return reply.redirect('/settings/posts?tab=trash', 303);
    });
    routes.post<{ Params: { slug: string } }>('/settings/drafts/:slug/trash', async (request, reply) => {
      const account = await currentAccount(request, db, options);
      if (!account) return editorRedirect(reply, false);
      if (account.role !== 'EDITOR') return managementNotFound(reply);
      if (!options.validateCsrf(request)) return managementForbidden(reply);
      const post = await loadPost(db, { userId: account.id, slug: request.params.slug });
      if (!post || post.publishedDate !== null) return managementNotFound(reply, '임시 포스트를 찾을 수 없습니다.');
      await trashPost(db, account, post);
      return reply.redirect('/settings/drafts', 303);
    });
    routes.post<{ Params: { slug: string; action: string } }>('/settings/posts/:slug/schedule/:action', async (request, reply) => {
      const account = await currentAccount(request, db, options);
      if (!account) return editorRedirect(reply, false);
      if (account.role !== 'EDITOR') return managementNotFound(reply);
      if (!options.validateCsrf(request)) return managementForbidden(reply);
      if (request.params.action !== 'cancel' && request.params.action !== 'publish-now') return managementNotFound(reply, '예약 포스트를 찾을 수 없습니다.');
      const post = await loadPost(db, { userId: account.id, slug: request.params.slug });
      const published = post ? dateAsIso(post.publishedDate) : null;
      if (!post || !published || new Date(published).valueOf() <= Date.now()) return managementNotFound(reply, '예약 포스트를 찾을 수 없습니다.');
      const date = request.params.action === 'cancel' ? null : nowString();
      const updated = nowString();
      await db.$transaction(async (tx) => {
        await tx.$executeRaw`UPDATE board_post SET published_date = ${date}, updated_date = ${updated} WHERE id = ${post.id} AND author_id = ${account.id}`;
        await syncPostPublication(tx, post.id, { announce: true });
      });
      return reply.redirect(request.params.action === 'cancel' ? '/settings/posts?tab=drafts' : '/settings/posts', 303);
    });
    routes.post<{ Params: { url: string; action: 'restore' | 'purge' } }>('/settings/posts/trash/:url/:action', async (request, reply) => {
      const account = await currentAccount(request, db, options);
      if (!account) return editorRedirect(reply, false);
      if (account.role !== 'EDITOR') return managementNotFound(reply);
      if (!options.validateCsrf(request)) return managementForbidden(reply);
      if (request.params.action !== 'restore' && request.params.action !== 'purge') return managementNotFound(reply, '휴지통 포스트를 찾을 수 없습니다.');
      const body = bodyObject(request.body);
      if (request.params.action === 'purge' && field(body.confirm_permanent) !== 'yes') return managementForbidden(reply);
      const expected = field(body.expected_deleted_date);
      if (!expected) return managementForbidden(reply);
      const post = await loadTrashedPost(db, account, request.params.url);
      if (!post) return managementNotFound(reply, '휴지통 포스트를 찾을 수 없습니다.');
      try {
        if (request.params.action === 'restore') await restoreTrashedPost(db, account, post, expected);
        else await permanentlyDeleteTrashedPost(db, account, post, expected);
      } catch (error) {
        if (error instanceof PostValidationError) return reply.code(409).type('text/plain; charset=utf-8').send('휴지통 상태가 변경되었습니다. 목록을 새로고침한 뒤 다시 시도해 주세요.');
        throw error;
      }
      return reply.redirect('/settings/posts?tab=trash', 303);
    });

    routes.get<{ Params: { username: string; slug: string } }>('/@:username/:slug/revisions', async (request, reply) => {
      const account = await editorAccount(request, reply, db, options, false);
      if (!account) return reply;
      const post = await loadPost(db, { username: request.params.username, slug: request.params.slug });
      if (!post || post.authorId !== account.id || post.publishedDate === null) return notFound(reply);
      const query = queryObject(request);
      const pageRaw = field(query.page) || '1';
      if (!/^\d+$/.test(pageRaw) || !Number.isSafeInteger(Number(pageRaw)) || Number(pageRaw) < 1) return notFound(reply);
      const page = Number(pageRaw);
      const limit = 20;
      const countRows = await db.$queryRaw<Array<{ total: number | bigint }>>`
        SELECT COUNT(*) AS total FROM board_edithistory
         WHERE post_id = ${post.id} AND change_type <> 'draft'
      `;
      const totalCount = numberValue(countRows[0]?.total);
      const lastPage = Math.max(1, Math.ceil(totalCount / limit));
      if (page > lastPage) return notFound(reply);
      const revisions = await db.$queryRaw<StoredRevision[]>`
        SELECT history.id AS id, history.title AS title, history.subtitle AS subtitle,
               history.content AS content, history.content_excerpt AS contentExcerpt,
               history.description AS description, history.tags AS tags,
               history.change_type AS changeType, actor.username AS actor,
               history.restored_from_id AS restoredFromId,
               CAST(history.source_updated_date AS TEXT) AS sourceUpdatedDate,
               CAST(history.created_date AS TEXT) AS createdDate
          FROM board_edithistory AS history LEFT JOIN auth_user AS actor ON actor.id = history.actor_id
         WHERE history.post_id = ${post.id} AND history.change_type <> 'draft'
         ORDER BY history.created_date DESC, history.id DESC
         LIMIT ${limit} OFFSET ${(page - 1) * limit}
      `;
      const updatedDate = post.updatedDate instanceof Date ? post.updatedDate.toISOString() : String(post.updatedDate ?? '');
      const notice = field(query.restored) === '1'
        ? '이 기록으로 복원했습니다.'
        : field(query.restored) === 'already'
          ? '현재 글이 이미 이 기록과 같습니다.'
          : field(query.deleted) === '1'
            ? '수정 기록을 삭제했습니다.'
            : field(query.conflict) === '1'
              ? '글이 다른 곳에서 변경됐습니다. 기록을 새로 불러왔습니다.'
              : '';
      return sendPrivateHistoryPage(reply, renderRevisionHistoryPage({
        username: account.username,
        slug: post.url,
        title: post.title,
        updatedDate,
        csrfToken: cookieValue(request, 'csrftoken'),
        page,
        lastPage,
        totalCount,
        revisions,
        notice,
      }));
    });

    routes.post<{ Params: { username: string; slug: string; revisionId: string } }>(
      '/@:username/:slug/revisions/:revisionId/restore',
      async (request, reply) => {
        const account = await editorAccount(request, reply, db, options, false);
        if (!account) return reply;
        if (!options.validateCsrf(request)) return forbidden(reply);
        const post = await loadPost(db, { username: request.params.username, slug: request.params.slug });
        const revisionId = /^\d+$/.test(request.params.revisionId) ? Number(request.params.revisionId) : 0;
        if (!post || post.authorId !== account.id || post.publishedDate === null || !Number.isSafeInteger(revisionId) || revisionId < 1) {
          return notFound(reply);
        }
        const revision = await loadRevision(db, post.id, revisionId);
        if (!revision) return notFound(reply);
        const expected = field(bodyObject(request.body).expected_updated_date);
        if (!expected) return forbidden(reply);
        try {
          const result = await restoreRevision(db, account, post, revision, expected);
          const state = result.restored ? '1' : 'already';
          return reply.redirect(`/@${encodeURIComponent(account.username)}/${encodeURIComponent(post.url)}/revisions?restored=${state}`, 303);
        } catch (error) {
          if (error instanceof PostValidationError) {
            return reply.redirect(`/@${encodeURIComponent(account.username)}/${encodeURIComponent(post.url)}/revisions?conflict=1`, 303);
          }
          throw error;
        }
      },
    );

    routes.post<{ Params: { username: string; slug: string; revisionId: string } }>(
      '/@:username/:slug/revisions/:revisionId/delete',
      async (request, reply) => {
        const account = await editorAccount(request, reply, db, options, false);
        if (!account) return reply;
        if (!options.validateCsrf(request)) return forbidden(reply);
        const post = await loadPost(db, { username: request.params.username, slug: request.params.slug });
        const revisionId = /^\d+$/.test(request.params.revisionId) ? Number(request.params.revisionId) : 0;
        if (!post || post.authorId !== account.id || post.publishedDate === null || !Number.isSafeInteger(revisionId) || revisionId < 1) {
          return notFound(reply);
        }
        const body = bodyObject(request.body);
        if (field(body.confirm_delete) !== 'yes') return forbidden(reply);
        const expected = field(body.expected_updated_date);
        if (!expected) return forbidden(reply);
        try {
          assertExpectedUpdatedAt(post.updatedDate, expected);
        } catch {
          return reply.redirect(`/@${encodeURIComponent(account.username)}/${encodeURIComponent(post.url)}/revisions?conflict=1`, 303);
        }
        if (!await deleteRevision(db, post.id, revisionId)) return notFound(reply);
        return reply.redirect(`/@${encodeURIComponent(account.username)}/${encodeURIComponent(post.url)}/revisions?deleted=1`, 303);
      },
    );

    routes.get<{ Params: { username: string; slug: string } }>('/@:username/:slug/timelapse', async (request, reply) => {
      const account = await editorAccount(request, reply, db, options, false);
      if (!account) return reply;
      const post = await loadPost(db, { username: request.params.username, slug: request.params.slug });
      if (!post || post.authorId !== account.id || post.publishedDate === null) return notFound(reply);
      return sendPrivateHistoryPage(reply, renderTimelapsePage(account.username, post, await buildTimelapse(db, post)));
    });

    routes.get<{ Params: { username: string; url: string } }>('/v1/users/@:username/posts/:url/revisions', async (request, reply) => {
      const account = await editorAccount(request, reply, db, options, true);
      if (!account) return reply;
      const post = await loadPost(db, { username: request.params.username, slug: request.params.url });
      if (!post || post.authorId !== account.id || post.publishedDate === null) return notFound(reply);
      const query = queryObject(request);
      const pageRaw = field(query.page) || '1';
      const limitRaw = field(query.limit) || '20';
      if (!/^\d+$/.test(pageRaw) || !/^\d+$/.test(limitRaw)) return failed('VA', 'Check the revision history pagination values.');
      const page = Number(pageRaw);
      const limit = Number(limitRaw);
      if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(limit) || limit < 1 || limit > 50) {
        return failed('VA', 'Check the revision history pagination values.');
      }
      const countRows = await db.$queryRaw<Array<{ total: number | bigint }>>`
        SELECT COUNT(*) AS total FROM board_edithistory WHERE post_id = ${post.id} AND change_type <> 'draft'
      `;
      const totalCount = numberValue(countRows[0]?.total);
      const lastPage = Math.max(1, Math.ceil(totalCount / limit));
      if (page > lastPage) return failed('VA', 'Check the revision history pagination values.');
      const revisions = await db.$queryRaw<StoredRevision[]>`
        SELECT history.id AS id, history.title AS title, history.subtitle AS subtitle,
               history.content_excerpt AS contentExcerpt, history.description AS description,
               history.tags AS tags, history.change_type AS changeType,
               actor.username AS actor, history.restored_from_id AS restoredFromId,
               CAST(history.source_updated_date AS TEXT) AS sourceUpdatedDate,
               CAST(history.created_date AS TEXT) AS createdDate
          FROM board_edithistory AS history LEFT JOIN auth_user AS actor ON actor.id = history.actor_id
         WHERE history.post_id = ${post.id} AND history.change_type <> 'draft'
         ORDER BY history.created_date DESC, history.id DESC
         LIMIT ${limit} OFFSET ${(page - 1) * limit}
      `;
      return done({
        revisions: revisions.map(revisionSummary),
        pagination: { page, limit, totalCount, lastPage },
        currentUpdatedDate: dateAsIso(post.updatedDate),
        retention: { mode: 'unlimited' },
      });
    });
    routes.route<{ Params: { username: string; url: string; revisionId: string } }>({
      method: ['GET', 'DELETE'],
      url: '/v1/users/@:username/posts/:url/revisions/:revisionId',
      handler: async (request, reply) => {
        const account = await editorAccount(request, reply, db, options, true);
        if (!account) return reply;
        const post = await loadPost(db, { username: request.params.username, slug: request.params.url });
        const revisionId = /^\d+$/.test(request.params.revisionId) ? Number(request.params.revisionId) : 0;
        if (!post || post.authorId !== account.id || post.publishedDate === null || !Number.isSafeInteger(revisionId) || revisionId < 1) return notFound(reply);
        if (request.method === 'DELETE') {
          if (!options.validateCsrf(request)) return forbidden(reply);
          if (!await deleteRevision(db, post.id, revisionId)) return notFound(reply);
          return done({ revisionId, deleted: true });
        }
        const revision = await loadRevision(db, post.id, revisionId);
        if (!revision) return notFound(reply);
        return done({
          revision: {
            ...revisionSummary(revision),
            contentHtml: sanitizePostHtml(revision.content),
            contentText: plainText(revision.content),
            description: revision.description,
          },
        });
      },
    });
    routes.post<{ Params: { username: string; url: string; revisionId: string } }>(
      '/v1/users/@:username/posts/:url/revisions/:revisionId/restore',
      async (request, reply) => {
        const account = await editorAccount(request, reply, db, options, true);
        if (!account) return reply;
        if (!options.validateCsrf(request)) return forbidden(reply);
        const post = await loadPost(db, { username: request.params.username, slug: request.params.url });
        const revisionId = /^\d+$/.test(request.params.revisionId) ? Number(request.params.revisionId) : 0;
        if (!post || post.authorId !== account.id || post.publishedDate === null || revisionId < 1) return notFound(reply);
        const revision = await loadRevision(db, post.id, revisionId);
        if (!revision) return notFound(reply);
        const body = bodyObject(request.body);
        const expected = field(body.expected_updated_date ?? body.expectedUpdatedDate);
        if (!expected) return failed('VA', 'Check the current post version.');
        try {
          const result = await restoreRevision(db, account, post, revision, expected);
          return done({ url: post.url, updatedDate: result.updatedDate, restored: result.restored });
        } catch (error) {
          if (error instanceof PostValidationError) return failed(error.code, error.message);
          throw error;
        }
      },
    );
    routes.get<{ Params: { username: string; url: string } }>('/v1/users/@:username/posts/:url/timelapse', async (request, reply) => {
      const account = await editorAccount(request, reply, db, options, true);
      if (!account) return reply;
      const post = await loadPost(db, { username: request.params.username, slug: request.params.url });
      if (!post || post.authorId !== account.id || post.publishedDate === null) return notFound(reply);
      return done(await buildTimelapse(db, post));
    });
  });
}
