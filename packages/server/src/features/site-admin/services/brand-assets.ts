import { Prisma, type PrismaClient } from '@prisma/client';
import sharp from 'sharp';
import { createHash } from 'node:crypto';
import { lstat, mkdir, readFile, realpath, stat, unlink, writeFile } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { type AdminSiteSettings } from '../types.js';
import { SiteRow, ensureSiteSetting, parseManifest, readSiteRow, serializeSiteSettings } from './site-settings.js';
import { AdminSettingsOptions, ApiResult, djangoTimestamp, isRecord, recordAudit } from '../shared.js';

export const ICON_PNG_SIZES = [16, 32, 57, 72, 76, 96, 114, 120, 128, 144, 152, 192, 256, 512] as const;

const BRAND_SVG_MAX_BYTES = 256 * 1024;

const BRAND_PNG_MAX_BYTES = 512 * 1024;

export const BRAND_ICO_MAX_BYTES = 1024 * 1024;

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

export async function mediaRootRealPath(mediaRoot: string | undefined): Promise<string> {
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

export function validateBrandTarget(value: unknown): { assetType: BrandAssetType; theme: BrandAssetTheme } {
  const input = isRecord(value) ? value : {};
  if (input.asset_type !== 'logo' && input.asset_type !== 'icon') throw new BrandAssetValidationError('Check the brand asset type.');
  if (input.theme !== 'default' && input.theme !== 'dark') throw new BrandAssetValidationError('Check the brand asset theme.');
  return { assetType: input.asset_type, theme: input.theme };
}

export async function uploadBrandAsset(
  db: PrismaClient,
  userId: number,
  canManageScripts: boolean,
  input: { assetType: BrandAssetType; theme: BrandAssetTheme; svg?: Buffer; files: Map<string, Buffer>; manifest: string },
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
      manifestSource = parseBrandIconManifest(input.manifest);
      for (const size of REQUIRED_ICON_PNG_SIZES) pngContent.set(size, await validateBrandPng(input.files.get(`png_${size}`), size));
      ico = await validateBrandIco(input.files.get('favicon_ico'));
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

export async function deleteBrandAsset(
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
