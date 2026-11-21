import formBody from '@fastify/formbody';
import multipart from '@fastify/multipart';
import { Prisma, type PrismaClient } from '@prisma/client';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import sharp from 'sharp';
import { createReadStream } from 'node:fs';
import { mkdir, realpath, stat, unlink, writeFile } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { randomUUID } from 'node:crypto';
import { renderWorkLogDelete, renderWorkLogDetail, renderWorkLogIndex, renderWorkLogShared, type WorkLogEntryView, type WorkLogShareView, type WorkLogView } from './pages.js';

const MAX_ATTACHMENT_SIZE = 12 * 1024 * 1024;
const MAX_REQUEST_SIZE = 13 * 1024 * 1024;
const MAX_IMAGE_PIXELS = 20_000_000;
const PAGE_SIZE = 20;
const PRIVATE_MEDIA_DIRECTORY = '_work_logs';

export interface WorkLogUser {
  id: number;
  username: string;
}

export interface WorkLogOptions {
  currentUser: (request: FastifyRequest) => Promise<WorkLogUser | null>;
  validateCsrf: (request: FastifyRequest) => boolean;
  mediaRoot?: string;
  siteUrl: URL;
}

interface WorkLogRow extends WorkLogView {
  ownerId?: number;
  ownerUsername?: string;
}

interface EntryRow extends WorkLogEntryView {
  logId: number;
}

interface ShareRow extends WorkLogShareView {
  logId: number;
  ownerId: number;
  ownerUsername: string;
  logTitle: string;
  logCreatedAt: string;
}

interface EntryInput {
  fields: Record<string, unknown>;
  attachment: Buffer | null;
}

interface MediaFile {
  path: string;
  size: number;
}

function html(reply: FastifyReply, content: string) {
  return reply.type('text/html; charset=utf-8').send(content);
}

function notFound(reply: FastifyReply) {
  return reply.code(404).type('text/plain; charset=utf-8').send('Not found');
}

function notAllowed(reply: FastifyReply) {
  return reply.code(403).type('text/plain; charset=utf-8').send('Forbidden');
}

function parseId(value: string | undefined): number | null {
  if (!value || !/^\d+$/.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function scalar(value: unknown): string {
  if (Array.isArray(value)) return scalar(value.at(-1));
  if (typeof value === 'string') return value;
  if (Buffer.isBuffer(value)) return value.toString('utf8');
  return '';
}

function arrayValue(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(scalar);
  const item = scalar(value);
  return item ? [item] : [];
}

function bodyRecord(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== 'object' || Array.isArray(body) || Buffer.isBuffer(body)) return {};
  return body as Record<string, unknown>;
}

function csrfCookieValue(request: FastifyRequest): string {
  const cookieHeader = request.headers.cookie ?? '';
  for (const part of cookieHeader.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0 || part.slice(0, separator).trim() !== 'csrftoken') continue;
    try {
      const value = decodeURIComponent(part.slice(separator + 1).trim());
      return /^[A-Za-z0-9_-]{43}$/.test(value) ? value : '';
    } catch {
      return '';
    }
  }
  return '';
}

function djangoTimestamp(date = new Date()): string {
  return date.toISOString()
    .replace('T', ' ')
    .replace(/\.(\d{3})Z$/, (_match, milliseconds: string) => `.${milliseconds}000`);
}

function toIsoDateTime(value: string | null): string {
  if (!value) return '';
  const match = value.replace('T', ' ').match(/^(.+\d{2}:\d{2}:\d{2})(?:\.(\d+))?(Z|[+-]\d{2}:\d{2})?$/);
  if (!match) return value;
  const hasFraction = match[2] !== undefined && /[1-9]/.test(match[2]);
  const fraction = hasFraction ? `.${match[2].slice(0, 6).padEnd(6, '0')}` : '';
  const offset = match[3] === 'Z' ? '+00:00' : (match[3] ?? '+00:00');
  return `${match[1].replace(' ', 'T')}${fraction}${offset}`;
}

function displayPage(value: string | undefined, totalCount: number): number {
  const pages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const parsed = value && /^[+-]?\d+$/.test(value) ? Number(value) : 1;
  if (!Number.isSafeInteger(parsed) || parsed < 1) return 1;
  return Math.min(parsed, pages);
}

function pageLinks(
  path: string,
  page: number,
  pages: number,
  extra: Record<string, number> = {},
  parameter = 'page',
) {
  const build = (targetPage: number) => {
    const params = new URLSearchParams({ [parameter]: String(targetPage) });
    for (const [key, value] of Object.entries(extra)) params.set(key, String(value));
    return `${path}?${params.toString()}`;
  };
  return {
    previous: page > 1 ? build(page - 1) : undefined,
    next: page < pages ? build(page + 1) : undefined,
  };
}

function loginRedirect(request: FastifyRequest, reply: FastifyReply) {
  const next = request.url.split('?')[0] || '/work-logs/';
  return reply.redirect(`/login?next=${encodeURIComponent(next)}`, 302);
}

async function currentUser(
  request: FastifyRequest,
  reply: FastifyReply,
  options: WorkLogOptions,
): Promise<WorkLogUser | null> {
  const user = await options.currentUser(request);
  if (!user) {
    loginRedirect(request, reply);
    return null;
  }
  return user;
}

