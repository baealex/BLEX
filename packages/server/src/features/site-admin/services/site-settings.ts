import { Prisma, type PrismaClient } from '@prisma/client';
import { realpath, stat } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { type AdminSiteSettings } from '../types.js';
import { ICON_PNG_SIZES } from './brand-assets.js';
import { AdminSettingsOptions, ApiResult, Body, booleanValue, djangoTimestamp, isRecord, isoDate, recordAudit, stringValue } from '../shared.js';

const SITE_DEFAULT_NAME = 'BLEX';

const SITE_DEFAULT_DESCRIPTION = 'BLOG EXPRESS ME';

const SITE_DEFAULT_COLUMNS = Prisma.sql`(
  id, header_script, footer_script, updated_date, aeo_enabled, seo_enabled,
  robots_txt_extra_rules, site_name, logo_svg, logo_svg_dark, icon_svg,
  icon_svg_dark, icon_manifest
)`;

const SITE_DEFAULT_VALUES = Prisma.sql`(
  1, '', '', ${djangoTimestamp()}, 0, 1, '', ${SITE_DEFAULT_NAME}, '', '', '', '', '{}'
)`;

export interface SiteRow {
  siteName: string | null;
  headerScript: string | null;
  footerScript: string | null;
  seoEnabled: number | bigint | boolean;
  robotsTxtExtraRules: string | null;
  aeoEnabled: number | bigint | boolean;
  updatedDate: string | null;
  logoSvg: string | null;
  logoSvgDark: string | null;
  iconSvg: string | null;
  iconSvgDark: string | null;
  iconManifest: string | null;
}

export async function readSiteRow(db: PrismaClient): Promise<SiteRow | null> {
  const [row] = await db.$queryRaw<SiteRow[]>`
    SELECT site_name AS siteName, header_script AS headerScript, footer_script AS footerScript,
           seo_enabled AS seoEnabled, robots_txt_extra_rules AS robotsTxtExtraRules,
           aeo_enabled AS aeoEnabled, CAST(updated_date AS TEXT) AS updatedDate,
           logo_svg AS logoSvg, logo_svg_dark AS logoSvgDark, icon_svg AS iconSvg,
           icon_svg_dark AS iconSvgDark, icon_manifest AS iconManifest
      FROM board_sitesetting WHERE id = 1 LIMIT 1
  `;
  return row ?? null;
}

export function parseManifest(value: string | null): { png?: Record<string, string>; ico?: string } {
  if (!value) return {};
  try {
    const parsed: unknown = JSON.parse(value);
    if (!isRecord(parsed)) return {};
    const png = isRecord(parsed.png)
      ? Object.fromEntries(Object.entries(parsed.png).filter((entry): entry is [string, string] => typeof entry[1] === 'string'))
      : undefined;
    return { png, ico: typeof parsed.ico === 'string' ? parsed.ico : undefined };
  } catch {
    return {};
  }
}

async function storedMediaUrl(mediaRoot: string | undefined, storedPath: string | null): Promise<string | null> {
  if (!mediaRoot || !storedPath || storedPath.startsWith('/') || storedPath.includes('\\') || storedPath.includes('\0')) return null;
  const parts = storedPath.split('/');
  if (parts.some((part) => part === '' || part === '.' || part === '..')) return null;
  try {
    const root = await realpath(mediaRoot);
    const file = await realpath(resolve(root, ...parts));
    const pathFromRoot = relative(root, file);
    if (pathFromRoot === '..' || pathFromRoot.startsWith(`..${sep}`) || isAbsolute(pathFromRoot) || !(await stat(file)).isFile()) return null;
    return `/resources/media/${parts.map(encodeURIComponent).join('/')}`;
  } catch {
    return null;
  }
}

