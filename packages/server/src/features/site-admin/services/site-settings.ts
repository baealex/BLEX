import type { Prisma, PrismaClient } from '@prisma/client';
import { realpath, stat } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import type { AdminSiteSettings } from '../types.js';
import { ICON_PNG_SIZES } from './brand-assets.js';
import {
  type AdminSettingsOptions,
  type ApiResult,
  type Body,
  isRecord,
  isoDate,
  recordAudit,
  stringValue,
} from '../shared.js';

const SITE_DEFAULT_NAME = 'BLEX';

const SITE_DEFAULT_DESCRIPTION = 'BLOG EXPRESS ME';

const siteRowSelect = {
  siteName: true,
  headerScript: true,
  footerScript: true,
  seoEnabled: true,
  robotsTxtExtraRules: true,
  aeoEnabled: true,
  updatedAt: true,
  logoSvg: true,
  logoSvgDark: true,
  iconSvg: true,
  iconSvgDark: true,
  iconManifest: true,
} satisfies Prisma.SiteSettingSelect;

export type SiteRow = Prisma.SiteSettingGetPayload<{ select: typeof siteRowSelect }>;

export function readSiteRow(db: PrismaClient): Promise<SiteRow | null> {
  return db.siteSetting.findUnique({ where: { id: 1 }, select: siteRowSelect });
}

/** Creates the singleton on its first write; reads never do. */
export function writeSiteSetting(db: Prisma.TransactionClient, changes: Prisma.SiteSettingCreateInput) {
  const data = { ...changes, updatedAt: new Date() };
  return db.siteSetting.upsert({ where: { id: 1 }, create: { id: 1, ...data }, update: data, select: { id: true } });
}

export function parseManifest(value: Prisma.JsonValue | null): { png?: Record<string, string>; ico?: string } {
  if (!isRecord(value)) return {};
  const png = isRecord(value.png)
    ? Object.fromEntries(
        Object.entries(value.png).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
      )
    : undefined;
  return { png, ico: typeof value.ico === 'string' ? value.ico : undefined };
}

async function storedMediaUrl(mediaRoot: string | undefined, storedPath: string | null): Promise<string | null> {
  if (!mediaRoot || !storedPath || storedPath.startsWith('/') || storedPath.includes('\\') || storedPath.includes('\0'))
    return null;
  const parts = storedPath.split('/');
  if (parts.some((part) => part === '' || part === '.' || part === '..')) return null;
  try {
    const root = await realpath(mediaRoot);
    const file = await realpath(resolve(root, ...parts));
    const pathFromRoot = relative(root, file);
    if (
      pathFromRoot === '..' ||
      pathFromRoot.startsWith(`..${sep}`) ||
      isAbsolute(pathFromRoot) ||
      !(await stat(file)).isFile()
    )
      return null;
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
    pngUrls[String(size)] =
      (await storedMediaUrl(options.mediaRoot, manifest.png?.[String(size)] ?? null)) ?? `/resources/logo${size}.png`;
  }
  const fallbackIcon = pngUrls['512'] ?? '/resources/logo512.png';
  return {
    siteName,
    siteDescription: siteName === SITE_DEFAULT_NAME ? SITE_DEFAULT_DESCRIPTION : `${siteName} recent public posts`,
    logoSvgUrl: logo ?? '/resources/logob.svg',
    logoSvgDarkUrl: logoDark ?? logo ?? '/resources/logow.svg',
    iconSvgUrl: icon ?? fallbackIcon,
    iconSvgDarkUrl: iconDark ?? icon ?? fallbackIcon,
    faviconUrl: (await storedMediaUrl(options.mediaRoot, manifest.ico ?? null)) ?? '/resources/favicon.ico',
    iconPngUrls: pngUrls,
    hasCustomLogo: Boolean(row?.logoSvg),
    hasCustomLogoDark: Boolean(row?.logoSvgDark),
    hasCustomIcon: Boolean(row?.iconSvg),
    hasCustomIconDark: Boolean(row?.iconSvgDark),
    headerScript: canManageScripts ? (row?.headerScript ?? '') : '',
    footerScript: canManageScripts ? (row?.footerScript ?? '') : '',
    canManageScripts,
    seoEnabled: row?.seoEnabled ?? true,
    robotsTxtExtraRules: row?.robotsTxtExtraRules ?? '',
    robotsTxtDefault: robotsDefault(options.siteUrl, row?.seoEnabled ?? true, row?.aeoEnabled ?? false),
    aeoEnabled: row?.aeoEnabled ?? false,
    updatedDate: isoDate(row?.updatedAt ?? null),
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
  else
    lines.push(
      '',
      '# Search indexing is disabled at runtime.',
      '# Page responses include X-Robots-Tag and HTML robots meta noindex signals.',
    );
  return `${lines.join('\n').trim()}\n`;
}

export async function updateSiteSettings(
  db: PrismaClient,
  userId: number,
  isSuperuser: boolean,
  input: Body,
  options: AdminSettingsOptions,
): Promise<ApiResult<AdminSiteSettings>> {
  if (['headerScript', 'footerScript'].some((field) => field in input) && !isSuperuser) {
    return { ok: false, code: 'RJ', message: 'Superuser access is required.' };
  }

  const changes: Prisma.SiteSettingCreateInput = {};
  if ('siteName' in input) {
    const siteName = typeof input.siteName === 'string' ? input.siteName.trim() : '';
    if (siteName.length > 80) {
      return { ok: false, code: 'VA', message: 'Site name must be 80 characters or fewer.' };
    }
    changes.siteName = siteName || SITE_DEFAULT_NAME;
  }
  if ('headerScript' in input) changes.headerScript = stringValue(input.headerScript);
  if ('footerScript' in input) changes.footerScript = stringValue(input.footerScript);
  if ('seoEnabled' in input) changes.seoEnabled = input.seoEnabled === true;
  if ('robotsTxtExtraRules' in input)
    changes.robotsTxtExtraRules = typeof input.robotsTxtExtraRules === 'string' ? input.robotsTxtExtraRules : '';
  if ('aeoEnabled' in input) changes.aeoEnabled = input.aeoEnabled === true;

  await db.$transaction(async (transaction) => {
    await writeSiteSetting(transaction, changes);
    await recordAudit(transaction, userId, 'sitesetting', 'Site settings', 'Updated site settings');
  });

  const site = await serializeSiteSettings(await readSiteRow(db), isSuperuser, options);
  return { ok: true, body: site };
}
