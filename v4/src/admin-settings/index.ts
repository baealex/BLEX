import formBody from '@fastify/formbody';
import multipart from '@fastify/multipart';
import { Prisma, type PrismaClient } from '@prisma/client';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import sharp from 'sharp';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { lstat, mkdir, readFile, readdir, realpath, rmdir, stat, unlink, writeFile } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { domainToASCII } from 'node:url';
import { encryptDjangoSecret, decryptDjangoSecret } from '../auth/django-secret.js';
import { djangoIso } from '../django-format.js';
import { sanitizeBannerHtml } from '../post-html.js';
import { adminSettingsCapabilities, readAdminAccess, type UserAccess } from './access.js';
import {
  renderAdminBanners,
  renderAdminLoginSettings,
  renderAdminIntegrationSettings,
  renderAdminInvites,
  renderAdminNotices,
  renderAdminStaticPageEditor,
  renderAdminStaticPages,
  renderAdminUtilities,
  renderAdminSeoSettings,
  renderAdminSiteSettings,
  renderAuthorBanners,
  renderAuthorNotices,
  type AdminBanner,
  type AdminManagedUser,
  type AdminNotice,
  type AdminStaticPage,
  type AdminUserList,
  type AdminLoginSettings,
  type AdminIntegrationSettings,
  type AdminInvite,
  type AdminSettingsUser,
  type AdminSiteSettings,
  type AdminUtilityAction,
} from './pages.js';

const SITE_DEFAULT_NAME = 'BLEX';
const SITE_DEFAULT_DESCRIPTION = 'BLOG EXPRESS ME';
const SOCIAL_PROVIDERS = [
  { key: 'google', name: 'Google' },
  { key: 'github', name: 'GitHub' },
] as const;
const ICON_PNG_SIZES = [16, 32, 57, 72, 76, 96, 114, 120, 128, 144, 152, 192, 256, 512] as const;
const SITE_DEFAULT_COLUMNS = Prisma.sql`(
  id, header_script, footer_script, updated_date, aeo_enabled, seo_enabled,
  robots_txt_extra_rules, site_name, logo_svg, logo_svg_dark, icon_svg,
  icon_svg_dark, icon_manifest
)`;
const SITE_DEFAULT_VALUES = Prisma.sql`(
  1, '', '', ${djangoTimestamp()}, 0, 1, '', ${SITE_DEFAULT_NAME}, '', '', '', '', '{}'
)`;

export interface AdminSettingsOptions {
  currentUser: (request: FastifyRequest) => Promise<AdminSettingsUser | null>;
  validateCsrf: (request: FastifyRequest) => boolean;
  siteUrl: URL;
  cipherKey: string;
  secretKey: string;
  fetchProvider?: (url: string, init?: RequestInit) => Promise<{ json(): Promise<unknown> }>;
  mediaRoot?: string;
}

interface SiteRow {
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

interface LoginRow {
  welcomeMessage: string | null;
  welcomeUrl: string | null;
  deletionRedirectUrl: string | null;
  hcaptchaEnabled: number | bigint | boolean;
  hcaptchaSiteKey: string | null;
  hcaptchaSecretKey: string | null;
  updatedDate: string | null;
}

interface ProviderRow {
  key: string;
  clientId: string | null;
  clientSecret: string | null;
  isEnabled: number | bigint | boolean;
}

interface IntegrationRow {
  telegramEnabled: number | bigint | boolean;
  telegramBotUsername: string | null;
  telegramBotToken: string | null;
  updatedDate: string | null;
}

interface InviteRow {
  id: number;
  code: string;
  note: string;
  isActive: number | bigint | boolean;
  createdBy: string | null;
  claimedBy: string | null;
  createdDate: string | null;
  claimedDate: string | null;
  claimedById: number | null;
}

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

interface NoticeRow {
  id: number;
  title: string;
  url: string;
  isActive: number | bigint | boolean;
  createdDate: string | null;
  updatedDate: string | null;
}

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

interface ManagedUserRow {
  id: number;
  username: string;
  name: string;
  email: string;
  isActive: number | bigint | boolean;
  isStaff: number | bigint | boolean;
  isSuperuser: number | bigint | boolean;
  role: string | null;
  postCount: number | bigint;
  dateJoined: string | null;
  lastLogin: string | null;
}

type ApiResult<T> = { ok: true; body: T } | { ok: false; code: string; message: string };
type Body = Record<string, unknown>;

function success(body: unknown = {}) {
  return { status: 'DONE', body };
}

function failure(code: string, message = '') {
  return { status: 'ERROR', errorCode: `error:${code}`, errorMessage: message };
}

function isRecord(value: unknown): value is Body {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value) && !Buffer.isBuffer(value));
}

function stringValue(value: unknown): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return stringValue(value.at(-1));
  if (Buffer.isBuffer(value)) return value.toString('utf8');
  return '';
}

function booleanValue(value: unknown): boolean {
  return value === true || value === 1 || value === 1n;
}

function formBoolean(value: unknown): boolean {
  return ['true', '1', 'on', 'yes'].includes(stringValue(value).toLowerCase());
}

