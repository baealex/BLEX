import { systemMessage } from '../../platform/messages.js';
import type { PrismaClient } from '@prisma/client';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { readAdminAccess } from '../../features/site-admin/access.js';
import { applicationContentSecurityPolicy } from '../../platform/document.js';
import { renderPage } from '../../platform/views.js';
import { authCookieOptions, csrfCookie, requestCookies } from '../../platform/cookies.js';
import { decryptSecret } from '../../features/auth/encrypted-secret.js';
import { safeReturnPath } from '../../features/auth/oauth.js';
import { createToken } from '../../features/auth/session.js';
import { hasAdministrator } from '../../features/auth/setup.js';
import { readPublicSiteBrand } from '../../features/discovery/http/pages.js';
import { resolveUiLocale } from '../../platform/locale.js';
import { readUiFile } from '../../platform/ui-assets.js';

export interface ScreenHostOptions {
  currentUser(request: FastifyRequest): Promise<{ id: number; username: string } | null>;
  siteUrl: URL;
  cipherKey: string;
}

const adminPrefixes = [
  'site-settings',
  'seo-aeo',
  'static-pages',
  'global-notices',
  'global-banners',
  'global-webhook',
  'integrations',
  'utilities',
  'users',
  'moderation',
];
const editorPrefixes = [
  'posts',
  'series',
  'pinned-posts',
  'drafts',
  'forms',
  'notices',
  'banners',
  'webhook',
  'developer-api',
];
const documentStyleEntry = 'styles/main.scss';

