import fastifyStatic from '@fastify/static';
import type { PrismaClient } from '@prisma/client';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { access, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { renderToString } from 'react-dom/server';
import { readAdminAccess } from '../../features/site-admin/access.js';
import { SiteFooter, SiteHeader, SiteTheme } from '../../appearance/shell.js';
import { applicationContentSecurityPolicy, renderApplicationDocument, scriptJson } from '../document.js';
import { authCookieOptions, csrfCookie, requestCookies } from '../../platform/cookies.js';
import { decryptSecret } from '../../features/auth/encrypted-secret.js';
import { safeReturnPath } from '../../features/auth/oauth.js';
import { createToken } from '../../features/auth/session.js';
import { hasAdministrator } from '../../features/auth/setup.js';
import { readPublicSiteBrand } from '../../features/discovery/pages/index.js';

interface ManifestEntry { file: string }
type Manifest = Record<string, ManifestEntry>;

export interface ScreenHostOptions {
  currentUser(request: FastifyRequest): Promise<{ id: number; username: string } | null>;
  siteUrl: URL;
  webAssetsRoot?: string;
  cipherKey: string;
}

const adminPrefixes = ['site-settings', 'seo-aeo', 'static-pages', 'global-notices', 'global-banners', 'global-webhook', 'integrations', 'utilities', 'users', 'moderation'];
const editorPrefixes = ['posts', 'series', 'pinned-posts', 'drafts', 'forms', 'notices', 'banners', 'webhook', 'developer-api'];
const webAssetPrefix = '/assets/web/';
const styleEntries = ['styles/main.scss', 'styles/post.scss'];
const loaderEntry = 'src/scripts/screen-loader.ts';

const hasPrefix = (path: string, prefixes: string[]) => {
  const normalized = path.replace(/^\/+|\/+$/g, '');
  return prefixes.some((prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`));
};

/** Finds the built 3.x screens next to the compiled server. */
export async function resolveWebAssetsRoot(): Promise<string | undefined> {
  const root = new URL('../../../web/', import.meta.url);
  try {
    await access(new URL('.vite/manifest.json', root));
    return fileURLToPath(root);
  } catch {
    return undefined;
  }
}

function manifestAsset(manifest: Manifest, entry: string): string {
  const asset = manifest[entry];
  if (!asset) throw new Error(`The BLEX settings bundle is missing ${entry}.`);
  return `${webAssetPrefix}${asset.file}`;
}

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
  const telegramToken = telegram?.telegramEnabled && telegram.telegramBotUsername.trim() ? telegram.telegramBotToken : '';
  const row = await db.user.findUnique({
    where: { id: userId },
    select: { profile: { select: { role: true } }, preference: { select: { language: true, timeZone: true } } },
  });
  const unread = await db.notification.count({ where: { userId, isRead: false } });
  const telegramConnected = await db.telegramConnection.count({ where: { userId, telegramId: { not: '' } } });
  return { role: row?.profile?.role ?? null, language: row?.preference?.language ?? null, timeZone: row?.preference?.timeZone ?? null, unread, telegramConnected, telegramConfigured: Boolean(telegramToken && decryptsToValue(telegramToken, cipherKey)) };
}

type ViewerState = Awaited<ReturnType<typeof readViewerState>>;
interface ScreenViewer { user: { id: number; username: string }; isStaff: boolean; state: ViewerState }
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

/** 3.x only offers the captcha widget when the stored secret can actually verify it. */
async function readCaptchaSiteKey(db: PrismaClient, cipherKey: string): Promise<string> {
  const row = await db.loginSetting.findUnique({
    where: { id: 1 },
    select: { hcaptchaEnabled: true, hcaptchaSiteKey: true, hcaptchaSecretKey: true },
  });
  return row?.hcaptchaEnabled && decryptsToValue(row.hcaptchaSecretKey, cipherKey) ? row.hcaptchaSiteKey.trim() : '';
}

export function registerScreenHost(app: FastifyInstance, db: PrismaClient, options: ScreenHostOptions) {
  let manifest: Promise<Manifest> | undefined;
  const { webAssetsRoot } = options;
  const readManifest = () => manifest ??= readFile(`${webAssetsRoot}.vite/manifest.json`, 'utf8').then((text) => JSON.parse(text) as Manifest);

  if (webAssetsRoot) {
    app.register(async (routes) => {
      await routes.register(fastifyStatic, {
        root: webAssetsRoot, prefix: webAssetPrefix, maxAge: '1y', immutable: true, decorateReply: false,
      });
    });
  }

  const sendDocument = async (request: FastifyRequest, reply: FastifyReply, viewer: ScreenViewer | null, page: ScreenPage) => {
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
    const screen = `<div data-screen="${page.component}" data-screen-status="pending" data-screen-props="${encodeURIComponent(JSON.stringify(page.props))}"><div role="status" aria-live="polite" class="flex min-h-52 items-center justify-center gap-2 py-12 text-sm font-medium text-content-secondary"><span aria-hidden="true" class="h-4 w-4 animate-spin rounded-full border-2 border-line-strong border-t-action motion-reduce:animate-none"></span><span>불러오는 중...</span></div></div>`;
    const robots = page.robots ?? 'noindex,nofollow';
    // The editor keeps full page loads so its unsaved-changes warning covers every way of leaving.
    const movesInApplication = page.component !== 'PostEditor';
    const documentPage = <html lang={configuration.locale}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="color-scheme" content="light dark" />
        <meta name="robots" content={robots} />
        <title>{page.title(brand.siteName)}</title>
        {page.canonical && <link rel="canonical" href={page.canonical} />}
        <link rel="icon" href={brand.faviconUrl} />
        {page.searchPage && <link rel="alternate" type="application/rss+xml" title={`${brand.siteName} RSS`} href={new URL('/rss', options.siteUrl).href} />}
        <SiteTheme />
        {styleEntries.map((entry) => <link key={entry} rel="stylesheet" href={manifestAsset(assets, entry)} />)}
        <script type="application/json" id="blex-screen-config" dangerouslySetInnerHTML={{ __html: scriptJson(configuration) }} />
        {page.globals && <script type="application/json" id="blex-screen-globals" dangerouslySetInnerHTML={{ __html: scriptJson(page.globals) }} />}
        {page.captcha && <script src="https://js.hcaptcha.com/1/api.js" async defer data-blex-trusted-script="hcaptcha" />}
      </head>
      <body className="antialiased bg-surface-page text-content selection:bg-action selection:text-content-inverted">
        <input type="hidden" name="csrfmiddlewaretoken" value={csrf} />
        <SiteHeader brand={brand} searchPage={page.searchPage} editorPage={page.component === 'PostEditor'}
          viewer={viewer ? { username: viewer.user.username, hasEditorRole: viewer.state.role === 'EDITOR', isStaff: viewer.isStaff, csrfToken: csrf, unreadCount: Number(viewer.state.unread) } : null} />
        <main className="min-h-[calc(100vh-10.5rem)]"><div className={page.contentClass} dangerouslySetInnerHTML={{ __html: screen }} /></main>
        {page.footer && <SiteFooter brand={brand} />}
        <script type="module" src="/assets/blex/screen-host.js" />
        <script type="module" src={manifestAsset(assets, loaderEntry)} {...(movesInApplication ? { 'data-blex-page-module': 'screen' } : {})} />
      </body>
    </html>;
    const html = movesInApplication ? renderApplicationDocument(documentPage) : `<!doctype html>${renderToString(documentPage)}`;
    return reply.type('text/html; charset=utf-8')
      .header('Cache-Control', 'private, no-store')
      .header('Vary', 'Cookie')
      .header('Content-Security-Policy', applicationContentSecurityPolicy)
      .send(html);
  };

  const sendScreen = async (
    request: FastifyRequest, reply: FastifyReply, user: { id: number; username: string }, isStaff: boolean,
    component: string, componentProps: (isEditor: boolean, state: ViewerState) => Record<string, unknown>, pageTitle: string,
  ) => {
    if (!webAssetsRoot) {
      return reply.code(503).type('text/plain; charset=utf-8').header('Cache-Control', 'no-store')
        .send('The web screens are not built. Run `pnpm build:web` and restart the server.');
    }
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
      contentClass: 'flex items-center justify-center my-16 px-4 md:px-6', footer: true, captcha: Boolean(siteKey),
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

  const sendHost = (request: FastifyRequest, reply: FastifyReply, mode: 'user' | 'admin', user: { id: number; username: string }, isStaff: boolean, isSuperuser: boolean, canManageSiteSettings: boolean) =>
    sendScreen(request, reply, user, isStaff, 'SettingsApp', (isEditor, state) => ({
      isEditor, isStaff, isSuperuser,
      canUseTelegramIntegration: state.telegramConfigured || state.telegramConnected > 0,
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
    const profile = await db.profile.findUnique({ where: { userId: user.id }, select: { role: true } });
    if (profile?.role !== 'EDITOR') return undefined;
    if (edit) {
      const [username, slug] = [decodeURIComponent(edit[1]), decodeURIComponent(edit[2])];
      if (username !== user.username) return undefined;
      const post = await db.post.findFirst({ where: { authorId: user.id, slug }, select: { slug: true } });
      if (!post) return undefined;
      return sendScreen(request, reply, user, account.staff, 'PostEditor', () => ({ mode: 'edit', username, postUrl: post.slug }), '수정하기 - {site}');
    }
    const published = await db.post.findFirst({ where: { authorId: user.id, publishedAt: { not: null } }, select: { id: true } });
    const showFirstPublishGuide = !published;
    const draftUrl = new URLSearchParams(query).get('draft');
    const draft = draftUrl
      ? await db.post.findFirst({ where: { authorId: user.id, slug: draftUrl, publishedAt: null }, select: { slug: true } })
      : null;
    if (draft) return sendScreen(request, reply, user, account.staff, 'PostEditor', () => ({ mode: 'draft', username: user.username, draftUrl: draft.slug, showFirstPublishGuide }), '임시저장 - {site}');
    return sendScreen(request, reply, user, account.staff, 'PostEditor', () => ({ mode: 'new', username: user.username, showFirstPublishGuide }), '새 포스트 - {site}');
  };

  app.addHook('onRequest', async (request, reply) => {
    if (request.method !== 'GET' && request.method !== 'HEAD') return;
    const [rawPath, query = ''] = request.url.split('?');
    const path = rawPath.replace(/\/{2,}/g, '/');
    const editorResponse = await sendEditor(request, reply, path, query);
    if (editorResponse) return editorResponse;
    if (webAssetsRoot && path === '/search') return sendSearch(request, reply, new URLSearchParams(query));
    if (webAssetsRoot && path === '/sign') {
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