async function isActiveEditor(db: PrismaClient, userId: number): Promise<boolean> {
  const [row] = await db.$queryRaw<Array<{ allowed: number | bigint }>>`
    SELECT EXISTS (
      SELECT 1 FROM auth_user AS user
      JOIN board_profile AS profile ON profile.user_id = user.id
      WHERE user.id = ${userId} AND user.is_active = 1 AND profile.role = 'EDITOR'
    ) AS allowed
  `;
  return Boolean(row?.allowed);
}

async function readOwnedLog(db: PrismaClient, logId: number, userId: number): Promise<WorkLogRow | null> {
  const [row] = await db.$queryRaw<WorkLogRow[]>`
    SELECT log.id, log.title, CAST(log.created_at AS TEXT) AS createdAt,
           log.owner_id AS ownerId, owner.username AS ownerUsername
      FROM board_worklog AS log
      JOIN auth_user AS owner ON owner.id = log.owner_id
     WHERE log.id = ${logId} AND log.owner_id = ${userId} AND owner.is_active = 1
     LIMIT 1
  `;
  return row ?? null;
}

async function readShare(db: PrismaClient, token: string): Promise<ShareRow | null> {
  const [row] = await db.$queryRaw<ShareRow[]>`
    SELECT share.id, share.token, share.headline,
           CAST(share.created_at AS TEXT) AS createdAt,
           share.log_id AS logId, log.owner_id AS ownerId,
           owner.username AS ownerUsername,
           log.title AS logTitle, CAST(log.created_at AS TEXT) AS logCreatedAt
      FROM board_worklogshare AS share
      JOIN board_worklog AS log ON log.id = share.log_id
      JOIN auth_user AS owner ON owner.id = log.owner_id
     WHERE share.token = ${token} AND owner.is_active = 1
     LIMIT 1
  `;
  return row ?? null;
}

async function countEntries(db: PrismaClient, logId: number): Promise<number> {
  const [row] = await db.$queryRaw<Array<{ total: number | bigint }>>`
    SELECT COUNT(*) AS total FROM board_worklogentry WHERE log_id = ${logId}
  `;
  return Number(row?.total ?? 0);
}

async function readEntries(
  db: PrismaClient,
  logId: number,
  page: number,
  order: 'newest' | 'oldest' = 'newest',
): Promise<EntryRow[]> {
  const orderBy = order === 'oldest' ? Prisma.sql`entry.created_at ASC, entry.id ASC` : Prisma.sql`entry.created_at DESC, entry.id DESC`;
  return db.$queryRaw<EntryRow[]>`
    SELECT entry.id, entry.log_id AS logId, entry.title, entry.text,
           entry.media_type AS mediaType, entry.attachment,
           CAST(entry.created_at AS TEXT) AS createdAt
      FROM board_worklogentry AS entry
     WHERE entry.log_id = ${logId}
     ORDER BY ${orderBy}
     LIMIT ${PAGE_SIZE} OFFSET ${(page - 1) * PAGE_SIZE}
  `;
}

async function readShares(db: PrismaClient, logId: number, page: number): Promise<WorkLogShareView[]> {
  return db.$queryRaw<WorkLogShareView[]>`
    SELECT share.id, share.token, share.headline, CAST(share.created_at AS TEXT) AS createdAt
      FROM board_worklogshare AS share
     WHERE share.log_id = ${logId}
     ORDER BY share.created_at DESC, share.id DESC
     LIMIT ${PAGE_SIZE} OFFSET ${(page - 1) * PAGE_SIZE}
  `;
}

async function readSnapshotEntries(db: PrismaClient, shareId: number, page: number): Promise<EntryRow[]> {
  return db.$queryRaw<EntryRow[]>`
    SELECT entry.id, entry.log_id AS logId, entry.title, entry.text,
           entry.media_type AS mediaType, entry.attachment,
           CAST(entry.created_at AS TEXT) AS createdAt
      FROM board_worklogshare_entries AS selection
      JOIN board_worklogentry AS entry ON entry.id = selection.worklogentry_id
     WHERE selection.worklogshare_id = ${shareId}
     ORDER BY entry.created_at ASC, entry.id ASC
     LIMIT ${PAGE_SIZE} OFFSET ${(page - 1) * PAGE_SIZE}
  `;
}

async function entryCountForShare(db: PrismaClient, shareId: number): Promise<number> {
  const [row] = await db.$queryRaw<Array<{ total: number | bigint }>>`
    SELECT COUNT(*) AS total FROM board_worklogshare_entries WHERE worklogshare_id = ${shareId}
  `;
  return Number(row?.total ?? 0);
}

async function pageEntryForShareMedia(
  db: PrismaClient,
  shareId: number,
  logId: number,
  entryId: number,
): Promise<EntryRow | null> {
  const [row] = await db.$queryRaw<EntryRow[]>`
    SELECT entry.id, entry.log_id AS logId, entry.title, entry.text,
           entry.media_type AS mediaType, entry.attachment,
           CAST(entry.created_at AS TEXT) AS createdAt
      FROM board_worklogshare_entries AS selection
      JOIN board_worklogentry AS entry ON entry.id = selection.worklogentry_id
     WHERE selection.worklogshare_id = ${shareId}
       AND entry.log_id = ${logId} AND entry.id = ${entryId}
       AND entry.attachment <> ''
     LIMIT 1
  `;
  return row ?? null;
}