const hasPrefix = (path: string, prefixes: string[]) => {
  const normalized = path.replace(/^\/+|\/+$/g, '');
  return prefixes.some((prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`));
};

function decryptsToValue(encrypted: string, cipherKey: string): boolean {
  try {
    return Boolean(decryptSecret(encrypted, cipherKey));
  } catch {
    return false;
  }
}

async function readViewerState(db: PrismaClient, userId: number, cipherKey: string) {
  const telegram = await db.integrationSetting.findUnique({
    where: { id: 1 },
    select: { telegramEnabled: true, telegramBotUsername: true, telegramBotToken: true },
  });
  const telegramToken =
    telegram?.telegramEnabled && telegram.telegramBotUsername.trim() ? telegram.telegramBotToken : '';
  const row = await db.user.findUnique({
    where: { id: userId },
    select: { profile: { select: { role: true } }, preference: { select: { language: true, timeZone: true } } },
  });
  const unread = await db.notification.count({ where: { userId, isRead: false } });
  const telegramConnected = await db.telegramConnection.count({ where: { userId, telegramId: { not: '' } } });
  return {
    role: row?.profile?.role ?? null,
    language: row?.preference?.language ?? null,
    timeZone: row?.preference?.timeZone ?? null,
    unread,
    telegramConnected,
    telegramConfigured: Boolean(telegramToken && decryptsToValue(telegramToken, cipherKey)),
  };
}

type ViewerState = Awaited<ReturnType<typeof readViewerState>>;
interface ScreenViewer {
  user: { id: number; username: string };
  isStaff: boolean;
  state: ViewerState;
}
interface ScreenPage {
  component: string;
  props: Record<string, unknown>;
  title: (siteName: string) => string;
  robots?: string;
  canonical?: string;
  contentClass?: string;
  globals?: Record<string, unknown>;
  captcha?: boolean;
  searchPage?: boolean;
  footer?: boolean;
}

/** Show the widget only when its stored secret can verify the response. */
async function readCaptchaSiteKey(db: PrismaClient, cipherKey: string): Promise<string> {
  const row = await db.loginSetting.findUnique({
    where: { id: 1 },
    select: { hcaptchaEnabled: true, hcaptchaSiteKey: true, hcaptchaSecretKey: true },
  });
  return row?.hcaptchaEnabled && decryptsToValue(row.hcaptchaSecretKey, cipherKey) ? row.hcaptchaSiteKey.trim() : '';
}

export function registerScreenHost(app: FastifyInstance, db: PrismaClient, options: ScreenHostOptions) {
  const sendDocument = async (
    request: FastifyRequest,
    reply: FastifyReply,
    viewer: ScreenViewer | null,
    page: ScreenPage,
  ) => {
    const [brand, documentStyleHref] = await Promise.all([readPublicSiteBrand(db), readUiFile(documentStyleEntry)]);
    let csrf = requestCookies(request)[csrfCookie] ?? '';
    if (!/^[A-Za-z0-9_-]{43}$/.test(csrf)) {
      csrf = createToken();
      reply.setCookie(csrfCookie, csrf, authCookieOptions(options.siteUrl));
    }
    const configuration = {
      media: '/resources/media/',
      static: '/resources/',
      locale: resolveUiLocale(viewer?.state.language),
      timeZone: viewer?.state.timeZone || process.env.TZ || 'Asia/Seoul',
      ...(viewer ? { user: { isAuthenticated: 'True', username: viewer.user.username } } : {}),
    };
    const robots = page.robots ?? 'noindex,nofollow';
    const html = renderPage('screen-host', {
      lang: configuration.locale,
      robots,
      title: page.title(brand.siteName),
      canonical: page.canonical,
      faviconUrl: brand.faviconUrl,
      rssUrl: page.searchPage ? new URL('/rss', options.siteUrl).href : undefined,
      brand,
      documentStyleHref,
      configuration,
      globals: page.globals,
      captcha: Boolean(page.captcha),
      csrf,
      searchPage: page.searchPage,
      editorPage: page.component === 'PostEditor',
      viewer: viewer
        ? {
            username: viewer.user.username,
            hasEditorRole: viewer.state.role === 'EDITOR',
            isStaff: viewer.isStaff,
            csrfToken: csrf,
            unreadCount: Number(viewer.state.unread),
          }
        : null,
      contentClass: page.contentClass,
      screen: { name: page.component, props: page.props },
      loadingText: systemMessage('Loading…'),
      footer: Boolean(page.footer),
    });
    return reply
      .type('text/html; charset=utf-8')
      .header('Content-Language', configuration.locale)
      .header('Cache-Control', 'private, no-store')
      .header('Vary', 'Cookie')
      .header('Content-Security-Policy', applicationContentSecurityPolicy(options.siteUrl))
      .send(html);
  };

  const sendScreen = async (
    request: FastifyRequest,
    reply: FastifyReply,
    user: { id: number; username: string },
    isStaff: boolean,
    component: string,
    componentProps: (isEditor: boolean, state: ViewerState) => Record<string, unknown>,
    pageTitle: string,
  ) => {
    const state = await readViewerState(db, user.id, options.cipherKey);
    return sendDocument(
      request,
      reply,
      { user, isStaff, state },
      {
        component,
        props: componentProps(state.role === 'EDITOR', state),
        title: (site) => pageTitle.replace('{site}', () => site),
      },
    );
  };

  // Signed-in visitors and first-run installs keep the existing /sign redirects.
  const sendSignup = async (request: FastifyRequest, reply: FastifyReply, query: URLSearchParams) => {
    if ((await options.currentUser(request)) || !(await hasAdministrator(db))) return undefined;
    const next = safeReturnPath(query.get('next') ?? undefined, options.siteUrl);
    const siteKey = await readCaptchaSiteKey(db, options.cipherKey);
    return sendDocument(request, reply, null, {
      component: 'Signup',
      props: {},
      title: (site) => systemMessage('Sign up - {value0}', { value0: site }),
      robots: 'noindex',
      contentClass: 'flex items-center justify-center my-16 px-4 md:px-6',
      footer: true,
      captcha: Boolean(siteKey),
      globals: {
        HCAPTCHA_SITE_KEY: siteKey,
        NEXT_URL: next === '/' ? '' : next,
        INVITE_CODE: (query.get('invite') ?? '').trim(),
      },
    });
  };

  const sendSearch = async (request: FastifyRequest, reply: FastifyReply, query: URLSearchParams) => {
    const user = await options.currentUser(request);
    const account = user ? await readAdminAccess(db, user.id) : null;
    const viewer =
      user && account?.active
        ? { user, isStaff: account.staff, state: await readViewerState(db, user.id, options.cipherKey) }
        : null;
    const username = (query.get('username') ?? '').trim();
    const searchText = query.get('q');
    return sendDocument(request, reply, viewer, {
      component: 'SearchPage',
      props: username ? { username } : {},
      title: (site) =>
        searchText
          ? systemMessage('Search: {value0} - {value1}', { value0: searchText, value1: site })
          : systemMessage('Search - {value0}', { value0: site }),
      robots: 'noindex,follow',
      canonical: new URL('/search', options.siteUrl).href,
      contentClass: 'max-w-7xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-12',
      searchPage: true,
      footer: true,
    });
  };

  const sendHost = (
    request: FastifyRequest,
    reply: FastifyReply,
    mode: 'user' | 'admin',
    user: { id: number; username: string },
    isStaff: boolean,
    isSuperuser: boolean,
    canManageSiteSettings: boolean,
  ) =>
    sendScreen(
      request,
      reply,
      user,
      isStaff,
      'SettingsApp',
      (isEditor, state) => ({
        isEditor,
        isStaff,
        isSuperuser,
        canUseTelegramIntegration: state.telegramConfigured || state.telegramConnected > 0,
        adminCapabilities: {
          canManageSiteSettings: isStaff && canManageSiteSettings,
          canManageLoginSettings: isStaff && isSuperuser,
          canManageIntegrationSettings: isStaff && isSuperuser,
          canManageUtilities: isStaff && isSuperuser,
        },
      }),
      `${mode === 'admin' ? systemMessage('Admin settings') : systemMessage('Settings')} | {site}`,
    );

  // Let the editor route handle login, role, and missing-post responses when this screen cannot mount.
  const sendEditor = async (request: FastifyRequest, reply: FastifyReply, path: string, query: string) => {
    const edit = /^\/@([^/]+)\/([^/]+)\/edit\/?$/.exec(path);
    if (!edit && !/^\/write\/?$/.test(path)) return undefined;
    const user = await options.currentUser(request);
    const account = user ? await readAdminAccess(db, user.id) : null;
    if (!user || !account?.active) return undefined;
    const profile = await db.profile.findUnique({ where: { userId: user.id }, select: { role: true } });
    if (profile?.role !== 'EDITOR') return undefined;
    if (edit) {
      const [username, slug] = [decodeURIComponent(edit[1]), decodeURIComponent(edit[2])];
      if (username !== user.username) return undefined;
      const post = await db.post.findFirst({ where: { authorId: user.id, slug }, select: { slug: true } });
      if (!post) return undefined;
      return sendScreen(
        request,
        reply,
        user,
        account.staff,
        'PostEditor',
        () => ({ mode: 'edit', username, postUrl: post.slug }),
        systemMessage('Edit post - {site}'),
      );
    }
    const published = await db.post.findFirst({
      where: { authorId: user.id, publishedAt: { not: null } },
      select: { id: true },
    });
    const showFirstPublishGuide = !published;
    const draftUrl = new URLSearchParams(query).get('draft');
    const draft = draftUrl
      ? await db.post.findFirst({
          where: { authorId: user.id, slug: draftUrl, publishedAt: null },
          select: { slug: true },
        })
      : null;
    if (draft)
      return sendScreen(
        request,
        reply,
        user,
        account.staff,
        'PostEditor',
        () => ({ mode: 'draft', username: user.username, draftUrl: draft.slug, showFirstPublishGuide }),
        systemMessage('Draft - {site}'),
      );
    return sendScreen(
      request,
      reply,
      user,
      account.staff,
      'PostEditor',
      () => ({ mode: 'new', username: user.username, showFirstPublishGuide }),
      systemMessage('New post - {site}'),
    );
  };

  app.addHook('onRequest', async (request, reply) => {
    if (request.method !== 'GET' && request.method !== 'HEAD') return;
    const [rawPath, query = ''] = request.url.split('?');
    const path = rawPath.replace(/\/{2,}/g, '/');
    const editorResponse = await sendEditor(request, reply, path, query);
    if (editorResponse) return editorResponse;
    if (path === '/search') return sendSearch(request, reply, new URLSearchParams(query));
    if (path === '/sign') {
      const signup = await sendSignup(request, reply, new URLSearchParams(query));
      if (signup) return signup;
    }
    const match = /^\/(settings|admin-settings)(?:\/(.*))?$/.exec(path);
    if (!match) return;
    const [, area, rest] = match;
    if (rest === undefined) return reply.redirect(`/${area}/${query ? `?${query}` : ''}`, 301);

    const user = await options.currentUser(request);
    const account = user ? await readAdminAccess(db, user.id) : null;
    if (!user || !account?.active) {
      return reply.redirect(`/login?next=${encodeURIComponent(`${path}${query ? `?${query}` : ''}`)}`, 302);
    }
    if (area === 'admin-settings') {
      if (!account.staff) return reply.callNotFound();
      return sendHost(request, reply, 'admin', user, account.staff, account.superuser, account.canManageSiteSettings);
    }
    if (hasPrefix(rest, adminPrefixes)) {
      if (!account.staff) return reply.callNotFound();
      return reply.redirect(`/admin-settings/${rest}${query ? `?${query}` : ''}`, 302);
    }
    if (hasPrefix(rest, editorPrefixes)) {
      const profile = await db.profile.findUnique({ where: { userId: user.id }, select: { role: true } });
      if (profile?.role !== 'EDITOR') return reply.callNotFound();
    }
    return sendHost(request, reply, 'user', user, account.staff, account.superuser, account.canManageSiteSettings);
  });
}
