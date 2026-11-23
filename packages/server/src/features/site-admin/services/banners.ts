import type { BannerPosition, BannerType, Prisma, PrismaClient } from '@prisma/client';
import { sanitizeBannerHtml } from '../../posts/post-html.js';
import { type AdminBanner } from '../types.js';
import { ApiResult, Body, isDatabaseInteger, isoDate, orderValue, stringValue } from '../shared.js';

type BannerScope = 'global' | 'user';

const bannerSelect = {
  id: true,
  title: true,
  contentHtml: true,
  type: true,
  position: true,
  isActive: true,
  order: true,
  createdAt: true,
  updatedAt: true,
  user: { select: { username: true } },
} satisfies Prisma.SiteBannerSelect;

type BannerRow = Prisma.SiteBannerGetPayload<{ select: typeof bannerSelect }>;

function serializeBanner(row: BannerRow, scope: BannerScope): AdminBanner {
  return {
    id: row.id,
    title: row.title,
    contentHtml: scope === 'global' ? row.contentHtml : sanitizeBannerHtml(row.contentHtml),
    bannerType: row.type,
    position: row.position,
    isActive: row.isActive,
    order: row.order,
    createdDate: isoDate(row.createdAt),
    updatedDate: isoDate(row.updatedAt),
    createdBy: row.user?.username ?? null,
  };
}

function bannersIn(scope: BannerScope, ownerId: number | null): Prisma.SiteBannerWhereInput {
  return scope === 'global' ? { scope } : { scope, userId: ownerId ?? 0 };
}

export async function readBanners(
  db: PrismaClient,
  scope: BannerScope = 'global',
  ownerId: number | null = null,
): Promise<AdminBanner[]> {
  const rows = await db.siteBanner.findMany({
    where: bannersIn(scope, ownerId),
    orderBy: [{ order: 'asc' }, { createdAt: 'desc' }],
    select: bannerSelect,
  });
  return rows.map((row) => serializeBanner(row, scope));
}

export async function readBanner(
  db: PrismaClient | Prisma.TransactionClient,
  id: number,
  scope: BannerScope = 'global',
  ownerId: number | null = null,
): Promise<AdminBanner | null> {
  const row = await db.siteBanner.findFirst({ where: { ...bannersIn(scope, ownerId), id }, select: bannerSelect });
  return row ? serializeBanner(row, scope) : null;
}

export function bannerApi(banner: AdminBanner, includeCreatedBy = true): Partial<AdminBanner> {
  if (includeCreatedBy) return banner;
  const { createdBy: _createdBy, ...authorView } = banner;
  return authorView;
}

export function bannerPayload(body: Body): Body {
  const result: Body = {};
  for (const field of ['title', 'contentHtml', 'bannerType', 'position'] as const) {
    if (field in body) result[field] = stringValue(body[field]);
  }
  if ('isActive' in body) result.isActive = body.isActive === true;
  if ('order' in body) result.order = orderValue(body.order);
  return result;
}

function bannerPlacement(type: string, position: string): { type: BannerType; position: BannerPosition } | { error: string } {
  if (type === 'horizontal') {
    return position === 'top' || position === 'bottom'
      ? { type, position }
      : { error: 'Horizontal banners can only be placed at the top or bottom.' };
  }
  if (type === 'sidebar') {
    return position === 'left' || position === 'right'
      ? { type, position }
      : { error: 'Sidebar banners can only be placed on the left or right.' };
  }
  return { error: 'Select a valid banner type.' };
}

export function saveBanner(
  db: PrismaClient,
  userId: number,
  input: Body,
  id?: number,
  scope: BannerScope = 'global',
): Promise<ApiResult<AdminBanner>> {
  const ownerId = scope === 'user' ? userId : null;
  return db.$transaction(async (tx): Promise<ApiResult<AdminBanner>> => {
    const current = id === undefined ? null : await readBanner(tx, id, scope, ownerId);
    if (id !== undefined && !current) return { ok: false, code: 'NF', message: 'Banner not found.' };
    const title = 'title' in input ? stringValue(input.title) : current?.title ?? '';
    const submittedHtml = stringValue(input.contentHtml);
    const contentHtml = 'contentHtml' in input
      ? (scope === 'global' ? submittedHtml : sanitizeBannerHtml(submittedHtml))
      : current?.contentHtml ?? '';
    if (id === undefined && !title) return { ok: false, code: 'VA', message: 'Enter a banner name.' };
    if (id === undefined && !contentHtml) return { ok: false, code: 'VA', message: 'Enter banner HTML.' };
    const placement = bannerPlacement(
      'bannerType' in input ? stringValue(input.bannerType) : current?.bannerType ?? 'horizontal',
      'position' in input ? stringValue(input.position) : current?.position ?? 'top',
    );
    if ('error' in placement) return { ok: false, code: 'VA', message: placement.error };
    const data = {
      title,
      contentHtml,
      ...placement,
      isActive: 'isActive' in input ? input.isActive === true : current?.isActive ?? true,
      order: isDatabaseInteger(input.order) ? input.order : current?.order ?? 0,
    };
    const saved = id === undefined
      ? await tx.siteBanner.create({ data: { ...data, scope, userId }, select: bannerSelect })
      : await tx.siteBanner.update({ where: { id }, data, select: bannerSelect });
    return { ok: true, body: serializeBanner(saved, scope) };
  });
}

/** Applies `[id, order]` pairs inside one scope and skips malformed pairs, as the settings screen expects. */
export async function saveBannerOrder(
  db: PrismaClient,
  order: unknown,
  scope: BannerScope,
  ownerId: number | null = null,
): Promise<void> {
  if (!Array.isArray(order)) return;
  await db.$transaction(async (tx) => {
    const banners = await tx.siteBanner.findMany({ where: bannersIn(scope, ownerId), select: { id: true, order: true } });
    const current = new Map(banners.map((banner) => [banner.id, banner.order]));
    const requested = new Map<number, number>();
    for (const item of order) {
      if (!Array.isArray(item) || item.length !== 2) continue;
      const [rawId, rawOrder] = item;
      const id = typeof rawId === 'number' ? rawId : /^\d+$/.test(String(rawId)) ? Number(rawId) : NaN;
      const position = typeof rawOrder === 'number' ? rawOrder : /^-?\d+$/.test(String(rawOrder)) ? Number(rawOrder) : NaN;
      if (isDatabaseInteger(id) && isDatabaseInteger(position) && current.has(id)) requested.set(id, position);
    }
    // The request size no longer decides how long this transaction holds the single database connection.
    for (const [id, position] of requested) {
      if (current.get(id) !== position) await tx.siteBanner.updateMany({ where: { ...bannersIn(scope, ownerId), id }, data: { order: position } });
    }
  });
}
