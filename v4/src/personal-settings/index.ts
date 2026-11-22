import formBody from '@fastify/formbody';
import multipart from '@fastify/multipart';
import type { Prisma, PrismaClient } from '@prisma/client';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import sharp from 'sharp';
import { createHash, randomUUID } from 'node:crypto';
import { chmod, mkdir, open, realpath, rename, rm, unlink } from 'node:fs/promises';
import { relative, resolve, sep } from 'node:path';
import { updateAccountIdentity } from '../auth/account-identity.js';
import { postOutline, sanitizePostHtml } from '../post-html.js';
import { markdownToHtml } from '../authoring/markdown.js';
import {
  renderAccountSettings,
  renderProfileSettings,
  renderSocialLinkSettings,
  type AccountSettingsView,
  type PersonalSettingsUser,
  type ProfileSettingsView,
  type RegionalPreferences,
} from './pages.js';

export interface PersonalSettingsOptions {
  currentUser: (request: FastifyRequest) => Promise<PersonalSettingsUser | null>;
  validateCsrf: (request: FastifyRequest) => boolean;
  siteUrl: URL;
  mediaRoot?: string;
  updatePassword?: (
    request: FastifyRequest,
    reply: FastifyReply,
    user: PersonalSettingsUser,
    payload: Record<string, unknown>,
  ) => Promise<unknown> | unknown;
}

type Body = Record<string, unknown>;
type RegionalConfig = { language: string | null; timeZone: string };
type SocialLink = { id: number; name: string; value: string; order: number };
type UpdateResult = { ok: true } | { ok: false; message: string; messageKey?: string };

const DEFAULT_LANGUAGE = 'ko';
const DEFAULT_LANGUAGES = [
  { code: 'ko', label: '한국어' },
  { code: 'en', label: '영어' },
];
const DEFAULT_TIME_ZONE = process.env.TZ || 'Asia/Seoul';
const MAX_PROFILE_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_PROFILE_IMAGE_PIXELS = 16_000_000;
const MAX_ABOUT_MARKDOWN_BYTES = 256 * 1024;

function success(body: unknown = {}) {
  return { status: 'DONE', body };
}

function failure(code: string, message = '', extra: Record<string, unknown> = {}) {
  return { status: 'ERROR', errorCode: `error:${code}`, errorMessage: message, ...extra };
}

function needLogin() {
  return failure('NL');
}

function bodyRecord(input: unknown): Body {
  if (!input || typeof input !== 'object' || Array.isArray(input) || Buffer.isBuffer(input)) return {};
  return input as Body;
}

function stringValue(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (Array.isArray(value)) return stringValue(value.at(-1));
  return '';
}

function positiveId(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : /^\d+$/.test(stringValue(value)) ? Number(value) : NaN;
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function formValue(request: FastifyRequest, name: string): string {
  return stringValue(bodyRecord(request.body)[name]);
}

function cookieValue(request: FastifyRequest, name: string): string {
  for (const part of (request.headers.cookie ?? '').split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0 || part.slice(0, separator).trim() !== name) continue;
    try {
      return decodeURIComponent(part.slice(separator + 1).trim());
    } catch {
      return '';
    }
  }
  return '';
}

function csrfToken(request: FastifyRequest): string {
  const value = cookieValue(request, 'csrftoken');
  return /^[A-Za-z0-9_-]{43}$/.test(value) ? value : '';
}

function loginRedirect(request: FastifyRequest, reply: FastifyReply) {
  const next = request.url.split('?')[0] || '/settings/';
  return reply.redirect(`/login?next=${encodeURIComponent(next)}`, 302);
}

function languageChoices(): Array<{ code: string; label: string }> {
  const englishEnabled = process.env.DEBUG === 'TRUE' || process.env.ENABLE_ENGLISH_UI === 'TRUE';
  return englishEnabled ? DEFAULT_LANGUAGES : DEFAULT_LANGUAGES.slice(0, 1);
}

function timeZoneChoices(): string[] {
  let zones: string[] = [];
  try {
    if (typeof Intl.supportedValuesOf === 'function') zones = Intl.supportedValuesOf('timeZone');
  } catch {
    zones = [];
  }
  return [...new Set([...zones, 'UTC'])].filter((zone) => zone !== 'Factory' && zone !== 'localtime').sort();
}

const availableTimeZones = timeZoneChoices();
const supportedZones = new Set(availableTimeZones);

