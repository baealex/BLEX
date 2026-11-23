import { Prisma, type PrismaClient } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { publicPostWhere } from '../../posts/data/visibility.js';
import { sanitizePostHtml } from '../../posts/post-html.js';
import { storedDateText } from '../../../platform/date-format.js';
import { type SeriesListItem, type SeriesPostOption, arrayValues, localDate, stringValue } from '../shared.js';

interface StoredSeries extends SeriesListItem {
  description: string;
  createdDate: string | null;
}

const MAX_SERIES_DESCRIPTION = 500;
const MAX_DATABASE_INTEGER = 2_147_483_647;

const activePosts = { posts: { where: { deletedAt: null } } } satisfies Prisma.SeriesCountOutputTypeSelect;

/** Series dates have always been written at whole seconds, and public pages show them as stored. */
function currentSecond(): Date {
  return new Date(Math.floor(Date.now() / 1000) * 1000);
}

function normalizeSlug(value: string): string {
  return value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}_\s-]/gu, '')
    .trim()
    .replace(/[\s-]+/g, '-')
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

async function countPublicPosts(db: PrismaClient, seriesIds: number[]): Promise<Map<number, number>> {
  const counts = new Map<number, number>();
  for (let offset = 0; offset < seriesIds.length; offset += 500) {
    const rows = await db.post.groupBy({
      by: ['seriesId'],
      where: { seriesId: { in: seriesIds.slice(offset, offset + 500) }, ...publicPostWhere() },
      _count: { _all: true },
    });
    for (const row of rows) {
      if (row.seriesId !== null) counts.set(row.seriesId, row._count._all);
    }
  }
  return counts;
}

export async function readSeriesRows(db: PrismaClient, ownerId: number, countKind: 'public' | 'active') {
  const rows = await db.series.findMany({
    where: { ownerId },
    orderBy: [{ order: 'asc' }, { id: 'desc' }],
    select: {
      id: true,
      slug: true,
      name: true,
      order: true,
      descriptionMarkdown: true,
      createdAt: true,
      _count: { select: activePosts },
    },
  });
  const publicCounts =
    countKind === 'public'
      ? await countPublicPosts(
          db,
          rows.map(({ id }) => id),
        )
      : null;
  return rows.map((row) => ({
    id: row.id,
    url: row.slug,
    name: row.name,
    order: row.order,
    description: row.descriptionMarkdown,
    createdDate: storedDateText(row.createdAt),
    totalPosts: publicCounts ? (publicCounts.get(row.id) ?? 0) : row._count.posts,
  }));
}

export async function readSeriesById(db: PrismaClient, ownerId: number, id: number): Promise<StoredSeries | null> {
  const row = await db.series.findFirst({
    where: { id, ownerId },
    select: {
      id: true,
      slug: true,
      name: true,
      order: true,
      descriptionMarkdown: true,
      createdAt: true,
      _count: { select: activePosts },
    },
  });
  if (!row) return null;
  return {
    id: row.id,
    url: row.slug,
    name: row.name,
    order: row.order,
    totalPosts: row._count.posts,
    description: row.descriptionMarkdown,
    createdDate: storedDateText(row.createdAt),
  };
}

export async function readSeriesPostIds(db: PrismaClient, ownerId: number, seriesId: number): Promise<number[]> {
  const rows = await db.post.findMany({
    where: { authorId: ownerId, seriesId },
    orderBy: { id: 'asc' },
    select: { id: true },
  });
  return rows.map(({ id }) => id);
}

export async function readAvailableSeriesPosts(
  db: PrismaClient,
  ownerId: number,
  seriesId?: number,
): Promise<SeriesPostOption[]> {
  const unassigned = { seriesId: null, ...publicPostWhere() };
  const rows = await db.post.findMany({
    where: { authorId: ownerId, ...(seriesId === undefined ? unassigned : { OR: [{ seriesId }, unassigned] }) },
    orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }],
    select: { id: true, title: true, publishedAt: true },
  });
  return rows.map((row) => ({ id: row.id, title: row.title, publishedDate: localDate(row.publishedAt) || null }));
}