async function validateAttachment(data: Buffer): Promise<{ mediaType: string; extension: string }> {
  if (data.length === 0 || data.length > MAX_ATTACHMENT_SIZE) {
    throw new Error('Choose an attachment up to 12 MB.');
  }
  if (data.length >= 12 && data.toString('ascii', 4, 8) === 'ftyp') {
    return { mediaType: 'video/mp4', extension: '.mp4' };
  }
  if (data.length >= 4 && data.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))) {
    return { mediaType: 'video/webm', extension: '.webm' };
  }

  let metadata: import('sharp').Metadata;
  try {
    metadata = await sharp(data, { failOn: 'error', limitInputPixels: MAX_IMAGE_PIXELS }).metadata();
  } catch {
    throw new Error('Choose a PNG, JPEG, WebP, MP4, or WebM file.');
  }
  const formats: Record<string, { mediaType: string; extension: string }> = {
    png: { mediaType: 'image/png', extension: '.png' },
    jpeg: { mediaType: 'image/jpeg', extension: '.jpg' },
    webp: { mediaType: 'image/webp', extension: '.webp' },
  };
  const validated = metadata.format ? formats[metadata.format] : undefined;
  if (!validated || !metadata.width || !metadata.height) {
    throw new Error('Choose a PNG, JPEG, WebP, MP4, or WebM file.');
  }
  if (metadata.width * metadata.height > MAX_IMAGE_PIXELS) {
    throw new Error('Choose an image up to 20 megapixels.');
  }
  try {
    await sharp(data, { failOn: 'error', limitInputPixels: MAX_IMAGE_PIXELS }).stats();
  } catch {
    throw new Error('Choose a PNG, JPEG, WebP, MP4, or WebM file.');
  }
  return validated;
}

async function saveAttachment(data: Buffer, extension: string, mediaRoot: string): Promise<string> {
  const key = randomUUID().replaceAll('-', '').toLowerCase();
  const relativeName = `${key.slice(0, 2)}/${key}${extension}`;
  const directory = resolve(mediaRoot, PRIVATE_MEDIA_DIRECTORY, key.slice(0, 2));
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const path = resolve(directory, `${key}${extension}`);
  try {
    await writeFile(path, data, { flag: 'wx', mode: 0o600 });
  } catch (error) {
    await unlink(path).catch(() => undefined);
    throw error;
  }
  return relativeName;
}

async function safeMediaFile(mediaRoot: string | undefined, attachment: string): Promise<MediaFile | null> {
  if (!mediaRoot || !attachment || attachment.includes('\\') || attachment.includes('\0')) return null;
  const root = resolve(mediaRoot, PRIVATE_MEDIA_DIRECTORY);
  const candidate = resolve(root, ...attachment.split('/'));
  const unresolved = relative(root, candidate);
  if (unresolved === '' || unresolved === '..' || unresolved.startsWith(`..${sep}`) || isAbsolute(unresolved)) return null;
  try {
    const realRoot = await realpath(root);
    const path = await realpath(candidate);
    const pathRelativeToRoot = relative(realRoot, path);
    if (pathRelativeToRoot === '..' || pathRelativeToRoot.startsWith(`..${sep}`) || isAbsolute(pathRelativeToRoot)) return null;
    const details = await stat(path);
    return details.isFile() ? { path, size: details.size } : null;
  } catch {
    return null;
  }
}

export async function removeAttachment(mediaRoot: string | undefined, attachment: string): Promise<void> {
  const file = await safeMediaFile(mediaRoot, attachment);
  if (file) await unlink(file.path).catch(() => undefined);
}

async function readEntryInput(request: FastifyRequest): Promise<EntryInput> {
  const fields = bodyRecord(request.body);
  const attachment = fields.attachment;
  return {
    fields,
    attachment: Buffer.isBuffer(attachment) ? attachment : null,
  };
}

function selectedEntryIds(fields: Record<string, unknown>, allowEmpty = false): { ids: number[]; error?: string } {
  const values = [
    ...arrayValue(fields.selected_entries).flatMap((value) => value.split(',')),
    ...arrayValue(fields.entries),
  ];
  if (values.length > 997) return { ids: [], error: 'Choose up to 997 entries for one link.' };
  if (values.some((value) => !/^\d{1,18}$/.test(value))) {
    return { ids: [], error: 'Choose entries from this work log.' };
  }
  const ids = [...new Set(values.map(Number))];
  if (ids.some((id) => !Number.isSafeInteger(id) || id <= 0)) {
    return { ids: [], error: 'Choose entries from this work log.' };
  }
  if (ids.length === 0 && !allowEmpty) return { ids, error: 'Choose at least one entry to share.' };
  return { ids };
}

function csrfValid(request: FastifyRequest, options: WorkLogOptions): boolean {
  try {
    return options.validateCsrf(request);
  } catch {
    return false;
  }
}

