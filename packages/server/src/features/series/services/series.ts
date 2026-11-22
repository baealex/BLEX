import { Prisma, type PrismaClient } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { sanitizePostHtml } from '../../posts/post-html.js';
import { type SeriesListItem, type SeriesPostOption } from '../pages.js';
import { arrayValues, localDate, stringValue } from '../shared.js';

interface StoredSeries extends SeriesListItem {
  description: string;
  createdDate: string | null;
}

const MAX_SERIES_DESCRIPTION = 500;

export const SERIES_PUBLIC_FILTER = `post.deleted_date IS NULL
  AND post.published_date IS NOT NULL
  AND datetime(post.published_date) <= CURRENT_TIMESTAMP
  AND COALESCE(post_config.hide, 0) = 0`;

function normalizeSlug(value: string): string {
  return value.normalize('NFKC').toLowerCase()
    .replace(/[^\p{L}\p{N}_\s-]/gu, '')
    .trim().replace(/[\s-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
}

function validSlug(value: string): boolean {
  return value.length <= 50 && /^[\p{L}\p{N}_-]+$/u.test(value);
}

export function parsePostIds(value: unknown): number[] | null {
  if (value === undefined || value === null) return [];
  const values = typeof value === 'string' ? value.split(',').filter(Boolean) : arrayValues(value);
  const parsed: number[] = [];
  for (const item of values) {
    const raw = stringValue(item);
    if (!/^\d+$/.test(raw)) return null;
    const id = Number(raw);
    if (!Number.isSafeInteger(id)) return null;
    if (id > 0 && !parsed.includes(id)) parsed.push(id);
  }
  return parsed;
}

export async function readSeriesRows(db: PrismaClient, ownerId: number, countKind: 'public' | 'active') {
  const countFilter = countKind === 'public'
    ? `post.id IS NOT NULL AND ${SERIES_PUBLIC_FILTER}`
    : 'post.id IS NOT NULL AND post.deleted_date IS NULL';
  return db.$queryRawUnsafe<Array<{
    id: number; url: string; name: string; order: number | bigint; totalPosts: number | bigint;
    description: string; createdDate: string | null;
  }>>(`
    SELECT series.id AS id, series.url AS url, series.name AS name,
           series."order" AS "order", series.text_md AS description,
           CAST(series.created_date AS TEXT) AS createdDate,
           COUNT(CASE WHEN ${countFilter} THEN post.id END) AS totalPosts
      FROM board_series AS series
      LEFT JOIN board_post AS post ON post.series_id = series.id
      LEFT JOIN board_postconfig AS post_config ON post_config.post_id = post.id
     WHERE series.owner_id = ?
     GROUP BY series.id
     ORDER BY series."order" ASC, series.id DESC
  `, ownerId);
}

export function seriesListItem(row: Awaited<ReturnType<typeof readSeriesRows>>[number]): SeriesListItem {
  return {
    id: Number(row.id), url: row.url, name: row.name, order: Number(row.order), totalPosts: Number(row.totalPosts),
  };
}

export async function readSeriesById(db: PrismaClient, ownerId: number, id: number): Promise<StoredSeries | null> {
  const rows = await db.$queryRaw<Array<{
    id: number; url: string; name: string; order: number | bigint; description: string;
    createdDate: string | null; totalPosts: number | bigint;
  }>>`
    SELECT series.id AS id, series.url AS url, series.name AS name, series."order" AS "order",
           series.text_md AS description, CAST(series.created_date AS TEXT) AS createdDate,
           COUNT(CASE WHEN post.deleted_date IS NULL THEN post.id END) AS totalPosts
      FROM board_series AS series
      LEFT JOIN board_post AS post ON post.series_id = series.id
     WHERE series.id = ${id} AND series.owner_id = ${ownerId}
     GROUP BY series.id
     LIMIT 1
  `;
  const row = rows[0];
  if (!row) return null;
  return {
    id: Number(row.id), url: row.url, name: row.name, order: Number(row.order),
    totalPosts: Number(row.totalPosts), description: row.description ?? '', createdDate: row.createdDate,
  };
}

export async function readSeriesPostIds(db: PrismaClient, ownerId: number, seriesId: number): Promise<number[]> {
  const rows = await db.$queryRaw<Array<{ id: number | bigint }>>`
    SELECT id FROM board_post WHERE author_id = ${ownerId} AND series_id = ${seriesId}
      ORDER BY id ASC
  `;
  return rows.map((row) => Number(row.id));
}

export async function readAvailableSeriesPosts(db: PrismaClient, ownerId: number, seriesId?: number): Promise<SeriesPostOption[]> {
  const filter = seriesId === undefined
    ? `post.series_id IS NULL AND ${SERIES_PUBLIC_FILTER}`
    : `(post.series_id = ? OR (post.series_id IS NULL AND ${SERIES_PUBLIC_FILTER}))`;
  const activeFilter = seriesId === undefined ? 'AND post.deleted_date IS NULL' : '';
  const params = seriesId === undefined ? [ownerId] : [ownerId, seriesId];
  const rows = await db.$queryRawUnsafe<Array<{ id: number; title: string; publishedDate: string | null }>>(`
    SELECT post.id AS id, post.title AS title, CAST(post.published_date AS TEXT) AS publishedDate
      FROM board_post AS post
      LEFT JOIN board_postconfig AS post_config ON post_config.post_id = post.id
     WHERE post.author_id = ? ${activeFilter} AND ${filter}
     ORDER BY post.published_date DESC, post.id DESC
  `, ...params);
  return rows.map((row) => ({ id: Number(row.id), title: row.title, publishedDate: localDate(row.publishedDate) || null }));
}

async function createUniqueSeriesUrl(db: Prisma.TransactionClient, base: string): Promise<string> {
  let candidate = base || 'series';
  for (let attempts = 0; attempts < 5; attempts += 1) {
    const [collision] = await db.$queryRaw<Array<{ id: number }>>`
      SELECT id FROM board_series WHERE url = ${candidate} LIMIT 1
    `;
    if (!collision) return candidate;
    const suffix = randomBytes(4).toString('hex');
    candidate = `${base.slice(0, 41)}-${suffix}`;
  }
  throw { code: 'AE', message: 'This URL already exists.' };
}

export async function saveSeries(
  db: PrismaClient,
  ownerId: number,
  input: { name?: string; url?: string; description?: string; postIds?: number[] },
  seriesId?: number,
): Promise<{ id: number; url: string; name: string; description: string; postCount: number }> {
  const name = input.name?.trim() ?? '';
  const description = input.description?.trim();
  if (input.name !== undefined && (!name || name.length > 50)) throw { code: 'RE', message: 'Enter a series name.' };
  if (description !== undefined && description.length > MAX_SERIES_DESCRIPTION) throw { code: 'VA', message: 'Series description must be 500 characters or fewer.' };
  let requestedUrl = input.url;
  const customUrl = requestedUrl !== undefined && Boolean(requestedUrl.trim());
  if (seriesId === undefined) {
    if (!customUrl) requestedUrl = normalizeSlug(name);
    else requestedUrl = (requestedUrl ?? '').trim();
    if (!requestedUrl || !validSlug(requestedUrl)) throw { code: 'VA', message: 'Enter a valid series URL.' };
  } else if (requestedUrl !== undefined) {
    requestedUrl = requestedUrl.trim();
    if (!requestedUrl || !validSlug(requestedUrl)) throw { code: 'VA', message: 'Enter a valid series URL.' };
  }

  return db.$transaction(async (tx: Prisma.TransactionClient) => {
    let id = seriesId;
    let url: string;
    let finalName = name;
    let finalDescription = (description ?? '').trim();
    if (id === undefined) {
      url = await createUniqueSeriesUrl(tx, requestedUrl!);
      const safeDescription = sanitizePostHtml(finalDescription);
      const inserted = await tx.$queryRaw<Array<{ id: number }>>`
        INSERT INTO board_series
          ("order", text_md, text_html, hide, url, layout, created_date, updated_date, owner_id, name)
        VALUES (0, ${finalDescription}, ${safeDescription}, 0, ${url}, 'list', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, ${ownerId}, ${finalName})
        RETURNING id
      `;
      id = Number(inserted[0]?.id);
      if (!id) throw new Error('series-create-failed');
    } else {
      const existingRows = await tx.$queryRaw<Array<{ id: number; url: string; name: string; description: string }>>`
        SELECT id, url, name, text_md AS description FROM board_series WHERE id = ${id} AND owner_id = ${ownerId} LIMIT 1
      `;
      const existing = existingRows[0];
      if (!existing) throw { code: 'NF', message: 'Series not found.' };
      url = requestedUrl ?? existing.url;
      if (requestedUrl !== undefined) {
        const [conflict] = await tx.$queryRaw<Array<{ id: number }>>`
          SELECT id FROM board_series WHERE url = ${url} AND id <> ${id} LIMIT 1
        `;
        if (conflict) throw { code: 'AE', message: 'This URL already exists.' };
      }
      finalName = input.name === undefined ? existing.name : name;
      finalDescription = description === undefined ? existing.description : description.trim();
      const safeDescription = sanitizePostHtml(finalDescription);
      await tx.$executeRaw`
        UPDATE board_series SET name = ${finalName}, url = ${url}, text_md = ${finalDescription},
          text_html = ${safeDescription}, updated_date = CURRENT_TIMESTAMP
        WHERE id = ${id} AND owner_id = ${ownerId}
      `;
    }

    if (input.postIds !== undefined) {
      await tx.$executeRaw`UPDATE board_post SET series_id = NULL WHERE series_id = ${id}`;
      for (const postId of input.postIds) {
        await tx.$executeRaw`
          UPDATE board_post SET series_id = ${id}
           WHERE id = ${postId} AND author_id = ${ownerId}
        `;
      }
    }

    const [saved] = await tx.$queryRaw<Array<{ id: number; url: string; name: string; description: string; postCount: number | bigint }>>`
      SELECT series.id AS id, series.url AS url, series.name AS name, series.text_md AS description,
             COUNT(CASE WHEN post.deleted_date IS NULL THEN post.id END) AS postCount
        FROM board_series AS series LEFT JOIN board_post AS post ON post.series_id = series.id
       WHERE series.id = ${id} AND series.owner_id = ${ownerId}
       GROUP BY series.id LIMIT 1
    `;
    return { id: Number(saved.id), url: saved.url, name: saved.name, description: saved.description ?? '', postCount: Number(saved.postCount) };
  });
}

export async function deleteSeries(db: PrismaClient, ownerId: number, seriesId: number): Promise<boolean> {
  return db.$transaction(async (tx: Prisma.TransactionClient) => {
    const [row] = await tx.$queryRaw<Array<{ id: number }>>`
      SELECT id FROM board_series WHERE id = ${seriesId} AND owner_id = ${ownerId} LIMIT 1
    `;
    if (!row) return false;
    await tx.$executeRaw`UPDATE board_post SET series_id = NULL WHERE series_id = ${seriesId}`;
    await tx.$executeRaw`DELETE FROM board_seriesconfigmeta WHERE post_id = ${seriesId}`;
    await tx.$executeRaw`DELETE FROM board_series WHERE id = ${seriesId} AND owner_id = ${ownerId}`;
    return true;
  });
}

export async function updateSeriesOrder(db: PrismaClient, ownerId: number, entries: Array<[number, number]>): Promise<void> {
  if (!entries.length) throw { code: 'IP', message: 'Order information is required.' };
  await db.$transaction(async (tx: Prisma.TransactionClient) => {
    for (const [id, order] of entries) {
      if (!Number.isSafeInteger(id) || !Number.isSafeInteger(order)) continue;
      await tx.$executeRaw`UPDATE board_series SET "order" = ${order}, updated_date = CURRENT_TIMESTAMP WHERE id = ${id} AND owner_id = ${ownerId}`;
    }
  });
}
