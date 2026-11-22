import type { PrismaClient } from '@prisma/client';
import { postOutline } from '../../posts/post-html.js';
import { markdownToHtml } from '../../posts/authoring/markdown.js';
import { type AccountSettingsView, type ProfileSettingsView } from '../types.js';
import { accountDate, regionalPreferences } from './regional.js';
import { Body, UpdateResult } from '../shared.js';

const MAX_ABOUT_MARKDOWN_BYTES = 256 * 1024;

export async function readAccount(db: PrismaClient, userId: number): Promise<AccountSettingsView | null> {
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

export async function accountExtras(db: PrismaClient, userId: number): Promise<{ accountDeletionRedirectUrl: string; has2fa: boolean }> {
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

export function mediaUrl(siteUrl: URL, path: string): string {
  const configuredResourceUrl = process.env.RESOURCE_URL?.trim().replace(/\/$/, '') ?? '';
  const resourcePath = `${configuredResourceUrl}/resources/`;
  const resourceBase = new URL(resourcePath, siteUrl);
  return new URL(`media/${path.replace(/^\/+/, '')}`, resourceBase).href;
}

/** 3.x answered profile uploads with a site-relative path unless a resource host was configured. */
export function uploadedMediaUrl(url: string): string {
  return process.env.RESOURCE_URL?.trim() ? url : new URL(url).pathname;
}

function defaultAvatarUrl(siteUrl: URL): string {
  const configuredResourceUrl = process.env.RESOURCE_URL?.trim().replace(/\/$/, '') ?? '';
  const resourceBase = new URL(`${configuredResourceUrl}/resources/`, siteUrl);
  return new URL('assets/images/default-avatar.jpg', resourceBase).href;
}

export async function readProfile(db: PrismaClient, userId: number, siteUrl: URL): Promise<ProfileSettingsView | null> {
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

export function safeExternalUrl(input: string): string {
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

export async function updateDisplayName(db: PrismaClient, userId: number, value: unknown): Promise<UpdateResult> {
  if (typeof value !== 'string') return { ok: false, message: '이름을 입력해 주세요.' };
  if (value.length > 30) return { ok: false, message: '이름은 30자 이하여야 합니다.' };
  if (value) {
    await db.$executeRaw`UPDATE auth_user SET first_name = ${value} WHERE id = ${userId}`;
  }
  return { ok: true };
}

export async function updateProfile(db: PrismaClient, userId: number, body: Body): Promise<UpdateResult> {
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

function renderAboutMarkdownToHtml(markdown: string): string {
  return postOutline(markdownToHtml(markdown), { maxLength: 25, fallback: 'header' }).html;
}

export interface AuthorAboutRow {
  id: number;
  username: string;
  isActive: number | bigint | boolean;
  role: string | null;
  aboutMarkdown: string | null;
  aboutHtml: string | null;
}

export async function readAuthorAbout(db: PrismaClient, username: string): Promise<AuthorAboutRow | null> {
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

export async function saveAuthorAbout(db: PrismaClient, userId: number, markdown: unknown): Promise<{ markdown: string; html: string } | null> {
  if (typeof markdown !== 'string' || Buffer.byteLength(markdown, 'utf8') > MAX_ABOUT_MARKDOWN_BYTES) return null;
  const html = renderAboutMarkdownToHtml(markdown);
  await ensureAuthorProfile(db, userId);
  await db.$executeRaw`UPDATE board_profile SET about_md = ${markdown}, about_html = ${html} WHERE user_id = ${userId}`;
  return { markdown, html };
}

export function accountApiBody(account: AccountSettingsView, extras: { accountDeletionRedirectUrl: string; has2fa: boolean }) {
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