async function createUniqueSeriesUrl(db: Prisma.TransactionClient, base: string): Promise<string> {
  let candidate = base || 'series';
  for (let attempts = 0; attempts < 5; attempts += 1) {
    const collision = await db.series.findUnique({ where: { slug: candidate }, select: { id: true } });
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
  if (description !== undefined && description.length > MAX_SERIES_DESCRIPTION)
    throw { code: 'VA', message: 'Series description must be 500 characters or fewer.' };
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

  try {
    return await db.$transaction(async (tx: Prisma.TransactionClient) => {
      let id = seriesId;
      let url: string;
      let finalName = name;
      let finalDescription = (description ?? '').trim();
      if (id === undefined) {
        if (!requestedUrl) throw { code: 'VA', message: 'Enter a valid series URL.' };
        url = await createUniqueSeriesUrl(tx, requestedUrl);
        const now = currentSecond();
        const created = await tx.series.create({
          data: {
            ownerId,
            slug: url,
            name: finalName,
            descriptionMarkdown: finalDescription,
            descriptionHtml: sanitizePostHtml(finalDescription),
            layout: 'list',
            createdAt: now,
            updatedAt: now,
          },
          select: { id: true },
        });
        id = created.id;
      } else {
        const existing = await tx.series.findFirst({
          where: { id, ownerId },
          select: { slug: true, name: true, descriptionMarkdown: true },
        });
        if (!existing) throw { code: 'NF', message: 'Series not found.' };
        url = requestedUrl ?? existing.slug;
        if (requestedUrl !== undefined) {
          const conflict = await tx.series.findFirst({ where: { slug: url, id: { not: id } }, select: { id: true } });
          if (conflict) throw { code: 'AE', message: 'This URL already exists.' };
        }
        finalName = input.name === undefined ? existing.name : name;
        finalDescription = description === undefined ? existing.descriptionMarkdown : description.trim();
        await tx.series.updateMany({
          where: { id, ownerId },
          data: {
            name: finalName,
            slug: url,
            descriptionMarkdown: finalDescription,
            descriptionHtml: sanitizePostHtml(finalDescription),
            updatedAt: currentSecond(),
          },
        });
      }

      if (input.postIds !== undefined) {
        await tx.post.updateMany({ where: { seriesId: id }, data: { seriesId: null } });
        for (let offset = 0; offset < input.postIds.length; offset += 500) {
          await tx.post.updateMany({
            where: { id: { in: input.postIds.slice(offset, offset + 500) }, authorId: ownerId },
            data: { seriesId: id },
          });
        }
      }

      const saved = await tx.series.findFirstOrThrow({
        where: { id, ownerId },
        select: { id: true, slug: true, name: true, descriptionMarkdown: true, _count: { select: activePosts } },
      });
      return {
        id: saved.id,
        url: saved.slug,
        name: saved.name,
        description: saved.descriptionMarkdown,
        postCount: saved._count.posts,
      };
    });
  } catch (failure) {
    if (failure instanceof Prisma.PrismaClientKnownRequestError && failure.code === 'P2002') {
      throw { code: 'AE', message: 'This URL already exists.' };
    }
    throw failure;
  }
}

export async function deleteSeries(db: PrismaClient, ownerId: number, seriesId: number): Promise<boolean> {
  // The schema detaches the series' posts without changing their updated date.
  const { count } = await db.series.deleteMany({ where: { id: seriesId, ownerId } });
  return count === 1;
}

export async function updateSeriesOrder(
  db: PrismaClient,
  ownerId: number,
  entries: Array<[number, number]>,
): Promise<void> {
  if (!entries.length) throw { code: 'IP', message: 'Order information is required.' };
  await db.$transaction(async (tx: Prisma.TransactionClient) => {
    for (const [id, order] of entries) {
      // Prisma cannot read an order wider than its 32-bit column back.
      if (!Number.isSafeInteger(id) || !Number.isSafeInteger(order) || Math.abs(order) > MAX_DATABASE_INTEGER) continue;
      await tx.series.updateMany({ where: { id, ownerId }, data: { order, updatedAt: currentSecond() } });
    }
  });
}
