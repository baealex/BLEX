import { Prisma, type PrismaClient } from '@prisma/client';
import { type AdminStaticPage } from '../types.js';
import { ApiResult, Body, booleanValue, djangoTimestamp, isoDate, stringValue } from '../shared.js';

interface StaticPageRow {
  id: number;
  title: string;
  slug: string;
  content: string;
  metaDescription: string;
  isPublished: number | bigint | boolean;
  showInFooter: number | bigint | boolean;
  order: number;
  createdDate: string | null;
  updatedDate: string | null;
}

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
    metaDescription: row.metaDescription,
    isPublished: booleanValue(row.isPublished),
    showInFooter: booleanValue(row.showInFooter),
    order: Number(row.order),
    createdDate: isoDate(row.createdDate),
    updatedDate: isoDate(row.updatedDate),
  };
}

export async function readStaticPages(db: PrismaClient): Promise<AdminStaticPage[]> {
  const rows = await db.$queryRaw<StaticPageRow[]>`
    SELECT id, title, slug, content, meta_description AS metaDescription,
           is_published AS isPublished, show_in_footer AS showInFooter, "order",
           CAST(created_date AS TEXT) AS createdDate, CAST(updated_date AS TEXT) AS updatedDate
      FROM board_staticpage ORDER BY "order" ASC, created_date DESC
  `;
  return rows.map(serializeStaticPage);
}

export async function readStaticPage(db: PrismaClient, id: number): Promise<AdminStaticPage | null> {
  const [row] = await db.$queryRaw<StaticPageRow[]>`
    SELECT id, title, slug, content, meta_description AS metaDescription,
           is_published AS isPublished, show_in_footer AS showInFooter, "order",
           CAST(created_date AS TEXT) AS createdDate, CAST(updated_date AS TEXT) AS updatedDate
      FROM board_staticpage WHERE id = ${id} LIMIT 1
  `;
  return row ? serializeStaticPage(row) : null;
}

export function staticPagePayload(body: Body): Body {
  const payload: Body = {};
  for (const field of ['title', 'slug', 'content', 'meta_description'] as const) {
    if (field in body) payload[field] = stringValue(body[field]);
  }
  for (const field of ['is_published', 'show_in_footer'] as const) {
    if (field in body) payload[field] = body[field] === true;
  }
  if ('order' in body) {
    const value = body.order;
    const parsed = typeof value === 'number' ? value : /^-?\d+$/.test(String(value)) ? Number(value) : NaN;
    payload.order = Number.isSafeInteger(parsed) ? parsed : 0;
  }
  return payload;
}

export async function saveStaticPage(
  db: PrismaClient,
  actorId: number,
  input: Body,
  id?: number,
): Promise<ApiResult<AdminStaticPage>> {
  const payload = { ...input };
  if (!id && (!stringValue(payload.title) || !stringValue(payload.slug))) {
    return { ok: false, code: 'VA', message: !stringValue(payload.title) ? 'Enter a title.' : 'Enter a URL slug.' };
  }
  if ('slug' in payload) {
    const slug = stringValue(payload.slug);
    const [duplicate] = await db.$queryRaw<Array<{ id: number }>>`
      SELECT id FROM board_staticpage WHERE slug = ${slug} AND id <> ${id ?? 0} LIMIT 1
    `;
    if (duplicate) return { ok: false, code: 'AE', message: 'This slug is already in use.' };
  }
  if ('content' in payload) payload.content = stringValue(payload.content);
  const timestamp = djangoTimestamp();
  try {
    if (id === undefined) {
      id = await db.$transaction(async (transaction) => {
        await transaction.$executeRaw`
          INSERT INTO board_staticpage (title, slug, content, meta_description, is_published, show_in_footer, "order", created_date, updated_date, author_id)
          VALUES (${stringValue(payload.title)}, ${stringValue(payload.slug)}, ${stringValue(payload.content)},
                  ${stringValue(payload.meta_description)}, ${payload.is_published === false ? 0 : 1},
                  ${payload.show_in_footer === true ? 1 : 0}, ${Number.isSafeInteger(payload.order) ? payload.order as number : 0},
                  ${timestamp}, ${timestamp}, ${actorId})
        `;
        const [created] = await transaction.$queryRaw<Array<{ id: number }>>`SELECT last_insert_rowid() AS id`;
        return Number(created?.id ?? 0);
      });
    } else {
      const updates: Prisma.Sql[] = [Prisma.sql`updated_date = ${timestamp}`];
      if ('title' in payload) updates.push(Prisma.sql`title = ${stringValue(payload.title)}`);
      if ('slug' in payload) updates.push(Prisma.sql`slug = ${stringValue(payload.slug)}`);
      if ('content' in payload) updates.push(Prisma.sql`content = ${stringValue(payload.content)}`);
      if ('meta_description' in payload) updates.push(Prisma.sql`meta_description = ${stringValue(payload.meta_description)}`);
      if ('is_published' in payload) updates.push(Prisma.sql`is_published = ${payload.is_published === true ? 1 : 0}`);
      if ('show_in_footer' in payload) updates.push(Prisma.sql`show_in_footer = ${payload.show_in_footer === true ? 1 : 0}`);
      if ('order' in payload) updates.push(Prisma.sql`"order" = ${Number.isSafeInteger(payload.order) ? payload.order as number : 0}`);
      await db.$executeRaw(Prisma.sql`UPDATE board_staticpage SET ${Prisma.join(updates, ', ')} WHERE id = ${id}`);
    }
  } catch (error) {
    if (String(error).includes('UNIQUE constraint failed: board_staticpage.slug')) {
      return { ok: false, code: 'AE', message: 'This slug is already in use.' };
    }
    throw error;
  }
  const page = await readStaticPage(db, id);
  return page ? { ok: true, body: page } : { ok: false, code: 'NF', message: 'Static page not found.' };
}

export function staticPageApi(page: AdminStaticPage): Record<string, unknown> {
  return {
    id: page.id,
    title: page.title,
    slug: page.slug,
    content: page.content,
    meta_description: page.metaDescription,
    is_published: page.isPublished,
    show_in_footer: page.showInFooter,
    order: page.order,
    created_date: page.createdDate,
    updated_date: page.updatedDate,
  };
}