export async function serializeSiteSettings(
  row: SiteRow | null,
  canManageScripts: boolean,
  options: AdminSettingsOptions,
): Promise<AdminSiteSettings> {
  const siteName = row?.siteName?.trim() || SITE_DEFAULT_NAME;
  const logo = await storedMediaUrl(options.mediaRoot, row?.logoSvg ?? null);
  const logoDark = await storedMediaUrl(options.mediaRoot, row?.logoSvgDark ?? null);
  const icon = await storedMediaUrl(options.mediaRoot, row?.iconSvg ?? null);
  const iconDark = await storedMediaUrl(options.mediaRoot, row?.iconSvgDark ?? null);
  const manifest = parseManifest(row?.iconManifest ?? null);
  const pngUrls: Record<string, string> = {};
  for (const size of ICON_PNG_SIZES) {
    pngUrls[String(size)] = await storedMediaUrl(options.mediaRoot, manifest.png?.[String(size)] ?? null) ?? `/resources/logo${size}.png`;
  }
  const fallbackIcon = pngUrls['512'] ?? '/resources/logo512.png';
  return {
    siteName,
    siteDescription: siteName === SITE_DEFAULT_NAME ? SITE_DEFAULT_DESCRIPTION : `${siteName} recent public posts`,
    logoSvgUrl: logo ?? '/resources/logob.svg',
    logoSvgDarkUrl: logoDark ?? logo ?? '/resources/logow.svg',
    iconSvgUrl: icon ?? fallbackIcon,
    iconSvgDarkUrl: iconDark ?? icon ?? fallbackIcon,
    faviconUrl: await storedMediaUrl(options.mediaRoot, manifest.ico ?? null) ?? '/resources/favicon.ico',
    iconPngUrls: pngUrls,
    hasCustomLogo: Boolean(row?.logoSvg),
    hasCustomLogoDark: Boolean(row?.logoSvgDark),
    hasCustomIcon: Boolean(row?.iconSvg),
    hasCustomIconDark: Boolean(row?.iconSvgDark),
    headerScript: canManageScripts ? row?.headerScript ?? '' : '',
    footerScript: canManageScripts ? row?.footerScript ?? '' : '',
    canManageScripts,
    seoEnabled: row ? booleanValue(row.seoEnabled) : true,
    robotsTxtExtraRules: row?.robotsTxtExtraRules ?? '',
    robotsTxtDefault: robotsDefault(options.siteUrl, row ? booleanValue(row.seoEnabled) : true, row ? booleanValue(row.aeoEnabled) : false),
    aeoEnabled: row ? booleanValue(row.aeoEnabled) : false,
    updatedDate: isoDate(row?.updatedDate ?? null),
  };
}

function robotsDefault(siteUrl: URL, seoEnabled: boolean, aeoEnabled: boolean): string {
  const lines = [
    'User-agent: *',
    'Disallow: /*.preview.jpg',
    'Disallow: /*.minify.*',
    'Disallow: /settings/',
    'Disallow: /admin-settings/',
    'Disallow: /write',
    'Disallow: /v1/',
  ];
  if (aeoEnabled) {
    lines.push('', `# AI agent entry point: ${new URL('/llms.txt', siteUrl).href}`);
  } else {
    lines.push('Disallow: /llms.txt', 'Disallow: /*.md');
  }
  if (seoEnabled) lines.push(`Sitemap: ${new URL('/sitemap.xml', siteUrl).href}`);
  else lines.push('', '# Search indexing is disabled at runtime.', '# Page responses include X-Robots-Tag and HTML robots meta noindex signals.');
  return `${lines.join('\n').trim()}\n`;
}

export async function ensureSiteSetting(db: Prisma.TransactionClient): Promise<void> {
  await db.$executeRaw`INSERT OR IGNORE INTO board_sitesetting ${SITE_DEFAULT_COLUMNS} VALUES ${SITE_DEFAULT_VALUES}`;
}

export async function updateSiteSettings(
  db: PrismaClient,
  userId: number,
  isSuperuser: boolean,
  input: Body,
  options: AdminSettingsOptions,
): Promise<ApiResult<AdminSiteSettings>> {
  if (['header_script', 'footer_script'].some((field) => field in input) && !isSuperuser) {
    return { ok: false, code: 'RJ', message: 'Superuser access is required.' };
  }

  let normalizedSiteName = '';
  if ('site_name' in input) {
    normalizedSiteName = typeof input.site_name === 'string' ? input.site_name.trim() : '';
    if (normalizedSiteName.length > 80) {
      return { ok: false, code: 'VA', message: 'Site name must be 80 characters or fewer.' };
    }
    normalizedSiteName ||= SITE_DEFAULT_NAME;
  }

  await db.$transaction(async (transaction) => {
    await ensureSiteSetting(transaction);
    const updates: Prisma.Sql[] = [Prisma.sql`updated_date = ${djangoTimestamp()}`];
    if ('header_script' in input) updates.push(Prisma.sql`header_script = ${stringValue(input.header_script)}`);
    if ('footer_script' in input) updates.push(Prisma.sql`footer_script = ${stringValue(input.footer_script)}`);
    if ('site_name' in input) updates.push(Prisma.sql`site_name = ${normalizedSiteName}`);
    if ('seo_enabled' in input) updates.push(Prisma.sql`seo_enabled = ${input.seo_enabled === true ? 1 : 0}`);
    if ('robots_txt_extra_rules' in input) updates.push(Prisma.sql`robots_txt_extra_rules = ${typeof input.robots_txt_extra_rules === 'string' ? input.robots_txt_extra_rules : ''}`);
    if ('aeo_enabled' in input) updates.push(Prisma.sql`aeo_enabled = ${input.aeo_enabled === true ? 1 : 0}`);
    await transaction.$executeRaw(Prisma.sql`UPDATE board_sitesetting SET ${Prisma.join(updates, ', ')} WHERE id = 1`);
    await recordAudit(transaction, userId, 'sitesetting', 'Site settings', 'Updated site settings');
  });

  const site = await serializeSiteSettings(await readSiteRow(db), isSuperuser, options);
  return { ok: true, body: site };
}

export function apiSitePayload(input: Body): Body {
  return input;
}

