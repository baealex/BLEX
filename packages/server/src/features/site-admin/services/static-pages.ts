import { Prisma, type PrismaClient } from '@prisma/client';
import type { AdminStaticPage } from '../types.js';
import { type ApiResult, type Body, isDatabaseInteger, isoDate, orderValue, stringValue } from '../shared.js';

const staticPageSelect = {
  id: true,
  title: true,
  slug: true,
  content: true,
  description: true,
  isPublished: true,
  showInFooter: true,
  order: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.StaticPageSelect;

type StaticPageRow = Prisma.StaticPageGetPayload<{ select: typeof staticPageSelect }>;

export function safeNavigationUrl(value: unknown): string {
  if (typeof value !== 'string') return '';
  const normalized = value.trim();
  if (!normalized || /[\\\u0000-\u001f\u007f]/.test(normalized) || normalized.startsWith('//')) return '';
  const scheme = normalized.match(/^([A-Za-z][A-Za-z0-9+.-]*):/)?.[1]?.toLowerCase() ?? '';
  if (!scheme) {
    try {
      const parsed = new URL(normalized, 'https://blex.invalid');
      return parsed.origin === 'https://blex.invalid' ? normalized : '';
    } catch {
      return '';
    }
  }
  if (scheme === 'mailto') {
    try {
      const parsed = new URL(normalized);
      return parsed.pathname ? normalized : '';
    } catch {
      return '';
    }
  }
  if (scheme !== 'http' && scheme !== 'https') return '';
  try {
    const parsed = new URL(normalized);
    return parsed.hostname && normalized.includes('://') ? normalized : '';
  } catch {
    return '';
  }
}

function serializeStaticPage(row: StaticPageRow): AdminStaticPage {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    content: row.content,
    metaDescription: row.description,
    isPublished: row.isPublished,
    showInFooter: row.showInFooter,
    order: row.order,
    createdDate: isoDate(row.createdAt),
    updatedDate: isoDate(row.updatedAt),
  };
}

export async function readStaticPages(db: PrismaClient): Promise<AdminStaticPage[]> {
  const rows = await db.staticPage.findMany({
    orderBy: [{ order: 'asc' }, { createdAt: 'desc' }],
    select: staticPageSelect,
  });
  return rows.map(serializeStaticPage);
}

export async function readStaticPage(db: PrismaClient, id: number): Promise<AdminStaticPage | null> {
  const row = await db.staticPage.findUnique({ where: { id }, select: staticPageSelect });
  return row ? serializeStaticPage(row) : null;
}

export function staticPagePayload(body: Body): Body {
  const payload: Body = {};
  for (const field of ['title', 'slug', 'content', 'metaDescription'] as const) {
    if (field in body) payload[field] = stringValue(body[field]);
  }
  for (const field of ['isPublished', 'showInFooter'] as const) {
    if (field in body) payload[field] = body[field] === true;
  }
  if ('order' in body) payload.order = orderValue(body.order);
  return payload;
}

export async function saveStaticPage(
  db: PrismaClient,
  actorId: number,
  payload: Body,
  id?: number,
): Promise<ApiResult<AdminStaticPage>> {
  if (!id && (!stringValue(payload.title) || !stringValue(payload.slug))) {
    return { ok: false, code: 'VA', message: !stringValue(payload.title) ? 'Enter a title.' : 'Enter a URL slug.' };
  }
  const order = isDatabaseInteger(payload.order) ? payload.order : 0;
  try {
    if (id === undefined) {
      const created = await db.staticPage.create({
        data: {
          title: stringValue(payload.title),
          slug: stringValue(payload.slug),
          content: stringValue(payload.content),
          description: stringValue(payload.metaDescription),
          isPublished: payload.isPublished !== false,
          showInFooter: payload.showInFooter === true,
          order,
          authorId: actorId,
        },
        select: staticPageSelect,
      });
      return { ok: true, body: serializeStaticPage(created) };
    }
    // Prisma skips an update with no fields and reports zero rows, so the timestamp is always set.
    const data: Prisma.StaticPageUpdateManyMutationInput = { updatedAt: new Date() };
    if ('title' in payload) data.title = stringValue(payload.title);
    if ('slug' in payload) data.slug = stringValue(payload.slug);
    if ('content' in payload) data.content = stringValue(payload.content);
    if ('metaDescription' in payload) data.description = stringValue(payload.metaDescription);
    if ('isPublished' in payload) data.isPublished = payload.isPublished === true;
    if ('showInFooter' in payload) data.showInFooter = payload.showInFooter === true;
    if ('order' in payload) data.order = order;
    await db.staticPage.updateMany({ where: { id }, data });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return { ok: false, code: 'AE', message: 'This slug is already in use.' };
    }
    throw error;
  }
  const page = await readStaticPage(db, id);
  return page ? { ok: true, body: page } : { ok: false, code: 'NF', message: 'Static page not found.' };
}
