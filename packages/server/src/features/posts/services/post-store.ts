import { randomBytes } from 'node:crypto';
import { Prisma, type PrismaClient } from '@prisma/client';
import { syncPostPublication } from '../../notifications/model.js';
import { descriptionFromHtml, normalizedTags, plainText, readingTime, resolveContent, resolveCoverImage, slugify, validatePostInput } from './post-content.js';
import { AuthoringPostInput, DbDate, POST_URL_MAX, RESERVED_URLS, StoredPost, UserRow, dateAsIso, field, isTrue, nowString, numberValue } from '../shared.js';

export async function loadPost(
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
               post.series_id AS seriesId, series.name AS seriesName, series.slug AS seriesUrl,
               CAST(series.isHidden AS INTEGER) AS seriesHidden,
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
        LEFT JOIN "Series" AS series ON series.id = post.series_id
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
               post.series_id AS seriesId, series.name AS seriesName, series.slug AS seriesUrl,
               CAST(series.isHidden AS INTEGER) AS seriesHidden,
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
        LEFT JOIN "Series" AS series ON series.id = post.series_id
        WHERE post.url = ${where.slug} AND author.username = ${where.username ?? ''}
          AND post.deleted_date IS NULL
        LIMIT 1
      `;
  return rows[0] ?? null;
}

export async function postTags(db: PrismaClient, postId: number): Promise<string[]> {
  const rows = await db.$queryRaw<Array<{ value: string }>>`
    SELECT tag.value AS value
    FROM board_tag AS tag
    JOIN board_post_tags AS link ON link.tag_id = tag.id
    WHERE link.post_id = ${postId}
    ORDER BY tag.value
  `;
  return rows.map((row) => row.value);
}

export async function draftReservation(db: PrismaClient, postId: number): Promise<string> {
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
  const series = await db.series.findFirst({ where: { ownerId: userId, slug: url }, select: { id: true } });
  return series?.id ?? null;
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
  updatedDate: DbDate;
  publishedDate: DbDate;
}

type EditorialSnapshotRow = Omit<EditorialSnapshot, 'tags'>;

export async function captureEditorialSnapshot(tx: Prisma.TransactionClient, postId: number): Promise<EditorialSnapshot> {
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

export async function updatePost(
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

export async function trashPost(
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

export function postPublic(post: StoredPost): boolean {
  const published = dateAsIso(post.publishedDate);
  return post.deletedDate === null && published !== null && new Date(published).valueOf() <= Date.now() && !isTrue(post.hide);
}

export async function updatePostSettings(
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
    const series = seriesId === null ? null : await db.series.findUnique({ where: { id: seriesId }, select: { slug: true } });
    return { series: series?.slug ?? null };
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
