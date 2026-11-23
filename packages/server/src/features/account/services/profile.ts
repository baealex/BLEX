import type { PrismaClient } from '@prisma/client';
import { postOutline } from '../../posts/post-html.js';
import { markdownToHtml } from '../../posts/authoring/markdown.js';
import { type AccountSettingsView, type ProfileSettingsView } from '../types.js';
import { accountDate, regionalPreferences } from './regional.js';
import { Body, UpdateResult } from '../shared.js';

const MAX_ABOUT_MARKDOWN_BYTES = 256 * 1024;

export async function readAccount(db: PrismaClient, userId: number): Promise<AccountSettingsView | null> {
  const account = await db.user.findUnique({
    where: { id: userId },
    select: {
      username: true,
      name: true,
      email: true,
      joinedAt: true,
      preference: { select: { language: true, timeZone: true } },
    },
  });
  if (!account) return null;

  const preferences = regionalPreferences(account.preference);
  return {
    username: account.username,
    name: account.name,
    email: account.email,
    createdDate: accountDate(account.joinedAt, preferences.timeZone || preferences.defaultTimeZone),
    regionalPreferences: preferences,
  };
}

export async function accountExtras(
  db: PrismaClient,
  userId: number,
): Promise<{ accountDeletionRedirectUrl: string; has2fa: boolean }> {
  let accountDeletionRedirectUrl = '';
  try {
    const setting = await db.loginSetting.findUnique({
      where: { id: 1 },
      select: { accountDeletionRedirectUrl: true },
    });
    accountDeletionRedirectUrl = setting?.accountDeletionRedirectUrl ?? '';
  } catch {
    accountDeletionRedirectUrl = '';
  }
  let has2fa = false;
  try {
    has2fa = (await db.twoFactorAuth.count({ where: { userId } })) > 0;
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
  const profile = await db.profile.findUnique({
    where: { userId },
    select: { avatar: true, cover: true, bio: true, homepage: true },
  });
  if (!profile) return null;

  const links = await db.socialLink.findMany({
    where: { userId },
    orderBy: [{ order: 'asc' }, { id: 'asc' }],
    select: { id: true, platform: true, url: true, order: true },
  });
  const social = links
    .filter((link) => safeExternalUrl(link.url) !== '')
    .map((link) => ({ id: link.id, name: link.platform, value: safeExternalUrl(link.url), order: link.order }));
  return {
    avatar: profile.avatar ? mediaUrl(siteUrl, profile.avatar) : defaultAvatarUrl(siteUrl),
    cover: profile.cover ? mediaUrl(siteUrl, profile.cover) : null,
    bio: profile.bio,
    homepage: profile.homepage,
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
    await db.user.updateMany({ where: { id: userId }, data: { name: value } });
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
  // An account without a profile row has nothing to update, as in 3.x.
  await db.profile.updateMany({
    where: { userId },
    data: { bio, homepage: homepage ? safeExternalUrl(homepage) : '' },
  });
  return { ok: true };
}

function renderAboutMarkdownToHtml(markdown: string): string {
  return postOutline(markdownToHtml(markdown), { maxLength: 25, fallback: 'header' }).html;
}

export interface AuthorAboutRow {
  id: number;
  username: string;
  isActive: boolean;
  role: string | null;
  aboutMarkdown: string | null;
  aboutHtml: string | null;
}

export async function readAuthorAbout(db: PrismaClient, username: string): Promise<AuthorAboutRow | null> {
  const author = await db.user.findUnique({
    where: { username },
    select: {
      id: true,
      username: true,
      isActive: true,
      profile: { select: { role: true, aboutMarkdown: true, aboutHtml: true } },
    },
  });
  return (
    author && {
      id: author.id,
      username: author.username,
      isActive: author.isActive,
      role: author.profile?.role ?? null,
      aboutMarkdown: author.profile?.aboutMarkdown ?? null,
      aboutHtml: author.profile?.aboutHtml ?? null,
    }
  );
}

export async function saveAuthorAbout(
  db: PrismaClient,
  userId: number,
  markdown: unknown,
): Promise<{ markdown: string; html: string } | null> {
  if (typeof markdown !== 'string' || Buffer.byteLength(markdown, 'utf8') > MAX_ABOUT_MARKDOWN_BYTES) return null;
  const html = renderAboutMarkdownToHtml(markdown);
  const about = { aboutMarkdown: markdown, aboutHtml: html };
  await db.profile.upsert({ where: { userId }, create: { userId, ...about }, update: about, select: { userId: true } });
  return { markdown, html };
}

export function accountApiBody(
  account: AccountSettingsView,
  extras: { accountDeletionRedirectUrl: string; has2fa: boolean },
) {
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