function isValidShareToken(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function selectedEntries(db: PrismaClient, logId: number, ids: number[]): Promise<EntryRow[]> {
  if (ids.length === 0) return [];
  return db.$queryRaw<EntryRow[]>`
    SELECT entry.id, entry.log_id AS logId, entry.title, entry.text,
           entry.media_type AS mediaType, entry.attachment,
           CAST(entry.created_at AS TEXT) AS createdAt
      FROM board_worklogentry AS entry
     WHERE entry.log_id = ${logId} AND entry.id IN (${Prisma.join(ids)})
     ORDER BY entry.created_at ASC, entry.id ASC
  `;
}

function sharePath(token: string): string {
  return `/work-logs/share/${token}/`;
}

async function createShare(db: PrismaClient, logId: number, headline: string, entries: EntryRow[]): Promise<string> {
  const token = randomUUID();
  const createdAt = djangoTimestamp();
  await db.$transaction(async (transaction) => {
    await transaction.$executeRaw`
      INSERT INTO board_worklogshare (token, headline, created_at, log_id)
      VALUES (${token}, ${headline}, ${createdAt}, ${logId})
    `;
    const [share] = await transaction.$queryRaw<Array<{ id: number }>>`SELECT last_insert_rowid() AS id`;
    for (const entry of entries) {
      await transaction.$executeRaw`
        INSERT INTO board_worklogshare_entries (worklogshare_id, worklogentry_id)
        VALUES (${share.id}, ${entry.id})
      `;
    }
  });
  return token;
}

async function insertWorkLog(db: PrismaClient, userId: number, title: string): Promise<number> {
  return db.$transaction(async (transaction) => {
    await transaction.$executeRaw`
      INSERT INTO board_worklog (title, created_at, owner_id)
      VALUES (${title}, ${djangoTimestamp()}, ${userId})
    `;
    const [row] = await transaction.$queryRaw<Array<{ id: number }>>`SELECT last_insert_rowid() AS id`;
    return row.id;
  });
}

async function insertEntry(
  db: PrismaClient,
  logId: number,
  title: string,
  text: string,
  mediaType: string,
  attachment: string,
): Promise<void> {
  await db.$executeRaw`
    INSERT INTO board_worklogentry (title, text, media_type, attachment, created_at, log_id)
    VALUES (${title}, ${text}, ${mediaType}, ${attachment}, ${djangoTimestamp()}, ${logId})
  `;
}

async function deleteEntry(db: PrismaClient, logId: number, entryId: number): Promise<string | null> {
  const [entry] = await db.$queryRaw<Array<{ attachment: string }>>`
    SELECT attachment FROM board_worklogentry WHERE log_id = ${logId} AND id = ${entryId}
  `;
  if (!entry) return null;
  await db.$transaction(async (transaction) => {
    await transaction.$executeRaw`
      DELETE FROM board_worklogshare_entries WHERE worklogentry_id = ${entryId}
    `;
    await transaction.$executeRaw`DELETE FROM board_worklogentry WHERE id = ${entryId} AND log_id = ${logId}`;
    await transaction.$executeRaw`
      DELETE FROM board_worklogshare
       WHERE log_id = ${logId}
         AND NOT EXISTS (
           SELECT 1 FROM board_worklogshare_entries AS selected
            WHERE selected.worklogshare_id = board_worklogshare.id
         )
    `;
  });
  return entry.attachment;
}

async function deleteWorkLog(db: PrismaClient, logId: number, userId: number): Promise<string[]> {
  const attachments = await db.$queryRaw<Array<{ attachment: string }>>`
    SELECT attachment FROM board_worklogentry WHERE log_id = ${logId} AND attachment <> ''
  `;
  await db.$transaction(async (transaction) => {
    await transaction.$executeRaw`
      DELETE FROM board_worklogshare_entries
       WHERE worklogshare_id IN (SELECT id FROM board_worklogshare WHERE log_id = ${logId})
          OR worklogentry_id IN (SELECT id FROM board_worklogentry WHERE log_id = ${logId})
    `;
    await transaction.$executeRaw`DELETE FROM board_worklogshare WHERE log_id = ${logId}`;
    await transaction.$executeRaw`DELETE FROM board_worklogentry WHERE log_id = ${logId}`;
    await transaction.$executeRaw`DELETE FROM board_worklog WHERE id = ${logId} AND owner_id = ${userId}`;
  });
  return attachments.map((file) => file.attachment);
}

function pageUrl(path: string, page: number, values: Record<string, number> = {}) {
  const query = new URLSearchParams({ page: String(page) });
  for (const [key, value] of Object.entries(values)) query.set(key, String(value));
  return `${path}?${query.toString()}`;
}

async function renderDetailPage(
  request: FastifyRequest,
  reply: FastifyReply,
  db: PrismaClient,
  options: WorkLogOptions,
  user: WorkLogUser,
  log: WorkLogRow,
  state: { timelinePage?: string; selectionPage?: string; linksPage?: string; selectedIds?: number[]; error?: string } = {},
) {
  const [totalEntries, totalShares, canWrite] = await Promise.all([
    countEntries(db, log.id),
    db.$queryRaw<Array<{ total: number | bigint }>>`
      SELECT COUNT(*) AS total FROM board_worklogshare WHERE log_id = ${log.id}
    `.then(([row]) => Number(row?.total ?? 0)),
    isActiveEditor(db, user.id),
  ]);
  const timelinePage = displayPage(state.timelinePage ?? (request.query as Record<string, string | undefined>).page, totalEntries);
  const selectionPage = displayPage(state.selectionPage ?? (request.query as Record<string, string | undefined>).selection_page, totalEntries);
  const linksPage = displayPage(state.linksPage ?? (request.query as Record<string, string | undefined>).links_page, totalShares);
  const [timeline, selector, shares] = await Promise.all([
    readEntries(db, log.id, timelinePage),
    readEntries(db, log.id, selectionPage),
    readShares(db, log.id, linksPage),
  ]);
  const url = `/work-logs/${log.id}/`;
  const entryPages = Math.max(1, Math.ceil(totalEntries / PAGE_SIZE));
  const sharePages = Math.max(1, Math.ceil(totalShares / PAGE_SIZE));
  return html(reply, renderWorkLogDetail({
    log: { ...log, createdAt: toIsoDateTime(log.createdAt) },
    canWrite,
    csrfToken: csrfCookieValue(request),
    viewer: { username: user.username, hasEditorRole: canWrite, csrfToken: csrfCookieValue(request) },
    timeline: timeline.map((entry) => ({ ...entry, createdAt: toIsoDateTime(entry.createdAt) })),
    selector: selector.map((entry) => ({ ...entry, createdAt: toIsoDateTime(entry.createdAt) })),
    selectedIds: state.selectedIds ?? [],
    shares: shares.map((share) => ({ ...share, createdAt: toIsoDateTime(share.createdAt) })),
    timelineLinks: pageLinks(url, timelinePage, entryPages, { links_page: linksPage, selection_page: selectionPage }),
    selectionLinks: pageLinks(url, selectionPage, entryPages, { page: timelinePage, links_page: linksPage }, 'selection_page'),
    shareLinks: pageLinks(url, linksPage, sharePages, { page: timelinePage, selection_page: selectionPage }, 'links_page'),
    timelinePage,
    selectionPage,
    linksPage,
    mediaUrl: (entry) => `/work-logs/${log.id}/media/${entry.id}/`,
    error: state.error,
  }));
}

async function mediaResponse(
  request: FastifyRequest,
  reply: FastifyReply,
  mediaRoot: string | undefined,
  entry: EntryRow,
) {
  const headReply = (statusCode: number, mediaType: string, responseHeaders: Record<string, string>) => {
    reply.hijack();
    reply.raw.writeHead(statusCode, { ...responseHeaders, 'Content-Type': mediaType });
    reply.raw.end();
    return reply;
  };
  const file = await safeMediaFile(mediaRoot, entry.attachment);
  if (!file) return notFound(reply);
  const rangeHeader = request.headers.range;
  const range = typeof rangeHeader === 'string' ? rangeHeader.match(/^bytes=(\d{0,18})-(\d{0,18})$/) : null;
  const headers = {
    'Accept-Ranges': 'bytes',
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'private, no-store',
  };

  if (range && (range[1] !== '' || range[2] !== '')) {
    const first = range[1];
    const last = range[2];
    const start = first ? Number(first) : Math.max(0, file.size - Number(last));
    const end = first && last ? Math.min(file.size - 1, Number(last)) : file.size - 1;
    if (start > end || start >= file.size || !Number.isSafeInteger(start) || !Number.isSafeInteger(end)) {
      return reply.code(416).headers(headers).header('Content-Range', `bytes */${file.size}`).send();
    }
    const length = end - start + 1;
    reply.code(206)
      .headers(headers)
      .type(entry.mediaType)
      .header('Content-Range', `bytes ${start}-${end}/${file.size}`)
      .header('Content-Length', String(length));
    if (request.method === 'HEAD') {
      return headReply(206, entry.mediaType, {
        ...headers,
        'Content-Range': `bytes ${start}-${end}/${file.size}`,
        'Content-Length': String(length),
      });
    }
    return reply.send(createReadStream(file.path, { start, end }));
  }

  reply.code(200).headers(headers).type(entry.mediaType).header('Content-Length', String(file.size));
  if (request.method === 'HEAD') {
    return headReply(200, entry.mediaType, { ...headers, 'Content-Length': String(file.size) });
  }
  return reply.send(createReadStream(file.path));
}

export function registerWorkLogs(app: FastifyInstance, db: PrismaClient, options: WorkLogOptions): void {
  app.register(async (routes) => {
    await routes.register(formBody);
    await routes.register(multipart, {
      attachFieldsToBody: 'keyValues',
      limits: { files: 1, fields: 12, parts: 16, fileSize: MAX_ATTACHMENT_SIZE },
    });

    routes.addHook('onRequest', async (_request, reply) => {
      reply.header('Cache-Control', 'private, no-store')
        .header('X-Robots-Tag', 'noindex, nofollow, noarchive')
        .header('Referrer-Policy', 'strict-origin');
    });

    routes.get('/work-logs/', async (request, reply) => {
      const user = await currentUser(request, reply, options);
      if (!user) return reply;
      const [total, canWrite] = await Promise.all([
        db.$queryRaw<Array<{ total: number | bigint }>>`
          SELECT COUNT(*) AS total FROM board_worklog AS log
          JOIN auth_user AS owner ON owner.id = log.owner_id
          WHERE log.owner_id = ${user.id} AND owner.is_active = 1
        `.then(([row]) => Number(row?.total ?? 0)),
        isActiveEditor(db, user.id),
      ]);
      const query = request.query as Record<string, string | string[] | undefined>;
      const page = displayPage(typeof query.page === 'string' ? query.page : undefined, total);
      const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
      const logs = await db.$queryRaw<WorkLogRow[]>`
        SELECT log.id, log.title, CAST(log.created_at AS TEXT) AS createdAt
          FROM board_worklog AS log
          JOIN auth_user AS owner ON owner.id = log.owner_id
         WHERE log.owner_id = ${user.id} AND owner.is_active = 1
         ORDER BY log.created_at DESC, log.id DESC
         LIMIT ${PAGE_SIZE} OFFSET ${(page - 1) * PAGE_SIZE}
      `;
      let entryCounts = new Map<number, number>();
      if (logs.length > 0) {
        const counts = await db.$queryRaw<Array<{ logId: number; total: number | bigint }>>`
          SELECT entry.log_id AS logId, COUNT(*) AS total
            FROM board_worklogentry AS entry
           WHERE entry.log_id IN (${Prisma.join(logs.map((log) => log.id))})
           GROUP BY entry.log_id
        `;
        entryCounts = new Map(counts.map((row) => [row.logId, Number(row.total)]));
      }
      const path = '/work-logs/';
      const content = renderWorkLogIndex({
        logs: logs.map((log) => ({ ...log, createdAt: toIsoDateTime(log.createdAt), entryCount: entryCounts.get(log.id) ?? 0 })),
        canWrite,
        csrfToken: csrfCookieValue(request),
        viewer: { username: user.username, hasEditorRole: canWrite, csrfToken: csrfCookieValue(request) },
        links: pageLinks(path, page, pages),
      });
      return html(reply, content);
    });

    routes.post<{ Body: unknown }>('/work-logs/', { bodyLimit: 8 * 1024 }, async (request, reply) => {
      if (!csrfValid(request, options)) return notAllowed(reply);
      const user = await currentUser(request, reply, options);
      if (!user) return reply;
      if (!await isActiveEditor(db, user.id)) return notAllowed(reply);
      const title = scalar(bodyRecord(request.body).title).trim();
      if (!title || title.length > 100) {
        const logs = await db.$queryRaw<WorkLogRow[]>`
          SELECT log.id, log.title, CAST(log.created_at AS TEXT) AS createdAt
            FROM board_worklog AS log WHERE log.owner_id = ${user.id}
           ORDER BY log.created_at DESC, log.id DESC LIMIT ${PAGE_SIZE}
        `;
        return html(reply, renderWorkLogIndex({
          logs,
          canWrite: true,
          csrfToken: csrfCookieValue(request),
          viewer: { username: user.username, hasEditorRole: true, csrfToken: csrfCookieValue(request) },
          error: 'Enter a work log title up to 100 characters.',
          links: {},
        }));
      }
      const id = await insertWorkLog(db, user.id, title);
      return reply.redirect(`/work-logs/${id}/`, 302);
    });

    routes.get<{ Params: { pk: string } }>('/work-logs/:pk/', async (request, reply) => {
      const user = await currentUser(request, reply, options);
      if (!user) return reply;
      const logId = parseId(request.params.pk);
      if (logId === null) return notFound(reply);
      const log = await readOwnedLog(db, logId, user.id);
      if (!log) return notFound(reply);
      return renderDetailPage(request, reply, db, options, user, log);
    });

    routes.post<{ Params: { pk: string }; Body: unknown }>('/work-logs/:pk/entry/', { bodyLimit: MAX_REQUEST_SIZE }, async (request, reply) => {
      if (!csrfValid(request, options)) return notAllowed(reply);
      const user = await currentUser(request, reply, options);
      if (!user) return reply;
      const logId = parseId(request.params.pk);
      if (logId === null) return notFound(reply);
      const log = await readOwnedLog(db, logId, user.id);
      if (!log) return notFound(reply);
      if (!await isActiveEditor(db, user.id)) return notAllowed(reply);

      const input = await readEntryInput(request);
      const title = scalar(input.fields.title).trim();
      const text = scalar(input.fields.text).trim();
      if (title.length > 100 || text.length > 5000 || (!title && !text && !input.attachment)) {
        return renderDetailPage(request, reply, db, options, user, log, { error: 'Write a note or add an attachment.' });
      }

      let mediaType = '';
      let attachment = '';
      if (input.attachment) {
        if (!options.mediaRoot) return renderDetailPage(request, reply, db, options, user, log, { error: 'Attachments are unavailable.' });
        try {
          const kind = await validateAttachment(input.attachment);
          mediaType = kind.mediaType;
          attachment = await saveAttachment(input.attachment, kind.extension, options.mediaRoot);
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Choose a valid attachment.';
          return renderDetailPage(request, reply, db, options, user, log, { error: message });
        }
      }

      try {
        await insertEntry(db, logId, title, text, mediaType, attachment);
      } catch (error) {
        await removeAttachment(options.mediaRoot, attachment);
        throw error;
      }
      return reply.redirect(`/work-logs/${logId}/`, 302);
    });

    routes.post<{ Params: { pk: string }; Body: unknown }>('/work-logs/:pk/share/', { bodyLimit: 64 * 1024 }, async (request, reply) => {
      if (!csrfValid(request, options)) return notAllowed(reply);
      const user = await currentUser(request, reply, options);
      if (!user) return reply;
      const logId = parseId(request.params.pk);
      if (logId === null) return notFound(reply);
      const log = await readOwnedLog(db, logId, user.id);
      if (!log) return notFound(reply);
      if (!await isActiveEditor(db, user.id)) return notAllowed(reply);

      const fields = bodyRecord(request.body);
      const action = scalar(fields.action) || 'preview';
      const browsing = 'selection_page' in fields || action === 'edit';
      const selection = selectedEntryIds(fields, browsing);
      const headline = scalar(fields.headline).trim();
      if (!selection.error && headline.length > 120) selection.error = 'The headline must be 120 characters or fewer.';
      if (!browsing && !headline) selection.error = 'Enter a headline for the share link.';
      const selected = selection.error ? [] : await selectedEntries(db, logId, selection.ids);
      if (!selection.error && selected.length !== selection.ids.length) selection.error = 'Choose entries from this work log.';

      if (browsing || selection.error) {
        return renderDetailPage(request, reply, db, options, user, log, {
          timelinePage: scalar(fields.timeline_page),
          selectionPage: scalar(fields.selection_page) || scalar(fields.current_selection_page),
          linksPage: scalar(fields.links_page),
          selectedIds: selected.map((entry) => entry.id),
          error: selection.error,
        });
      }

      if (action === 'preview') {
        const page = displayPage(scalar(fields.preview_page), selected.length);
        const start = (page - 1) * PAGE_SIZE;
        const entries = selected.slice(start, start + PAGE_SIZE);
        return html(reply, renderWorkLogShared({
          log: { ...log, createdAt: toIsoDateTime(log.createdAt) },
          ownerUsername: user.username,
          headline,
          entries: entries.map((entry) => ({ ...entry, createdAt: toIsoDateTime(entry.createdAt) })),
          cover: [...selected].reverse().find((entry) => entry.attachment) ?? null,
          imageUrl: null,
          shareUrl: '',
          timelineLinks: pageLinks(`/work-logs/${logId}/share/`, page, Math.max(1, Math.ceil(selected.length / PAGE_SIZE))),
          newLink: false,
          preview: true,
          selectedIds: selected.map((entry) => entry.id),
          csrfToken: csrfCookieValue(request),
          timelinePage: Number(scalar(fields.timeline_page)) || 1,
          selectionPage: Number(scalar(fields.current_selection_page)) || 1,
          linksPage: Number(scalar(fields.links_page)) || 1,
          mediaUrl: (entry) => `/work-logs/${logId}/media/${entry.id}/`,
        }));
      }

      if (action !== 'publish') return renderDetailPage(request, reply, db, options, user, log, { error: 'Choose Preview or Create share link.' });
      const token = await createShare(db, logId, headline, selected);
      return reply.redirect(`${sharePath(token)}?new=1`, 302);
    });

    routes.post<{ Params: { pk: string; token: string } }>('/work-logs/:pk/share/:token/revoke/', { bodyLimit: 8 * 1024 }, async (request, reply) => {
      if (!csrfValid(request, options)) return notAllowed(reply);
      const user = await currentUser(request, reply, options);
      if (!user) return reply;
      const logId = parseId(request.params.pk);
      if (logId === null || !isValidShareToken(request.params.token)) return notFound(reply);
      const log = await readOwnedLog(db, logId, user.id);
      if (!log) return notFound(reply);
      const deleted = await db.$executeRaw`
        DELETE FROM board_worklogshare WHERE log_id = ${logId} AND token = ${request.params.token.toLowerCase()}
      `;
      if (deleted !== 1) return notFound(reply);
      return reply.redirect(`/work-logs/${logId}/`, 302);
    });

    routes.get<{ Params: { pk: string } }>('/work-logs/:pk/delete/', async (request, reply) => {
      const user = await currentUser(request, reply, options);
      if (!user) return reply;
      const logId = parseId(request.params.pk);
      if (logId === null) return notFound(reply);
      const log = await readOwnedLog(db, logId, user.id);
      if (!log) return notFound(reply);
      return html(reply, renderWorkLogDelete({ log: { ...log, createdAt: toIsoDateTime(log.createdAt) }, csrfToken: csrfCookieValue(request) }));
    });

    routes.post<{ Params: { pk: string } }>('/work-logs/:pk/delete/', { bodyLimit: 8 * 1024 }, async (request, reply) => {
      if (!csrfValid(request, options)) return notAllowed(reply);
      const user = await currentUser(request, reply, options);
      if (!user) return reply;
      const logId = parseId(request.params.pk);
      if (logId === null) return notFound(reply);
      const log = await readOwnedLog(db, logId, user.id);
      if (!log) return notFound(reply);
      const attachments = await deleteWorkLog(db, logId, user.id);
      await Promise.all(attachments.map((attachment) => removeAttachment(options.mediaRoot, attachment)));
      return reply.redirect('/work-logs/', 302);
    });

    routes.get<{ Params: { pk: string; entry_id: string } }>('/work-logs/:pk/entry/:entry_id/delete/', async (request, reply) => {
      const user = await currentUser(request, reply, options);
      if (!user) return reply;
      const logId = parseId(request.params.pk);
      const entryId = parseId(request.params.entry_id);
      if (logId === null || entryId === null) return notFound(reply);
      const log = await readOwnedLog(db, logId, user.id);
      if (!log) return notFound(reply);
      const [entry] = await db.$queryRaw<EntryRow[]>`
        SELECT id, log_id AS logId, title, text, media_type AS mediaType, attachment,
               CAST(created_at AS TEXT) AS createdAt
          FROM board_worklogentry WHERE log_id = ${logId} AND id = ${entryId}
        LIMIT 1
      `;
      if (!entry) return notFound(reply);
      return html(reply, renderWorkLogDelete({
        log: { ...log, createdAt: toIsoDateTime(log.createdAt) },
        entry: { ...entry, createdAt: toIsoDateTime(entry.createdAt) },
        csrfToken: csrfCookieValue(request),
      }));
    });

    routes.post<{ Params: { pk: string; entry_id: string } }>('/work-logs/:pk/entry/:entry_id/delete/', { bodyLimit: 8 * 1024 }, async (request, reply) => {
      if (!csrfValid(request, options)) return notAllowed(reply);
      const user = await currentUser(request, reply, options);
      if (!user) return reply;
      const logId = parseId(request.params.pk);
      const entryId = parseId(request.params.entry_id);
      if (logId === null || entryId === null) return notFound(reply);
      const log = await readOwnedLog(db, logId, user.id);
      if (!log) return notFound(reply);
      const attachment = await deleteEntry(db, logId, entryId);
      if (attachment === null) return notFound(reply);
      await removeAttachment(options.mediaRoot, attachment);
      return reply.redirect(`/work-logs/${logId}/`, 302);
    });

    routes.get<{ Params: { pk: string; entry_id: string } }>('/work-logs/:pk/media/:entry_id/', async (request, reply) => {
      const user = await currentUser(request, reply, options);
      if (!user) return reply;
      const logId = parseId(request.params.pk);
      const entryId = parseId(request.params.entry_id);
      if (logId === null || entryId === null) return notFound(reply);
      if (!await readOwnedLog(db, logId, user.id)) return notFound(reply);
      const [entry] = await db.$queryRaw<EntryRow[]>`
        SELECT id, log_id AS logId, title, text, media_type AS mediaType, attachment,
               CAST(created_at AS TEXT) AS createdAt
          FROM board_worklogentry
         WHERE log_id = ${logId} AND id = ${entryId} AND attachment <> ''
         LIMIT 1
      `;
      if (!entry) return notFound(reply);
      return mediaResponse(request, reply, options.mediaRoot, entry);
    });

    routes.get<{ Params: { token: string } }>('/work-logs/share/:token/', async (request, reply) => {
      if (!isValidShareToken(request.params.token)) return notFound(reply);
      const share = await readShare(db, request.params.token.toLowerCase());
      if (!share) return notFound(reply);
      const total = await entryCountForShare(db, share.id);
      if (total === 0) return notFound(reply);
      const query = request.query as Record<string, string | string[] | undefined>;
      const page = displayPage(typeof query.page === 'string' ? query.page : undefined, total);
      const [entries, [cover], [image]] = await Promise.all([
        readSnapshotEntries(db, share.id, page),
        db.$queryRaw<EntryRow[]>`
          SELECT entry.id, entry.log_id AS logId, entry.title, entry.text,
                 entry.media_type AS mediaType, entry.attachment,
                 CAST(entry.created_at AS TEXT) AS createdAt
            FROM board_worklogshare_entries AS selection
            JOIN board_worklogentry AS entry ON entry.id = selection.worklogentry_id
           WHERE selection.worklogshare_id = ${share.id} AND entry.attachment <> ''
           ORDER BY entry.created_at DESC, entry.id DESC LIMIT 1
        `,
        db.$queryRaw<EntryRow[]>`
          SELECT entry.id, entry.log_id AS logId, entry.title, entry.text,
                 entry.media_type AS mediaType, entry.attachment,
                 CAST(entry.created_at AS TEXT) AS createdAt
            FROM board_worklogshare_entries AS selection
            JOIN board_worklogentry AS entry ON entry.id = selection.worklogentry_id
           WHERE selection.worklogshare_id = ${share.id} AND entry.media_type LIKE 'image/%'
             AND entry.attachment <> ''
           ORDER BY entry.created_at DESC, entry.id DESC LIMIT 1
        `,
      ]);
      const path = sharePath(share.token);
      const shareUrl = new URL(path, options.siteUrl).href;
      const imageUrl = image ? new URL(`/work-logs/share/${share.token}/media/${image.id}/`, options.siteUrl).href : null;
      const user = await options.currentUser(request);
      return html(reply, renderWorkLogShared({
        log: { id: share.logId, title: share.logTitle, createdAt: toIsoDateTime(share.logCreatedAt) },
        ownerUsername: share.ownerUsername,
        headline: share.headline,
        entries: entries.map((entry) => ({ ...entry, createdAt: toIsoDateTime(entry.createdAt) })),
        cover: cover ? { ...cover, createdAt: toIsoDateTime(cover.createdAt) } : null,
        imageUrl,
        shareUrl,
        timelineLinks: pageLinks(path, page, Math.max(1, Math.ceil(total / PAGE_SIZE))),
        newLink: query.new === '1' && user?.id === share.ownerId,
        csrfToken: '',
        mediaUrl: (entry) => `/work-logs/share/${share.token}/media/${entry.id}/`,
      }));
    });

    routes.get<{ Params: { token: string; entry_id: string } }>('/work-logs/share/:token/media/:entry_id/', async (request, reply) => {
      if (!isValidShareToken(request.params.token)) return notFound(reply);
      const share = await readShare(db, request.params.token.toLowerCase());
      const entryId = parseId(request.params.entry_id);
      if (!share || entryId === null) return notFound(reply);
      const entry = await pageEntryForShareMedia(db, share.id, share.logId, entryId);
      if (!entry) return notFound(reply);
      return mediaResponse(request, reply, options.mediaRoot, entry);
    });
  });
}
