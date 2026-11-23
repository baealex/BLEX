import { systemMessage } from '../../../platform/messages.js';
import type { PrismaClient } from '@prisma/client';
import { postOutline, sanitizeAboutHtml } from '../../posts/post-html.js';
import { markdownToHtml } from '../../posts/authoring/markdown.js';
import type { AccountSettingsView, ProfileSettingsView } from '../types.js';
import { accountDate, regionalPreferences } from './regional.js';
import type { Body, UpdateResult } from '../shared.js';

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

/** Returns a site-relative upload path unless a separate resource host is configured. */
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
    return { ok: false, message: systemMessage('Homepage URLs must use HTTP or HTTPS.') };
  }
  return { ok: true };
}

export async function updateDisplayName(db: PrismaClient, userId: number, value: unknown): Promise<UpdateResult> {
  if (typeof value !== 'string') return { ok: false, message: systemMessage('Enter your name.') };
  if (value.length > 30) return { ok: false, message: systemMessage('Names must be 30 characters or fewer.') };
  if (value) {
    await db.user.updateMany({ where: { id: userId }, data: { name: value } });
  }
  return { ok: true };
}

export async function updateProfile(db: PrismaClient, userId: number, body: Body): Promise<UpdateResult> {
  const bio = body.bio === undefined ? '' : body.bio;
  const homepage = body.homepage === undefined ? '' : body.homepage;
  if (typeof bio !== 'string' || typeof homepage !== 'string') {
    return { ok: false, message: systemMessage('Check your profile details.') };
  }
  if (bio.length > 500) return { ok: false, message: systemMessage('Introductions must be 500 characters or fewer.') };
  if (homepage.length > 100)
    return { ok: false, message: systemMessage('Homepage URLs must be 100 characters or fewer.') };
  const homepageValidation = validateHomepage(homepage);
  if (!homepageValidation.ok) return homepageValidation;
  // A missing profile stays absent; this operation only updates existing rows.
  await db.profile.updateMany({
    where: { userId },
    data: { bio, homepage: homepage ? safeExternalUrl(homepage) : '' },
  });
  return { ok: true };
}

function renderAboutMarkdownToHtml(markdown: string): string {
  return postOutline(sanitizeAboutHtml(markdownToHtml(markdown)), { maxLength: 25, fallback: 'header' }).html;
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