function isSupportedTimeZone(value: string): boolean {
  if (!value || value.length > 64) return false;
  if (supportedZones.has(value)) return true;
  try {
    new Intl.DateTimeFormat('en', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

function normalizedLanguage(value: string | null, languages: Array<{ code: string }>): string {
  return value && languages.some(({ code }) => code === value) ? value : '';
}

function normalizedTimeZone(value: string | null): string {
  return value && isSupportedTimeZone(value) ? value : '';
}

function accountDate(value: string | null, timeZone: string): string {
  if (!value) return '';
  const timestamp = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value)
    ? value.replace(' ', 'T')
    : `${value.replace(' ', 'T')}Z`;
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) return '';
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: isSupportedTimeZone(timeZone) ? timeZone : DEFAULT_TIME_ZONE,
      year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(date);
    const fields = Object.fromEntries(parts.map(({ type, value: partValue }) => [type, partValue]));
    return `${fields.year}-${fields.month}-${fields.day}`;
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

function regionalPreferences(config: RegionalConfig | null): RegionalPreferences {
  const languages = languageChoices();
  const timeZones = [...availableTimeZones];
  if (config?.timeZone && isSupportedTimeZone(config.timeZone) && !timeZones.includes(config.timeZone)) {
    timeZones.push(config.timeZone);
    timeZones.sort();
  }
  return {
    language: config === null || config.language === null ? null : normalizedLanguage(config.language, languages),
    timeZone: normalizedTimeZone(config?.timeZone ?? null),
    defaultLanguage: DEFAULT_LANGUAGE,
    defaultTimeZone: DEFAULT_TIME_ZONE,
    languages,
    timeZones,
  };
}

async function readAccount(db: PrismaClient, userId: number): Promise<AccountSettingsView | null> {
  const [account] = await db.$queryRaw<Array<{
    username: string;
    name: string;
    email: string;
    createdDate: string | null;
  }>>`
    SELECT username, first_name AS name, email,
           CAST(date_joined AS TEXT) AS createdDate
      FROM auth_user
     WHERE id = ${userId}
     LIMIT 1
  `;
  if (!account) return null;

  const [config] = await db.$queryRaw<Array<{ language: string | null; timeZone: string | null }>>`
    SELECT language, time_zone AS timeZone
      FROM board_config
     WHERE user_id = ${userId}
     LIMIT 1
  `;
  const preferences = regionalPreferences(config ? { language: config.language, timeZone: config.timeZone ?? '' } : null);
  return {
    username: account.username,
    name: account.name,
    email: account.email,
    createdDate: accountDate(account.createdDate, preferences.timeZone || preferences.defaultTimeZone),
    regionalPreferences: preferences,
  };
}

async function accountExtras(db: PrismaClient, userId: number): Promise<{ accountDeletionRedirectUrl: string; has2fa: boolean }> {
  let accountDeletionRedirectUrl = '';
  try {
    const [setting] = await db.$queryRaw<Array<{ url: string | null }>>`
      SELECT account_deletion_redirect_url AS url FROM board_loginsetting LIMIT 1
    `;
    accountDeletionRedirectUrl = setting?.url ?? '';
  } catch {
    accountDeletionRedirectUrl = '';
  }
  let has2fa = false;
  try {
    const [result] = await db.$queryRaw<Array<{ enabled: number | bigint | boolean }>>`
      SELECT EXISTS (SELECT 1 FROM board_twofactorauth WHERE user_id = ${userId}) AS enabled
    `;
    has2fa = Boolean(result?.enabled);
  } catch {
    has2fa = false;
  }
  return { accountDeletionRedirectUrl, has2fa };
}

function mediaUrl(siteUrl: URL, path: string): string {
  const configuredResourceUrl = process.env.RESOURCE_URL?.trim().replace(/\/$/, '') ?? '';
  const resourcePath = `${configuredResourceUrl}/resources/`;
  const resourceBase = new URL(resourcePath, siteUrl);
  return new URL(`media/${path.replace(/^\/+/, '')}`, resourceBase).href;
}

/** 3.x answered profile uploads with a site-relative path unless a resource host was configured. */
function uploadedMediaUrl(url: string): string {
  return process.env.RESOURCE_URL?.trim() ? url : new URL(url).pathname;
}

function defaultAvatarUrl(siteUrl: URL): string {
  const configuredResourceUrl = process.env.RESOURCE_URL?.trim().replace(/\/$/, '') ?? '';
  const resourceBase = new URL(`${configuredResourceUrl}/resources/`, siteUrl);
  return new URL('assets/images/default-avatar.jpg', resourceBase).href;
}

async function readProfile(db: PrismaClient, userId: number, siteUrl: URL): Promise<ProfileSettingsView | null> {
  const [profile] = await db.$queryRaw<Array<{
    avatar: string | null;
    cover: string | null;
    bio: string;
    homepage: string;
  }>>`
    SELECT avatar, cover, bio, homepage
      FROM board_profile
     WHERE user_id = ${userId}
     LIMIT 1
  `;
  if (!profile) return null;

  const links = await db.$queryRaw<Array<{
    id: number;
    name: string;
    value: string;
    order: number;
  }>>`
    SELECT id, name, value, "order" AS "order"
      FROM board_userlinkmeta
     WHERE user_id = ${userId}
     ORDER BY "order" ASC, id ASC
  `;
  const social = links
    .filter((link) => safeExternalUrl(link.value) !== '')
    .map((link) => ({ id: link.id, name: link.name, value: safeExternalUrl(link.value), order: Number(link.order) }));
  return {
    avatar: profile.avatar ? mediaUrl(siteUrl, profile.avatar) : defaultAvatarUrl(siteUrl),
    cover: profile.cover ? mediaUrl(siteUrl, profile.cover) : null,
    bio: profile.bio ?? '',
    homepage: profile.homepage ?? '',
    social,
  };
}

function decodeUrlEntities(value: string): string {
  return value
    .replace(/&#(?:x([\da-f]+)|(\d+));?/gi, (_match, hex: string | undefined, decimal: string | undefined) => {
      const codePoint = Number.parseInt(hex ?? decimal ?? '', hex ? 16 : 10);
      return Number.isFinite(codePoint) && codePoint > 0 && codePoint <= 0x10ffff
        ? String.fromCodePoint(codePoint)
        : '\ufffd';
    })
    .replace(/&colon;?/gi, ':')
    .replace(/&sol;?/gi, '/')
    .replace(/&period;?/gi, '.')
    .replace(/&amp;?/gi, '&');
}

function safeExternalUrl(input: string): string {
  const value = decodeUrlEntities(input).trim();
  if (!value || /[\x00\r\n\t]/.test(value)) return '';
  if (!/^https?:\/\//i.test(value)) return '';
  try {
    const parsed = new URL(value);
    if ((parsed.protocol !== 'http:' && parsed.protocol !== 'https:') || !parsed.hostname) return '';
    return value;
  } catch {
    return '';
  }
}

function validateHomepage(value: string): UpdateResult {
  if (value && !safeExternalUrl(value)) {
    return { ok: false, message: '홈페이지 주소는 HTTP 또는 HTTPS URL이어야 합니다.' };
  }
  return { ok: true };
}

function regionalError(field: 'language' | 'time_zone'): UpdateResult {
  return {
    ok: false,
    message: field === 'language' ? '지원하는 언어를 선택하세요.' : '유효한 시간대를 선택하세요.',
    messageKey: `settings.regional_preferences.invalid_${field}`,
  };
}

async function updateDisplayName(db: PrismaClient, userId: number, value: unknown): Promise<UpdateResult> {
  if (typeof value !== 'string') return { ok: false, message: '이름을 입력해 주세요.' };
  if (value.length > 30) return { ok: false, message: '이름은 30자 이하여야 합니다.' };
  if (value) {
    await db.$executeRaw`UPDATE auth_user SET first_name = ${value} WHERE id = ${userId}`;
  }
  return { ok: true };
}

async function updateRegionalPreferences(db: PrismaClient, userId: number, body: Body): Promise<UpdateResult> {
  const language = body.language;
  const timeZone = body.time_zone;
  const languages = languageChoices();
  if (language !== null && language !== '' && (typeof language !== 'string' || !languages.some(({ code }) => code === language))) {
    return regionalError('language');
  }
  if (typeof timeZone !== 'string' || (timeZone !== '' && !isSupportedTimeZone(timeZone))) {
    return regionalError('time_zone');
  }
  await db.$executeRaw`
    INSERT INTO board_config (user_id, language, time_zone)
    VALUES (${userId}, ${language as string | null}, ${timeZone})
    ON CONFLICT(user_id) DO UPDATE SET language = excluded.language, time_zone = excluded.time_zone
  `;
  return { ok: true };
}

async function updateProfile(db: PrismaClient, userId: number, body: Body): Promise<UpdateResult> {
  const bio = body.bio === undefined ? '' : body.bio;
  const homepage = body.homepage === undefined ? '' : body.homepage;
  if (typeof bio !== 'string' || typeof homepage !== 'string') {
    return { ok: false, message: '프로필 정보를 확인해 주세요.' };
  }
  if (bio.length > 500) return { ok: false, message: '소개는 500자 이하여야 합니다.' };
  if (homepage.length > 100) return { ok: false, message: '홈페이지 주소는 100자 이하여야 합니다.' };
  const homepageValidation = validateHomepage(homepage);
  if (!homepageValidation.ok) return homepageValidation;
  await db.$executeRaw`
    UPDATE board_profile SET bio = ${bio}, homepage = ${homepage ? safeExternalUrl(homepage) : ''}
     WHERE user_id = ${userId}
  `;
  return { ok: true };
}

type ProfileImageKind = 'avatar' | 'cover';

interface EncodedProfileImage {
  buffer: Buffer;
  extension: 'jpg' | 'png' | 'webp' | 'gif';
}

function profileMediaPrefix(username: string): string {
  return createHash('md5').update(username).digest('hex').slice(0, 2);
}

function safeUsernamePathPart(username: string): boolean {
  return /^[a-z0-9]{4,15}$/.test(username);
}

function isWithinDirectory(parent: string, child: string): boolean {
  const pathFromParent = relative(parent, child);
  return pathFromParent !== '' && pathFromParent !== '..' && !pathFromParent.startsWith(`..${sep}`);
}

function safeLegacyProfileImagePath(
  value: string | null,
  username: string,
  kind?: ProfileImageKind,
): string | null {
  if (!value || !safeUsernamePathPart(username) || value.includes('\\') || value.startsWith('/')) return null;
  const match = value.match(/^images\/avatar\/([a-f0-9]{2})\/([a-z0-9]{4,15})\/([ac][A-Za-z0-9]{4,32}\.(?:jpg|png|webp|gif))$/i);
  if (!match || match[1].toLowerCase() !== profileMediaPrefix(username) || match[2] !== username) return null;
  if (kind === 'avatar' && !/^a/i.test(match[3])) return null;
  if (kind === 'cover' && !/^c/i.test(match[3])) return null;
  return value;
}

async function encodeProfileImage(input: Buffer, kind: ProfileImageKind): Promise<EncodedProfileImage | null> {
  if (!input.length || input.length > MAX_PROFILE_IMAGE_BYTES) return null;
  const animated = kind === 'cover';
  try {
    const metadata = await sharp(input, {
      animated,
      failOn: 'warning',
      limitInputPixels: MAX_PROFILE_IMAGE_PIXELS,
      pages: animated ? -1 : 1,
    }).metadata();
    const extensions: Record<string, EncodedProfileImage['extension']> = {
      jpeg: 'jpg', png: 'png', webp: 'webp', gif: 'gif',
    };
    const extension = extensions[metadata.format];
    const frameHeight = metadata.pageHeight ?? metadata.height ?? 0;
    const width = metadata.width ?? 0;
    const pages = Math.max(1, metadata.pages ?? 1);
    if (!extension || width < 1 || frameHeight < 1 || width * frameHeight > MAX_PROFILE_IMAGE_PIXELS) return null;
    if (animated && pages > 1 && width * frameHeight * pages > MAX_PROFILE_IMAGE_PIXELS) return null;

    let pipeline = sharp(input, {
      animated,
      failOn: 'warning',
      limitInputPixels: MAX_PROFILE_IMAGE_PIXELS,
      pages: animated ? -1 : 1,
    }).rotate();
    if (kind === 'avatar') pipeline = pipeline.resize(500, 500, { fit: 'inside', withoutEnlargement: true });
    let encoded: Buffer;
    if (metadata.format === 'jpeg') encoded = await pipeline.jpeg({ quality: 90 }).toBuffer();
    else if (metadata.format === 'png') encoded = await pipeline.png().toBuffer();
    else if (metadata.format === 'webp') encoded = await pipeline.webp({
      ...(animated && pages > 1 ? { loop: metadata.loop ?? 0, delay: metadata.delay } : {}),
    }).toBuffer();
    else encoded = await pipeline.gif({
      ...(animated && pages > 1 ? { loop: metadata.loop ?? 0, delay: metadata.delay } : {}),
    }).toBuffer();
    if (!encoded.length || encoded.length > MAX_PROFILE_IMAGE_BYTES * 2) return null;
    return { buffer: encoded, extension };
  } catch {
    return null;
  }
}

async function prepareMediaDirectory(mediaRoot: string, relativeDirectory: string): Promise<{ root: string; directory: string }> {
  const requestedRoot = resolve(mediaRoot);
  await mkdir(requestedRoot, { recursive: true, mode: 0o755 });
  const root = await realpath(requestedRoot);
  const requestedDirectory = resolve(root, ...relativeDirectory.split('/'));
  if (!isWithinDirectory(root, requestedDirectory)) throw new Error('invalid-profile-media-directory');
  await mkdir(requestedDirectory, { recursive: true, mode: 0o755 });
  const directory = await realpath(requestedDirectory);
  if (!isWithinDirectory(root, directory)) throw new Error('invalid-profile-media-directory');
  return { root, directory };
}

async function saveProfileImage(
  db: PrismaClient,
  user: PersonalSettingsUser,
  kind: ProfileImageKind,
  input: Buffer,
  mediaRoot: string,
  siteUrl: URL,
): Promise<string | null> {
  if (!safeUsernamePathPart(user.username)) return null;
  const encoded = await encodeProfileImage(input, kind);
  if (!encoded) return null;
  const prefix = profileMediaPrefix(user.username);
  const relativeDirectory = `images/avatar/${prefix}/${user.username}`;
  const { root, directory } = await prepareMediaDirectory(mediaRoot, relativeDirectory);
  const filename = `${kind === 'avatar' ? 'a' : 'c'}${randomUUID().replace(/-/g, '')}.${encoded.extension}`;
  const relativePath = `${relativeDirectory}/${filename}`;
  if (!safeLegacyProfileImagePath(relativePath, user.username, kind)) throw new Error('invalid-profile-media-path');
  const target = resolve(directory, filename);
  if (!isWithinDirectory(root, target)) throw new Error('invalid-profile-media-target');
  const temporary = resolve(directory, `.${filename}.${randomUUID()}.tmp`);
  let committed = false;
  try {
    const handle = await open(temporary, 'wx', 0o600);
    try {
      await handle.writeFile(encoded.buffer);
      await handle.sync();
    } finally {
      await handle.close();
    }
    await rename(temporary, target);
    await chmod(target, 0o644);
    const updated = kind === 'avatar'
      ? await db.$executeRaw`UPDATE board_profile SET avatar = ${relativePath} WHERE user_id = ${user.id}`
      : await db.$executeRaw`UPDATE board_profile SET cover = ${relativePath} WHERE user_id = ${user.id}`;
    if (Number(updated) !== 1) throw new Error('profile-row-not-found');
    committed = true;
    return mediaUrl(siteUrl, relativePath);
  } finally {
    await rm(temporary, { force: true }).catch(() => undefined);
    if (!committed) await rm(target, { force: true }).catch(() => undefined);
  }
}

async function removeScopedProfileImage(mediaRoot: string, path: string | null, username: string): Promise<void> {
  const relativePath = safeLegacyProfileImagePath(path, username, 'cover');
  if (!relativePath) return;
  const requestedRoot = resolve(mediaRoot);
  let root: string;
  try {
    root = await realpath(requestedRoot);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
    throw error;
  }
  const target = resolve(root, ...relativePath.split('/'));
  if (!isWithinDirectory(root, target)) return;
  try {
    const realTarget = await realpath(target);
    if (!isWithinDirectory(root, realTarget)) return;
    await unlink(realTarget);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
}

async function deleteProfileCover(db: PrismaClient, user: PersonalSettingsUser, mediaRoot: string): Promise<void> {
  const [profile] = await db.$queryRaw<Array<{ cover: string | null }>>`
    SELECT cover FROM board_profile WHERE user_id = ${user.id} LIMIT 1
  `;
  if (!profile) throw new Error('profile-row-not-found');
  await removeScopedProfileImage(mediaRoot, profile.cover, user.username);
  await db.$executeRaw`UPDATE board_profile SET cover = '' WHERE user_id = ${user.id}`;
}

function renderAboutMarkdownToHtml(markdown: string): string {
  return postOutline(markdownToHtml(markdown), { maxLength: 25, fallback: 'header' }).html;
}

interface AuthorAboutRow {
  id: number;
  username: string;
  isActive: number | bigint | boolean;
  role: string | null;
  aboutMarkdown: string | null;
  aboutHtml: string | null;
}

async function readAuthorAbout(db: PrismaClient, username: string): Promise<AuthorAboutRow | null> {
  const [author] = await db.$queryRaw<AuthorAboutRow[]>`
    SELECT user.id, user.username, CAST(user.is_active AS INTEGER) AS isActive,
           profile.role AS role, profile.about_md AS aboutMarkdown, profile.about_html AS aboutHtml
      FROM auth_user AS user
      LEFT JOIN board_profile AS profile ON profile.user_id = user.id
     WHERE user.username = ${username}
     LIMIT 1
  `;
  return author ?? null;
}

async function ensureAuthorProfile(db: PrismaClient, userId: number): Promise<void> {
  await db.$executeRaw`
    INSERT INTO board_profile
      (bio, cover, avatar, homepage, about_md, about_html, user_id, analytics_share_url, role)
    VALUES ('', '', '', '', '', '', ${userId}, '', 'READER')
    ON CONFLICT(user_id) DO NOTHING
  `;
}

async function saveAuthorAbout(db: PrismaClient, userId: number, markdown: unknown): Promise<{ markdown: string; html: string } | null> {
  if (typeof markdown !== 'string' || Buffer.byteLength(markdown, 'utf8') > MAX_ABOUT_MARKDOWN_BYTES) return null;
  const html = renderAboutMarkdownToHtml(markdown);
  await ensureAuthorProfile(db, userId);
  await db.$executeRaw`UPDATE board_profile SET about_md = ${markdown}, about_html = ${html} WHERE user_id = ${userId}`;
  return { markdown, html };
}

function isActiveEditor(author: AuthorAboutRow): boolean {
  return Boolean(author.isActive) && author.role === 'EDITOR';
}

async function authenticatedDatabaseUser(
  db: PrismaClient,
  request: FastifyRequest,
  options: PersonalSettingsOptions,
): Promise<PersonalSettingsUser | null> {
  const supplied = await options.currentUser(request);
  if (!supplied || !Number.isSafeInteger(supplied.id) || supplied.id < 1 || !supplied.username) return null;
  const [active] = await db.$queryRaw<Array<{ active: number | bigint | boolean }>>`
    SELECT CAST(is_active AS INTEGER) AS active FROM auth_user
     WHERE id = ${supplied.id} AND username = ${supplied.username}
     LIMIT 1
  `;
  return active && Boolean(active.active) ? supplied : null;
}

interface SocialMutation {
  updates: SocialLink[];
  creates: Array<Omit<SocialLink, 'id'>>;
  deletes: number[];
}

function splitLegacyItems(value: string): string[] {
  return value.split('&').filter(Boolean);
}

function socialValueError(): UpdateResult {
  return { ok: false, message: '소셜 링크를 확인해 주세요. HTTPS 주소와 쉼표, 앰퍼샌드가 없는 값을 사용하세요.' };
}

function validateSocialFields(name: string, value: string, orderValue: string): number | null {
  if (!name || name.length > 50 || name.includes(',') || name.includes('&') || value.length > 255 || value.includes(',') || value.includes('&')) return null;
  if (!value.startsWith('https://') || !safeExternalUrl(value)) return null;
  if (!/^-?\d+$/.test(orderValue)) return null;
  const order = Number(orderValue);
  return Number.isSafeInteger(order) && order >= 0 ? order : null;
}

function parseSocialMutation(body: Body, mode: 'legacy' | 'form'): SocialMutation | UpdateResult {
  if (mode === 'form') {
    const intent = stringValue(body.intent);
    const name = stringValue(body.name);
    const value = stringValue(body.value);
    const orderValue = stringValue(body.order);
    if (intent === 'delete') {
      const id = positiveId(body.id);
      return id ? { updates: [], creates: [], deletes: [id] } : socialValueError();
    }
    const order = validateSocialFields(name, value, orderValue);
    if (order === null) return socialValueError();
    if (intent === 'create') return { updates: [], creates: [{ name, value, order }], deletes: [] };
    if (intent === 'update') {
      const id = positiveId(body.id);
      return id ? { updates: [{ id, name, value, order }], creates: [], deletes: [] } : socialValueError();
    }
    return socialValueError();
  }

  const updates: SocialLink[] = [];
  const creates: Array<Omit<SocialLink, 'id'>> = [];
  const deletes: number[] = [];
  for (const item of splitLegacyItems(stringValue(body.update))) {
    const values = item.split(',');
    if (values.length !== 4) return socialValueError();
    const id = positiveId(values[0]);
    const order = validateSocialFields(values[1], values[2], values[3]);
    if (!id || order === null) return socialValueError();
    updates.push({ id, name: values[1], value: values[2], order });
  }
  for (const item of splitLegacyItems(stringValue(body.create))) {
    const values = item.split(',');
    if (values.length !== 3) return socialValueError();
    const order = validateSocialFields(values[0], values[1], values[2]);
    if (order === null) return socialValueError();
    creates.push({ name: values[0], value: values[1], order });
  }
  for (const item of splitLegacyItems(stringValue(body.delete))) {
    const id = positiveId(item);
    if (!id) return socialValueError();
    deletes.push(id);
  }
  return { updates, creates, deletes };
}

async function applySocialMutation(
  db: PrismaClient,
  userId: number,
  body: Body,
  mode: 'legacy' | 'form',
): Promise<UpdateResult> {
  const mutation = parseSocialMutation(body, mode);
  if ('ok' in mutation) return mutation;
  try {
    await db.$transaction(async (transaction: Prisma.TransactionClient) => {
      for (const link of mutation.updates) {
        const result = await transaction.$executeRaw`
          UPDATE board_userlinkmeta
             SET name = ${link.name}, value = ${link.value}, "order" = ${link.order}, updated_date = CURRENT_TIMESTAMP
           WHERE id = ${link.id} AND user_id = ${userId}
        `;
        if (Number(result) === 0) {
          const [collision] = await transaction.$queryRaw<Array<{ exists: number | bigint }>>`
            SELECT EXISTS (SELECT 1 FROM board_userlinkmeta WHERE id = ${link.id}) AS "exists"
          `;
          if (collision?.exists) throw new Error('social-link-conflict');
          await transaction.$executeRaw`
            INSERT INTO board_userlinkmeta (id, name, value, created_date, updated_date, user_id, "order")
            VALUES (${link.id}, ${link.name}, ${link.value}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, ${userId}, ${link.order})
          `;
        }
      }
      for (const link of mutation.creates) {
        await transaction.$executeRaw`
          INSERT INTO board_userlinkmeta (name, value, created_date, updated_date, user_id, "order")
          VALUES (${link.name}, ${link.value}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, ${userId}, ${link.order})
        `;
      }
      for (const id of mutation.deletes) {
        await transaction.$executeRaw`DELETE FROM board_userlinkmeta WHERE id = ${id} AND user_id = ${userId}`;
      }
    });
  } catch {
    return socialValueError();
  }
  return { ok: true };
}

function apiValidationError(reply: FastifyReply, result: Extract<UpdateResult, { ok: false }>) {
  return reply.send(failure('VA', result.message, result.messageKey ? { messageKey: result.messageKey, messageParams: {} } : {}));
}

async function currentUser(request: FastifyRequest, reply: FastifyReply, options: PersonalSettingsOptions) {
  const user = await options.currentUser(request);
  if (!user || !Number.isSafeInteger(user.id) || user.id <= 0 || !user.username) return null;
  return user;
}

async function pageUser(request: FastifyRequest, reply: FastifyReply, options: PersonalSettingsOptions) {
  const user = await currentUser(request, reply, options);
  if (!user) {
    loginRedirect(request, reply);
    return null;
  }
  return user;
}

function html(reply: FastifyReply, content: string) {
  return reply.type('text/html; charset=utf-8').header('Cache-Control', 'private, no-store').send(content);
}

function savedQuery(request: FastifyRequest): boolean {
  return Boolean(new URLSearchParams(request.url.split('?')[1] ?? '').get('saved'));
}

function accountApiBody(account: AccountSettingsView, extras: { accountDeletionRedirectUrl: string; has2fa: boolean }) {
  const preferences = account.regionalPreferences;
  return {
    username: account.username,
    name: account.name,
    email: account.email,
    createdDate: account.createdDate,
    regionalPreferences: {
      language: preferences.language,
      timeZone: preferences.timeZone,
      defaultLanguage: preferences.defaultLanguage,
      defaultTimeZone: preferences.defaultTimeZone,
      languages: preferences.languages,
      timeZones: preferences.timeZones,
    },
    accountDeletionRedirectUrl: extras.accountDeletionRedirectUrl,
    has2fa: extras.has2fa,
  };
}

export function registerPersonalSettings(app: FastifyInstance, db: PrismaClient, options: PersonalSettingsOptions) {
  app.register(async (routes) => {
    await routes.register(formBody);
    await routes.register(multipart, {
      attachFieldsToBody: 'keyValues',
      limits: { files: 1, fields: 8, parts: 10, fieldSize: 2048, fileSize: MAX_PROFILE_IMAGE_BYTES },
    });
    routes.addHook('onRequest', async (_request, reply) => {
      reply.header('Cache-Control', 'private, no-store');
    });

    const sendAccountPage = async (request: FastifyRequest, reply: FastifyReply, error?: string) => {
      const user = await pageUser(request, reply, options);
      if (!user) return reply;
      const account = await readAccount(db, user.id);
      if (!account) return reply.code(404).send('계정 정보를 찾을 수 없습니다.');
      return html(reply, renderAccountSettings({ user, account, csrfToken: csrfToken(request), saved: error ? false : savedQuery(request), error }));
    };
    const sendProfilePage = async (request: FastifyRequest, reply: FastifyReply, error?: string) => {
      const user = await pageUser(request, reply, options);
      if (!user) return reply;
      const profile = await readProfile(db, user.id, options.siteUrl);
      if (!profile) return reply.code(404).send('프로필 정보를 찾을 수 없습니다.');
      return html(reply, renderProfileSettings({ user, profile, csrfToken: csrfToken(request), saved: error ? false : savedQuery(request), error }));
    };
    const sendSocialPage = async (request: FastifyRequest, reply: FastifyReply, error?: string) => {
      const user = await pageUser(request, reply, options);
      if (!user) return reply;
      const profile = await readProfile(db, user.id, options.siteUrl);
      if (!profile) return reply.code(404).send('프로필 정보를 찾을 수 없습니다.');
      return html(reply, renderSocialLinkSettings({ user, profile, csrfToken: csrfToken(request), saved: error ? false : savedQuery(request), error }));
    };

    const registerProfileImageUpload = (kind: ProfileImageKind) => {
      const expectedReturnTo = `/settings/profile?saved=${kind}`;
      routes.post<{ Body: unknown }>(`/v1/setting/${kind}`, { bodyLimit: MAX_PROFILE_IMAGE_BYTES + 32 * 1024 }, async (request, reply) => {
        const isHtmlForm = formValue(request, 'return_to') === expectedReturnTo;
        const user = await authenticatedDatabaseUser(db, request, options);
        if (!user) return isHtmlForm ? loginRedirect(request, reply) : needLogin();
        if (!options.validateCsrf(request)) {
          if (isHtmlForm) return reply.code(403).send('요청을 확인해 주세요.');
          return reply.code(403).send(failure('RJ'));
        }
        const upload = bodyRecord(request.body)[kind];
        if (!Buffer.isBuffer(upload)) {
          if (isHtmlForm) return reply.code(400).type('text/html; charset=utf-8').send(await sendProfileError(request, reply, '유효한 프로필 이미지를 업로드해 주세요.'));
          return reply.send(failure('VA', 'Upload a valid profile image.'));
        }
        if (!options.mediaRoot) {
          if (isHtmlForm) return reply.code(503).type('text/html; charset=utf-8').send(await sendProfileError(request, reply, '프로필 이미지 저장소를 사용할 수 없습니다.'));
          return reply.code(503).send(failure('RJ', 'Profile image storage is unavailable.'));
        }
        const url = await saveProfileImage(db, user, kind, upload, options.mediaRoot, options.siteUrl);
        if (!url) {
          if (isHtmlForm) return reply.code(400).type('text/html; charset=utf-8').send(await sendProfileError(request, reply, '유효한 프로필 이미지를 업로드해 주세요.'));
          return reply.send(failure('VA', 'Upload a valid profile image.'));
        }
        if (isHtmlForm) return reply.redirect(expectedReturnTo, 303);
        return success({ url: uploadedMediaUrl(url) });
      });
    };

    registerProfileImageUpload('avatar');
    registerProfileImageUpload('cover');

    routes.get('/settings', (_request, reply) => reply.redirect('/settings/notify', 302));
    routes.get('/settings/', (_request, reply) => reply.redirect('/settings/notify', 302));
    routes.get('/settings/account', (request, reply) => sendAccountPage(request, reply));
    routes.get('/settings/profile', (request, reply) => sendProfilePage(request, reply));
    routes.get('/settings/social-links', (request, reply) => sendSocialPage(request, reply));

    routes.post<{ Params: { username: string }; Body: unknown }>(
      '/@:username/about/edit', async (request, reply) => {
        const user = await authenticatedDatabaseUser(db, request, options);
        if (!user) {
          loginRedirect(request, reply);
          return reply;
        }
        if (!options.validateCsrf(request)) return reply.code(403).send('요청을 확인해 주세요.');
        const author = await readAuthorAbout(db, request.params.username);
        if (!author) return reply.code(404).send('작가 정보를 찾을 수 없습니다.');
        if (author.id !== user.id) return reply.code(403).send('접근 권한이 없습니다.');
        const saved = await saveAuthorAbout(db, user.id, bodyRecord(request.body).about_md);
        if (!saved) return reply.code(400).send({ status: 'error', message: '소개글을 저장하지 못했습니다.' });
        return reply.send({ status: 'success', message: '소개글을 저장했습니다.', about_md: saved.markdown, about_html: saved.html });
      },
    );

    routes.put<{ Params: { username: string }; Body: unknown }>(
      '/v1/users/@:username', async (request, reply) => {
        const user = await authenticatedDatabaseUser(db, request, options);
        if (!user) return needLogin();
        const body = bodyRecord(request.body);
        const aboutFlag = body.about === true || Boolean(stringValue(body.about));
        if (!aboutFlag) return reply.code(404).send('Not found');
        const author = await readAuthorAbout(db, request.params.username);
        if (!author) return reply.code(404).send('Not found');
        if (author.id !== user.id) return reply.send(failure('AT'));
        if (!options.validateCsrf(request)) return reply.code(403).send(failure('RJ'));
        const saved = await saveAuthorAbout(db, user.id, body.about_md);
        if (!saved) return reply.send(failure('VA', '소개 내용을 확인해 주세요.'));
        return success();
      },
    );

    routes.delete('/v1/setting/cover', async (request, reply) => {
      const user = await authenticatedDatabaseUser(db, request, options);
      if (!user) return needLogin();
      if (!options.validateCsrf(request)) return reply.code(403).send(failure('RJ'));
      if (!options.mediaRoot) return reply.code(503).send(failure('RJ', 'Profile image storage is unavailable.'));
      await deleteProfileCover(db, user, options.mediaRoot);
      return success({ url: null });
    });

    routes.post('/settings/profile/cover/delete', async (request, reply) => {
      const user = await authenticatedDatabaseUser(db, request, options);
      if (!user) {
        loginRedirect(request, reply);
        return reply;
      }
      if (!options.validateCsrf(request)) return reply.code(403).send('요청을 확인해 주세요.');
      if (!options.mediaRoot) return reply.code(503).type('text/html; charset=utf-8').send(await sendProfileError(request, reply, '프로필 이미지 저장소를 사용할 수 없습니다.'));
      await deleteProfileCover(db, user, options.mediaRoot);
      return reply.redirect('/settings/profile?saved=cover', 303);
    });

    routes.post('/settings/account', async (request, reply) => {
      const user = await pageUser(request, reply, options);
      if (!user) return reply;
      if (!options.validateCsrf(request)) return reply.code(403).send('요청을 확인해 주세요.');
      const body = bodyRecord(request.body);
      let result: UpdateResult;
      if (body.intent === 'name') {
        result = await updateDisplayName(db, user.id, body.name);
      } else if (body.intent === 'username') {
        const error = await updateAccountIdentity(db, user.id, body, 'account');
        result = error ? { ok: false, message: error } : { ok: true };
      } else if (body.intent === 'regional') {
        const language = body.language === 'browser' ? null : body.language;
        result = await updateRegionalPreferences(db, user.id, { language, time_zone: body.time_zone });
      } else {
        result = { ok: false, message: '요청을 확인해 주세요.' };
      }
      if (!result.ok) return reply.code(400).type('text/html; charset=utf-8').send(await sendAccountError(request, reply, result.message));
      return reply.redirect('/settings/account?saved=1', 303);
    });

    routes.post('/settings/profile', async (request, reply) => {
      const user = await pageUser(request, reply, options);
      if (!user) return reply;
      if (!options.validateCsrf(request)) return reply.code(403).send('요청을 확인해 주세요.');
      const result = await updateProfile(db, user.id, bodyRecord(request.body));
      if (!result.ok) return reply.code(400).type('text/html; charset=utf-8').send(await sendProfileError(request, reply, result.message));
      return reply.redirect('/settings/profile?saved=1', 303);
    });

    routes.post('/settings/social-links', async (request, reply) => {
      const user = await pageUser(request, reply, options);
      if (!user) return reply;
      if (!options.validateCsrf(request)) return reply.code(403).send('요청을 확인해 주세요.');
      const result = await applySocialMutation(db, user.id, bodyRecord(request.body), 'form');
      if (!result.ok) return reply.code(400).type('text/html; charset=utf-8').send(await sendSocialError(request, reply, result.message));
      return reply.redirect('/settings/social-links?saved=1', 303);
    });

    routes.get('/v1/setting/account', async (request, reply) => {
      const user = await currentUser(request, reply, options);
      if (!user) return needLogin();
      const account = await readAccount(db, user.id);
      if (!account) return reply.code(404).send('Not found');
      const extras = await accountExtras(db, user.id);
      return success(accountApiBody(account, extras));
    });

    routes.put('/v1/setting/account', async (request, reply) => {
      const user = await currentUser(request, reply, options);
      if (!user) return needLogin();
      if (!options.validateCsrf(request)) return reply.code(403).send(failure('RJ'));
      const body = bodyRecord(request.body);
      const password = body.password;
      if (password !== undefined && typeof password !== 'string') return reply.send(failure('VA', '비밀번호를 확인해 주세요.'));
      if (typeof password === 'string' && password) {
        if (!options.updatePassword) return reply.send(failure('VA', '비밀번호 변경 기능을 사용할 수 없습니다.'));
        return options.updatePassword(request, reply, user, body);
      }
      if (body.username) {
        const error = await updateAccountIdentity(db, user.id, body, 'account');
        return error ? failure('VA', error) : success();
      }
      const result = body.name === undefined ? { ok: true } as const : await updateDisplayName(db, user.id, body.name);
      if (!result.ok) return apiValidationError(reply, result);
      return success();
    });

    routes.put('/v1/setting/regional-preferences', async (request, reply) => {
      const user = await currentUser(request, reply, options);
      if (!user) return needLogin();
      if (!options.validateCsrf(request)) return reply.code(403).send(failure('RJ'));
      const result = await updateRegionalPreferences(db, user.id, bodyRecord(request.body));
      if (!result.ok) return apiValidationError(reply, result);
      return success();
    });

    routes.get('/v1/setting/profile', async (request, reply) => {
      const user = await currentUser(request, reply, options);
      if (!user) return needLogin();
      const profile = await readProfile(db, user.id, options.siteUrl);
      return profile ? success(profile) : reply.code(404).send('Not found');
    });

    routes.put('/v1/setting/profile', async (request, reply) => {
      const user = await currentUser(request, reply, options);
      if (!user) return needLogin();
      if (!options.validateCsrf(request)) return reply.code(403).send(failure('RJ'));
      const result = await updateProfile(db, user.id, bodyRecord(request.body));
      if (!result.ok) return apiValidationError(reply, result);
      return success();
    });

    routes.put('/v1/setting/social', async (request, reply) => {
      const user = await currentUser(request, reply, options);
      if (!user) return needLogin();
      if (!options.validateCsrf(request)) return reply.code(403).send(failure('RJ'));
      const result = await applySocialMutation(db, user.id, bodyRecord(request.body), 'legacy');
      if (!result.ok) return apiValidationError(reply, result);
      const profile = await readProfile(db, user.id, options.siteUrl);
      return success(profile?.social ?? []);
    });
  });

  async function sendAccountError(request: FastifyRequest, reply: FastifyReply, message: string): Promise<string> {
    const user = await options.currentUser(request);
    if (!user) return 'Not found';
    const account = await readAccount(db, user.id);
    return account ? renderAccountSettings({ user, account, csrfToken: csrfToken(request), error: message }) : 'Not found';
  }

  async function sendProfileError(request: FastifyRequest, reply: FastifyReply, message: string): Promise<string> {
    const user = await options.currentUser(request);
    if (!user) return 'Not found';
    const profile = await readProfile(db, user.id, options.siteUrl);
    return profile ? renderProfileSettings({ user, profile, csrfToken: csrfToken(request), error: message }) : 'Not found';
  }

  async function sendSocialError(request: FastifyRequest, reply: FastifyReply, message: string): Promise<string> {
    const user = await options.currentUser(request);
    if (!user) return 'Not found';
    const profile = await readProfile(db, user.id, options.siteUrl);
    return profile ? renderSocialLinkSettings({ user, profile, csrfToken: csrfToken(request), error: message }) : 'Not found';
  }
}