function csrfToken(request: FastifyRequest): string {
  for (const part of (request.headers.cookie ?? '').split(';')) {
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
  return date.toISOString().replace('T', ' ').replace(/Z$/, '000');
}

function isoDate(value: string | null): string {
  return djangoIso(value) ?? '';
}

function pageNumber(request: FastifyRequest): URLSearchParams {
  return new URLSearchParams(request.url.split('?')[1] ?? '');
}

function loginRedirect(request: FastifyRequest, reply: FastifyReply) {
  const next = request.url.split('?')[0] || '/admin-settings/';
  return reply.redirect(`/login?next=${encodeURIComponent(next)}`, 302);
}

async function pageAccess(
  request: FastifyRequest,
  reply: FastifyReply,
  db: PrismaClient,
  options: AdminSettingsOptions,
): Promise<{ user: AdminSettingsUser; access: UserAccess } | null> {
  const user = await options.currentUser(request);
  if (!user) {
    loginRedirect(request, reply);
    return null;
  }
  const access = await readAdminAccess(db, user.id);
  if (!access?.active) {
    loginRedirect(request, reply);
    return null;
  }
  if (!access.staff) {
    reply.code(404).type('text/plain; charset=utf-8').send('페이지를 찾을 수 없습니다.');
    return null;
  }
  const [profile] = await db.$queryRaw<Array<{ role: string }>>`
    SELECT role FROM board_profile WHERE user_id = ${user.id} LIMIT 1
  `;
  return { user: { ...user, hasEditorRole: profile?.role === 'EDITOR', isStaff: access.staff }, access };
}

async function editorPageAccess(
  request: FastifyRequest,
  reply: FastifyReply,
  db: PrismaClient,
  options: AdminSettingsOptions,
): Promise<{ user: AdminSettingsUser; access: UserAccess } | null> {
  const user = await options.currentUser(request);
  if (!user) {
    loginRedirect(request, reply);
    return null;
  }
  const access = await readAdminAccess(db, user.id);
  if (!access?.active) {
    loginRedirect(request, reply);
    return null;
  }
  const [profile] = await db.$queryRaw<Array<{ role: string }>>`
    SELECT role FROM board_profile WHERE user_id = ${user.id} LIMIT 1
  `;
  if (profile?.role !== 'EDITOR') {
    reply.code(404).type('text/plain; charset=utf-8').send('페이지를 찾을 수 없습니다.');
    return null;
  }
  return { user: { ...user, hasEditorRole: true, isStaff: access.staff }, access };
}

async function readSiteRow(db: PrismaClient): Promise<SiteRow | null> {
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

function parseManifest(value: string | null): { png?: Record<string, string>; ico?: string } {
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

async function serializeSiteSettings(
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

const BRAND_SVG_MAX_BYTES = 256 * 1024;
const BRAND_PNG_MAX_BYTES = 512 * 1024;
const BRAND_ICO_MAX_BYTES = 1024 * 1024;
const SVG_ALLOWED_TAGS = new Set([
  'svg', 'g', 'defs', 'title', 'desc', 'style', 'path', 'rect', 'circle', 'ellipse',
  'line', 'polyline', 'polygon', 'linearGradient', 'radialGradient', 'stop', 'text', 'tspan',
]);
const SVG_ALLOWED_ATTRIBUTES = new Set([
  'xmlns', 'viewBox', 'width', 'height', 'class', 'style', 'type', 'fill', 'stroke', 'stroke-width',
  'stroke-linecap', 'stroke-linejoin', 'stroke-miterlimit', 'stroke-dasharray', 'stroke-dashoffset',
  'opacity', 'fill-opacity', 'stroke-opacity', 'd', 'points', 'x', 'y', 'x1', 'x2', 'y1', 'y2',
  'cx', 'cy', 'r', 'rx', 'ry', 'transform', 'gradientUnits', 'gradientTransform', 'offset',
  'stop-color', 'stop-opacity', 'id', 'role', 'aria-hidden', 'focusable', 'xml:space', 'font-family',
  'font-size', 'font-weight', 'text-anchor', 'dominant-baseline', 'letter-spacing', 'fill-rule',
  'clip-rule', 'version', 'preserveAspectRatio',
]);
const REQUIRED_ICON_PNG_SIZES = [16, 32, 57, 72, 76, 96, 114, 120, 128, 144, 152, 192, 256, 512] as const;
const SVG_DANGEROUS_VALUE = /(javascript:|https?:|\/\/|data:|@import)/i;
const SVG_EXTERNAL_URL = /url\(\s*(?!#|'#|"#)/i;
const BRAND_SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

class BrandAssetValidationError extends Error {}

type BrandAssetType = 'logo' | 'icon';
type BrandAssetTheme = 'default' | 'dark';

function decodeXmlEntities(value: string): string {
  if (/&(?!amp;|lt;|gt;|quot;|apos;|#\d+;|#x[\da-f]+;)/i.test(value)) {
    throw new BrandAssetValidationError('This is not a valid SVG file.');
  }
  return value.replace(/&(?:amp|lt|gt|quot|apos|#\d+|#x[\da-f]+);/gi, (entity) => {
    const body = entity.slice(1, -1);
    if (body === 'amp') return '&';
    if (body === 'lt') return '<';
    if (body === 'gt') return '>';
    if (body === 'quot') return '"';
    if (body === 'apos') return "'";
    const codePoint = body.startsWith('#x') || body.startsWith('#X')
      ? Number.parseInt(body.slice(2), 16)
      : Number.parseInt(body.slice(1), 10);
    if (!Number.isSafeInteger(codePoint) || codePoint <= 0 || codePoint > 0x10ffff || (codePoint >= 0xd800 && codePoint <= 0xdfff)) {
      throw new BrandAssetValidationError('This is not a valid SVG file.');
    }
    return String.fromCodePoint(codePoint);
  });
}

function validateSvg(content: Buffer | undefined): Buffer {
  if (!content?.length) throw new BrandAssetValidationError('SVG file is required.');
  if (content.length > BRAND_SVG_MAX_BYTES) throw new BrandAssetValidationError('SVG file is too large.');
  const source = new TextDecoder('utf-8', { fatal: true }).decode(content).replace(/^\uFEFF/, '').trim();
  if (/<!DOCTYPE/i.test(source) || /<\?(?!xml\s)[\s\S]*?\?>/i.test(source)) {
    throw new BrandAssetValidationError('SVG processing instructions and DOCTYPE declarations are not allowed.');
  }
  const xml = source.replace(/^<\?xml\s+[^?]*\?>\s*/i, '');
  const stack: string[] = [];
  let index = 0;
  let nodes = 0;
  let rootViewBox = false;
  let rootSeen = false;
  let rootClosed = false;
  const dangerous = (value: string) => SVG_DANGEROUS_VALUE.test(value) || SVG_EXTERNAL_URL.test(value);

  while (index < xml.length) {
    if (xml[index] !== '<') {
      const nextTag = xml.indexOf('<', index);
      const rawText = xml.slice(index, nextTag < 0 ? xml.length : nextTag);
      const text = decodeXmlEntities(rawText);
      if (!stack.length && text.trim()) throw new BrandAssetValidationError('This is not a valid SVG file.');
      if (dangerous(text)) throw new BrandAssetValidationError('The SVG text contains an unsafe value.');
      index = nextTag < 0 ? xml.length : nextTag;
      continue;
    }
    if (xml.startsWith('<!--', index)) {
      const end = xml.indexOf('-->', index + 4);
      if (end < 0 || xml.slice(index + 4, end).includes('--')) throw new BrandAssetValidationError('This is not a valid SVG file.');
      index = end + 3;
      continue;
    }
    if (xml.startsWith('<!', index) || xml.startsWith('<?', index)) throw new BrandAssetValidationError('This is not a valid SVG file.');

    let end = index + 1;
    let quote = '';
    for (; end < xml.length; end += 1) {
      const character = xml[end] ?? '';
      if (quote) {
        if (character === quote) quote = '';
      } else if (character === '"' || character === "'") quote = character;
      else if (character === '>') break;
    }
    if (end >= xml.length || quote) throw new BrandAssetValidationError('This is not a valid SVG file.');
    const token = xml.slice(index, end + 1);
    index = end + 1;

    if (token.startsWith('</')) {
      const closing = token.match(/^<\/\s*([A-Za-z_:][\w:.-]*)\s*>$/);
      if (!closing || stack.pop() !== closing[1]) throw new BrandAssetValidationError('This is not a valid SVG file.');
      if (!stack.length) rootClosed = true;
      continue;
    }

    const opening = token.match(/^<([A-Za-z_:][\w:.-]*)([\s\S]*)>$/);
    if (!opening) throw new BrandAssetValidationError('This is not a valid SVG file.');
    let tagSource = opening[2] ?? '';
    const selfClosing = /\/\s*$/.test(tagSource);
    if (selfClosing) tagSource = tagSource.replace(/\/\s*$/, '');
    const tag = (opening[1] ?? '').split(':').at(-1) ?? '';
    if (!SVG_ALLOWED_TAGS.has(tag) || rootClosed) throw new BrandAssetValidationError(`Unsupported SVG element: ${tag}`);
    const root = !rootSeen;
    if (root && tag !== 'svg') throw new BrandAssetValidationError('Check the SVG root element.');
    if (root) rootSeen = true;
    nodes += 1;
    if (nodes > 300) throw new BrandAssetValidationError('The SVG structure is too complex.');

    const seenAttributes = new Set<string>();
    let rest = tagSource;
    while (rest.trim()) {
      const attribute = rest.match(/^\s+([A-Za-z_:][\w:.-]*)\s*=\s*(?:"([^"<]*)"|'([^'<]*)')/);
      if (!attribute) throw new BrandAssetValidationError('This is not a valid SVG file.');
      const name = attribute[1] ?? '';
      const value = decodeXmlEntities(attribute[2] ?? attribute[3] ?? '');
      rest = rest.slice(attribute[0].length);
      if (seenAttributes.has(name)) throw new BrandAssetValidationError('This is not a valid SVG file.');
      seenAttributes.add(name);
      const localName = name.split(':').at(-1) ?? name;
      if (localName.toLowerCase().startsWith('on')) throw new BrandAssetValidationError('The SVG contains an event handler attribute.');
      if (!SVG_ALLOWED_ATTRIBUTES.has(name) && !SVG_ALLOWED_ATTRIBUTES.has(localName) && !name.startsWith('data-') && !name.startsWith('aria-')) {
        throw new BrandAssetValidationError(`Unsupported SVG attribute: ${name}`);
      }
      if (name === 'xmlns' || name.startsWith('xmlns:')) {
        if (value !== BRAND_SVG_NAMESPACE) throw new BrandAssetValidationError('The SVG contains an external reference or unsafe value.');
      } else if (dangerous(value)) {
        throw new BrandAssetValidationError('The SVG contains an external reference or unsafe value.');
      }
      if (root && name === 'viewBox' && value.trim()) rootViewBox = true;
    }
    if (root && !rootViewBox) throw new BrandAssetValidationError('SVG files require a viewBox.');
    if (!selfClosing) stack.push(opening[1] ?? '');
    else if (root) rootClosed = true;
  }

  if (!rootSeen || stack.length || !rootClosed) throw new BrandAssetValidationError('This is not a valid SVG file.');
  return content;
}

function parseBrandIconManifest(raw: string): Record<string, unknown> {
  if (!raw || raw.length > 16_384) throw new BrandAssetValidationError('An icon manifest is required.');
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    throw new BrandAssetValidationError('Check the icon manifest format.');
  }
  if (!isRecord(parsed)) throw new BrandAssetValidationError('Check the icon manifest format.');
  if (!Array.isArray(parsed.pngSizes) || JSON.stringify(parsed.pngSizes) !== JSON.stringify(REQUIRED_ICON_PNG_SIZES)) {
    throw new BrandAssetValidationError('Check the PNG size list in the icon manifest.');
  }
  if (parsed.ico !== true) throw new BrandAssetValidationError('Check the ICO information in the icon manifest.');
  return parsed;
}

async function validateBrandPng(content: Buffer | undefined, size: number): Promise<Buffer> {
  if (!content?.length) throw new BrandAssetValidationError(`${size}x${size} PNG file is required.`);
  if (content.length > BRAND_PNG_MAX_BYTES) throw new BrandAssetValidationError(`${size}x${size} PNG file is too large.`);
  try {
    const image = sharp(content, { limitInputPixels: size * size, failOn: 'error' });
    const metadata = await image.metadata();
    if (metadata.format !== 'png') throw new BrandAssetValidationError('Check the PNG file format.');
    if (metadata.width !== size || metadata.height !== size) throw new BrandAssetValidationError(`Check the dimensions of the ${size}x${size} PNG file.`);
    await image.raw().toBuffer();
  } catch (error) {
    if (error instanceof BrandAssetValidationError) throw error;
    throw new BrandAssetValidationError('Could not read the PNG file.');
  }
  return content;
}

async function generateIconDerivatives(svg: Buffer) {
  const master = await sharp(svg, { limitInputPixels: 16_777_216, failOn: 'error' })
    .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  const pngs = new Map<number, Buffer>();
  for (const size of REQUIRED_ICON_PNG_SIZES) {
    pngs.set(size, size === 512 ? master : await sharp(master).resize(size, size).png().toBuffer());
  }
  const faviconSizes = [16, 32];
  const directory = Buffer.alloc(6 + faviconSizes.length * 16);
  directory.writeUInt16LE(1, 2);
  directory.writeUInt16LE(faviconSizes.length, 4);
  let offset = directory.length;
  const images = faviconSizes.map((size, index) => {
    const png = pngs.get(size)!;
    const entry = 6 + index * 16;
    directory[entry] = directory[entry + 1] = size;
    directory.writeUInt16LE(1, entry + 4);
    directory.writeUInt16LE(32, entry + 6);
    directory.writeUInt32LE(png.length, entry + 8);
    directory.writeUInt32LE(offset, entry + 12);
    offset += png.length;
    return png;
  });
  return { pngs, ico: Buffer.concat([directory, ...images]) };
}

async function validateBrandIco(content: Buffer | undefined): Promise<Buffer> {
  if (!content?.length) throw new BrandAssetValidationError('favicon.ico file is required.');
  if (content.length > BRAND_ICO_MAX_BYTES) throw new BrandAssetValidationError('favicon.ico file is too large.');
  if (content.length < 22 || content.readUInt16LE(0) !== 0 || content.readUInt16LE(2) !== 1) {
    throw new BrandAssetValidationError('Check the ICO file format.');
  }
  const imageCount = content.readUInt16LE(4);
  if (imageCount < 1 || imageCount > 128 || 6 + imageCount * 16 > content.length) throw new BrandAssetValidationError('Could not read the ICO file.');
  let validImage = false;
  for (let index = 0; index < imageCount; index += 1) {
    const entry = 6 + index * 16;
    const width = content[entry] || 256;
    const height = content[entry + 1] || 256;
    const imageBytes = content.readUInt32LE(entry + 8);
    const imageOffset = content.readUInt32LE(entry + 12);
    const end = imageOffset + imageBytes;
    if (imageBytes < 8 || imageOffset < 6 + imageCount * 16 || end > content.length) throw new BrandAssetValidationError('Could not read the ICO file.');
    const imageContent = content.subarray(imageOffset, end);
    if (imageContent.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
      try {
        const image = sharp(imageContent, { limitInputPixels: 65_536, failOn: 'error' });
        const metadata = await image.metadata();
        if (metadata.format !== 'png' || metadata.width !== width || metadata.height !== height) throw new Error('invalid PNG icon');
        await image.raw().toBuffer();
        validImage = true;
      } catch {
        throw new BrandAssetValidationError('Could not read the ICO file.');
      }
      continue;
    }
    if (imageContent.length < 40) throw new BrandAssetValidationError('Could not read the ICO file.');
    const headerSize = imageContent.readUInt32LE(0);
    const dibWidth = imageContent.readInt32LE(4);
    const dibHeight = imageContent.readInt32LE(8);
    const planes = imageContent.readUInt16LE(12);
    const bitsPerPixel = imageContent.readUInt16LE(14);
    if (headerSize < 40 || headerSize > imageContent.length || dibWidth !== width || Math.abs(dibHeight) !== height * 2 || planes !== 1 || ![1, 4, 8, 16, 24, 32].includes(bitsPerPixel)) {
      throw new BrandAssetValidationError('Could not read the ICO file.');
    }
    validImage = true;
  }
  if (!validImage) throw new BrandAssetValidationError('Could not read the ICO file.');
  return content;
}

function brandAssetField(assetType: BrandAssetType, theme: BrandAssetTheme): string {
  if (assetType === 'logo') return theme === 'default' ? 'logo_svg' : 'logo_svg_dark';
  return theme === 'default' ? 'icon_svg' : 'icon_svg_dark';
}

function siteRowBrandAsset(row: SiteRow | null, assetType: BrandAssetType, theme: BrandAssetTheme): string | null {
  if (!row) return null;
  if (assetType === 'logo') return theme === 'default' ? row.logoSvg : row.logoSvgDark;
  return theme === 'default' ? row.iconSvg : row.iconSvgDark;
}

function brandAssetPaths(row: SiteRow | null, type?: BrandAssetType, theme?: BrandAssetTheme): string[] {
  const paths: string[] = [];
  if (!type || type === 'logo') {
    if (!theme || theme === 'default') {
      if (row?.logoSvg) paths.push(row.logoSvg);
      if (theme === 'default' && row?.logoSvgDark) paths.push(row.logoSvgDark);
    } else if (row?.logoSvgDark) paths.push(row.logoSvgDark);
  }
  if (!type || type === 'icon') {
    if (!theme || theme === 'default') {
      if (row?.iconSvg) paths.push(row.iconSvg);
      if (theme === 'default' && row?.iconSvgDark) paths.push(row.iconSvgDark);
      const manifest = parseManifest(row?.iconManifest ?? null);
      paths.push(...Object.values(manifest.png ?? {}));
      if (manifest.ico) paths.push(manifest.ico);
    } else if (row?.iconSvgDark) paths.push(row.iconSvgDark);
  }
  return [...new Set(paths)];
}

function isManagedBrandPath(path: string): boolean {
  return !path.startsWith('/') && !path.includes('\\') && !path.includes('\0') &&
    !path.split('/').some((part) => part === '' || part === '.' || part === '..') &&
    /^brand\/(?:logo|icon)\/(?:default|dark)\/[a-f0-9]{16}\/[a-z0-9_-]+\.(?:svg|png|ico)$/i.test(path);
}

async function mediaRootRealPath(mediaRoot: string | undefined): Promise<string> {
  if (!mediaRoot) throw new BrandAssetValidationError('Brand asset storage is unavailable.');
  const root = await realpath(mediaRoot);
  if (!(await stat(root)).isDirectory()) throw new BrandAssetValidationError('Brand asset storage is unavailable.');
  return root;
}

async function ensureMediaSubdirectory(root: string, parts: string[]): Promise<string> {
  let current = root;
  for (const part of parts) {
    current = resolve(current, part);
    try {
      const existing = await lstat(current);
      if (!existing.isDirectory() || existing.isSymbolicLink()) throw new BrandAssetValidationError('Brand asset storage path is unsafe.');
    } catch (error) {
      if (error instanceof BrandAssetValidationError) throw error;
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') await mkdir(current, { mode: 0o750 });
      else throw error;
    }
  }
  return current;
}

async function writeBrandAssetFiles(mediaRoot: string, files: Array<{ path: string; content: Buffer }>): Promise<string[]> {
  const root = await mediaRootRealPath(mediaRoot);
  const created: string[] = [];
  try {
    for (const file of files) {
      if (!isManagedBrandPath(file.path)) throw new BrandAssetValidationError('Brand asset storage path is unsafe.');
      const parts = file.path.split('/');
      const directory = await ensureMediaSubdirectory(root, parts.slice(0, -1));
      const destination = resolve(directory, parts.at(-1) ?? '');
      try {
        await writeFile(destination, file.content, { flag: 'wx', mode: 0o640 });
        created.push(file.path);
      } catch (error) {
        if (!(error instanceof Error && 'code' in error && error.code === 'EEXIST')) throw error;
        const existing = await lstat(destination);
        if (!existing.isFile() || existing.isSymbolicLink() || !(await readFile(destination)).equals(file.content)) {
          throw new BrandAssetValidationError('Brand asset storage path already contains different data.');
        }
      }
    }
    return created;
  } catch (error) {
    await removeBrandAssetFiles(root, created);
    throw error;
  }
}

async function removeBrandAssetFiles(mediaRoot: string, paths: string[]): Promise<void> {
  let root: string;
  try {
    root = await mediaRootRealPath(mediaRoot);
  } catch {
    return;
  }
  for (const path of paths) {
    if (!isManagedBrandPath(path)) continue;
    const parts = path.split('/');
    let target = resolve(root, ...parts);
    const fromRoot = relative(root, target);
    if (fromRoot === '..' || fromRoot.startsWith(`..${sep}`) || isAbsolute(fromRoot)) continue;
    try {
      const file = await lstat(target);
      if (file.isFile() && !file.isSymbolicLink()) await unlink(target);
    } catch (error) {
      if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
    }
  }
}

function validateBrandTarget(value: unknown): { assetType: BrandAssetType; theme: BrandAssetTheme } {
  const input = isRecord(value) ? value : {};
  if (input.asset_type !== 'logo' && input.asset_type !== 'icon') throw new BrandAssetValidationError('Check the brand asset type.');
  if (input.theme !== 'default' && input.theme !== 'dark') throw new BrandAssetValidationError('Check the brand asset theme.');
  return { assetType: input.asset_type, theme: input.theme };
}

async function uploadBrandAsset(
  db: PrismaClient,
  userId: number,
  canManageScripts: boolean,
  input: { assetType: BrandAssetType; theme: BrandAssetTheme; svg?: Buffer; files: Map<string, Buffer>; manifest: string; generateDerivatives?: boolean },
  options: AdminSettingsOptions,
): Promise<ApiResult<AdminSiteSettings>> {
  if (!options.mediaRoot) return { ok: false, code: 'RJ', message: 'Brand asset storage is unavailable.' };
  let svg: Buffer;
  let manifestSource: Record<string, unknown> | null = null;
  let pngContent = new Map<number, Buffer>();
  let ico: Buffer | null = null;
  try {
    svg = validateSvg(input.svg);
    if (input.theme === 'dark') {
      const current = await readSiteRow(db);
      if (!siteRowBrandAsset(current, input.assetType, 'default')) throw new BrandAssetValidationError('Upload the default asset first.');
    }
    if (input.assetType === 'icon' && input.theme === 'default') {
      if (input.generateDerivatives) {
        const generated = await generateIconDerivatives(svg).catch(() => {
          throw new BrandAssetValidationError('Could not generate icon files from the SVG.');
        });
        pngContent = generated.pngs;
        ico = generated.ico;
        manifestSource = { version: 1, pngSizes: REQUIRED_ICON_PNG_SIZES, ico: true };
      } else {
        manifestSource = parseBrandIconManifest(input.manifest);
        for (const size of REQUIRED_ICON_PNG_SIZES) pngContent.set(size, await validateBrandPng(input.files.get(`png_${size}`), size));
        ico = await validateBrandIco(input.files.get('favicon_ico'));
      }
    }
  } catch (error) {
    return { ok: false, code: 'VA', message: error instanceof Error ? error.message : 'Check the uploaded brand asset.' };
  }

  await db.$transaction((transaction) => ensureSiteSetting(transaction));
  const current = await readSiteRow(db);
  const digest = createHash('sha256');
  const hashParts = [svg, ...REQUIRED_ICON_PNG_SIZES.map((size) => pngContent.get(size)).filter((content): content is Buffer => Boolean(content)), ico ?? Buffer.alloc(0)];
  for (const part of hashParts) {
    const length = Buffer.alloc(8);
    length.writeBigUInt64BE(BigInt(part.length));
    digest.update(length).update(part);
  }
  const assetHash = digest.digest('hex').slice(0, 16);
  const base = `brand/${input.assetType}/${input.theme}/${assetHash}`;
  const files: Array<{ path: string; content: Buffer }> = [{ path: `${base}/${input.assetType}.svg`, content: svg }];
  const manifest: { version: number; hash: string; png: Record<string, string>; ico: string; source: Record<string, unknown> | null } | null =
    input.assetType === 'icon' && input.theme === 'default'
      ? { version: 1, hash: assetHash, png: {}, ico: `${base}/favicon.ico`, source: manifestSource }
      : null;
  if (manifest) {
    for (const size of REQUIRED_ICON_PNG_SIZES) {
      const path = `${base}/logo${size}.png`;
      manifest.png[String(size)] = path;
      files.push({ path, content: pngContent.get(size) as Buffer });
    }
    files.push({ path: manifest.ico, content: ico as Buffer });
  }

  let createdPaths: string[] = [];
  try {
    createdPaths = await writeBrandAssetFiles(options.mediaRoot, files);
    await db.$transaction(async (transaction) => {
      await ensureSiteSetting(transaction);
      const field = brandAssetField(input.assetType, input.theme);
      const updates: Prisma.Sql[] = [Prisma.sql`${Prisma.raw(field)} = ${files[0]?.path ?? ''}`, Prisma.sql`updated_date = ${djangoTimestamp()}`];
      if (manifest) {
        updates.push(Prisma.sql`icon_manifest = ${JSON.stringify({ ...manifest, source: manifestSource })}`);
      }
      await transaction.$executeRaw(Prisma.sql`UPDATE board_sitesetting SET ${Prisma.join(updates, ', ')} WHERE id = 1`);
      await recordAudit(transaction, userId, 'sitesetting', 'Site settings', 'Uploaded a brand asset');
    });
  } catch (error) {
    await removeBrandAssetFiles(options.mediaRoot, createdPaths);
    throw error;
  }
  const updated = await readSiteRow(db);
  const retained = new Set(brandAssetPaths(updated));
  const replaced = brandAssetPaths(current, input.assetType, input.theme).filter((path) => !retained.has(path));
  await removeBrandAssetFiles(options.mediaRoot, replaced);
  return { ok: true, body: await serializeSiteSettings(updated, canManageScripts, options) };
}

async function deleteBrandAsset(
  db: PrismaClient,
  userId: number,
  canManageScripts: boolean,
  target: { assetType: BrandAssetType; theme: BrandAssetTheme },
  options: AdminSettingsOptions,
): Promise<ApiResult<AdminSiteSettings>> {
  if (!options.mediaRoot) return { ok: false, code: 'RJ', message: 'Brand asset storage is unavailable.' };
  await db.$transaction((transaction) => ensureSiteSetting(transaction));
  const current = await readSiteRow(db);
  const oldPaths = brandAssetPaths(current, target.assetType, target.theme);
  const updates: Prisma.Sql[] = [Prisma.sql`updated_date = ${djangoTimestamp()}`];
  if (target.assetType === 'logo' && target.theme === 'default') {
    updates.push(Prisma.sql`logo_svg = ''`, Prisma.sql`logo_svg_dark = ''`);
  } else if (target.assetType === 'icon' && target.theme === 'default') {
    updates.push(Prisma.sql`icon_svg = ''`, Prisma.sql`icon_svg_dark = ''`, Prisma.sql`icon_manifest = '{}'`);
  } else {
    updates.push(Prisma.sql`${Prisma.raw(brandAssetField(target.assetType, target.theme))} = ''`);
  }
  await db.$transaction(async (transaction) => {
    await transaction.$executeRaw(Prisma.sql`UPDATE board_sitesetting SET ${Prisma.join(updates, ', ')} WHERE id = 1`);
    await recordAudit(transaction, userId, 'sitesetting', 'Site settings', 'Deleted a brand asset');
  });
  const updated = await readSiteRow(db);
  const retained = new Set(brandAssetPaths(updated));
  await removeBrandAssetFiles(options.mediaRoot, oldPaths.filter((path) => !retained.has(path)));
  return { ok: true, body: await serializeSiteSettings(updated, canManageScripts, options) };
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

async function ensureSiteSetting(db: Prisma.TransactionClient): Promise<void> {
  await db.$executeRaw`INSERT OR IGNORE INTO board_sitesetting ${SITE_DEFAULT_COLUMNS} VALUES ${SITE_DEFAULT_VALUES}`;
}

async function recordAudit(
  db: Prisma.TransactionClient,
  userId: number,
  model: 'sitesetting' | 'loginsetting' | 'integrationsetting',
  objectRepr: string,
  changeMessage: string,
): Promise<void> {
  await db.$executeRaw`INSERT OR IGNORE INTO django_content_type (app_label, model) VALUES ('board', ${model})`;
  const [contentType] = await db.$queryRaw<Array<{ id: number }>>`
    SELECT id FROM django_content_type WHERE app_label = 'board' AND model = ${model} LIMIT 1
  `;
  if (!contentType) return;
  await db.$executeRaw`
    INSERT INTO django_admin_log (object_id, object_repr, action_flag, change_message, content_type_id, user_id, action_time)
    VALUES ('1', ${objectRepr}, 2, ${changeMessage}, ${contentType.id}, ${userId}, ${djangoTimestamp()})
  `;
}

async function updateSiteSettings(
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

async function readLoginRow(db: PrismaClient): Promise<LoginRow | null> {
  const [row] = await db.$queryRaw<LoginRow[]>`
    SELECT welcome_notification_message AS welcomeMessage,
           welcome_notification_url AS welcomeUrl,
           account_deletion_redirect_url AS deletionRedirectUrl,
           hcaptcha_enabled AS hcaptchaEnabled, hcaptcha_site_key AS hcaptchaSiteKey,
           hcaptcha_secret_key AS hcaptchaSecretKey, CAST(updated_date AS TEXT) AS updatedDate
      FROM board_loginsetting WHERE id = 1 LIMIT 1
  `;
  return row ?? null;
}

async function readProviders(db: PrismaClient): Promise<ProviderRow[]> {
  return db.$queryRaw<ProviderRow[]>`
    SELECT key, client_id AS clientId, client_secret AS clientSecret, is_enabled AS isEnabled
      FROM board_socialauthprovider WHERE key IN ('google', 'github')
  `;
}

async function serializeLoginSettings(db: PrismaClient, cipherKey: string): Promise<AdminLoginSettings> {
  const [row, providerRows] = await Promise.all([readLoginRow(db), readProviders(db)]);
  const providers = new Map(providerRows.map((provider) => [provider.key, provider]));
  const encryptedCaptchaSecret = row?.hcaptchaSecretKey ?? '';
  return {
    welcomeNotificationMessage: row?.welcomeMessage ?? '',
    welcomeNotificationUrl: row?.welcomeUrl || '/',
    accountDeletionRedirectUrl: row?.deletionRedirectUrl ?? '',
    hcaptchaEnabled: row ? booleanValue(row.hcaptchaEnabled) : false,
    hcaptchaSiteKey: row?.hcaptchaSiteKey?.trim() ?? '',
    hcaptchaHasSecretKey: Boolean(encryptedCaptchaSecret && decryptDjangoSecret(encryptedCaptchaSecret, cipherKey)),
    updatedDate: isoDate(row?.updatedDate ?? null),
    socialAuthProviders: SOCIAL_PROVIDERS.map(({ key, name }) => {
      const provider = providers.get(key);
      return {
        key,
        name,
        isEnabled: provider ? booleanValue(provider.isEnabled) : false,
        clientId: provider?.clientId ?? '',
        hasClientSecret: Boolean(provider?.clientSecret),
      };
    }),
  };
}

function validateNotificationUrl(value: unknown): ApiResult<string> {
  if (typeof value !== 'string') return { ok: false, code: 'VA', message: 'Enter a valid notification URL.' };
  const normalized = value.trim();
  if ([...normalized].some((character) => character.charCodeAt(0) < 32)) {
    return { ok: false, code: 'VA', message: 'Notification URLs cannot contain control characters.' };
  }
  if (normalized.includes('\\')) return { ok: false, code: 'VA', message: 'Notification URLs cannot contain backslashes.' };
  const scheme = normalized.match(/^([A-Za-z][A-Za-z0-9+.-]*):/)?.[1]?.toLowerCase() ?? '';
  if (scheme && scheme !== 'http' && scheme !== 'https') {
    return { ok: false, code: 'VA', message: 'Notification URLs must be a relative path or an HTTP(S) URL.' };
  }
  const absolute = scheme ? normalized : normalized.startsWith('//') ? `https:${normalized}` : '';
  if (!absolute) return { ok: true, body: normalized };
  try {
    const parsed = new URL(absolute);
    if (!parsed.hostname) throw new Error('missing hostname');
    const hostname = parsed.hostname.replace(/^\[|\]$/g, '');
    if (hostname.includes(':')) return { ok: true, body: normalized };
    const ascii = domainToASCII(hostname);
    if (!ascii || !/^[A-Za-z0-9._-]+$/.test(ascii) || ascii.replaceAll('.', '').length > 0 && /^\d+$/.test(ascii.replaceAll('.', ''))) {
      throw new Error('invalid hostname');
    }
    return { ok: true, body: normalized };
  } catch {
    return { ok: false, code: 'VA', message: 'Enter a valid notification URL.' };
  }
}

function encryptSecret(value: string, cipherKey: string): string {
  if (!value) return '';
  return decryptDjangoSecret(value, cipherKey) !== null ? value : encryptDjangoSecret(value, cipherKey);
}

async function ensureLoginSetting(db: Prisma.TransactionClient): Promise<void> {
  await db.$executeRaw`
    INSERT OR IGNORE INTO board_loginsetting (
      id, welcome_notification_message, welcome_notification_url, account_deletion_redirect_url,
      hcaptcha_enabled, hcaptcha_site_key, hcaptcha_secret_key, updated_date
    ) VALUES (1, '', '/', '', 0, '', '', ${djangoTimestamp()})
  `;
}

async function updateLoginSettings(
  db: PrismaClient,
  userId: number,
  cipherKey: string,
  input: Body,
): Promise<ApiResult<AdminLoginSettings>> {
  const current = await readLoginRow(db);
  const welcomeUrl = 'welcome_notification_url' in input
    ? validateNotificationUrl(input.welcome_notification_url)
    : { ok: true as const, body: current?.welcomeUrl || '/' };
  if (!welcomeUrl.ok) return welcomeUrl;

  let hcaptchaEnabled = current ? booleanValue(current.hcaptchaEnabled) : false;
  let hcaptchaSiteKey = current?.hcaptchaSiteKey ?? '';
  let hcaptchaSecretKey = current?.hcaptchaSecretKey ?? '';
  if ('hcaptcha_enabled' in input) hcaptchaEnabled = input.hcaptcha_enabled === true;
  if (typeof input.hcaptcha_site_key === 'string') hcaptchaSiteKey = input.hcaptcha_site_key.trim();
  if (input.clear_hcaptcha_secret_key === true) hcaptchaSecretKey = '';
  if (typeof input.hcaptcha_secret_key === 'string' && input.hcaptcha_secret_key.trim()) {
    hcaptchaSecretKey = encryptSecret(input.hcaptcha_secret_key.trim(), cipherKey);
  }
  if (hcaptchaEnabled && !hcaptchaSiteKey.trim()) {
    return { ok: false, code: 'VA', message: 'Enter an hCaptcha Site Key.' };
  }
  if (hcaptchaEnabled && !decryptDjangoSecret(hcaptchaSecretKey, cipherKey)) {
    return { ok: false, code: 'VA', message: 'Enter an hCaptcha Secret Key.' };
  }

  const supportedPayload = Array.isArray(input.social_auth_providers) ? input.social_auth_providers.filter(isRecord) : null;
  try {
    await db.$transaction(async (transaction) => {
      await ensureLoginSetting(transaction);
      const updates: Prisma.Sql[] = [
        Prisma.sql`updated_date = ${djangoTimestamp()}`,
        Prisma.sql`hcaptcha_enabled = ${hcaptchaEnabled ? 1 : 0}`,
        Prisma.sql`hcaptcha_site_key = ${hcaptchaSiteKey}`,
        Prisma.sql`hcaptcha_secret_key = ${hcaptchaSecretKey}`,
      ];
      if (typeof input.welcome_notification_message === 'string') updates.push(Prisma.sql`welcome_notification_message = ${input.welcome_notification_message}`);
      if ('welcome_notification_url' in input) updates.push(Prisma.sql`welcome_notification_url = ${welcomeUrl.body}`);
      if (typeof input.account_deletion_redirect_url === 'string') updates.push(Prisma.sql`account_deletion_redirect_url = ${input.account_deletion_redirect_url}`);
      await transaction.$executeRaw(Prisma.sql`UPDATE board_loginsetting SET ${Prisma.join(updates, ', ')} WHERE id = 1`);

      if (supportedPayload !== null) {
        for (const provider of SOCIAL_PROVIDERS) {
          await transaction.$executeRaw`
            INSERT OR IGNORE INTO board_socialauthprovider (key, client_id, client_secret, is_enabled)
            VALUES (${provider.key}, '', '', 0)
          `;
        }
        for (const item of supportedPayload) {
          const key = stringValue(item.key);
          if (!SOCIAL_PROVIDERS.some((provider) => provider.key === key)) continue;
          const [existing] = await transaction.$queryRaw<ProviderRow[]>`
            SELECT key, client_id AS clientId, client_secret AS clientSecret, is_enabled AS isEnabled
              FROM board_socialauthprovider WHERE key = ${key} LIMIT 1
          `;
          if (!existing) continue;
          let clientId = existing.clientId ?? '';
          let clientSecret = existing.clientSecret ?? '';
          let isEnabled = booleanValue(existing.isEnabled);
          if ('is_enabled' in item) isEnabled = item.is_enabled === true;
          if (typeof item.client_id === 'string') clientId = item.client_id.trim();
          if (typeof item.client_secret === 'string' && item.client_secret) {
            const trimmed = item.client_secret.trim();
            clientSecret = trimmed ? encryptSecret(trimmed, cipherKey) : '';
          }
          if (item.clear_client_secret === true) clientSecret = '';
          await transaction.$executeRaw`
            UPDATE board_socialauthprovider SET is_enabled = ${isEnabled ? 1 : 0}, client_id = ${clientId}, client_secret = ${clientSecret}
             WHERE key = ${key}
          `;
        }
      }
      await recordAudit(transaction, userId, 'loginsetting', 'Login settings', 'Updated login and security settings');
    });
  } catch (error) {
    throw error;
  }
  return { ok: true, body: await serializeLoginSettings(db, cipherKey) };
}

async function ensureIntegrationSetting(db: Prisma.TransactionClient): Promise<void> {
  await db.$executeRaw`
    INSERT OR IGNORE INTO board_integrationsetting (id, telegram_enabled, telegram_bot_username, telegram_bot_token, updated_date)
    VALUES (1, 0, '', '', ${djangoTimestamp()})
  `;
}

async function readIntegrationRow(db: PrismaClient): Promise<IntegrationRow | null> {
  const [row] = await db.$queryRaw<IntegrationRow[]>`
    SELECT telegram_enabled AS telegramEnabled, telegram_bot_username AS telegramBotUsername,
      telegram_bot_token AS telegramBotToken, CAST(updated_date AS TEXT) AS updatedDate
    FROM board_integrationsetting WHERE id = 1 LIMIT 1
  `;
  return row ?? null;
}

function connection(state: string, detail = ''): AdminIntegrationSettings['telegramConnection'] {
  return { state, detail };
}

function telegramWebhookSecret(botToken: string, secretKey: string): string {
  return createHmac('sha256', secretKey).update(`telegram-webhook:${botToken}`).digest('hex');
}

async function callTelegramApi(
  options: AdminSettingsOptions,
  botToken: string,
  method: string,
  payload?: Record<string, unknown>,
): Promise<Record<string, unknown> | null> {
  const fetcher = options.fetchProvider ?? fetch;
  try {
    const response = await fetcher(`https://api.telegram.org/bot${botToken}/${method}`, {
      method: payload ? 'POST' : 'GET',
      ...(payload ? {
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      } : {}),
      signal: AbortSignal.timeout(5000),
    });
    const data: unknown = await response.json();
    return isRecord(data) ? data : null;
  } catch {
    return null;
  }
}

function telegramFailure(data: Record<string, unknown> | null): AdminIntegrationSettings['telegramConnection'] | null {
  if (!data) return connection('unreachable');
  if (data.ok === true) return null;
  const code = Number(data.error_code);
  if (code === 401 || code === 404) return connection('invalid_token');
  return connection('rejected', typeof data.description === 'string' ? data.description : '');
}

async function confirmTelegramBot(
  options: AdminSettingsOptions,
  botToken: string,
): Promise<{ failure: AdminIntegrationSettings['telegramConnection'] | null; username?: string }> {
  const result = await callTelegramApi(options, botToken, 'getMe');
  const failure = telegramFailure(result);
  if (failure) return { failure };
  const profile = isRecord(result?.result) ? result.result : {};
  const username = typeof profile.username === 'string' ? profile.username.trim().replace(/^@+/, '') : '';
  return { failure: null, ...(username ? { username } : {}) };
}

async function inspectTelegramConnection(
  options: AdminSettingsOptions,
  setting: IntegrationRow,
  webhookUrl: string,
): Promise<AdminIntegrationSettings['telegramConnection']> {
  const token = booleanValue(setting.telegramEnabled)
    ? decryptDjangoSecret(setting.telegramBotToken ?? '', options.cipherKey) ?? ''
    : '';
  if (!token) return connection('disabled');
  if (!(setting.telegramBotUsername ?? '').trim()) return connection('not_connected');
  const result = await callTelegramApi(options, token, 'getWebhookInfo');
  const failure = telegramFailure(result);
  if (failure) return failure;
  const webhook = isRecord(result?.result) ? result.result : {};
  if (webhook.url !== webhookUrl) return connection('not_connected');
  if (webhook.pending_update_count && webhook.last_error_message) {
    return connection('delivery_failed', String(webhook.last_error_message));
  }
  return connection('connected');
}

async function serializeIntegrationSettings(
  db: PrismaClient,
  options: AdminSettingsOptions,
): Promise<AdminIntegrationSettings> {
  await db.$transaction((transaction) => ensureIntegrationSetting(transaction));
  const row = await readIntegrationRow(db);
  const setting: IntegrationRow = row ?? {
    telegramEnabled: false,
    telegramBotUsername: '',
    telegramBotToken: '',
    updatedDate: '',
  };
  const webhookUrl = new URL('/v1/telegram/webHook', options.siteUrl).href;
  return {
    telegramEnabled: booleanValue(setting.telegramEnabled),
    telegramBotUsername: (setting.telegramBotUsername ?? '').trim(),
    telegramHasBotToken: Boolean(decryptDjangoSecret(setting.telegramBotToken ?? '', options.cipherKey)),
    updatedDate: isoDate(setting.updatedDate),
    telegramConnection: await inspectTelegramConnection(options, setting, webhookUrl),
  };
}

function integrationSettingsApi(settings: AdminIntegrationSettings): Record<string, unknown> {
  return {
    telegram_enabled: settings.telegramEnabled,
    telegram_bot_username: settings.telegramBotUsername,
    telegram_has_bot_token: settings.telegramHasBotToken,
    updated_date: settings.updatedDate,
    telegram_connection: settings.telegramConnection,
  };
}

function pageIntegrationPayload(body: Body): Body {
  return {
    telegram_enabled: formBoolean(body.telegram_enabled),
    telegram_bot_username: stringValue(body.telegram_bot_username),
    telegram_bot_token: stringValue(body.telegram_bot_token),
    clear_telegram_bot_token: formBoolean(body.clear_telegram_bot_token),
  };
}

async function updateIntegrationSettings(
  db: PrismaClient,
  userId: number,
  input: Body,
  options: AdminSettingsOptions,
): Promise<ApiResult<AdminIntegrationSettings>> {
  await db.$transaction((transaction) => ensureIntegrationSetting(transaction));
  const current = await readIntegrationRow(db);
  let enabled = current ? booleanValue(current.telegramEnabled) : false;
  let username = current?.telegramBotUsername ?? '';
  let tokenCiphertext = current?.telegramBotToken ?? '';
  if ('telegram_enabled' in input) enabled = input.telegram_enabled === true;
  if ('telegram_bot_username' in input) {
    username = typeof input.telegram_bot_username === 'string'
      ? input.telegram_bot_username.trim().replace(/^@+/, '')
      : '';
  }
  if (input.clear_telegram_bot_token === true) tokenCiphertext = '';
  if (typeof input.telegram_bot_token === 'string' && input.telegram_bot_token.trim()) {
    const botToken = input.telegram_bot_token.trim();
    if (!/^\d+:[A-Za-z0-9_-]+$/.test(botToken)) {
      return { ok: false, code: 'VA', message: 'Enter a valid Telegram bot token.' };
    }
    const existingToken = decryptDjangoSecret(current?.telegramBotToken ?? '', options.cipherKey) ?? '';
    const isNewToken = botToken !== existingToken;
    tokenCiphertext = encryptDjangoSecret(botToken, options.cipherKey);
    if (isNewToken && !('telegram_bot_username' in input)) username = '';
  }
  const botToken = decryptDjangoSecret(tokenCiphertext, options.cipherKey) ?? '';
  if (enabled && !botToken) return { ok: false, code: 'VA', message: 'Enter a Telegram bot token.' };

  let botFailure: AdminIntegrationSettings['telegramConnection'] | null = null;
  if (enabled) {
    const confirmed = await confirmTelegramBot(options, botToken);
    botFailure = confirmed.failure;
    if (botFailure?.state === 'invalid_token') {
      return { ok: false, code: 'VA', message: 'Telegram rejected this bot token. Check the token and try again.' };
    }
    if (!botFailure && confirmed.username) username = confirmed.username;
  }

  const timestamp = djangoTimestamp();
  await db.$transaction(async (transaction) => {
    await ensureIntegrationSetting(transaction);
    await transaction.$executeRaw`
      UPDATE board_integrationsetting SET telegram_enabled = ${enabled ? 1 : 0},
        telegram_bot_username = ${username}, telegram_bot_token = ${tokenCiphertext}, updated_date = ${timestamp}
      WHERE id = 1
    `;
    await recordAudit(transaction, userId, 'integrationsetting', 'Integration settings', 'Updated notification integration settings');
  });

  let connectionResult: AdminIntegrationSettings['telegramConnection'];
  if (!enabled) connectionResult = connection('disabled');
  else if (botFailure) connectionResult = botFailure;
  else {
    const webhookUrl = new URL('/v1/telegram/webHook', options.siteUrl).href;
    const registered = await callTelegramApi(options, botToken, 'setWebhook', {
      url: webhookUrl,
      secret_token: telegramWebhookSecret(botToken, options.secretKey),
      allowed_updates: ['message'],
    });
    connectionResult = telegramFailure(registered) ?? connection('connected');
  }
  return {
    ok: true,
    body: {
      telegramEnabled: enabled,
      telegramBotUsername: username.trim(),
      telegramHasBotToken: Boolean(botToken),
      updatedDate: isoDate(timestamp),
      telegramConnection: connectionResult,
    },
  };
}

function apiSitePayload(input: Body): Body {
  return input;
}

function pageSitePayload(body: Body, onlyName: boolean): Body {
  const result: Body = {};
  if ('site_name' in body) result.site_name = stringValue(body.site_name);
  if (!onlyName) {
    result.seo_enabled = formBoolean(body.seo_enabled);
    result.aeo_enabled = formBoolean(body.aeo_enabled);
    result.robots_txt_extra_rules = stringValue(body.robots_txt_extra_rules);
  }
  if ('header_script' in body) result.header_script = stringValue(body.header_script);
  if ('footer_script' in body) result.footer_script = stringValue(body.footer_script);
  return result;
}

function pageLoginPayload(body: Body): Body {
  const providers = SOCIAL_PROVIDERS.map(({ key }) => ({
    key,
    is_enabled: formBoolean(body[`provider_${key}_enabled`]),
    client_id: stringValue(body[`provider_${key}_client_id`]),
    client_secret: stringValue(body[`provider_${key}_client_secret`]),
    clear_client_secret: formBoolean(body[`provider_${key}_clear_secret`]),
  }));
  return {
    welcome_notification_message: stringValue(body.welcome_notification_message),
    welcome_notification_url: stringValue(body.welcome_notification_url),
    account_deletion_redirect_url: stringValue(body.account_deletion_redirect_url),
    hcaptcha_enabled: formBoolean(body.hcaptcha_enabled),
    hcaptcha_site_key: stringValue(body.hcaptcha_site_key),
    hcaptcha_secret_key: stringValue(body.hcaptcha_secret_key),
    clear_hcaptcha_secret_key: formBoolean(body.clear_hcaptcha_secret_key),
    social_auth_providers: providers,
  };
}

async function pageSiteSettings(
  request: FastifyRequest,
  reply: FastifyReply,
  db: PrismaClient,
  options: AdminSettingsOptions,
  user: AdminSettingsUser,
  access: UserAccess,
  error?: string,
) {
  const capabilities = adminSettingsCapabilities(access);
  const settings = await serializeSiteSettings(await readSiteRow(db), access.superuser, options);
  return reply.type('text/html; charset=utf-8').send(renderAdminSiteSettings({
    user, capabilities, settings, csrfToken: csrfToken(request),
    brandAssetsEnabled: Boolean(options.mediaRoot),
    saved: !error && pageNumber(request).get('saved') === '1', error,
  }));
}

async function pageSeoSettings(
  request: FastifyRequest,
  reply: FastifyReply,
  db: PrismaClient,
  options: AdminSettingsOptions,
  user: AdminSettingsUser,
  access: UserAccess,
  error?: string,
) {
  const capabilities = adminSettingsCapabilities(access);
  const settings = await serializeSiteSettings(await readSiteRow(db), access.superuser, options);
  return reply.type('text/html; charset=utf-8').send(renderAdminSeoSettings({
    user, capabilities, settings, csrfToken: csrfToken(request),
    saved: !error && pageNumber(request).get('saved') === '1', error,
  }));
}

async function pageLoginSettings(
  request: FastifyRequest,
  reply: FastifyReply,
  db: PrismaClient,
  options: AdminSettingsOptions,
  user: AdminSettingsUser,
  access: UserAccess,
  error?: string,
) {
  const capabilities = adminSettingsCapabilities(access);
  const settings = await serializeLoginSettings(db, options.cipherKey);
  return reply.type('text/html; charset=utf-8').send(renderAdminLoginSettings({
    user, capabilities, settings, csrfToken: csrfToken(request),
    saved: !error && pageNumber(request).get('saved') === '1', error,
  }));
}

async function pageIntegrationSettings(
  request: FastifyRequest,
  reply: FastifyReply,
  db: PrismaClient,
  options: AdminSettingsOptions,
  user: AdminSettingsUser,
  access: UserAccess,
  error?: string,
) {
  const settings = await serializeIntegrationSettings(db, options);
  return reply.type('text/html; charset=utf-8').send(renderAdminIntegrationSettings({
    user,
    capabilities: adminSettingsCapabilities(access),
    settings,
    csrfToken: csrfToken(request),
    saved: !error && pageNumber(request).get('saved') === '1',
    error,
  }));
}

function csrfValid(request: FastifyRequest, options: AdminSettingsOptions): boolean {
  try {
    return options.validateCsrf(request);
  } catch {
    return false;
  }
}

function csrfValidWithBody(request: FastifyRequest, options: AdminSettingsOptions, body: unknown): boolean {
  try {
    const requestWithBody = Object.create(request) as FastifyRequest;
    Object.defineProperty(requestWithBody, 'body', { value: body, enumerable: true });
    return options.validateCsrf(requestWithBody);
  } catch {
    return false;
  }
}

async function readMultipartFields(request: FastifyRequest): Promise<{ fields: Body; files: Map<string, Buffer> }> {
  const fields: Body = {};
  const files = new Map<string, Buffer>();
  for await (const part of request.parts()) {
    if (part.type === 'file') {
      files.set(part.fieldname, await part.toBuffer());
    } else {
      fields[part.fieldname] = part.value;
    }
  }
  return { fields, files };
}

async function apiAccess(
  request: FastifyRequest,
  db: PrismaClient,
  options: AdminSettingsOptions,
): Promise<{ user: AdminSettingsUser; access: UserAccess } | { response: ReturnType<typeof failure> }> {
  const user = await options.currentUser(request);
  if (!user) return { response: failure('NL') };
  const access = await readAdminAccess(db, user.id);
  if (!access?.active) return { response: failure('NL') };
  if (!access.staff) return { response: failure('RJ', 'Administrator access is required.') };
  return { user, access };
}

async function editorApiAccess(
  request: FastifyRequest,
  db: PrismaClient,
  options: AdminSettingsOptions,
): Promise<{ user: AdminSettingsUser; access: UserAccess } | { response: ReturnType<typeof failure> }> {
  const user = await options.currentUser(request);
  if (!user) return { response: failure('NL') };
  const access = await readAdminAccess(db, user.id);
  if (!access?.active) return { response: failure('NL') };
  const [profile] = await db.$queryRaw<Array<{ role: string }>>`
    SELECT role FROM board_profile WHERE user_id = ${user.id} LIMIT 1
  `;
  if (profile?.role !== 'EDITOR') {
    return { response: failure('RJ', 'Author access is required.') };
  }
  return { user, access };
}

function sendApiResult<T>(reply: FastifyReply, result: ApiResult<T>) {
  return reply.send(result.ok ? success(result.body) : failure(result.code, result.message));
}

async function readInvites(db: PrismaClient): Promise<AdminInvite[]> {
  const rows = await db.$queryRaw<InviteRow[]>`
    SELECT invite.id, invite.code, invite.note, invite.is_active AS isActive,
           creator.username AS createdBy, claimer.username AS claimedBy,
           CAST(invite.created_date AS TEXT) AS createdDate,
           CAST(invite.claimed_date AS TEXT) AS claimedDate, invite.claimed_by_id AS claimedById
      FROM board_authorinvite AS invite
      LEFT JOIN auth_user AS creator ON creator.id = invite.created_by_id
      LEFT JOIN auth_user AS claimer ON claimer.id = invite.claimed_by_id
     ORDER BY invite.created_date DESC LIMIT 20
  `;
  return rows.map((row) => ({
    id: row.id,
    code: row.code,
    note: row.note,
    signupUrl: `/sign?invite=${row.code}`,
    isActive: booleanValue(row.isActive),
    isClaimed: row.claimedById !== null,
    createdBy: row.createdBy ?? '',
    claimedBy: row.claimedBy ?? '',
    createdDate: row.createdDate ? isoDate(row.createdDate) : null,
    claimedDate: row.claimedDate ? isoDate(row.claimedDate) : null,
  }));
}

function safeNavigationUrl(value: unknown): string {
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

async function readStaticPages(db: PrismaClient): Promise<AdminStaticPage[]> {
  const rows = await db.$queryRaw<StaticPageRow[]>`
    SELECT id, title, slug, content, meta_description AS metaDescription,
           is_published AS isPublished, show_in_footer AS showInFooter, "order",
           CAST(created_date AS TEXT) AS createdDate, CAST(updated_date AS TEXT) AS updatedDate
      FROM board_staticpage ORDER BY "order" ASC, created_date DESC
  `;
  return rows.map(serializeStaticPage);
}

async function readStaticPage(db: PrismaClient, id: number): Promise<AdminStaticPage | null> {
  const [row] = await db.$queryRaw<StaticPageRow[]>`
    SELECT id, title, slug, content, meta_description AS metaDescription,
           is_published AS isPublished, show_in_footer AS showInFooter, "order",
           CAST(created_date AS TEXT) AS createdDate, CAST(updated_date AS TEXT) AS updatedDate
      FROM board_staticpage WHERE id = ${id} LIMIT 1
  `;
  return row ? serializeStaticPage(row) : null;
}

function staticPagePayload(body: Body, form = false): Body {
  const payload: Body = {};
  for (const field of ['title', 'slug', 'content', 'meta_description'] as const) {
    if (field in body) payload[field] = stringValue(body[field]);
  }
  for (const field of ['is_published', 'show_in_footer'] as const) {
    if (field in body || form) payload[field] = form ? formBoolean(body[field]) : body[field] === true;
  }
  if ('order' in body || form) {
    const value = form ? stringValue(body.order) : body.order;
    const parsed = typeof value === 'number' ? value : /^-?\d+$/.test(String(value)) ? Number(value) : NaN;
    payload.order = Number.isSafeInteger(parsed) ? parsed : 0;
  }
  return payload;
}

async function saveStaticPage(
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

function serializeNotice(row: NoticeRow): AdminNotice {
  return {
    id: row.id,
    title: row.title,
    url: safeNavigationUrl(row.url),
    isActive: booleanValue(row.isActive),
    createdDate: isoDate(row.createdDate),
    updatedDate: isoDate(row.updatedDate),
  };
}

async function readNotices(
  db: PrismaClient,
  scope: 'global' | 'user' = 'global',
  ownerId: number | null = null,
): Promise<AdminNotice[]> {
  const rows = await db.$queryRaw<NoticeRow[]>`
    SELECT id, title, url, is_active AS isActive,
           CAST(created_date AS TEXT) AS createdDate, CAST(updated_date AS TEXT) AS updatedDate
      FROM board_sitenotice
     WHERE scope = ${scope} AND (${scope} = 'global' OR user_id = ${ownerId ?? 0})
     ORDER BY created_date DESC
  `;
  return rows.map(serializeNotice);
}

async function readNotice(
  db: PrismaClient,
  id: number,
  scope: 'global' | 'user' = 'global',
  ownerId: number | null = null,
): Promise<AdminNotice | null> {
  const [row] = await db.$queryRaw<NoticeRow[]>`
    SELECT id, title, url, is_active AS isActive,
           CAST(created_date AS TEXT) AS createdDate, CAST(updated_date AS TEXT) AS updatedDate
      FROM board_sitenotice
     WHERE scope = ${scope} AND (${scope} = 'global' OR user_id = ${ownerId ?? 0})
       AND id = ${id} LIMIT 1
  `;
  return row ? serializeNotice(row) : null;
}

function noticePayload(body: Body, form = false): Body {
  const result: Body = {};
  for (const field of ['title', 'url'] as const) if (field in body) result[field] = stringValue(body[field]);
  if ('is_active' in body || form) result.is_active = form ? formBoolean(body.is_active) : body.is_active === true;
  return result;
}

async function saveNotice(
  db: PrismaClient,
  input: Body,
  id?: number,
  scope: 'global' | 'user' = 'global',
  ownerId: number | null = null,
): Promise<ApiResult<AdminNotice>> {
  if (id === undefined && !stringValue(input.title)) return { ok: false, code: 'VA', message: 'Enter a notice title.' };
  if (id === undefined && !stringValue(input.url)) return { ok: false, code: 'VA', message: 'Enter a URL.' };
  if (scope === 'user' && ownerId === null) return { ok: false, code: 'RJ', message: 'Author access is required.' };
  const timestamp = djangoTimestamp();
  if (id === undefined) {
    const createdId = await db.$transaction(async (transaction) => {
      await transaction.$executeRaw`
        INSERT INTO board_sitenotice (scope, user_id, title, is_active, "order", created_date, updated_date, url)
        VALUES (${scope}, ${scope === 'user' ? ownerId : null}, ${stringValue(input.title)},
                ${input.is_active === false ? 0 : 1}, 0, ${timestamp}, ${timestamp}, ${stringValue(input.url)})
      `;
      const [created] = await transaction.$queryRaw<Array<{ id: number }>>`SELECT last_insert_rowid() AS id`;
      return Number(created?.id ?? 0);
    });
    const notice = await readNotice(db, createdId, scope, ownerId);
    return notice ? { ok: true, body: notice } : { ok: false, code: 'NF', message: 'Notice not found.' };
  }
  const updates: Prisma.Sql[] = [Prisma.sql`updated_date = ${timestamp}`];
  if ('title' in input) updates.push(Prisma.sql`title = ${stringValue(input.title)}`);
  if ('url' in input) updates.push(Prisma.sql`url = ${stringValue(input.url)}`);
  if ('is_active' in input) updates.push(Prisma.sql`is_active = ${input.is_active === true ? 1 : 0}`);
  const changed = await db.$executeRaw(Prisma.sql`
    UPDATE board_sitenotice SET ${Prisma.join(updates, ', ')}
    WHERE scope = ${scope} AND (${scope} = 'global' OR user_id = ${ownerId ?? 0}) AND id = ${id}
  `);
  if (changed === 0) return { ok: false, code: 'NF', message: 'Notice not found.' };
  const notice = await readNotice(db, id, scope, ownerId);
  return notice ? { ok: true, body: notice } : { ok: false, code: 'NF', message: 'Notice not found.' };
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

async function readBanners(
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

async function readBanner(
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

function positiveInteger(value: string | null, fallback: number): number {
  if (!value || !/^\d+$/.test(value)) return fallback;
  const number = Number(value);
  return Number.isSafeInteger(number) ? number : fallback;
}

function userListQuery(request: FastifyRequest): URLSearchParams {
  return new URL(request.url, 'https://blex.invalid').searchParams;
}

function managedUserWhere(query: string, role: string): Prisma.Sql[] {
  const where: Prisma.Sql[] = [];
  if (query) {
    where.push(Prisma.sql`(
      instr(lower(user.username), lower(${query})) > 0 OR
      instr(lower(user.email), lower(${query})) > 0 OR
      instr(lower(user.first_name), lower(${query})) > 0
    )`);
  }
  if (role === 'reader') where.push(Prisma.sql`profile.role = 'READER'`);
  else if (role === 'editor') where.push(Prisma.sql`profile.role = 'EDITOR'`);
  else if (role === 'admin') where.push(Prisma.sql`(user.is_staff = 1 OR user.is_superuser = 1)`);
  return where;
}

function userRoleFilter(value: string | null): string {
  const role = value?.toLowerCase() ?? 'all';
  return ['all', 'reader', 'editor', 'admin'].includes(role) ? role : 'all';
}

function userOrdering(value: string | null): Prisma.Sql {
  switch (value) {
    case '-username': return Prisma.sql`user.username DESC, user.username ASC`;
    case 'post_count': return Prisma.sql`postCount ASC, user.username ASC`;
    case '-post_count': return Prisma.sql`postCount DESC, user.username ASC`;
    case 'date_joined': return Prisma.sql`user.date_joined ASC, user.username ASC`;
    case '-date_joined': return Prisma.sql`user.date_joined DESC, user.username ASC`;
    default: return Prisma.sql`user.username ASC`;
  }
}

async function readManagedUsers(db: PrismaClient, request: FastifyRequest): Promise<AdminUserList> {
  const params = userListQuery(request);
  const query = (params.get('q') ?? '').trim();
  const role = userRoleFilter(params.get('role'));
  const where = managedUserWhere(query, role);
  const clause = where.length ? Prisma.sql`WHERE ${Prisma.join(where, ' AND ')}` : Prisma.empty;
  const [counts] = await db.$queryRaw<Array<{ total: number | bigint; editors: number | bigint; readers: number | bigint; admins: number | bigint }>>(Prisma.sql`
    SELECT COUNT(*) AS total,
      SUM(CASE WHEN profile.role = 'EDITOR' THEN 1 ELSE 0 END) AS editors,
      SUM(CASE WHEN profile.role = 'READER' THEN 1 ELSE 0 END) AS readers,
      SUM(CASE WHEN user.is_staff = 1 OR user.is_superuser = 1 THEN 1 ELSE 0 END) AS admins
    FROM auth_user AS user LEFT JOIN board_profile AS profile ON profile.user_id = user.id
    ${clause}
  `);
  const total = Number(counts?.total ?? 0);
  const pageSizeValue = positiveInteger(params.get('page_size'), 20);
  const pageSize = pageSizeValue < 1 ? 20 : Math.min(pageSizeValue, 100);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const requestedPage = positiveInteger(params.get('page'), 1);
  const page = Math.min(Math.max(requestedPage, 1), totalPages);
  const ordering = userOrdering(params.get('ordering'));
  const rows = await db.$queryRaw<ManagedUserRow[]>(Prisma.sql`
    SELECT user.id, user.username, user.first_name AS name, user.email,
      user.is_active AS isActive, user.is_staff AS isStaff, user.is_superuser AS isSuperuser,
      profile.role AS role,
      (SELECT COUNT(*) FROM board_post AS post WHERE post.author_id = user.id AND post.deleted_date IS NULL) AS postCount,
      CAST(user.date_joined AS TEXT) AS dateJoined, CAST(user.last_login AS TEXT) AS lastLogin
    FROM auth_user AS user LEFT JOIN board_profile AS profile ON profile.user_id = user.id
    ${clause}
    ORDER BY ${ordering}
    LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}
  `);
  return {
    users: rows.map((row) => ({
      id: Number(row.id),
      username: row.username,
      name: row.name,
      email: row.email,
      role: row.role === 'EDITOR' ? 'EDITOR' : 'READER',
      isActive: booleanValue(row.isActive),
      isStaff: booleanValue(row.isStaff),
      isSuperuser: booleanValue(row.isSuperuser),
      canChangeRole: booleanValue(row.isActive) && !booleanValue(row.isStaff) && !booleanValue(row.isSuperuser),
      postCount: Number(row.postCount),
      dateJoined: row.dateJoined ? isoDate(row.dateJoined) : null,
      lastLogin: row.lastLogin ? isoDate(row.lastLogin) : null,
    })),
    pagination: {
      page,
      pageSize,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrevious: page > 1,
    },
    stats: {
      total,
      editors: Number(counts?.editors ?? 0),
      readers: Number(counts?.readers ?? 0),
      admins: Number(counts?.admins ?? 0),
    },
  };
}

function managedUserApi(user: AdminManagedUser): Record<string, unknown> {
  return {
    id: user.id,
    username: user.username,
    name: user.name,
    email: user.email,
    role: user.role,
    is_active: user.isActive,
    is_staff: user.isStaff,
    is_superuser: user.isSuperuser,
    can_change_role: user.canChangeRole,
    post_count: user.postCount,
    date_joined: user.dateJoined,
    last_login: user.lastLogin,
  };
}

function managedUserListApi(list: AdminUserList): Record<string, unknown> {
  return {
    users: list.users.map(managedUserApi),
    pagination: {
      page: list.pagination.page,
      page_size: list.pagination.pageSize,
      total: list.pagination.total,
      total_pages: list.pagination.totalPages,
      has_next: list.pagination.hasNext,
      has_previous: list.pagination.hasPrevious,
    },
    stats: list.stats,
  };
}

function staticPageApi(page: AdminStaticPage): Record<string, unknown> {
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

function noticeApi(notice: AdminNotice): Record<string, unknown> {
  return {
    id: notice.id,
    title: notice.title,
    url: notice.url,
    is_active: notice.isActive,
    created_date: notice.createdDate,
    updated_date: notice.updatedDate,
  };
}

function bannerApi(banner: AdminBanner, includeCreatedBy = true): Record<string, unknown> {
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

async function updateManagedUserRole(
  db: PrismaClient,
  actorId: number,
  targetId: number,
  roleValue: unknown,
): Promise<ApiResult<AdminManagedUser>> {
  if (roleValue !== 'READER' && roleValue !== 'EDITOR') {
    return { ok: false, code: 'RJ', message: 'This role is not supported.' };
  }
  return db.$transaction(async (transaction) => {
    const [target] = await transaction.$queryRaw<Array<{
      id: number;
      username: string;
      name: string;
      email: string;
      isActive: number | bigint | boolean;
      isStaff: number | bigint | boolean;
      isSuperuser: number | bigint | boolean;
      dateJoined: string | null;
      lastLogin: string | null;
    }>>`
      SELECT id, username, first_name AS name, email, is_active AS isActive,
        is_staff AS isStaff, is_superuser AS isSuperuser,
        CAST(date_joined AS TEXT) AS dateJoined, CAST(last_login AS TEXT) AS lastLogin
      FROM auth_user WHERE id = ${targetId} LIMIT 1
    `;
    if (!target) return { ok: false, code: 'NF', message: 'User not found.' };
    if (target.id === actorId) return { ok: false, code: 'RJ', message: 'You cannot change your own role.' };
    if (booleanValue(target.isStaff) || booleanValue(target.isSuperuser)) {
      return { ok: false, code: 'RJ', message: 'Administrator roles cannot be changed from this page.' };
    }
    const [profile] = await transaction.$queryRaw<Array<{ id: number; role: string }>>`
      SELECT id, role FROM board_profile WHERE user_id = ${targetId} LIMIT 1
    `;
    if (profile) {
      await transaction.$executeRaw`UPDATE board_profile SET role = ${roleValue} WHERE id = ${profile.id}`;
      if (profile.role === 'EDITOR' && roleValue === 'READER') {
        const timestamp = djangoTimestamp();
        await transaction.$executeRaw`
          UPDATE board_post SET published_date = NULL, updated_date = ${timestamp}
          WHERE author_id = ${targetId} AND published_date > ${timestamp}
        `;
      }
    } else {
      await transaction.$executeRaw`INSERT INTO board_profile (user_id, role) VALUES (${targetId}, ${roleValue})`;
    }
    await transaction.$executeRaw`
      INSERT INTO board_config (user_id, language, time_zone) VALUES (${targetId}, NULL, '')
      ON CONFLICT(user_id) DO NOTHING
    `;
    const [postCount] = await transaction.$queryRaw<Array<{ postCount: number | bigint }>>`
      SELECT COUNT(*) AS postCount FROM board_post WHERE author_id = ${targetId}
    `;
    const user: AdminManagedUser = {
      id: Number(target.id),
      username: target.username,
      name: target.name,
      email: target.email,
      role: roleValue,
      isActive: booleanValue(target.isActive),
      isStaff: booleanValue(target.isStaff),
      isSuperuser: booleanValue(target.isSuperuser),
      canChangeRole: booleanValue(target.isActive),
      postCount: Number(postCount?.postCount ?? 0),
      dateJoined: target.dateJoined ? isoDate(target.dateJoined) : null,
      lastLogin: target.lastLogin ? isoDate(target.lastLogin) : null,
    };
    return { ok: true, body: user };
  });
}

function bannerPayload(body: Body, form = false): Body {
  const result: Body = {};
  for (const field of ['title', 'content_html', 'banner_type', 'position'] as const) {
    if (field in body) result[field] = stringValue(body[field]);
  }
  if ('is_active' in body || form) result.is_active = form ? formBoolean(body.is_active) : body.is_active === true;
  if ('order' in body || form) {
    const raw = form ? stringValue(body.order) : body.order;
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

async function saveBanner(
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

async function createInvite(db: PrismaClient, userId: number, noteInput: unknown): Promise<AdminInvite> {
  const note = typeof noteInput === 'string' ? noteInput.trim().slice(0, 120) : '';
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const code = randomBytes(12).toString('base64url');
    try {
      const id = await db.$transaction(async (transaction) => {
        await transaction.$executeRaw`
          INSERT INTO board_authorinvite (code, note, is_active, created_date, claimed_date, claimed_by_id, created_by_id)
          VALUES (${code}, ${note}, 1, ${djangoTimestamp()}, NULL, NULL, ${userId})
        `;
        const [row] = await transaction.$queryRaw<Array<{ id: number }>>`SELECT last_insert_rowid() AS id`;
        return Number(row?.id ?? 0);
      });
      const [creator] = await db.$queryRaw<Array<{ username: string }>>`SELECT username FROM auth_user WHERE id = ${userId} LIMIT 1`;
      return {
        id,
        code,
        note,
        signupUrl: `/sign?invite=${code}`,
        isActive: true,
        isClaimed: false,
        createdBy: creator?.username ?? '',
        claimedBy: '',
        createdDate: isoDate(djangoTimestamp()),
        claimedDate: null,
      };
    } catch (error) {
      if (attempt === 2) throw error;
    }
  }
  throw new Error('Could not create an invitation link.');
}

async function deleteInvite(db: PrismaClient, inviteId: number): Promise<'deleted' | 'claimed' | 'missing'> {
  return db.$transaction(async (transaction) => {
    const deleted = await transaction.$executeRaw`
      DELETE FROM board_authorinvite WHERE id = ${inviteId} AND claimed_by_id IS NULL
    `;
    if (deleted > 0) return 'deleted';
    const [row] = await transaction.$queryRaw<Array<{ claimedById: number | null }>>`
      SELECT claimed_by_id AS claimedById FROM board_authorinvite WHERE id = ${inviteId} LIMIT 1
    `;
    if (!row) return 'missing';
    return row.claimedById === null ? 'missing' : 'claimed';
  });
}

type UtilityAction = 'clean_tags' | 'clean_sessions' | 'clean_logs' | 'clean_images';
type UtilityParameters = Record<string, unknown>;

interface UtilityConfirmationPayload {
  userId: number;
  sessionFingerprint: string;
  action: UtilityAction;
  parameters: UtilityParameters;
  nonce: string;
  issuedAt: number;
}

function utilitySessionFingerprint(request: FastifyRequest): string {
  const cookieHeader = request.headers.cookie ?? '';
  let sessionToken = '';
  for (const part of cookieHeader.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0 || part.slice(0, separator).trim() !== 'blexsessionid') continue;
    try {
      sessionToken = decodeURIComponent(part.slice(separator + 1).trim());
    } catch {
      sessionToken = '';
    }
    break;
  }
  return typeof sessionToken === 'string' && sessionToken
    ? createHash('sha256').update(sessionToken).digest('hex')
    : '';
}

function utilityParameters(action: UtilityAction, body: Body): UtilityParameters {
  if (action === 'clean_sessions') return { cleanAll: body.clean_all === true };
  if (action === 'clean_images') {
    const target = body.target ?? 'all';
    if (typeof target !== 'string' || !['all', 'content', 'title', 'avatar'].includes(target)) {
      throw new Error('Select a valid cleanup target.');
    }
    return { target, removeDuplicates: body.remove_duplicates === true };
  }
  return {};
}

function utilityTokenSignature(value: string, secretKey: string): Buffer {
  return createHmac('sha256', secretKey).update('blex.utility-cleanup\0').update(value).digest();
}

async function issueUtilityConfirmation(
  db: PrismaClient,
  userId: number,
  sessionFingerprint: string,
  action: UtilityAction,
  parameters: UtilityParameters,
  secretKey: string,
): Promise<string> {
  const payload: UtilityConfirmationPayload = {
    userId,
    sessionFingerprint,
    action,
    parameters,
    nonce: randomBytes(16).toString('base64url'),
    issuedAt: Date.now(),
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = utilityTokenSignature(encodedPayload, secretKey).toString('base64url');
  const token = `${encodedPayload}.${signature}`;
  const now = djangoTimestamp();
  const expiresAt = djangoTimestamp(new Date(Date.now() + 5 * 60 * 1000));
  const tokenHash = createHash('sha256').update(token).digest('hex');
  await db.$transaction(async (transaction) => {
    await transaction.$executeRaw`DELETE FROM board_utilitycleanupconfirmation WHERE expires_at <= ${now}`;
    await transaction.$executeRaw`
      INSERT INTO board_utilitycleanupconfirmation
        (token_hash, action, session_fingerprint, expires_at, consumed_at, created_date, user_id)
      VALUES (${tokenHash}, ${action}, ${sessionFingerprint}, ${expiresAt}, NULL, ${now}, ${userId})
    `;
  });
  return token;
}

async function consumeUtilityConfirmation(
  transaction: Prisma.TransactionClient,
  tokenValue: unknown,
  userId: number,
  sessionFingerprint: string,
  action: UtilityAction,
  parameters: UtilityParameters,
  secretKey: string,
): Promise<void> {
  if (typeof tokenValue !== 'string') throw new Error('invalid utility confirmation');
  const parts = tokenValue.split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) throw new Error('invalid utility confirmation');
  let payload: unknown;
  let receivedSignature: Buffer;
  try {
    payload = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8')) as unknown;
    receivedSignature = Buffer.from(parts[1], 'base64url');
  } catch {
    throw new Error('invalid utility confirmation');
  }
  const expectedSignature = utilityTokenSignature(parts[0], secretKey);
  if (receivedSignature.length !== expectedSignature.length || !timingSafeEqual(receivedSignature, expectedSignature)) {
    throw new Error('invalid utility confirmation');
  }
  if (!isRecord(payload)
      || payload.userId !== userId
      || payload.sessionFingerprint !== sessionFingerprint
      || payload.action !== action
      || !isRecord(payload.parameters)
      || JSON.stringify(payload.parameters) !== JSON.stringify(parameters)
      || typeof payload.issuedAt !== 'number'
      || payload.issuedAt > Date.now()
      || Date.now() - payload.issuedAt > 5 * 60 * 1000
      || typeof payload.nonce !== 'string'
      || !payload.nonce) {
    throw new Error('invalid utility confirmation');
  }
  const tokenHash = createHash('sha256').update(tokenValue).digest('hex');
  const now = djangoTimestamp();
  const consumed = await transaction.$executeRaw`
    UPDATE board_utilitycleanupconfirmation SET consumed_at = ${now}
    WHERE token_hash = ${tokenHash} AND user_id = ${userId} AND action = ${action}
      AND session_fingerprint = ${sessionFingerprint} AND expires_at > ${now} AND consumed_at IS NULL
  `;
  if (consumed !== 1) throw new Error('invalid utility confirmation');
}

function retentionDays(name: string, defaultValue: number): number {
  const configured = Number(process.env[name]);
  return Number.isSafeInteger(configured) && configured > 0 ? configured : defaultValue;
}

async function readUtilityStats(db: PrismaClient): Promise<Record<string, unknown>> {
  const now = djangoTimestamp();
  const epoch = BigInt(Date.now());
  const [stats] = await db.$queryRaw<Array<Record<string, number | bigint>>>(Prisma.sql`
    SELECT
      (SELECT COUNT(*) FROM board_post) AS total_posts,
      COALESCE(SUM(CASE WHEN post.deleted_date IS NULL AND post.published_date IS NOT NULL AND post.published_date <= ${now} AND config.hide = 0 THEN 1 ELSE 0 END), 0) AS public_posts,
      COALESCE(SUM(CASE WHEN post.deleted_date IS NULL AND post.published_date IS NOT NULL AND post.published_date <= ${now} THEN 1 ELSE 0 END), 0) AS published_posts,
      COALESCE(SUM(CASE WHEN post.deleted_date IS NULL AND post.published_date > ${now} THEN 1 ELSE 0 END), 0) AS scheduled_posts,
      COALESCE(SUM(CASE WHEN config.hide = 1 THEN 1 ELSE 0 END), 0) AS hidden_posts,
      COALESCE(SUM(CASE WHEN post.deleted_date IS NULL AND post.published_date IS NULL THEN 1 ELSE 0 END), 0) AS draft_posts,
      (SELECT COUNT(*) FROM board_comment) AS total_comments,
      (SELECT COUNT(*) FROM auth_user) AS total_users,
      (SELECT COUNT(*) FROM board_profile) AS active_profiles,
      (SELECT COUNT(*) FROM board_series) AS total_series,
      (SELECT COUNT(*) FROM board_imagecache) AS image_cache_count,
      (SELECT COUNT(*) FROM blex_session) AS total_sessions,
      (SELECT COUNT(*) FROM blex_session WHERE expires_at < ${epoch}) AS expired_sessions
    FROM board_post AS post LEFT JOIN board_postconfig AS config ON config.post_id = post.id
  `);
  const [logs] = await db.$queryRaw<Array<{ logCount: number | bigint; developerRequestLogCount: number | bigint }>>`
    SELECT (SELECT COUNT(*) FROM django_admin_log) AS logCount,
      (SELECT COUNT(*) FROM board_developerrequestlog) AS developerRequestLogCount
  `;
  let dbSize = 'N/A';
  try {
    const [pageCount] = await db.$queryRaw<Array<{ page_count: number | bigint }>>`PRAGMA page_count`;
    const [pageSize] = await db.$queryRaw<Array<{ page_size: number | bigint }>>`PRAGMA page_size`;
    if (pageCount && pageSize) dbSize = `${Math.round(Number(pageCount.page_count) * Number(pageSize.page_size) / 1024 / 1024 * 100) / 100} MB`;
  } catch {
    // Some SQLite adapters disallow PRAGMA through prepared statements.
  }
  return {
    ...Object.fromEntries(Object.entries(stats ?? {}).map(([key, value]) => [key, Number(value)])),
    log_count: Number(logs?.logCount ?? 0),
    developer_request_log_count: Number(logs?.developerRequestLogCount ?? 0),
    db_size: dbSize,
  };
}

type ImageCleanupTarget = 'all' | 'content' | 'title' | 'avatar';

interface ImageCleanupFile {
  category: 'content' | 'title' | 'avatar';
  path: string;
  relativePath: string;
  filename: string;
  size: number;
  sizeKb: number;
  mtimeMs: number;
  inode: number;
  contentHash: string;
  isUsed: boolean;
}

interface ImageCleanupPlan {
  target: ImageCleanupTarget;
  removeDuplicates: boolean;
  unusedFiles: ImageCleanupFile[];
  duplicateFiles: Array<{ duplicate: ImageCleanupFile; original: ImageCleanupFile }>;
  cacheRows: Array<{ id: number; path: string }>;
  previewHash: string;
  totalSize: number;
  duplicateSize: number;
}

function cleanLegacyImageName(filename: string): string {
  let cleaned = filename;
  if (cleaned.includes('.preview')) cleaned = cleaned.split('.preview')[0] ?? cleaned;
  if (cleaned.includes('.minify')) cleaned = cleaned.split('.minify')[0] ?? cleaned;
  return cleaned;
}

function filenameFromStoredPath(value: string): string {
  const part = value.replaceAll('\\', '/').split('/').at(-1) ?? '';
  try {
    return decodeURIComponent(part);
  } catch {
    return part;
  }
}

function relativeImagePathFromStoredPath(value: string): string {
  let path = value.replaceAll('\\', '/').trim();
  path = path.replace(/^https?:\/\/[^/]+/i, '');
  path = path.replace(/^\/?resources\/media\//i, '');
  return path.replace(/^\/+/, '').split(/[?#]/, 1)[0] ?? '';
}

function collectImageReferences(values: Array<string | null>, category: ImageCleanupFile['category']): Set<string> {
  const used = new Set<string>();
  const expression = new RegExp(`(?:https?:\\/\\/[^/\\s"'<>]+)?\\/?(?:resources\\/media\\/)?images\\/${category}\\/([^?#\\s"'<>)]*)`, 'gi');
  for (const value of values) {
    if (!value) continue;
    for (const match of value.matchAll(expression)) {
      const path = match[1] ?? '';
      const filename = filenameFromStoredPath(path);
      if (filename) used.add(cleanLegacyImageName(filename));
    }
  }
  return used;
}

async function readImageReferences(db: PrismaClient | Prisma.TransactionClient): Promise<Record<ImageCleanupFile['category'], Set<string>>> {
  const [posts, content, history, editRequests, comments, profiles, series, pages, forms, notices, banners, workLogEntries] = await Promise.all([
    db.$queryRaw<Array<{ image: string | null }>>`SELECT image FROM board_post`,
    db.$queryRaw<Array<{ content: string | null }>>`SELECT content_html AS content FROM board_postcontent`,
    db.$queryRaw<Array<{ content: string | null }>>`SELECT content FROM board_edithistory`,
    db.$queryRaw<Array<{ content: string | null }>>`SELECT content FROM board_editrequest`,
    db.$queryRaw<Array<{ textMd: string | null; textHtml: string | null }>>`SELECT text_md AS textMd, text_html AS textHtml FROM board_comment`,
    db.$queryRaw<Array<{ aboutMd: string | null; aboutHtml: string | null }>>`SELECT about_md AS aboutMd, about_html AS aboutHtml FROM board_profile`,
    db.$queryRaw<Array<{ textMd: string | null; textHtml: string | null }>>`SELECT text_md AS textMd, text_html AS textHtml FROM board_series`,
    db.$queryRaw<Array<{ content: string | null }>>`SELECT content FROM board_staticpage`,
    db.$queryRaw<Array<{ content: string | null }>>`SELECT content FROM board_form`,
    db.$queryRaw<Array<{ url: string | null }>>`SELECT url FROM board_sitenotice`,
    db.$queryRaw<Array<{ contentHtml: string | null }>>`SELECT content_html AS contentHtml FROM board_sitebanner`,
    db.$queryRaw<Array<{ text: string | null }>>`SELECT text FROM board_worklogentry`,
  ]);
  const values = [
    ...posts.map((row) => row.image),
    ...content.map((row) => row.content),
    ...history.map((row) => row.content),
    ...editRequests.map((row) => row.content),
    ...comments.flatMap((row) => [row.textMd, row.textHtml]),
    ...profiles.flatMap((row) => [row.aboutMd, row.aboutHtml]),
    ...series.flatMap((row) => [row.textMd, row.textHtml]),
    ...pages.map((row) => row.content),
    ...forms.map((row) => row.content),
    ...notices.map((row) => row.url),
    ...banners.map((row) => row.contentHtml),
    ...workLogEntries.map((row) => row.text),
  ];
  return {
    content: collectImageReferences(values, 'content'),
    title: collectImageReferences(values, 'title'),
    avatar: collectImageReferences(values, 'avatar'),
  };
}

async function streamFileHash(path: string): Promise<string> {
  const digest = createHash('sha256');
  for await (const chunk of createReadStream(path)) digest.update(chunk as Buffer);
  return digest.digest('hex');
}

async function safeImageCategoryDirectory(root: string, category: string): Promise<string | null> {
  const base = resolve(root, 'images');
  const directory = resolve(base, category);
  const relativePath = relative(root, directory);
  if (relativePath === '..' || relativePath.startsWith(`..${sep}`) || isAbsolute(relativePath)) return null;
  try {
    const baseInfo = await lstat(base);
    const directoryInfo = await lstat(directory);
    if (!baseInfo.isDirectory() || baseInfo.isSymbolicLink() || !directoryInfo.isDirectory() || directoryInfo.isSymbolicLink()) return null;
    return directory;
  } catch (error) {
    if (error instanceof Error && 'code' in error && ['ENOENT', 'ENOTDIR'].includes(String(error.code))) return null;
    throw error;
  }
}

async function scanImageCategory(
  root: string,
  category: ImageCleanupFile['category'],
  usedNames: Set<string>,
): Promise<ImageCleanupFile[]> {
  const baseDirectory = await safeImageCategoryDirectory(root, category);
  if (!baseDirectory) return [];
  const found: ImageCleanupFile[] = [];
  const queue = [baseDirectory];
  while (queue.length) {
    const current = queue.pop();
    if (!current) continue;
    const entries = await readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.name || entry.name === '.' || entry.name === '..' || entry.isSymbolicLink()) continue;
      const absolutePath = resolve(current, entry.name);
      if (entry.isDirectory()) {
        queue.push(absolutePath);
        continue;
      }
      if (!entry.isFile()) continue;
      try {
        const info = await lstat(absolutePath);
        const real = await realpath(absolutePath);
        const fromRoot = relative(root, real);
        if (!info.isFile() || info.isSymbolicLink() || fromRoot === '..' || fromRoot.startsWith(`..${sep}`) || isAbsolute(fromRoot)) continue;
        const contentHash = await streamFileHash(real);
        const relativePath = fromRoot.split(sep).join('/');
        const filename = entry.name;
        found.push({
          category,
          path: real,
          relativePath,
          filename,
          size: info.size,
          sizeKb: Math.round(info.size / 1024 * 100) / 100,
          mtimeMs: info.mtimeMs,
          inode: Number(info.ino),
          contentHash,
          isUsed: usedNames.has(cleanLegacyImageName(filename)),
        });
      } catch (error) {
        if (error instanceof Error && 'code' in error && ['ENOENT', 'ELOOP', 'ENOTDIR'].includes(String(error.code))) continue;
        throw error;
      }
    }
  }
  return found.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
}

function imageMediaUrl(relativePath: string): string {
  return `/resources/media/${relativePath.split('/').map(encodeURIComponent).join('/')}`;
}

async function buildImageCleanupPlan(
  db: PrismaClient | Prisma.TransactionClient,
  mediaRoot: string | undefined,
  parameters: UtilityParameters,
): Promise<ImageCleanupPlan> {
  if (!mediaRoot) throw new Error('Image cleanup storage is unavailable.');
  const targetValue = parameters.target;
  const target: ImageCleanupTarget = targetValue === 'content' || targetValue === 'title' || targetValue === 'avatar' ? targetValue : 'all';
  const removeDuplicates = parameters.removeDuplicates === true;
  const root = await mediaRootRealPath(mediaRoot);
  const imageReferences = await readImageReferences(db);
  const [posts, profiles, cacheRows] = await Promise.all([
    db.$queryRaw<Array<{ image: string | null }>>`SELECT image FROM board_post`,
    db.$queryRaw<Array<{ avatar: string | null; cover: string | null }>>`SELECT avatar, cover FROM board_profile`,
    target === 'all' || target === 'content'
      ? db.$queryRaw<Array<{ id: number; path: string }>>`
          SELECT id, path FROM board_imagecache WHERE path LIKE 'images/content/%' ORDER BY id
        `
      : Promise.resolve([] as Array<{ id: number; path: string }>),
  ]);
  const usedTitle = new Set([
    ...imageReferences.title,
    ...posts.map((row) => filenameFromStoredPath(row.image ?? '')).filter(Boolean),
  ]);
  const usedAvatar = new Set([
    ...imageReferences.avatar,
    ...profiles.flatMap((row) => [row.avatar, row.cover])
    .filter((path): path is string => Boolean(path))
    .map(filenameFromStoredPath),
  ]);
  const categories: ImageCleanupFile['category'][] = target === 'all'
    ? ['content', 'title', 'avatar']
    : [target];
  const allFiles = (await Promise.all(categories.map((category) => scanImageCategory(
    root,
    category,
    category === 'content' ? imageReferences.content : category === 'title' ? usedTitle : usedAvatar,
  )))).flat();
  const unusedFiles = allFiles.filter((file) => !file.isUsed);
  const duplicateFiles: ImageCleanupPlan['duplicateFiles'] = [];
  if (removeDuplicates && (target === 'all' || target === 'title')) {
    const seen = new Map<string, ImageCleanupFile>();
    for (const file of unusedFiles.filter((candidate) => candidate.category === 'title')) {
      const original = seen.get(file.contentHash);
      if (original) duplicateFiles.push({ duplicate: file, original });
      else seen.set(file.contentHash, file);
    }
  }
  const referencedContentNames = imageReferences.content;
  const unusedCacheRows = cacheRows.filter((row) => !referencedContentNames.has(cleanLegacyImageName(filenameFromStoredPath(row.path))));
  const planDigest = createHash('sha256');
  for (const file of unusedFiles) planDigest.update(`${file.relativePath}\0${file.size}\0${file.mtimeMs}\0${file.inode}\0${file.contentHash}\n`);
  for (const row of unusedCacheRows) planDigest.update(`cache\0${row.id}\0${row.path}\n`);
  const totalSize = unusedFiles.reduce((total, file) => total + file.size, 0);
  const duplicateSize = duplicateFiles.reduce((total, entry) => total + entry.duplicate.size, 0);
  return {
    target,
    removeDuplicates,
    unusedFiles,
    duplicateFiles,
    cacheRows: unusedCacheRows,
    previewHash: planDigest.digest('hex'),
    totalSize,
    duplicateSize,
  };
}

function imageCleanupPlanApi(plan: ImageCleanupPlan, dryRun: boolean): Record<string, unknown> {
  const messages: string[] = [];
  if (plan.cacheRows.length) messages.push(`이미지 캐시 ${plan.cacheRows.length}개가 삭제 대상입니다.`);
  if (plan.duplicateFiles.length) {
    messages.push(dryRun
      ? `중복 타이틀 이미지 ${plan.duplicateFiles.length}개(${Math.round(plan.duplicateSize / 1024 / 1024 * 100) / 100}MB)가 삭제 대상입니다.`
      : `중복 타이틀 이미지 ${plan.duplicateFiles.length}개(${Math.round(plan.duplicateSize / 1024 / 1024 * 100) / 100}MB)를 삭제했습니다.`);
  }
  return {
    target: plan.target,
    remove_duplicates: plan.removeDuplicates,
    total_unused: plan.unusedFiles.length,
    total_size_mb: Math.round(plan.totalSize / 1024 / 1024 * 100) / 100,
    total_duplicates: plan.duplicateFiles.length,
    total_duplicate_size_mb: Math.round(plan.duplicateSize / 1024 / 1024 * 100) / 100,
    total_saved_mb: Math.round((plan.totalSize + plan.duplicateSize) / 1024 / 1024 * 100) / 100,
    messages,
    has_errors: false,
    dry_run: dryRun,
    ...(dryRun ? {
      preview_hash: plan.previewHash,
      unused_files: plan.unusedFiles.slice(0, 100).map((file) => ({
        path: file.relativePath.split('/').slice(2).join('/'),
        url: imageMediaUrl(file.relativePath),
        size_kb: file.sizeKb,
      })),
      ...(plan.duplicateFiles.length ? { duplicate_files: plan.duplicateFiles.slice(0, 100).map(({ duplicate, original }) => ({
        duplicate_url: imageMediaUrl(duplicate.relativePath),
        duplicate_size_kb: duplicate.sizeKb,
        original_url: imageMediaUrl(original.relativePath),
        original_size_kb: original.sizeKb,
        hash: duplicate.contentHash.slice(0, 8),
      })) } : {}),
    } : {}),
  };
}

async function verifyImageCandidate(root: string, file: ImageCleanupFile): Promise<boolean> {
  const parts = file.relativePath.split('/');
  if (parts.length < 3 || parts[0] !== 'images' || parts[1] !== file.category || parts.some((part) => !part || part === '.' || part === '..')) return false;
  let current = root;
  try {
    for (const part of parts.slice(0, -1)) {
      current = resolve(current, part);
      const info = await lstat(current);
      if (!info.isDirectory() || info.isSymbolicLink()) return false;
    }
    const path = resolve(current, parts.at(-1) ?? '');
    const info = await lstat(path);
    const real = await realpath(path);
    const fromRoot = relative(root, real);
    if (!info.isFile() || info.isSymbolicLink() || fromRoot !== file.relativePath.split('/').join(sep)) return false;
    if (info.size !== file.size || info.mtimeMs !== file.mtimeMs || Number(info.ino) !== file.inode) return false;
    return await streamFileHash(real) === file.contentHash;
  } catch {
    return false;
  }
}

async function executeImageCleanupPlan(
  db: Prisma.TransactionClient,
  mediaRoot: string,
  plan: ImageCleanupPlan,
): Promise<Record<string, unknown>> {
  const root = await mediaRootRealPath(mediaRoot);
  const messages: string[] = [];
  const errors: string[] = [];
  let deletedFiles = 0;
  const deletedRelativePaths = new Set<string>();
  for (const file of plan.unusedFiles) {
    if (!(await verifyImageCandidate(root, file))) {
      errors.push(`Skipped a changed file: ${file.relativePath}`);
      continue;
    }
    try {
      await unlink(file.path);
      deletedFiles += 1;
      deletedRelativePaths.add(file.relativePath);
    } catch {
      errors.push(`Could not delete: ${file.relativePath}`);
    }
  }
  let deletedCaches = 0;
  for (const cache of plan.cacheRows) {
    if (!deletedRelativePaths.has(relativeImagePathFromStoredPath(cache.path))) continue;
    deletedCaches += await db.$executeRaw`
      DELETE FROM board_imagecache WHERE id = ${cache.id} AND path = ${cache.path}
    `;
  }
  if (deletedFiles) messages.push(`미사용 이미지 ${deletedFiles}개를 삭제했습니다.`);
  if (deletedCaches) messages.push(`이미지 캐시 ${deletedCaches}개를 삭제했습니다.`);
  if (errors.length) messages.push(...errors.slice(0, 20));
  return {
    ...imageCleanupPlanApi(plan, false),
    cleaned_count: deletedFiles,
    image_cache_count: deletedCaches,
    messages,
    has_errors: errors.length > 0,
  };
}

async function runUtilityCleanup(
  db: Prisma.TransactionClient | PrismaClient,
  action: UtilityAction,
  parameters: UtilityParameters,
  dryRun: boolean,
  mediaRoot?: string,
): Promise<Record<string, unknown>> {
  if (action === 'clean_images') {
    const plan = await buildImageCleanupPlan(db, mediaRoot, parameters);
    return imageCleanupPlanApi(plan, dryRun);
  }
  if (action === 'clean_tags') {
    const [counts] = await db.$queryRaw<Array<{ totalTags: number | bigint; usedTags: number | bigint }>>`
      SELECT COUNT(*) AS totalTags,
        SUM(CASE WHEN EXISTS (SELECT 1 FROM board_post_tags AS relation WHERE relation.tag_id = tag.id) THEN 1 ELSE 0 END) AS usedTags
      FROM board_tag AS tag
    `;
    const unusedRows = await db.$queryRaw<Array<{ value: string }>>`
      SELECT tag.value FROM board_tag AS tag
      WHERE NOT EXISTS (SELECT 1 FROM board_post_tags AS relation WHERE relation.tag_id = tag.id)
      ORDER BY tag.value
    `;
    const topTags = await db.$queryRaw<Array<{ name: string; count: number | bigint }>>`
      SELECT tag.value AS name, COUNT(relation.post_id) AS count
      FROM board_tag AS tag JOIN board_post_tags AS relation ON relation.tag_id = tag.id
      GROUP BY tag.id, tag.value ORDER BY count DESC LIMIT 10
    `;
    const deleted = dryRun ? 0 : await db.$executeRaw`
      DELETE FROM board_tag WHERE NOT EXISTS (
        SELECT 1 FROM board_post_tags AS relation WHERE relation.tag_id = board_tag.id
      )
    `;
    const total = Number(counts?.totalTags ?? 0);
    const used = Number(counts?.usedTags ?? 0);
    return {
      total_tags: total,
      used_tags: used,
      unused_tags: Math.max(0, total - used),
      top_tags: topTags.map((tag) => ({ name: tag.name, count: Number(tag.count) })),
      cleaned_count: Number(deleted || unusedRows.length),
      cleaned_tags: unusedRows.slice(0, 20).map((row) => row.value),
      dry_run: dryRun,
    };
  }
  if (action === 'clean_sessions') {
    const [counts] = await db.$queryRaw<Array<{ total: number | bigint; expired: number | bigint }>>`
      SELECT COUNT(*) AS total, SUM(CASE WHEN expires_at < ${BigInt(Date.now())} THEN 1 ELSE 0 END) AS expired
      FROM blex_session
    `;
    const cleanAll = parameters.cleanAll === true;
    const deleted = dryRun ? 0 : cleanAll
      ? await db.$executeRaw`DELETE FROM blex_session`
      : await db.$executeRaw`DELETE FROM blex_session WHERE expires_at < ${BigInt(Date.now())}`;
    return {
      total_sessions: Number(counts?.total ?? 0),
      expired_sessions: Number(counts?.expired ?? 0),
      cleaned_count: Number(deleted),
      clean_all: cleanAll,
      dry_run: dryRun,
    };
  }
  const adminRetention = retentionDays('ADMIN_AUDIT_LOG_RETENTION_DAYS', 365);
  const developerRetention = retentionDays('DEVELOPER_API_LOG_RETENTION_DAYS', 30);
  const adminCutoff = djangoTimestamp(new Date(Date.now() - adminRetention * 24 * 60 * 60 * 1000));
  const developerCutoff = djangoTimestamp(new Date(Date.now() - developerRetention * 24 * 60 * 60 * 1000));
  const [counts] = await db.$queryRaw<Array<{
    logCount: number | bigint;
    expiredLogCount: number | bigint;
    developerCount: number | bigint;
    expiredDeveloperCount: number | bigint;
  }>>`
    SELECT COUNT(*) AS logCount,
      SUM(CASE WHEN action_time < ${adminCutoff} THEN 1 ELSE 0 END) AS expiredLogCount,
      (SELECT COUNT(*) FROM board_developerrequestlog) AS developerCount,
      (SELECT COUNT(*) FROM board_developerrequestlog WHERE created_date < ${developerCutoff}) AS expiredDeveloperCount
    FROM django_admin_log
  `;
  const cleanedLogs = dryRun ? 0 : await db.$executeRaw`DELETE FROM django_admin_log WHERE action_time < ${adminCutoff}`;
  const cleanedDeveloperLogs = dryRun ? 0 : await db.$executeRaw`DELETE FROM board_developerrequestlog WHERE created_date < ${developerCutoff}`;
  return {
    log_count: Number(counts?.logCount ?? 0),
    admin_audit_log_retention_days: adminRetention,
    expired_log_count: Number(counts?.expiredLogCount ?? 0),
    cleaned_count: Number(cleanedLogs),
    developer_request_log_count: Number(counts?.developerCount ?? 0),
    developer_api_log_retention_days: developerRetention,
    expired_developer_request_log_count: Number(counts?.expiredDeveloperCount ?? 0),
    cleaned_developer_request_log_count: Number(cleanedDeveloperLogs),
    dry_run: dryRun,
  };
}

async function recordUtilityAudit(
  transaction: Prisma.TransactionClient,
  userId: number,
  action: UtilityAction,
  phase: 'started' | 'completed' = 'completed',
): Promise<number | null> {
  const changeMessages: Record<UtilityAction, string> = {
    clean_tags: 'Executed unused tag cleanup',
    clean_sessions: 'Executed session cleanup',
    clean_logs: 'Executed expired log cleanup',
    clean_images: phase === 'started' ? 'Started unused image cleanup' : 'Executed unused image cleanup',
  };
  await transaction.$executeRaw`INSERT OR IGNORE INTO django_content_type (app_label, model) VALUES ('admin', 'logentry')`;
  const [contentType] = await transaction.$queryRaw<Array<{ id: number }>>`
    SELECT id FROM django_content_type WHERE app_label = 'admin' AND model = 'logentry' LIMIT 1
  `;
  if (!contentType) return null;
  await transaction.$executeRaw`
    INSERT INTO django_admin_log (object_id, object_repr, action_flag, change_message, content_type_id, user_id, action_time)
    VALUES (NULL, 'System utilities', 2, ${changeMessages[action]}, ${contentType.id}, ${userId}, ${djangoTimestamp()})
  `;
  const [row] = await transaction.$queryRaw<Array<{ id: number }>>`SELECT last_insert_rowid() AS id`;
  return row ? Number(row.id) : null;
}

async function runUtilityAction(
  db: PrismaClient,
  request: FastifyRequest,
  userId: number,
  action: UtilityAction,
  body: Body,
  options: AdminSettingsOptions,
): Promise<ApiResult<Record<string, unknown>>> {
  const fingerprint = utilitySessionFingerprint(request);
  if (!fingerprint) return { ok: false, code: 'RJ', message: 'A signed-in session is required.' };
  let parameters: UtilityParameters;
  try {
    parameters = utilityParameters(action, body);
  } catch (error) {
    return { ok: false, code: 'VA', message: error instanceof Error ? error.message : 'Invalid cleanup parameters.' };
  }
  if (action === 'clean_images') {
    if (!options.mediaRoot) return { ok: false, code: 'RJ', message: 'Image cleanup storage is unavailable.' };
    if (body.dry_run !== false) {
      try {
        const plan = await buildImageCleanupPlan(db, options.mediaRoot, parameters);
        const confirmationToken = await issueUtilityConfirmation(
          db,
          userId,
          fingerprint,
          action,
          { ...parameters, previewHash: plan.previewHash },
          options.secretKey,
        );
        return { ok: true, body: { ...imageCleanupPlanApi(plan, true), confirmation_token: confirmationToken } };
      } catch (error) {
        return { ok: false, code: 'VA', message: error instanceof Error ? error.message : 'Could not preview image cleanup.' };
      }
    }
    const previewHash = typeof body.preview_hash === 'string' ? body.preview_hash : '';
    if (!/^[a-f0-9]{64}$/.test(previewHash)) {
      return { ok: false, code: 'RJ', message: 'The cleanup preview has expired or is invalid.' };
    }
    const boundParameters = { ...parameters, previewHash };
    let auditId: number;
    try {
      auditId = await db.$transaction(async (transaction) => {
        await consumeUtilityConfirmation(
          transaction,
          body.confirmation_token,
          userId,
          fingerprint,
          action,
          boundParameters,
          options.secretKey,
        );
        const createdAuditId = await recordUtilityAudit(transaction, userId, action, 'started');
        if (createdAuditId === null) throw new Error('Image cleanup audit could not be recorded.');
        return createdAuditId;
      });
    } catch (error) {
      if (String(error).includes('invalid utility confirmation')) {
        return { ok: false, code: 'RJ', message: 'The cleanup preview has expired or is invalid.' };
      }
      throw error;
    }
    try {
      const result = await db.$transaction(async (transaction) => {
        const plan = await buildImageCleanupPlan(transaction, options.mediaRoot, parameters);
        if (plan.previewHash !== previewHash) throw new Error('image cleanup preview changed');
        return executeImageCleanupPlan(transaction, options.mediaRoot as string, plan);
      }, { timeout: 120_000 });
      await db.$transaction(async (transaction) => {
        await transaction.$executeRaw`
          UPDATE django_admin_log SET change_message = 'Executed unused image cleanup' WHERE id = ${auditId}
        `;
      });
      return { ok: true, body: result };
    } catch (error) {
      if (String(error).includes('image cleanup preview changed')) {
        return { ok: false, code: 'RJ', message: 'The cleanup preview has expired or is invalid.' };
      }
      return { ok: false, code: 'VA', message: 'Image cleanup stopped safely; review the utility audit log.' };
    }
  }
  if (body.dry_run !== false) {
    const result = await runUtilityCleanup(db, action, parameters, true, options.mediaRoot);
    const confirmationToken = await issueUtilityConfirmation(db, userId, fingerprint, action, parameters, options.secretKey);
    return { ok: true, body: { ...result, confirmation_token: confirmationToken } };
  }
  try {
    const result = await db.$transaction(async (transaction) => {
      await consumeUtilityConfirmation(
        transaction,
        body.confirmation_token,
        userId,
        fingerprint,
        action,
        parameters,
        options.secretKey,
      );
      const cleaned = await runUtilityCleanup(transaction, action, parameters, false);
      await recordUtilityAudit(transaction, userId, action);
      return cleaned;
    });
    return { ok: true, body: result };
  } catch (error) {
    if (String(error).includes('invalid utility confirmation')) {
      return { ok: false, code: 'RJ', message: 'The cleanup preview has expired or is invalid.' };
    }
    throw error;
  }
}

function camelizeValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(camelizeValue);
  if (!isRecord(value)) return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [
    key.replace(/_([a-z])/g, (_match, letter: string) => letter.toUpperCase()),
    camelizeValue(item),
  ]));
}

async function pageInvites(
  request: FastifyRequest,
  reply: FastifyReply,
  db: PrismaClient,
  user: AdminSettingsUser,
  access: UserAccess,
  error?: string,
) {
  const params = userListQuery(request);
  return reply.type('text/html; charset=utf-8').send(renderAdminInvites({
    user,
    capabilities: adminSettingsCapabilities(access),
    invites: await readInvites(db),
    managedUsers: await readManagedUsers(db, request),
    query: params.get('q') ?? '',
    roleFilter: userRoleFilter(params.get('role')),
    csrfToken: csrfToken(request),
    saved: !error && pageNumber(request).get('saved') === '1',
    error,
  }));
}

function validRouteId(value: string): number | null {
  if (!/^\d+$/.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

async function pageStaticPages(
  request: FastifyRequest,
  reply: FastifyReply,
  db: PrismaClient,
  user: AdminSettingsUser,
  access: UserAccess,
  error?: string,
) {
  return reply.type('text/html; charset=utf-8').send(renderAdminStaticPages({
    user,
    capabilities: adminSettingsCapabilities(access),
    pages: await readStaticPages(db),
    csrfToken: csrfToken(request),
    saved: !error && pageNumber(request).get('saved') === '1',
    error,
  }));
}

async function pageStaticPageEditor(
  request: FastifyRequest,
  reply: FastifyReply,
  user: AdminSettingsUser,
  access: UserAccess,
  page: AdminStaticPage | null,
  error?: string,
) {
  return reply.type('text/html; charset=utf-8').send(renderAdminStaticPageEditor({
    user,
    capabilities: adminSettingsCapabilities(access),
    page,
    csrfToken: csrfToken(request),
    saved: !error && pageNumber(request).get('saved') === '1',
    error,
  }));
}

async function pageNotices(
  request: FastifyRequest,
  reply: FastifyReply,
  db: PrismaClient,
  user: AdminSettingsUser,
  access: UserAccess,
  error?: string,
) {
  return reply.type('text/html; charset=utf-8').send(renderAdminNotices({
    user,
    capabilities: adminSettingsCapabilities(access),
    notices: await readNotices(db),
    csrfToken: csrfToken(request),
    saved: !error && pageNumber(request).get('saved') === '1',
    error,
  }));
}

async function pageBanners(
  request: FastifyRequest,
  reply: FastifyReply,
  db: PrismaClient,
  user: AdminSettingsUser,
  access: UserAccess,
  error?: string,
) {
  return reply.type('text/html; charset=utf-8').send(renderAdminBanners({
    user,
    capabilities: adminSettingsCapabilities(access),
    banners: await readBanners(db),
    csrfToken: csrfToken(request),
    saved: !error && pageNumber(request).get('saved') === '1',
    error,
  }));
}

async function pageAuthorNotices(
  request: FastifyRequest,
  reply: FastifyReply,
  db: PrismaClient,
  user: AdminSettingsUser,
  error?: string,
) {
  return reply.type('text/html; charset=utf-8').send(renderAuthorNotices({
    user,
    notices: await readNotices(db, 'user', user.id),
    csrfToken: csrfToken(request),
    saved: !error && pageNumber(request).get('saved') === '1',
    error,
  }));
}

async function pageAuthorBanners(
  request: FastifyRequest,
  reply: FastifyReply,
  db: PrismaClient,
  user: AdminSettingsUser,
  error?: string,
) {
  return reply.type('text/html; charset=utf-8').send(renderAuthorBanners({
    user,
    banners: await readBanners(db, 'user', user.id),
    csrfToken: csrfToken(request),
    saved: !error && pageNumber(request).get('saved') === '1',
    error,
  }));
}

async function pageUtilities(
  request: FastifyRequest,
  reply: FastifyReply,
  db: PrismaClient,
  options: AdminSettingsOptions,
  user: AdminSettingsUser,
  access: UserAccess,
  feedback?: { action: AdminUtilityAction; data: Record<string, unknown>; confirmationToken?: string; cleanAll?: boolean },
  error?: string,
) {
  return reply.type('text/html; charset=utf-8').send(renderAdminUtilities({
    user,
    capabilities: adminSettingsCapabilities(access),
    stats: await readUtilityStats(db),
    csrfToken: csrfToken(request),
    feedback,
    saved: !error && pageNumber(request).get('saved') === '1',
    error,
  }));
}

function apiJsonBody(request: FastifyRequest): Body {
  return isRecord(request.body) ? request.body : {};
}

function unauthorizedPage(reply: FastifyReply) {
  return reply.code(404).type('text/plain; charset=utf-8').send('페이지를 찾을 수 없습니다.');
}

export function registerAdminSettings(app: FastifyInstance, db: PrismaClient, options: AdminSettingsOptions): void {
  app.register(async (routes) => {
    await routes.register(formBody);
    await routes.register(multipart, {
      limits: { files: 16, fields: 4, parts: 20, fileSize: BRAND_ICO_MAX_BYTES, fieldSize: 16 * 1024 },
    });
    routes.addHook('onRequest', async (_request, reply) => {
      reply.header('Cache-Control', 'private, no-store')
        .header('X-Robots-Tag', 'noindex, nofollow, noarchive')
        .header('Referrer-Policy', 'same-origin');
    });

    routes.get('/admin-settings/', async (request, reply) => {
      const result = await pageAccess(request, reply, db, options);
      if (!result) return reply;
      if (!result.access.staff) return unauthorizedPage(reply);
      const destination = result.access.canManageSiteSettings ? 'site-settings' : result.access.superuser ? 'login' : 'global-notices';
      return reply.redirect(`/admin-settings/${destination}`, 302);
    });
    routes.get('/admin-settings', async (_request, reply) => reply.redirect('/admin-settings/', 302));

    routes.get('/admin-settings/site-settings', async (request, reply) => {
      const result = await pageAccess(request, reply, db, options);
      if (!result) return reply;
      if (!result.access.canManageSiteSettings) return unauthorizedPage(reply);
      return pageSiteSettings(request, reply, db, options, result.user, result.access);
    });
    routes.post<{ Body: unknown }>('/admin-settings/site-settings', { bodyLimit: 1024 * 1024 }, async (request, reply) => {
      if (!csrfValid(request, options)) return reply.code(403).type('text/plain; charset=utf-8').send('요청을 확인할 수 없습니다. 페이지를 새로고침해 주세요.');
      const result = await pageAccess(request, reply, db, options);
      if (!result) return reply;
      if (!result.access.canManageSiteSettings) return unauthorizedPage(reply);
      const body = isRecord(request.body) ? request.body : {};
      const payload = pageSitePayload(body, !('seo_enabled' in body || 'aeo_enabled' in body || 'robots_txt_extra_rules' in body));
      const updated = await updateSiteSettings(db, result.user.id, result.access.superuser, payload, options);
      if (!updated.ok) return pageSiteSettings(request, reply, db, options, result.user, result.access, updated.message);
      return reply.redirect('/admin-settings/site-settings?saved=1', 303);
    });
    routes.post<{ Body: unknown }>('/admin-settings/brand-assets', { bodyLimit: 12 * 1024 * 1024 }, async (request, reply) => {
      const isMultipart = request.headers['content-type']?.toLowerCase().startsWith('multipart/form-data') === true;
      let fields: Body = {};
      let files = new Map<string, Buffer>();
      try {
        if (isMultipart) {
          const parsed = await readMultipartFields(request);
          fields = parsed.fields;
          files = parsed.files;
        } else if (isRecord(request.body)) {
          fields = request.body;
        }
      } catch {
        return reply.code(400).type('text/plain; charset=utf-8').send('업로드한 파일을 읽을 수 없습니다.');
      }
      if (!csrfValidWithBody(request, options, fields)) return reply.code(403).type('text/plain; charset=utf-8').send('요청을 확인할 수 없습니다. 페이지를 새로고침해 주세요.');
      const permission = await pageAccess(request, reply, db, options);
      if (!permission) return reply;
      if (!permission.access.canManageSiteSettings) return unauthorizedPage(reply);
      let saved: ApiResult<AdminSiteSettings>;
      if (isMultipart) {
        let target: ReturnType<typeof validateBrandTarget>;
        try {
          target = validateBrandTarget(fields);
        } catch (error) {
          return pageSiteSettings(request, reply, db, options, permission.user, permission.access, error instanceof Error ? error.message : 'Check the brand asset type.');
        }
        saved = await uploadBrandAsset(db, permission.user.id, permission.access.superuser, {
          ...target,
          svg: files.get('svg'),
          files,
          manifest: stringValue(fields.manifest),
          generateDerivatives: !fields.manifest && files.size === 1 && files.has('svg'),
        }, options);
      } else if (formBoolean(fields._delete)) {
        try {
          const target = validateBrandTarget(fields);
          saved = await deleteBrandAsset(db, permission.user.id, permission.access.superuser, target, options);
        } catch (error) {
          return pageSiteSettings(request, reply, db, options, permission.user, permission.access, error instanceof Error ? error.message : 'Check the brand asset type.');
        }
      } else {
        return pageSiteSettings(request, reply, db, options, permission.user, permission.access, 'Choose a brand asset action.');
      }
      if (!saved.ok) return pageSiteSettings(request, reply, db, options, permission.user, permission.access, saved.message);
      return reply.redirect('/admin-settings/site-settings?saved=1', 303);
    });

    routes.get('/admin-settings/seo-aeo', async (request, reply) => {
      const result = await pageAccess(request, reply, db, options);
      if (!result) return reply;
      if (!result.access.canManageSiteSettings) return unauthorizedPage(reply);
      return pageSeoSettings(request, reply, db, options, result.user, result.access);
    });
    routes.post<{ Body: unknown }>('/admin-settings/seo-aeo', { bodyLimit: 1024 * 1024 }, async (request, reply) => {
      if (!csrfValid(request, options)) return reply.code(403).type('text/plain; charset=utf-8').send('요청을 확인할 수 없습니다. 페이지를 새로고침해 주세요.');
      const result = await pageAccess(request, reply, db, options);
      if (!result) return reply;
      if (!result.access.canManageSiteSettings) return unauthorizedPage(reply);
      const payload = pageSitePayload(isRecord(request.body) ? request.body : {}, false);
      const updated = await updateSiteSettings(db, result.user.id, result.access.superuser, payload, options);
      if (!updated.ok) return pageSeoSettings(request, reply, db, options, result.user, result.access, updated.message);
      return reply.redirect('/admin-settings/seo-aeo?saved=1', 303);
    });

    routes.get('/admin-settings/login', async (request, reply) => {
      const result = await pageAccess(request, reply, db, options);
      if (!result) return reply;
      if (!result.access.superuser) return unauthorizedPage(reply);
      return pageLoginSettings(request, reply, db, options, result.user, result.access);
    });
    routes.post<{ Body: unknown }>('/admin-settings/login', { bodyLimit: 1024 * 1024 }, async (request, reply) => {
      if (!csrfValid(request, options)) return reply.code(403).type('text/plain; charset=utf-8').send('요청을 확인할 수 없습니다. 페이지를 새로고침해 주세요.');
      const result = await pageAccess(request, reply, db, options);
      if (!result) return reply;
      if (!result.access.superuser) return unauthorizedPage(reply);
      const payload = pageLoginPayload(isRecord(request.body) ? request.body : {});
      const updated = await updateLoginSettings(db, result.user.id, options.cipherKey, payload);
      if (!updated.ok) return pageLoginSettings(request, reply, db, options, result.user, result.access, updated.message);
      return reply.redirect('/admin-settings/login?saved=1', 303);
    });

    routes.get('/admin-settings/integrations', async (request, reply) => {
      const result = await pageAccess(request, reply, db, options);
      if (!result) return reply;
      if (!result.access.superuser) return unauthorizedPage(reply);
      return pageIntegrationSettings(request, reply, db, options, result.user, result.access);
    });
    routes.post<{ Body: unknown }>('/admin-settings/integrations', { bodyLimit: 64 * 1024 }, async (request, reply) => {
      if (!csrfValid(request, options)) return reply.code(403).type('text/plain; charset=utf-8').send('요청을 확인할 수 없습니다. 페이지를 새로고침해 주세요.');
      const result = await pageAccess(request, reply, db, options);
      if (!result) return reply;
      if (!result.access.superuser) return unauthorizedPage(reply);
      const updated = await updateIntegrationSettings(
        db,
        result.user.id,
        pageIntegrationPayload(isRecord(request.body) ? request.body : {}),
        options,
      );
      if (!updated.ok) return pageIntegrationSettings(request, reply, db, options, result.user, result.access, updated.message);
      return reply.redirect('/admin-settings/integrations?saved=1', 303);
    });

    routes.get('/admin-settings/users', async (request, reply) => {
      const result = await pageAccess(request, reply, db, options);
      if (!result) return reply;
      return pageInvites(request, reply, db, result.user, result.access);
    });
    routes.post<{ Body: unknown }>('/admin-settings/users', { bodyLimit: 64 * 1024 }, async (request, reply) => {
      if (!csrfValid(request, options)) return reply.code(403).type('text/plain; charset=utf-8').send('요청을 확인할 수 없습니다. 페이지를 새로고침해 주세요.');
      const result = await pageAccess(request, reply, db, options);
      if (!result) return reply;
      const input = isRecord(request.body) ? request.body : {};
      await createInvite(db, result.user.id, input.note);
      return reply.redirect('/admin-settings/users?saved=1', 303);
    });
    routes.post<{ Params: { inviteId: string }; Body: unknown }>('/admin-settings/users/:inviteId/delete', { bodyLimit: 8 * 1024 }, async (request, reply) => {
      if (!csrfValid(request, options)) return reply.code(403).type('text/plain; charset=utf-8').send('요청을 확인할 수 없습니다. 페이지를 새로고침해 주세요.');
      const result = await pageAccess(request, reply, db, options);
      if (!result) return reply;
      if (!/^\d+$/.test(request.params.inviteId) || !Number.isSafeInteger(Number(request.params.inviteId))) {
        return pageInvites(request, reply, db, result.user, result.access, 'Invitation link not found.');
      }
      const deleted = await deleteInvite(db, Number(request.params.inviteId));
      if (deleted === 'claimed') return pageInvites(request, reply, db, result.user, result.access, 'A used invitation link cannot be deleted.');
      if (deleted === 'missing') return pageInvites(request, reply, db, result.user, result.access, 'Invitation link not found.');
      return reply.redirect('/admin-settings/users?saved=1', 303);
    });
    routes.post<{ Params: { userId: string }; Body: unknown }>('/admin-settings/users/:userId/role', { bodyLimit: 8 * 1024 }, async (request, reply) => {
      if (!csrfValid(request, options)) return reply.code(403).type('text/plain; charset=utf-8').send('요청을 확인할 수 없습니다. 페이지를 새로고침해 주세요.');
      const result = await pageAccess(request, reply, db, options);
      if (!result) return reply;
      const userId = validRouteId(request.params.userId);
      if (!userId) return pageInvites(request, reply, db, result.user, result.access, 'User not found.');
      const body = isRecord(request.body) ? request.body : {};
      const update = await updateManagedUserRole(db, result.user.id, userId, stringValue(body.role));
      if (!update.ok) return pageInvites(request, reply, db, result.user, result.access, update.message);
      return reply.redirect('/admin-settings/users?saved=1', 303);
    });

    routes.get('/admin-settings/static-pages', async (request, reply) => {
      const result = await pageAccess(request, reply, db, options);
      if (!result) return reply;
      return pageStaticPages(request, reply, db, result.user, result.access);
    });
    routes.get('/admin-settings/static-pages/create', async (request, reply) => {
      const result = await pageAccess(request, reply, db, options);
      if (!result) return reply;
      return pageStaticPageEditor(request, reply, result.user, result.access, null);
    });
    routes.post<{ Body: unknown }>('/admin-settings/static-pages/create', { bodyLimit: 1024 * 1024 }, async (request, reply) => {
      if (!csrfValid(request, options)) return reply.code(403).type('text/plain; charset=utf-8').send('요청을 확인할 수 없습니다. 페이지를 새로고침해 주세요.');
      const result = await pageAccess(request, reply, db, options);
      if (!result) return reply;
      const saved = await saveStaticPage(db, result.user.id, staticPagePayload(isRecord(request.body) ? request.body : {}, true));
      if (!saved.ok) return pageStaticPageEditor(request, reply, result.user, result.access, null, saved.message);
      return reply.redirect('/admin-settings/static-pages?saved=1', 303);
    });
    routes.get<{ Params: { pageId: string } }>('/admin-settings/static-pages/:pageId/edit', async (request, reply) => {
      const result = await pageAccess(request, reply, db, options);
      if (!result) return reply;
      const pageId = validRouteId(request.params.pageId);
      const page = pageId ? await readStaticPage(db, pageId) : null;
      if (!page) return reply.code(404).type('text/plain; charset=utf-8').send('페이지를 찾을 수 없습니다.');
      return pageStaticPageEditor(request, reply, result.user, result.access, page);
    });
    routes.post<{ Params: { pageId: string }; Body: unknown }>('/admin-settings/static-pages/:pageId/edit', { bodyLimit: 1024 * 1024 }, async (request, reply) => {
      if (!csrfValid(request, options)) return reply.code(403).type('text/plain; charset=utf-8').send('요청을 확인할 수 없습니다. 페이지를 새로고침해 주세요.');
      const result = await pageAccess(request, reply, db, options);
      if (!result) return reply;
      const pageId = validRouteId(request.params.pageId);
      const current = pageId ? await readStaticPage(db, pageId) : null;
      if (!pageId || !current) return reply.code(404).type('text/plain; charset=utf-8').send('페이지를 찾을 수 없습니다.');
      const saved = await saveStaticPage(db, result.user.id, staticPagePayload(isRecord(request.body) ? request.body : {}, true), pageId);
      if (!saved.ok) return pageStaticPageEditor(request, reply, result.user, result.access, current, saved.message);
      return reply.redirect('/admin-settings/static-pages?saved=1', 303);
    });
    routes.post<{ Params: { pageId: string }; Body: unknown }>('/admin-settings/static-pages/:pageId/delete', { bodyLimit: 8 * 1024 }, async (request, reply) => {
      if (!csrfValid(request, options)) return reply.code(403).type('text/plain; charset=utf-8').send('요청을 확인할 수 없습니다. 페이지를 새로고침해 주세요.');
      const result = await pageAccess(request, reply, db, options);
      if (!result) return reply;
      const pageId = validRouteId(request.params.pageId);
      if (!pageId) return pageStaticPages(request, reply, db, result.user, result.access, 'Static page not found.');
      const deleted = await db.$executeRaw`DELETE FROM board_staticpage WHERE id = ${pageId}`;
      if (deleted === 0) return pageStaticPages(request, reply, db, result.user, result.access, 'Static page not found.');
      return reply.redirect('/admin-settings/static-pages?saved=1', 303);
    });

    routes.get('/admin-settings/global-notices', async (request, reply) => {
      const result = await pageAccess(request, reply, db, options);
      if (!result) return reply;
      return pageNotices(request, reply, db, result.user, result.access);
    });
    routes.post<{ Body: unknown }>('/admin-settings/global-notices', { bodyLimit: 64 * 1024 }, async (request, reply) => {
      if (!csrfValid(request, options)) return reply.code(403).type('text/plain; charset=utf-8').send('요청을 확인할 수 없습니다. 페이지를 새로고침해 주세요.');
      const result = await pageAccess(request, reply, db, options);
      if (!result) return reply;
      const saved = await saveNotice(db, noticePayload(isRecord(request.body) ? request.body : {}, true));
      if (!saved.ok) return pageNotices(request, reply, db, result.user, result.access, saved.message);
      return reply.redirect('/admin-settings/global-notices?saved=1', 303);
    });
    routes.post<{ Params: { noticeId: string }; Body: unknown }>('/admin-settings/global-notices/:noticeId', { bodyLimit: 64 * 1024 }, async (request, reply) => {
      if (!csrfValid(request, options)) return reply.code(403).type('text/plain; charset=utf-8').send('요청을 확인할 수 없습니다. 페이지를 새로고침해 주세요.');
      const result = await pageAccess(request, reply, db, options);
      if (!result) return reply;
      const noticeId = validRouteId(request.params.noticeId);
      if (!noticeId) return pageNotices(request, reply, db, result.user, result.access, 'Notice not found.');
      const saved = await saveNotice(db, noticePayload(isRecord(request.body) ? request.body : {}, true), noticeId);
      if (!saved.ok) return pageNotices(request, reply, db, result.user, result.access, saved.message);
      return reply.redirect('/admin-settings/global-notices?saved=1', 303);
    });
    routes.post<{ Params: { noticeId: string }; Body: unknown }>('/admin-settings/global-notices/:noticeId/delete', { bodyLimit: 8 * 1024 }, async (request, reply) => {
      if (!csrfValid(request, options)) return reply.code(403).type('text/plain; charset=utf-8').send('요청을 확인할 수 없습니다. 페이지를 새로고침해 주세요.');
      const result = await pageAccess(request, reply, db, options);
      if (!result) return reply;
      const noticeId = validRouteId(request.params.noticeId);
      if (!noticeId) return pageNotices(request, reply, db, result.user, result.access, 'Notice not found.');
      const deleted = await db.$executeRaw`DELETE FROM board_sitenotice WHERE scope = 'global' AND id = ${noticeId}`;
      if (deleted === 0) return pageNotices(request, reply, db, result.user, result.access, 'Notice not found.');
      return reply.redirect('/admin-settings/global-notices?saved=1', 303);
    });

    routes.get('/admin-settings/global-banners', async (request, reply) => {
      const result = await pageAccess(request, reply, db, options);
      if (!result) return reply;
      return pageBanners(request, reply, db, result.user, result.access);
    });
    routes.post<{ Body: unknown }>('/admin-settings/global-banners', { bodyLimit: 1024 * 1024 }, async (request, reply) => {
      if (!csrfValid(request, options)) return reply.code(403).type('text/plain; charset=utf-8').send('요청을 확인할 수 없습니다. 페이지를 새로고침해 주세요.');
      const result = await pageAccess(request, reply, db, options);
      if (!result) return reply;
      const saved = await saveBanner(db, result.user.id, bannerPayload(isRecord(request.body) ? request.body : {}, true));
      if (!saved.ok) return pageBanners(request, reply, db, result.user, result.access, saved.message);
      return reply.redirect('/admin-settings/global-banners?saved=1', 303);
    });
    routes.post<{ Params: { bannerId: string }; Body: unknown }>('/admin-settings/global-banners/:bannerId', { bodyLimit: 1024 * 1024 }, async (request, reply) => {
      if (!csrfValid(request, options)) return reply.code(403).type('text/plain; charset=utf-8').send('요청을 확인할 수 없습니다. 페이지를 새로고침해 주세요.');
      const result = await pageAccess(request, reply, db, options);
      if (!result) return reply;
      const bannerId = validRouteId(request.params.bannerId);
      if (!bannerId) return pageBanners(request, reply, db, result.user, result.access, 'Banner not found.');
      const saved = await saveBanner(db, result.user.id, bannerPayload(isRecord(request.body) ? request.body : {}, true), bannerId);
      if (!saved.ok) return pageBanners(request, reply, db, result.user, result.access, saved.message);
      return reply.redirect('/admin-settings/global-banners?saved=1', 303);
    });
    routes.post<{ Params: { bannerId: string }; Body: unknown }>('/admin-settings/global-banners/:bannerId/delete', { bodyLimit: 8 * 1024 }, async (request, reply) => {
      if (!csrfValid(request, options)) return reply.code(403).type('text/plain; charset=utf-8').send('요청을 확인할 수 없습니다. 페이지를 새로고침해 주세요.');
      const result = await pageAccess(request, reply, db, options);
      if (!result) return reply;
      const bannerId = validRouteId(request.params.bannerId);
      if (!bannerId) return pageBanners(request, reply, db, result.user, result.access, 'Banner not found.');
      const deleted = await db.$executeRaw`DELETE FROM board_sitebanner WHERE scope = 'global' AND id = ${bannerId}`;
      if (deleted === 0) return pageBanners(request, reply, db, result.user, result.access, 'Banner not found.');
      return reply.redirect('/admin-settings/global-banners?saved=1', 303);
    });

    routes.get('/settings/notices', async (request, reply) => {
      const result = await editorPageAccess(request, reply, db, options);
      if (!result) return reply;
      return pageAuthorNotices(request, reply, db, result.user);
    });
    routes.post<{ Body: unknown }>('/settings/notices', { bodyLimit: 64 * 1024 }, async (request, reply) => {
      if (!csrfValid(request, options)) return reply.code(403).type('text/plain; charset=utf-8').send('요청을 확인할 수 없습니다. 페이지를 새로고침해 주세요.');
      const result = await editorPageAccess(request, reply, db, options);
      if (!result) return reply;
      const saved = await saveNotice(db, noticePayload(isRecord(request.body) ? request.body : {}, true), undefined, 'user', result.user.id);
      if (!saved.ok) return pageAuthorNotices(request, reply, db, result.user, saved.message);
      return reply.redirect('/settings/notices?saved=1', 303);
    });
    routes.post<{ Params: { noticeId: string }; Body: unknown }>('/settings/notices/:noticeId', { bodyLimit: 64 * 1024 }, async (request, reply) => {
      if (!csrfValid(request, options)) return reply.code(403).type('text/plain; charset=utf-8').send('요청을 확인할 수 없습니다. 페이지를 새로고침해 주세요.');
      const result = await editorPageAccess(request, reply, db, options);
      if (!result) return reply;
      const noticeId = validRouteId(request.params.noticeId);
      if (!noticeId || !(await readNotice(db, noticeId, 'user', result.user.id))) {
        return pageAuthorNotices(request, reply, db, result.user, 'Notice not found.');
      }
      const saved = await saveNotice(db, noticePayload(isRecord(request.body) ? request.body : {}, true), noticeId, 'user', result.user.id);
      if (!saved.ok) return pageAuthorNotices(request, reply, db, result.user, saved.message);
      return reply.redirect('/settings/notices?saved=1', 303);
    });
    routes.post<{ Params: { noticeId: string }; Body: unknown }>('/settings/notices/:noticeId/delete', { bodyLimit: 8 * 1024 }, async (request, reply) => {
      if (!csrfValid(request, options)) return reply.code(403).type('text/plain; charset=utf-8').send('요청을 확인할 수 없습니다. 페이지를 새로고침해 주세요.');
      const result = await editorPageAccess(request, reply, db, options);
      if (!result) return reply;
      const noticeId = validRouteId(request.params.noticeId);
      const deleted = noticeId ? await db.$executeRaw`
        DELETE FROM board_sitenotice WHERE scope = 'user' AND user_id = ${result.user.id} AND id = ${noticeId}
      ` : 0;
      if (!deleted) return pageAuthorNotices(request, reply, db, result.user, 'Notice not found.');
      return reply.redirect('/settings/notices?saved=1', 303);
    });

    routes.get('/settings/banners', async (request, reply) => {
      const result = await editorPageAccess(request, reply, db, options);
      if (!result) return reply;
      return pageAuthorBanners(request, reply, db, result.user);
    });
    routes.post<{ Body: unknown }>('/settings/banners', { bodyLimit: 1024 * 1024 }, async (request, reply) => {
      if (!csrfValid(request, options)) return reply.code(403).type('text/plain; charset=utf-8').send('요청을 확인할 수 없습니다. 페이지를 새로고침해 주세요.');
      const result = await editorPageAccess(request, reply, db, options);
      if (!result) return reply;
      const saved = await saveBanner(db, result.user.id, bannerPayload(isRecord(request.body) ? request.body : {}, true), undefined, 'user');
      if (!saved.ok) return pageAuthorBanners(request, reply, db, result.user, saved.message);
      return reply.redirect('/settings/banners?saved=1', 303);
    });
    routes.post<{ Params: { bannerId: string }; Body: unknown }>('/settings/banners/:bannerId', { bodyLimit: 1024 * 1024 }, async (request, reply) => {
      if (!csrfValid(request, options)) return reply.code(403).type('text/plain; charset=utf-8').send('요청을 확인할 수 없습니다. 페이지를 새로고침해 주세요.');
      const result = await editorPageAccess(request, reply, db, options);
      if (!result) return reply;
      const bannerId = validRouteId(request.params.bannerId);
      if (!bannerId || !(await readBanner(db, bannerId, 'user', result.user.id))) {
        return pageAuthorBanners(request, reply, db, result.user, 'Banner not found.');
      }
      const saved = await saveBanner(db, result.user.id, bannerPayload(isRecord(request.body) ? request.body : {}, true), bannerId, 'user');
      if (!saved.ok) return pageAuthorBanners(request, reply, db, result.user, saved.message);
      return reply.redirect('/settings/banners?saved=1', 303);
    });
    routes.post<{ Params: { bannerId: string }; Body: unknown }>('/settings/banners/:bannerId/delete', { bodyLimit: 8 * 1024 }, async (request, reply) => {
      if (!csrfValid(request, options)) return reply.code(403).type('text/plain; charset=utf-8').send('요청을 확인할 수 없습니다. 페이지를 새로고침해 주세요.');
      const result = await editorPageAccess(request, reply, db, options);
      if (!result) return reply;
      const bannerId = validRouteId(request.params.bannerId);
      const deleted = bannerId ? await db.$executeRaw`
        DELETE FROM board_sitebanner WHERE scope = 'user' AND user_id = ${result.user.id} AND id = ${bannerId}
      ` : 0;
      if (!deleted) return pageAuthorBanners(request, reply, db, result.user, 'Banner not found.');
      return reply.redirect('/settings/banners?saved=1', 303);
    });
    routes.post<{ Body: unknown }>('/settings/banners/order', { bodyLimit: 64 * 1024 }, async (request, reply) => {
      if (!csrfValid(request, options)) return reply.code(403).type('text/plain; charset=utf-8').send('요청을 확인할 수 없습니다. 페이지를 새로고침해 주세요.');
      const result = await editorPageAccess(request, reply, db, options);
      if (!result) return reply;
      const body = isRecord(request.body) ? request.body : {};
      const requestedOrder = Object.entries(body).flatMap(([key, value]) => {
        const match = key.match(/^order_(\d+)$/);
        if (!match) return [];
        const id = validRouteId(match[1] ?? '');
        const rawOrder = stringValue(value);
        const order = /^-?\d+$/.test(rawOrder) ? Number(rawOrder) : NaN;
        return id && Number.isSafeInteger(order) ? [[id, order] as const] : [];
      });
      const timestamp = djangoTimestamp();
      await db.$transaction(async (transaction) => {
        for (const [bannerId, order] of requestedOrder) {
          await transaction.$executeRaw`
            UPDATE board_sitebanner SET "order" = ${order}, updated_date = ${timestamp}
            WHERE scope = 'user' AND user_id = ${result.user.id} AND id = ${bannerId}
          `;
        }
      });
      return reply.redirect('/settings/banners?saved=1', 303);
    });

    routes.get('/admin-settings/utilities', async (request, reply) => {
      const result = await pageAccess(request, reply, db, options);
      if (!result) return reply;
      if (!result.access.superuser) return unauthorizedPage(reply);
      return pageUtilities(request, reply, db, options, result.user, result.access);
    });
    routes.post<{ Body: unknown }>('/admin-settings/utilities', { bodyLimit: 64 * 1024 }, async (request, reply) => {
      if (!csrfValid(request, options)) return reply.code(403).type('text/plain; charset=utf-8').send('요청을 확인할 수 없습니다. 페이지를 새로고침해 주세요.');
      const result = await pageAccess(request, reply, db, options);
      if (!result) return reply;
      if (!result.access.superuser) return unauthorizedPage(reply);
      const form = isRecord(request.body) ? request.body : {};
      const actionValue = stringValue(form.action);
      if (actionValue !== 'clean_tags' && actionValue !== 'clean_sessions' && actionValue !== 'clean_logs' && actionValue !== 'clean_images') {
        return pageUtilities(request, reply, db, options, result.user, result.access, undefined, 'Choose a valid maintenance task.');
      }
      const cleanAll = formBoolean(form.clean_all);
      const payload: Body = {
        dry_run: formBoolean(form.dry_run),
        clean_all: cleanAll,
        confirmation_token: stringValue(form.confirmation_token),
        target: stringValue(form.target) || 'all',
        remove_duplicates: formBoolean(form.remove_duplicates),
        preview_hash: stringValue(form.preview_hash),
      };
      const utility = await runUtilityAction(db, request, result.user.id, actionValue, payload, options);
      if (!utility.ok) return pageUtilities(request, reply, db, options, result.user, result.access, undefined, utility.message);
      const data = camelizeValue(utility.body) as Record<string, unknown>;
      const confirmationToken = typeof data.confirmationToken === 'string' ? data.confirmationToken : undefined;
      delete data.confirmationToken;
      return pageUtilities(request, reply, db, options, result.user, result.access, {
        action: actionValue,
        data,
        confirmationToken,
        cleanAll,
      });
    });

    routes.post<{ Body: unknown }>('/v1/site-settings/brand-assets', { bodyLimit: 12 * 1024 * 1024 }, async (request, reply) => {
      const permission = await apiAccess(request, db, options);
      if ('response' in permission) return reply.send(permission.response);
      if (!permission.access.canManageSiteSettings) return reply.send(failure('RJ', 'Permission to change site settings is required.'));
      let parsed: { fields: Body; files: Map<string, Buffer> };
      try {
        parsed = await readMultipartFields(request);
      } catch {
        return reply.send(failure('VA', 'Could not read the uploaded brand files.'));
      }
      if (!csrfValidWithBody(request, options, parsed.fields)) return reply.code(403).type('text/plain; charset=utf-8').send('Forbidden');
      let target: ReturnType<typeof validateBrandTarget>;
      try {
        target = validateBrandTarget(parsed.fields);
      } catch (error) {
        return reply.send(failure('VA', error instanceof Error ? error.message : 'Check the brand asset type.'));
      }
      const saved = await uploadBrandAsset(db, permission.user.id, permission.access.superuser, {
        ...target,
        svg: parsed.files.get('svg'),
        files: parsed.files,
        manifest: stringValue(parsed.fields.manifest),
      }, options);
      return saved.ok ? reply.send(success(saved.body)) : reply.send(failure(saved.code, saved.message));
    });
    routes.delete<{ Body: unknown }>('/v1/site-settings/brand-assets', async (request, reply) => {
      if (!csrfValid(request, options)) return reply.code(403).type('text/plain; charset=utf-8').send('Forbidden');
      const permission = await apiAccess(request, db, options);
      if ('response' in permission) return reply.send(permission.response);
      if (!permission.access.canManageSiteSettings) return reply.send(failure('RJ', 'Permission to change site settings is required.'));
      const input = apiJsonBody(request);
      const query = userListQuery(request);
      let target: ReturnType<typeof validateBrandTarget>;
      try {
        target = validateBrandTarget({
          asset_type: input.asset_type ?? query.get('asset_type'),
          theme: input.theme ?? query.get('theme'),
        });
      } catch (error) {
        return reply.send(failure('VA', error instanceof Error ? error.message : 'Check the brand asset type.'));
      }
      const saved = await deleteBrandAsset(db, permission.user.id, permission.access.superuser, target, options);
      return saved.ok ? reply.send(success(saved.body)) : reply.send(failure(saved.code, saved.message));
    });

    routes.get('/v1/site-settings', async (request, reply) => {
      const permission = await apiAccess(request, db, options);
      if ('response' in permission) return reply.send(permission.response);
      if (!permission.access.canManageSiteSettings) return reply.send(failure('RJ', 'Permission to change site settings is required.'));
      return reply.send(success(await serializeSiteSettings(await readSiteRow(db), permission.access.superuser, options)));
    });
    routes.put<{ Body: unknown }>('/v1/site-settings', { bodyLimit: 1024 * 1024 }, async (request, reply) => {
      if (!csrfValid(request, options)) return reply.code(403).type('text/plain; charset=utf-8').send('Forbidden');
      const permission = await apiAccess(request, db, options);
      if ('response' in permission) return reply.send(permission.response);
      if (!permission.access.canManageSiteSettings) return reply.send(failure('RJ', 'Permission to change site settings is required.'));
      const updated = await updateSiteSettings(db, permission.user.id, permission.access.superuser, apiSitePayload(apiJsonBody(request)), options);
      return sendApiResult(reply, updated);
    });

    routes.get('/v1/login-settings', async (request, reply) => {
      const permission = await apiAccess(request, db, options);
      if ('response' in permission) return reply.send(permission.response);
      if (!permission.access.superuser) return reply.send(failure('RJ', 'Superuser access is required.'));
      return reply.send(success(await serializeLoginSettings(db, options.cipherKey)));
    });
    routes.put<{ Body: unknown }>('/v1/login-settings', { bodyLimit: 1024 * 1024 }, async (request, reply) => {
      if (!csrfValid(request, options)) return reply.code(403).type('text/plain; charset=utf-8').send('Forbidden');
      const permission = await apiAccess(request, db, options);
      if ('response' in permission) return reply.send(permission.response);
      if (!permission.access.superuser) return reply.send(failure('RJ', 'Superuser access is required.'));
      const updated = await updateLoginSettings(db, permission.user.id, options.cipherKey, apiJsonBody(request));
      return sendApiResult(reply, updated);
    });

    routes.get('/v1/integration-settings', async (request, reply) => {
      const permission = await apiAccess(request, db, options);
      if ('response' in permission) return reply.send(permission.response);
      if (!permission.access.superuser) return reply.send(failure('RJ', 'Superuser access is required.'));
      return reply.send(success(integrationSettingsApi(await serializeIntegrationSettings(db, options))));
    });
    routes.put<{ Body: unknown }>('/v1/integration-settings', { bodyLimit: 64 * 1024 }, async (request, reply) => {
      if (!csrfValid(request, options)) return reply.code(403).type('text/plain; charset=utf-8').send('Forbidden');
      const permission = await apiAccess(request, db, options);
      if ('response' in permission) return reply.send(permission.response);
      if (!permission.access.superuser) return reply.send(failure('RJ', 'Superuser access is required.'));
      if (!isRecord(request.body)) return reply.send(failure('VA', 'Invalid request body.'));
      const updated = await updateIntegrationSettings(db, permission.user.id, request.body, options);
      return updated.ok
        ? reply.send(success(integrationSettingsApi(updated.body)))
        : reply.send(failure(updated.code, updated.message));
    });

    routes.get('/v1/utilities/stats', async (request, reply) => {
      const permission = await apiAccess(request, db, options);
      if ('response' in permission) return reply.send(permission.response);
      if (!permission.access.superuser) return reply.send(failure('RJ', 'Superuser access is required.'));
      return reply.send(success(camelizeValue(await readUtilityStats(db))));
    });
    const utilityActions: Array<{ path: string; action: UtilityAction }> = [
      { path: '/v1/utilities/clean-tags', action: 'clean_tags' },
      { path: '/v1/utilities/clean-sessions', action: 'clean_sessions' },
      { path: '/v1/utilities/clean-logs', action: 'clean_logs' },
        { path: '/v1/utilities/clean-images', action: 'clean_images' },
    ];
    for (const route of utilityActions) {
      routes.post<{ Body: unknown }>(route.path, { bodyLimit: 64 * 1024 }, async (request, reply) => {
        if (!csrfValid(request, options)) return reply.code(403).type('text/plain; charset=utf-8').send('Forbidden');
        const permission = await apiAccess(request, db, options);
        if ('response' in permission) return reply.send(permission.response);
        if (!permission.access.superuser) return reply.send(failure('RJ', 'Superuser access is required.'));
        if (!isRecord(request.body)) return reply.send(failure('VA', 'Invalid request body.'));
        const result = await runUtilityAction(db, request, permission.user.id, route.action, request.body, options);
        return result.ok
          ? reply.send(success(camelizeValue(result.body)))
          : reply.send(failure(result.code, result.message));
      });
    }

    routes.get('/v1/static-pages', async (request, reply) => {
      const permission = await apiAccess(request, db, options);
      if ('response' in permission) return reply.send(permission.response);
      return reply.send(success({ pages: (await readStaticPages(db)).map(staticPageApi) }));
    });
    routes.get<{ Params: { pageId: string } }>('/v1/static-pages/:pageId', async (request, reply) => {
      const permission = await apiAccess(request, db, options);
      if ('response' in permission) return reply.send(permission.response);
      const pageId = validRouteId(request.params.pageId);
      const page = pageId ? await readStaticPage(db, pageId) : null;
      if (!page) return reply.code(404).type('text/plain; charset=utf-8').send('Not found');
      return reply.send(success(staticPageApi(page)));
    });
    routes.post<{ Body: unknown }>('/v1/static-pages', { bodyLimit: 1024 * 1024 }, async (request, reply) => {
      if (!csrfValid(request, options)) return reply.code(403).type('text/plain; charset=utf-8').send('Forbidden');
      const permission = await apiAccess(request, db, options);
      if ('response' in permission) return reply.send(permission.response);
      const saved = await saveStaticPage(db, permission.user.id, staticPagePayload(apiJsonBody(request)));
      return saved.ok ? reply.send(success(staticPageApi(saved.body))) : reply.send(failure(saved.code, saved.message));
    });
    routes.put<{ Params: { pageId: string }; Body: unknown }>('/v1/static-pages/:pageId', { bodyLimit: 1024 * 1024 }, async (request, reply) => {
      if (!csrfValid(request, options)) return reply.code(403).type('text/plain; charset=utf-8').send('Forbidden');
      const permission = await apiAccess(request, db, options);
      if ('response' in permission) return reply.send(permission.response);
      const pageId = validRouteId(request.params.pageId);
      if (!pageId || !(await readStaticPage(db, pageId))) return reply.code(404).type('text/plain; charset=utf-8').send('Not found');
      const saved = await saveStaticPage(db, permission.user.id, staticPagePayload(apiJsonBody(request)), pageId);
      return saved.ok ? reply.send(success(staticPageApi(saved.body))) : reply.send(failure(saved.code, saved.message));
    });
    routes.delete<{ Params: { pageId: string } }>('/v1/static-pages/:pageId', async (request, reply) => {
      if (!csrfValid(request, options)) return reply.code(403).type('text/plain; charset=utf-8').send('Forbidden');
      const permission = await apiAccess(request, db, options);
      if ('response' in permission) return reply.send(permission.response);
      const pageId = validRouteId(request.params.pageId);
      if (!pageId) return reply.code(404).type('text/plain; charset=utf-8').send('Not found');
      const deleted = await db.$executeRaw`DELETE FROM board_staticpage WHERE id = ${pageId}`;
      if (!deleted) return reply.code(404).type('text/plain; charset=utf-8').send('Not found');
      return reply.send(success({ message: 'Static page deleted.' }));
    });

    routes.get('/v1/notices', async (request, reply) => {
      const permission = await editorApiAccess(request, db, options);
      if ('response' in permission) return reply.send(permission.response);
      return reply.send(success({ notices: (await readNotices(db, 'user', permission.user.id)).map(noticeApi) }));
    });
    routes.get<{ Params: { noticeId: string } }>('/v1/notices/:noticeId', async (request, reply) => {
      const permission = await editorApiAccess(request, db, options);
      if ('response' in permission) return reply.send(permission.response);
      const noticeId = validRouteId(request.params.noticeId);
      const notice = noticeId ? await readNotice(db, noticeId, 'user', permission.user.id) : null;
      if (!notice) return reply.code(404).type('text/plain; charset=utf-8').send('Not found');
      return reply.send(success(noticeApi(notice)));
    });
    routes.post<{ Body: unknown }>('/v1/notices', { bodyLimit: 64 * 1024 }, async (request, reply) => {
      if (!csrfValid(request, options)) return reply.code(403).type('text/plain; charset=utf-8').send('Forbidden');
      const permission = await editorApiAccess(request, db, options);
      if ('response' in permission) return reply.send(permission.response);
      const saved = await saveNotice(db, noticePayload(apiJsonBody(request)), undefined, 'user', permission.user.id);
      return saved.ok ? reply.send(success(noticeApi(saved.body))) : reply.send(failure(saved.code, saved.message));
    });
    routes.put<{ Params: { noticeId: string }; Body: unknown }>('/v1/notices/:noticeId', { bodyLimit: 64 * 1024 }, async (request, reply) => {
      if (!csrfValid(request, options)) return reply.code(403).type('text/plain; charset=utf-8').send('Forbidden');
      const permission = await editorApiAccess(request, db, options);
      if ('response' in permission) return reply.send(permission.response);
      const noticeId = validRouteId(request.params.noticeId);
      if (!noticeId || !(await readNotice(db, noticeId, 'user', permission.user.id))) {
        return reply.code(404).type('text/plain; charset=utf-8').send('Not found');
      }
      const saved = await saveNotice(db, noticePayload(apiJsonBody(request)), noticeId, 'user', permission.user.id);
      return saved.ok ? reply.send(success(noticeApi(saved.body))) : reply.send(failure(saved.code, saved.message));
    });
    routes.delete<{ Params: { noticeId: string } }>('/v1/notices/:noticeId', async (request, reply) => {
      if (!csrfValid(request, options)) return reply.code(403).type('text/plain; charset=utf-8').send('Forbidden');
      const permission = await editorApiAccess(request, db, options);
      if ('response' in permission) return reply.send(permission.response);
      const noticeId = validRouteId(request.params.noticeId);
      if (!noticeId) return reply.code(404).type('text/plain; charset=utf-8').send('Not found');
      const deleted = await db.$executeRaw`
        DELETE FROM board_sitenotice WHERE scope = 'user' AND user_id = ${permission.user.id} AND id = ${noticeId}
      `;
      if (!deleted) return reply.code(404).type('text/plain; charset=utf-8').send('Not found');
      return reply.send(success({ message: 'Notice deleted.' }));
    });

    routes.get('/v1/banners', async (request, reply) => {
      const permission = await editorApiAccess(request, db, options);
      if ('response' in permission) return reply.send(permission.response);
      return reply.send(success({ banners: (await readBanners(db, 'user', permission.user.id)).map((banner) => bannerApi(banner, false)) }));
    });
    routes.put<{ Body: unknown }>('/v1/banners/order', { bodyLimit: 64 * 1024 }, async (request, reply) => {
      if (!csrfValid(request, options)) return reply.code(403).type('text/plain; charset=utf-8').send('Forbidden');
      const permission = await editorApiAccess(request, db, options);
      if ('response' in permission) return reply.send(permission.response);
      const order = apiJsonBody(request).order;
      if (Array.isArray(order)) {
        const timestamp = djangoTimestamp();
        await db.$transaction(async (transaction) => {
          for (const item of order) {
            if (!Array.isArray(item) || item.length !== 2) continue;
            const [rawId, rawOrder] = item;
            const bannerId = typeof rawId === 'number' ? rawId : /^\d+$/.test(String(rawId)) ? Number(rawId) : NaN;
            const bannerOrder = typeof rawOrder === 'number' ? rawOrder : /^-?\d+$/.test(String(rawOrder)) ? Number(rawOrder) : NaN;
            if (!Number.isSafeInteger(bannerId) || !Number.isSafeInteger(bannerOrder)) continue;
            await transaction.$executeRaw`
              UPDATE board_sitebanner SET "order" = ${bannerOrder}, updated_date = ${timestamp}
              WHERE scope = 'user' AND user_id = ${permission.user.id} AND id = ${bannerId}
            `;
          }
        });
      }
      return reply.send(success({ message: 'Banner order updated.' }));
    });
    routes.get<{ Params: { bannerId: string } }>('/v1/banners/:bannerId(^\\d+$)', async (request, reply) => {
      const permission = await editorApiAccess(request, db, options);
      if ('response' in permission) return reply.send(permission.response);
      const bannerId = validRouteId(request.params.bannerId);
      const banner = bannerId ? await readBanner(db, bannerId, 'user', permission.user.id) : null;
      if (!banner) return reply.code(404).type('text/plain; charset=utf-8').send('Not found');
      return reply.send(success(bannerApi(banner, false)));
    });
    routes.post<{ Body: unknown }>('/v1/banners', { bodyLimit: 1024 * 1024 }, async (request, reply) => {
      if (!csrfValid(request, options)) return reply.code(403).type('text/plain; charset=utf-8').send('Forbidden');
      const permission = await editorApiAccess(request, db, options);
      if ('response' in permission) return reply.send(permission.response);
      const saved = await saveBanner(db, permission.user.id, bannerPayload(apiJsonBody(request)), undefined, 'user');
      return saved.ok ? reply.send(success(bannerApi(saved.body, false))) : reply.send(failure(saved.code, saved.message));
    });
    routes.put<{ Params: { bannerId: string }; Body: unknown }>('/v1/banners/:bannerId(^\\d+$)', { bodyLimit: 1024 * 1024 }, async (request, reply) => {
      if (!csrfValid(request, options)) return reply.code(403).type('text/plain; charset=utf-8').send('Forbidden');
      const permission = await editorApiAccess(request, db, options);
      if ('response' in permission) return reply.send(permission.response);
      const bannerId = validRouteId(request.params.bannerId);
      if (!bannerId || !(await readBanner(db, bannerId, 'user', permission.user.id))) {
        return reply.code(404).type('text/plain; charset=utf-8').send('Not found');
      }
      const saved = await saveBanner(db, permission.user.id, bannerPayload(apiJsonBody(request)), bannerId, 'user');
      return saved.ok ? reply.send(success(bannerApi(saved.body, false))) : reply.send(failure(saved.code, saved.message));
    });
    routes.delete<{ Params: { bannerId: string } }>('/v1/banners/:bannerId(^\\d+$)', async (request, reply) => {
      if (!csrfValid(request, options)) return reply.code(403).type('text/plain; charset=utf-8').send('Forbidden');
      const permission = await editorApiAccess(request, db, options);
      if ('response' in permission) return reply.send(permission.response);
      const bannerId = validRouteId(request.params.bannerId);
      if (!bannerId) return reply.code(404).type('text/plain; charset=utf-8').send('Not found');
      const deleted = await db.$executeRaw`
        DELETE FROM board_sitebanner WHERE scope = 'user' AND user_id = ${permission.user.id} AND id = ${bannerId}
      `;
      if (!deleted) return reply.code(404).type('text/plain; charset=utf-8').send('Not found');
      return reply.send(success({ message: 'Banner deleted.' }));
    });

    routes.get('/v1/global-notices', async (request, reply) => {
      const permission = await apiAccess(request, db, options);
      if ('response' in permission) return reply.send(permission.response);
      return reply.send(success({ notices: (await readNotices(db)).map(noticeApi) }));
    });
    routes.get<{ Params: { noticeId: string } }>('/v1/global-notices/:noticeId', async (request, reply) => {
      const permission = await apiAccess(request, db, options);
      if ('response' in permission) return reply.send(permission.response);
      const noticeId = validRouteId(request.params.noticeId);
      const notice = noticeId ? await readNotice(db, noticeId) : null;
      if (!notice) return reply.code(404).type('text/plain; charset=utf-8').send('Not found');
      return reply.send(success(noticeApi(notice)));
    });
    routes.post<{ Body: unknown }>('/v1/global-notices', { bodyLimit: 64 * 1024 }, async (request, reply) => {
      if (!csrfValid(request, options)) return reply.code(403).type('text/plain; charset=utf-8').send('Forbidden');
      const permission = await apiAccess(request, db, options);
      if ('response' in permission) return reply.send(permission.response);
      const saved = await saveNotice(db, noticePayload(apiJsonBody(request)));
      return saved.ok ? reply.send(success(noticeApi(saved.body))) : reply.send(failure(saved.code, saved.message));
    });
    routes.put<{ Params: { noticeId: string }; Body: unknown }>('/v1/global-notices/:noticeId', { bodyLimit: 64 * 1024 }, async (request, reply) => {
      if (!csrfValid(request, options)) return reply.code(403).type('text/plain; charset=utf-8').send('Forbidden');
      const permission = await apiAccess(request, db, options);
      if ('response' in permission) return reply.send(permission.response);
      const noticeId = validRouteId(request.params.noticeId);
      if (!noticeId) return reply.code(404).type('text/plain; charset=utf-8').send('Not found');
      const saved = await saveNotice(db, noticePayload(apiJsonBody(request)), noticeId);
      return saved.ok ? reply.send(success(noticeApi(saved.body))) : reply.send(failure(saved.code, saved.message));
    });
    routes.delete<{ Params: { noticeId: string } }>('/v1/global-notices/:noticeId', async (request, reply) => {
      if (!csrfValid(request, options)) return reply.code(403).type('text/plain; charset=utf-8').send('Forbidden');
      const permission = await apiAccess(request, db, options);
      if ('response' in permission) return reply.send(permission.response);
      const noticeId = validRouteId(request.params.noticeId);
      if (!noticeId) return reply.code(404).type('text/plain; charset=utf-8').send('Not found');
      const deleted = await db.$executeRaw`DELETE FROM board_sitenotice WHERE scope = 'global' AND id = ${noticeId}`;
      if (!deleted) return reply.code(404).type('text/plain; charset=utf-8').send('Not found');
      return reply.send(success({ message: 'Notice deleted.' }));
    });

    routes.get('/v1/global-banners', async (request, reply) => {
      const permission = await apiAccess(request, db, options);
      if ('response' in permission) return reply.send(permission.response);
      return reply.send(success({ banners: (await readBanners(db)).map((banner) => bannerApi(banner)) }));
    });
    routes.get<{ Params: { bannerId: string } }>('/v1/global-banners/:bannerId(^\\d+$)', async (request, reply) => {
      const permission = await apiAccess(request, db, options);
      if ('response' in permission) return reply.send(permission.response);
      const bannerId = validRouteId(request.params.bannerId);
      const banner = bannerId ? await readBanner(db, bannerId) : null;
      if (!banner) return reply.code(404).type('text/plain; charset=utf-8').send('Not found');
      return reply.send(success(bannerApi(banner)));
    });
    routes.post<{ Body: unknown }>('/v1/global-banners', { bodyLimit: 1024 * 1024 }, async (request, reply) => {
      if (!csrfValid(request, options)) return reply.code(403).type('text/plain; charset=utf-8').send('Forbidden');
      const permission = await apiAccess(request, db, options);
      if ('response' in permission) return reply.send(permission.response);
      const saved = await saveBanner(db, permission.user.id, bannerPayload(apiJsonBody(request)));
      return saved.ok ? reply.send(success(bannerApi(saved.body))) : reply.send(failure(saved.code, saved.message));
    });
    routes.put<{ Params: { bannerId: string }; Body: unknown }>('/v1/global-banners/:bannerId(^\\d+$)', { bodyLimit: 1024 * 1024 }, async (request, reply) => {
      if (!csrfValid(request, options)) return reply.code(403).type('text/plain; charset=utf-8').send('Forbidden');
      const permission = await apiAccess(request, db, options);
      if ('response' in permission) return reply.send(permission.response);
      const bannerId = validRouteId(request.params.bannerId);
      if (!bannerId) return reply.code(404).type('text/plain; charset=utf-8').send('Not found');
      const saved = await saveBanner(db, permission.user.id, bannerPayload(apiJsonBody(request)), bannerId);
      return saved.ok ? reply.send(success(bannerApi(saved.body))) : reply.send(failure(saved.code, saved.message));
    });
    routes.delete<{ Params: { bannerId: string } }>('/v1/global-banners/:bannerId(^\\d+$)', async (request, reply) => {
      if (!csrfValid(request, options)) return reply.code(403).type('text/plain; charset=utf-8').send('Forbidden');
      const permission = await apiAccess(request, db, options);
      if ('response' in permission) return reply.send(permission.response);
      const bannerId = validRouteId(request.params.bannerId);
      if (!bannerId) return reply.code(404).type('text/plain; charset=utf-8').send('Not found');
      const deleted = await db.$executeRaw`DELETE FROM board_sitebanner WHERE scope = 'global' AND id = ${bannerId}`;
      if (!deleted) return reply.code(404).type('text/plain; charset=utf-8').send('Not found');
      return reply.send(success({ message: 'Global banner deleted.' }));
    });
    routes.put<{ Body: unknown }>('/v1/global-banners/order', { bodyLimit: 64 * 1024 }, async (request, reply) => {
      if (!csrfValid(request, options)) return reply.code(403).type('text/plain; charset=utf-8').send('Forbidden');
      const permission = await apiAccess(request, db, options);
      if ('response' in permission) return reply.send(permission.response);
      const order = apiJsonBody(request).order;
      if (Array.isArray(order)) {
        const timestamp = djangoTimestamp();
        await db.$transaction(async (transaction) => {
          for (const item of order) {
            if (!Array.isArray(item) || item.length !== 2) continue;
            const [rawId, rawOrder] = item;
            const bannerId = typeof rawId === 'number' ? rawId : /^\d+$/.test(String(rawId)) ? Number(rawId) : NaN;
            const bannerOrder = typeof rawOrder === 'number' ? rawOrder : /^-?\d+$/.test(String(rawOrder)) ? Number(rawOrder) : NaN;
            if (!Number.isSafeInteger(bannerId) || !Number.isSafeInteger(bannerOrder)) continue;
            await transaction.$executeRaw`
              UPDATE board_sitebanner SET "order" = ${bannerOrder}, updated_date = ${timestamp}
              WHERE scope = 'global' AND id = ${bannerId}
            `;
          }
        });
      }
      return reply.send(success({ message: 'Global banner order updated.' }));
    });

    routes.get('/v1/admin/users', async (request, reply) => {
      const permission = await apiAccess(request, db, options);
      if ('response' in permission) return reply.send(permission.response);
      return reply.send(success(managedUserListApi(await readManagedUsers(db, request))));
    });
    routes.patch<{ Params: { userId: string }; Body: unknown }>('/v1/admin/users/:userId/role', { bodyLimit: 64 * 1024 }, async (request, reply) => {
      if (!csrfValid(request, options)) return reply.code(403).type('text/plain; charset=utf-8').send('Forbidden');
      const permission = await apiAccess(request, db, options);
      if ('response' in permission) return reply.send(permission.response);
      const targetId = validRouteId(request.params.userId);
      if (!targetId) return reply.send(failure('NF', 'User not found.'));
      const body = apiJsonBody(request);
      const updated = await updateManagedUserRole(db, permission.user.id, targetId, body.role);
      return updated.ok
        ? reply.send(success({ user: managedUserApi(updated.body) }))
        : reply.send(failure(updated.code, updated.message));
    });

    routes.get('/v1/admin/author-invites', async (request, reply) => {
      const permission = await apiAccess(request, db, options);
      if ('response' in permission) return reply.send(permission.response);
      return reply.send(success({ invites: await readInvites(db) }));
    });
    routes.post<{ Body: unknown }>('/v1/admin/author-invites', { bodyLimit: 64 * 1024 }, async (request, reply) => {
      if (!csrfValid(request, options)) return reply.code(403).type('text/plain; charset=utf-8').send('Forbidden');
      const permission = await apiAccess(request, db, options);
      if ('response' in permission) return reply.send(permission.response);
      const body = apiJsonBody(request);
      const invite = await createInvite(db, permission.user.id, body.note);
      return reply.send(success({ invite }));
    });
    routes.delete<{ Params: { inviteId: string } }>('/v1/admin/author-invites/:inviteId', async (request, reply) => {
      if (!csrfValid(request, options)) return reply.code(403).type('text/plain; charset=utf-8').send('Forbidden');
      const permission = await apiAccess(request, db, options);
      if ('response' in permission) return reply.send(permission.response);
      if (!/^\d+$/.test(request.params.inviteId) || !Number.isSafeInteger(Number(request.params.inviteId))) {
        return reply.send(failure('NF', 'Invitation link not found.'));
      }
      const id = Number(request.params.inviteId);
      const deleted = await deleteInvite(db, id);
      if (deleted === 'claimed') return reply.send(failure('RJ', 'A used invitation link cannot be deleted.'));
      if (deleted === 'missing') return reply.send(failure('NF', 'Invitation link not found.'));
      return reply.send(success());
    });
  });
}
