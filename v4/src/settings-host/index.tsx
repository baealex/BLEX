import fastifyStatic from '@fastify/static';
import type { PrismaClient } from '@prisma/client';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { access, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { renderToString } from 'react-dom/server';
import { readAdminAccess } from '../admin-settings/access.js';
import { SiteFooter, SiteHeader, SiteTheme } from '../appearance/shell.js';
import { applicationContentSecurityPolicy, scriptJson } from '../application/document.js';
import { authCookieOptions, csrfCookie, requestCookies } from '../auth/cookies.js';
import { decryptDjangoSecret } from '../auth/django-secret.js';
import { safeReturnPath } from '../auth/oauth.js';
import { createToken } from '../auth/session.js';
import { hasAdministrator } from '../auth/setup.js';
import { readPublicSiteBrand } from '../public-pages/index.js';

interface ManifestEntry { file: string }
type Manifest = Record<string, ManifestEntry>;

export interface SettingsHostOptions {
  currentUser(request: FastifyRequest): Promise<{ id: number; username: string } | null>;
  siteUrl: URL;
  islandsRoot: string;
  cipherKey: string;
}

const adminPrefixes = ['site-settings', 'seo-aeo', 'static-pages', 'global-notices', 'global-banners', 'global-webhook', 'integrations', 'utilities', 'users'];
const editorPrefixes = ['posts', 'series', 'pinned-posts', 'drafts', 'forms', 'notices', 'banners', 'webhook', 'developer-api'];
const islandAssetPrefix = '/resources/staticfiles/islands/';
const styleEntries = ['styles/tailwind.css', 'styles/main.scss', 'styles/post.scss'];
const loaderEntry = 'src/scripts/island-loader.ts';

const hasPrefix = (path: string, prefixes: string[]) => {
  const normalized = path.replace(/^\/+|\/+$/g, '');
  return prefixes.some((prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`));
};

/** Finds the built 3.x screens next to the compiled server. */
export async function resolveIslandsRoot(configured?: string): Promise<string | undefined> {
  const candidates = [
    configured,
    fileURLToPath(new URL('../../islands/', import.meta.url)),
  ].filter((value): value is string => Boolean(value));
  for (const candidate of candidates) {
    try {
      await access(new URL('.vite/manifest.json', `file://${candidate.endsWith('/') ? candidate : `${candidate}/`}`));
      return candidate.endsWith('/') ? candidate : `${candidate}/`;
    } catch { /* Try the next location. */ }
  }
  return undefined;
}

function manifestAsset(manifest: Manifest, entry: string): string {
  const asset = manifest[entry];
  if (!asset) throw new Error(`The BLEX settings bundle is missing ${entry}.`);
  return `${islandAssetPrefix}${asset.file}`;
}

function decryptsToValue(encrypted: string, cipherKey: string): boolean {
  try {
    return Boolean(decryptDjangoSecret(encrypted, cipherKey));
  } catch {
    return false;
  }
}

async function readViewerState(db: PrismaClient, userId: number, cipherKey: string) {
  const [row] = await db.$queryRaw<Array<{
    role: string | null; unread: number | bigint; language: string | null; timeZone: string | null;
    telegramToken: string | null; telegramConnected: number | bigint;
  }>>`
    SELECT (SELECT role FROM board_profile WHERE user_id = ${userId} LIMIT 1) AS role,
           (SELECT COUNT(*) FROM board_notify WHERE user_id = ${userId} AND has_read = 0) AS unread,
           (SELECT language FROM board_config WHERE user_id = ${userId} LIMIT 1) AS language,
           (SELECT time_zone FROM board_config WHERE user_id = ${userId} LIMIT 1) AS timeZone,
           (SELECT telegram_bot_token FROM board_integrationsetting WHERE id = 1 AND telegram_enabled = 1
              AND TRIM(telegram_bot_username) <> '' LIMIT 1) AS telegramToken,
           EXISTS(SELECT 1 FROM board_telegramsync WHERE user_id = ${userId} AND tid <> '') AS telegramConnected
  `;
  return { ...row, telegramConfigured: Boolean(row.telegramToken && decryptsToValue(row.telegramToken, cipherKey)) };
}

type ViewerState = Awaited<ReturnType<typeof readViewerState>>;
interface IslandViewer { user: { id: number; username: string }; isStaff: boolean; state: ViewerState }
interface IslandPage {
  component: string;
  props: Record<string, unknown>;
  title: (siteName: string) => string;
  robots?: string;
  canonical?: string;
  contentClass?: string;
  globals?: Record<string, unknown>;
  captcha?: boolean;
  searchPage?: boolean;
  hideAuthLinks?: boolean;
  footer?: boolean;
}

/** 3.x only offers the captcha widget when the stored secret can actually verify it. */
async function readCaptchaSiteKey(db: PrismaClient, cipherKey: string): Promise<string> {
  const [row] = await db.$queryRaw<Array<{ enabled: number | bigint | boolean; siteKey: string; secret: string }>>`
    SELECT hcaptcha_enabled AS enabled, hcaptcha_site_key AS siteKey, hcaptcha_secret_key AS secret
      FROM board_loginsetting WHERE id = 1
  `;
  return row?.enabled && decryptsToValue(row.secret, cipherKey) ? row.siteKey.trim() : '';
}

export function registerSettingsHost(app: FastifyInstance, db: PrismaClient, options: SettingsHostOptions) {
  let manifest: Promise<Manifest> | undefined;
  const readManifest = () => manifest ??= readFile(`${options.islandsRoot}.vite/manifest.json`, 'utf8').then((text) => JSON.parse(text) as Manifest);

  app.register(async (routes) => {
    await routes.register(fastifyStatic, {
      root: options.islandsRoot, prefix: islandAssetPrefix, maxAge: '1y', immutable: true, decorateReply: false,
    });
  });

  const sendDocument = async (request: FastifyRequest, reply: FastifyReply, viewer: IslandViewer | null, page: IslandPage) => {
    const [brand, assets] = await Promise.all([readPublicSiteBrand(db), readManifest()]);
    let csrf = requestCookies(request)[csrfCookie] ?? '';
    if (!/^[A-Za-z0-9_-]{43}$/.test(csrf)) {
      csrf = createToken();
      reply.setCookie(csrfCookie, csrf, authCookieOptions(options.siteUrl));
    }
    const configuration = {
      media: '/resources/media/', static: '/resources/',
      locale: viewer?.state.language || 'ko',
      timeZone: viewer?.state.timeZone || process.env.TZ || 'Asia/Seoul',
      ...(viewer ? { user: { isAuthenticated: 'True', username: viewer.user.username } } : {}),
      googleClientId: '', githubClientId: '',
    };
    const island = `<island-component name="${page.component}" data-island-name="${page.component}" data-island-status="pending" class="block" props="${encodeURIComponent(JSON.stringify(page.props))}"><div data-island-fallback role="status" aria-live="polite" class="flex min-h-52 items-center justify-center gap-2 py-12 text-sm font-medium text-content-secondary"><span aria-hidden="true" class="h-4 w-4 animate-spin rounded-full border-2 border-line-strong border-t-action motion-reduce:animate-none"></span><span>불러오는 중...</span></div></island-component>`;
    const robots = page.robots ?? 'noindex,nofollow';
    const html = renderToString(<html lang={configuration.locale}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="color-scheme" content="light dark" />
        <meta name="robots" content={robots} />
        <title>{page.title(brand.siteName)}</title>
        {page.canonical && <link rel="canonical" href={page.canonical} />}
        <link rel="icon" href={brand.faviconUrl} />
        <SiteTheme />
        {styleEntries.map((entry) => <link key={entry} rel="stylesheet" href={manifestAsset(assets, entry)} />)}
        <script type="application/json" id="blex-island-config" dangerouslySetInnerHTML={{ __html: scriptJson(configuration) }} />
        {page.globals && <script type="application/json" id="blex-island-globals" dangerouslySetInnerHTML={{ __html: scriptJson(page.globals) }} />}
        {page.captcha && <script src="https://js.hcaptcha.com/1/api.js" async defer />}
      </head>
      <body className="antialiased bg-surface-page text-content selection:bg-action selection:text-content-inverted">
        <input type="hidden" name="csrfmiddlewaretoken" value={csrf} />
        <SiteHeader brand={brand} searchPage={page.searchPage} hideAuthLinks={page.hideAuthLinks}
          viewer={viewer ? { username: viewer.user.username, hasEditorRole: viewer.state.role === 'EDITOR', isStaff: viewer.isStaff, csrfToken: csrf, unreadCount: Number(viewer.state.unread) } : null} />
        <main className="min-h-[calc(100vh-10.5rem)]"><div className={page.contentClass} dangerouslySetInnerHTML={{ __html: island }} /></main>
        {page.footer && <SiteFooter brand={brand} />}
        <script type="module" src="/assets/blex/island-host.js" />
        <script type="module" src={manifestAsset(assets, loaderEntry)} />
      </body>
    </html>);
    return reply.type('text/html; charset=utf-8')
      .header('Cache-Control', 'private, no-store')
      .header('Vary', 'Cookie')
      .header('Content-Security-Policy', applicationContentSecurityPolicy)
      .send(`<!doctype html>${html}`);
  };

  const sendIsland = async (
    request: FastifyRequest, reply: FastifyReply, user: { id: number; username: string }, isStaff: boolean,
    component: string, componentProps: (isEditor: boolean, state: ViewerState) => Record<string, unknown>, pageTitle: string,
  ) => {
    const state = await readViewerState(db, user.id, options.cipherKey);
    return sendDocument(request, reply, { user, isStaff, state }, {
      component, props: componentProps(state.role === 'EDITOR', state), title: (site) => pageTitle.replace('{site}', () => site),
    });
  };

  // Signed-in visitors and first-run installs keep the existing /sign redirects.
  const sendSignup = async (request: FastifyRequest, reply: FastifyReply, query: URLSearchParams) => {
    if (await options.currentUser(request) || !await hasAdministrator(db)) return undefined;
    const next = safeReturnPath(query.get('next') ?? undefined, options.siteUrl);
    const siteKey = await readCaptchaSiteKey(db, options.cipherKey);
    return sendDocument(request, reply, null, {
      component: 'Signup', props: {}, title: (site) => `회원가입 - ${site}`, robots: 'noindex',
      contentClass: 'flex items-center justify-center my-16 px-4 md:px-6', hideAuthLinks: true, footer: true, captcha: Boolean(siteKey),
      globals: { HCAPTCHA_SITE_KEY: siteKey, NEXT_URL: next === '/' ? '' : next, INVITE_CODE: (query.get('invite') ?? '').trim() },
    });
  };

  const sendSearch = async (request: FastifyRequest, reply: FastifyReply, query: URLSearchParams) => {
    const user = await options.currentUser(request);
    const account = user ? await readAdminAccess(db, user.id) : null;
    const viewer = user && account?.active
      ? { user, isStaff: account.staff, state: await readViewerState(db, user.id, options.cipherKey) }
      : null;
    const username = (query.get('username') ?? '').trim();
    const searchText = query.get('q');
    return sendDocument(request, reply, viewer, {
      component: 'SearchPage', props: username ? { username } : {},
      title: (site) => (searchText ? `검색: ${searchText} - ${site}` : `검색 - ${site}`),
      robots: 'noindex,follow', canonical: new URL('/search', options.siteUrl).href,
      contentClass: 'max-w-7xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-12', searchPage: true, footer: true,
    });
  };

  const sendHost = (request: FastifyRequest, reply: FastifyReply, mode: 'user' | 'admin', basePath: string, user: { id: number; username: string }, isStaff: boolean, isSuperuser: boolean, canManageSiteSettings: boolean) =>
    sendIsland(request, reply, user, isStaff, 'SettingsApp', (isEditor, state) => ({
      isEditor, isStaff, isSuperuser, adminUrl: null, settingsMode: mode, basePath,
      canUseTelegramIntegration: state.telegramConfigured || Boolean(Number(state.telegramConnected)),
      adminCapabilities: {
        canManageSiteSettings: isStaff && canManageSiteSettings,
        canManageLoginSettings: isStaff && isSuperuser,
        canManageIntegrationSettings: isStaff && isSuperuser,
        canManageUtilities: isStaff && isSuperuser,
      },
    }), `${mode === 'admin' ? '관리자 설정' : '설정'} | {site}`);

  // Requests the 3.x editor cannot serve fall through to the existing login, role, and 404 handling.
  const sendEditor = async (request: FastifyRequest, reply: FastifyReply, path: string, query: string) => {
    const edit = /^\/@([^/]+)\/([^/]+)\/edit\/?$/.exec(path);
    if (!edit && !/^\/write\/?$/.test(path)) return undefined;
    const user = await options.currentUser(request);
    const account = user ? await readAdminAccess(db, user.id) : null;
    if (!user || !account?.active) return undefined;
    const [profile] = await db.$queryRaw<Array<{ role: string }>>`SELECT role FROM board_profile WHERE user_id = ${user.id} LIMIT 1`;
    if (profile?.role !== 'EDITOR') return undefined;
    if (edit) {
      const [username, slug] = [decodeURIComponent(edit[1]), decodeURIComponent(edit[2])];
      if (username !== user.username) return undefined;
      const [post] = await db.$queryRaw<Array<{ url: string }>>`SELECT url FROM board_post WHERE author_id = ${user.id} AND url = ${slug} LIMIT 1`;
      if (!post) return undefined;
      return sendIsland(request, reply, user, account.staff, 'PostEditor', () => ({ mode: 'edit', username, postUrl: post.url }), '수정하기 - {site}');
    }
    const [published] = await db.$queryRaw<Array<{ id: number }>>`SELECT id FROM board_post WHERE author_id = ${user.id} AND published_date IS NOT NULL LIMIT 1`;
    const showFirstPublishGuide = !published;
    const draftUrl = new URLSearchParams(query).get('draft');
    const [draft] = draftUrl
      ? await db.$queryRaw<Array<{ url: string }>>`SELECT url FROM board_post WHERE author_id = ${user.id} AND url = ${draftUrl} AND published_date IS NULL LIMIT 1`
      : [];
    if (draft) return sendIsland(request, reply, user, account.staff, 'PostEditor', () => ({ mode: 'draft', username: user.username, draftUrl: draft.url, showFirstPublishGuide }), '임시저장 - {site}');
    return sendIsland(request, reply, user, account.staff, 'PostEditor', () => ({ mode: 'new', username: user.username, showFirstPublishGuide }), '새 포스트 - {site}');
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
      return sendHost(request, reply, 'admin', '/admin-settings', user, account.staff, account.superuser, account.canManageSiteSettings);
    }
    if (hasPrefix(rest, adminPrefixes)) {
      if (!account.staff) return reply.callNotFound();
      return reply.redirect(`/admin-settings/${rest}${query ? `?${query}` : ''}`, 302);
    }
    if (hasPrefix(rest, editorPrefixes)) {
      const [profile] = await db.$queryRaw<Array<{ role: string }>>`SELECT role FROM board_profile WHERE user_id = ${user.id} LIMIT 1`;
      if (profile?.role !== 'EDITOR') return reply.callNotFound();
    }
    return sendHost(request, reply, 'user', '/settings', user, account.staff, account.superuser, account.canManageSiteSettings);
  });
}
