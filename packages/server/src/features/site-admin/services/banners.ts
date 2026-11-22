import { type PrismaClient } from '@prisma/client';
import { sanitizeBannerHtml } from '../../posts/post-html.js';
import { type AdminBanner } from '../types.js';
import { ApiResult, Body, booleanValue, djangoTimestamp, isoDate, stringValue } from '../shared.js';

interface BannerRow {
  id: number;
  title: string;
  contentHtml: string;
  bannerType: string;
  position: string;
  isActive: number | bigint | boolean;
  order: number;
  createdDate: string | null;
  updatedDate: string | null;
  createdBy: string | null;
}

function serializeBanner(row: BannerRow, scope: 'global' | 'user'): AdminBanner {
  return {
    id: row.id,
    title: row.title,
    contentHtml: scope === 'global' ? row.contentHtml : sanitizeBannerHtml(row.contentHtml),
    bannerType: row.bannerType,
    position: row.position,
    isActive: booleanValue(row.isActive),
    order: Number(row.order),
    createdDate: isoDate(row.createdDate),
    updatedDate: isoDate(row.updatedDate),
    createdBy: row.createdBy,
  };
}

export async function readBanners(
  db: PrismaClient,
  scope: 'global' | 'user' = 'global',
  ownerId: number | null = null,
): Promise<AdminBanner[]> {
  const rows = await db.$queryRaw<BannerRow[]>`
    SELECT banner.id, banner.title, banner.content_html AS contentHtml,
           banner.banner_type AS bannerType, banner.position, banner.is_active AS isActive,
           banner."order", CAST(banner.created_date AS TEXT) AS createdDate,
           CAST(banner.updated_date AS TEXT) AS updatedDate, owner.username AS createdBy
      FROM board_sitebanner AS banner LEFT JOIN auth_user AS owner ON owner.id = banner.user_id
     WHERE banner.scope = ${scope} AND (${scope} = 'global' OR banner.user_id = ${ownerId ?? 0})
     ORDER BY banner."order" ASC, banner.created_date DESC
  `;
  return rows.map((row) => serializeBanner(row, scope));
}

export async function readBanner(
  db: PrismaClient,
  id: number,
  scope: 'global' | 'user' = 'global',
  ownerId: number | null = null,
): Promise<AdminBanner | null> {
  const [row] = await db.$queryRaw<BannerRow[]>`
    SELECT banner.id, banner.title, banner.content_html AS contentHtml,
           banner.banner_type AS bannerType, banner.position, banner.is_active AS isActive,
           banner."order", CAST(banner.created_date AS TEXT) AS createdDate,
           CAST(banner.updated_date AS TEXT) AS updatedDate, owner.username AS createdBy
      FROM board_sitebanner AS banner LEFT JOIN auth_user AS owner ON owner.id = banner.user_id
     WHERE banner.scope = ${scope} AND (${scope} = 'global' OR banner.user_id = ${ownerId ?? 0})
       AND banner.id = ${id} LIMIT 1
  `;
  return row ? serializeBanner(row, scope) : null;
}

export function bannerApi(banner: AdminBanner, includeCreatedBy = true): Record<string, unknown> {
  return {
    id: banner.id,
    title: banner.title,
    content_html: banner.contentHtml,
    banner_type: banner.bannerType,
    position: banner.position,
    is_active: banner.isActive,
    order: banner.order,
    created_date: banner.createdDate,
    updated_date: banner.updatedDate,
    ...(includeCreatedBy ? { created_by: banner.createdBy } : {}),
  };
}

export function bannerPayload(body: Body): Body {
  const result: Body = {};
  for (const field of ['title', 'content_html', 'banner_type', 'position'] as const) {
    if (field in body) result[field] = stringValue(body[field]);
  }
  if ('is_active' in body) result.is_active = body.is_active === true;
  if ('order' in body) {
    const raw = body.order;
    const order = typeof raw === 'number' ? raw : /^-?\d+$/.test(String(raw)) ? Number(raw) : NaN;
    result.order = Number.isSafeInteger(order) ? order : 0;
  }
  return result;
}

function validateBannerPosition(bannerType: string, position: string): string | null {
  if (bannerType === 'horizontal' && position !== 'top' && position !== 'bottom') {
    return 'Horizontal banners can only be placed at the top or bottom.';
  }
  if (bannerType === 'sidebar' && position !== 'left' && position !== 'right') {
    return 'Sidebar banners can only be placed on the left or right.';
  }
  return null;
}

export async function saveBanner(
  db: PrismaClient,
  userId: number,
  input: Body,
  id?: number,
  scope: 'global' | 'user' = 'global',
): Promise<ApiResult<AdminBanner>> {
  const current = id === undefined ? null : await readBanner(db, id, scope, scope === 'user' ? userId : null);
  if (id !== undefined && !current) return { ok: false, code: 'NF', message: 'Banner not found.' };
  const title = 'title' in input ? stringValue(input.title) : current?.title ?? '';
  const contentHtml = 'content_html' in input ? (scope === 'global' ? stringValue(input.content_html) : sanitizeBannerHtml(stringValue(input.content_html))) : current?.contentHtml ?? '';
  const bannerType = 'banner_type' in input ? stringValue(input.banner_type) : current?.bannerType ?? 'horizontal';
  const position = 'position' in input ? stringValue(input.position) : current?.position ?? 'top';
  if (id === undefined && !title) return { ok: false, code: 'VA', message: 'Enter a banner name.' };
  if (id === undefined && !contentHtml) return { ok: false, code: 'VA', message: 'Enter banner HTML.' };
  const positionError = validateBannerPosition(bannerType, position);
  if (positionError) return { ok: false, code: 'VA', message: positionError };
  const active = 'is_active' in input ? input.is_active === true : current?.isActive ?? true;
  const order = Number.isSafeInteger(input.order) ? input.order as number : current?.order ?? 0;
  const timestamp = djangoTimestamp();
  if (id === undefined) {
    const createdId = await db.$transaction(async (transaction) => {
      await transaction.$executeRaw`
        INSERT INTO board_sitebanner (scope, title, is_active, "order", created_date, updated_date, content_html, banner_type, position, user_id)
        VALUES (${scope}, ${title}, ${active ? 1 : 0}, ${order}, ${timestamp}, ${timestamp}, ${contentHtml}, ${bannerType}, ${position}, ${userId})
      `;
      const [created] = await transaction.$queryRaw<Array<{ id: number }>>`SELECT last_insert_rowid() AS id`;
      return Number(created?.id ?? 0);
    });
    const banner = await readBanner(db, createdId, scope, scope === 'user' ? userId : null);
    return banner ? { ok: true, body: banner } : { ok: false, code: 'NF', message: 'Banner not found.' };
  }
  await db.$executeRaw`
    UPDATE board_sitebanner SET title = ${title}, content_html = ${contentHtml}, banner_type = ${bannerType}, position = ${position},
      is_active = ${active ? 1 : 0}, "order" = ${order}, updated_date = ${timestamp}
    WHERE scope = ${scope} AND (${scope} = 'global' OR user_id = ${userId}) AND id = ${id}
  `;
  const banner = await readBanner(db, id, scope, scope === 'user' ? userId : null);
  return banner ? { ok: true, body: banner } : { ok: false, code: 'NF', message: 'Banner not found.' };
}

