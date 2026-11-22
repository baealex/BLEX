import cookie from '@fastify/cookie';
import { PrismaClient } from '@prisma/client';
import Fastify, { type FastifyError, type FastifyRequest } from 'fastify';
import { stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { registerAdminSettings } from './features/site-admin/index.js';
import { applicationContentSecurityPolicy, isApplicationDocument } from './application/document.js';
import { authCookieOptions, csrfCookie, requestCookies, sessionCookie } from './features/auth/cookies.js';
import { csrfPattern, validCsrf } from './features/auth/csrf.js';
import { registerAuthentication, type AuthConfig } from './features/auth/http.js';
import { passwordUpdater } from './features/auth/security.js';
import { createToken, readSession } from './features/auth/session.js';
import { hasAdministrator } from './features/auth/setup.js';
import { registerAuthorCollections } from './features/series/index.js';
import { createAuthorPost, deleteAuthorPost, PostValidationError, publishAuthorDraft, registerAuthoring, updateAuthorPost } from './features/posts/authoring/index.js';
import { registerAuthorForms } from './features/posts/author-forms.js';
import { registerContentMedia } from './features/media/content-media.js';
import { registerDeveloperDocumentation } from './features/developer-api/docs.js';
import { registerDeveloperApi } from './features/developer-api/index.js';
import { registerDeveloperTokens } from './features/developer-api/tokens.js';
import { startNotificationWorker } from './features/notifications/delivery.js';
import { registerNotifications } from './features/notifications/index.js';
import { registerPersonalSettings } from './features/account/index.js';
import { youtubeFrameSources } from './features/posts/post-html.js';
import { registerPostShare } from './features/posts/post-share.js';
import { renderForbiddenPage, renderNotFoundPage, wantsNotFoundPage } from './features/discovery/pages/not-found.js';
import { publicPostPath, readPostPresentation, readPublicPost } from './features/posts/public-post.js';
import { registerPublicActivity, relatedPosts } from './features/authors/public-activity.js';
import { registerPublicDiscovery, searchIndexingEnabled } from './features/discovery/feeds/index.js';
import { registerPublicMedia } from './features/media/public-media.js';
import { registerPublicPages } from './features/discovery/pages/index.js';
import { postContentSecurityPolicy, renderPublicPostPage } from './features/posts/pages/public-post-page.js';
import { registerLegacyApiContract } from './compat/legacy-api-contract.js';
import { readReaderPostView, registerReaderActions } from './features/engagement/index.js';
import { registerSubscriptionPage } from './features/engagement/ui/subscriptions.js';
import { registerSettingsHost } from './settings-host/index.js';
import { registerSiteAssets } from './platform/site-assets.js';
import { registerTelegram } from './features/integrations/telegram.js';
import { registerUploadGuard } from './features/media/upload-guard.js';
import { registerWebhooks } from './features/integrations/webhooks/index.js';
import { registerWorkLogs } from './features/work-logs/index.js';

const securityHeaders = [
  ['X-Frame-Options', 'DENY'],
  ['X-Content-Type-Options', 'nosniff'],
  ['Referrer-Policy', 'same-origin'],
  ['Cross-Origin-Opener-Policy', 'same-origin'],
] as const;

const indexableContentType = /^(?:text\/(?:html|markdown|plain)|application\/(?:rss\+)?xml)/;

export async function buildApp(dbPath: string, siteUrl: URL, auth?: AuthConfig, mediaRoot?: string) {
  const file = resolve(dbPath);
  if (!(await stat(file)).isFile()) {
    throw new Error('BLEX_V4_DB_PATH must point to an existing SQLite database file.');
  }
  if (file.includes('?')) {
    throw new Error('Use a SQLite database path without a question mark.');
  }

  // Prisma's SQLite connector expects a literal path and uses '?' to delimit connection options.
  const db = new PrismaClient({
    datasourceUrl: `file:${file}?connection_limit=1`,
    // Publishing writes one notification per subscriber inside its transaction.
    transactionOptions: { maxWait: 15_000, timeout: 30_000 },
  });
  const app = Fastify({ bodyLimit: 8 * 1024, requestTimeout: 300_000, routerOptions: { ignoreDuplicateSlashes: true, maxParamLength: 150 }, trustProxy: auth?.trustedProxies ?? false });
  const httpsSite = siteUrl.protocol === 'https:';
  app.addHook('onRequest', async (request, reply) => {
    const forwarded = String(request.headers['x-forwarded-proto'] ?? '').split(',')[0]?.trim().toLowerCase();
    if (httpsSite && forwarded === 'http') return reply.redirect(`${siteUrl.origin}${request.url}`, 301);
  });
  app.addHook('onSend', async (request, reply, payload) => {
    for (const [name, value] of securityHeaders) if (!reply.hasHeader(name)) reply.header(name, value);
    if (httpsSite) reply.header('Strict-Transport-Security', 'max-age=31536000');
    const contentType = String(reply.getHeader('Content-Type') ?? '');
    if ((reply.statusCode === 404 || reply.statusCode === 403) && !contentType.startsWith('text/html') && wantsNotFoundPage(request)) {
      try {
        const render = reply.statusCode === 403 ? renderForbiddenPage : renderNotFoundPage;
        const page = await render(db, await currentUser(request), requestCookies(request)[csrfCookie] ?? '');
        reply.type('text/html; charset=utf-8').header('Content-Security-Policy', applicationContentSecurityPolicy).removeHeader('Content-Length');
        return page;
      } catch (error) {
        request.log.warn(error);
      }
    }
    if (contentType.startsWith('text/html') && isApplicationDocument(payload)) {
      reply.header('Content-Security-Policy', applicationContentSecurityPolicy);
    }
    if (reply.statusCode === 200 && !reply.hasHeader('X-Robots-Tag') && indexableContentType.test(contentType)
      && !await searchIndexingEnabled(db)) {
      reply.header('X-Robots-Tag', 'noindex, nofollow');
    }
    return payload;
  });
  app.setErrorHandler<FastifyError>((error, request, reply) => {
    if ((error.statusCode ?? 500) < 500) return reply.send(error);
    request.log.error(error);
    return reply.code(500).send({ error: 'Could not complete the request' });
  });
  let stopDelivery: (() => Promise<void>) | undefined;
  app.addHook('onClose', async () => {
    await stopDelivery?.();
    await db.$disconnect();
  });
  app.addHook('onReady', async () => {
    if (auth) {
      try {
        await db.$queryRaw`
          SELECT session.verified_until FROM blex_session AS session, blex_oauth_flow, blex_oauth_challenge,
            blex_factor_setup, blex_notification_delivery, blex_scheduled_publication, blex_webhook_delivery LIMIT 0
        `;
      } catch (error) {
        throw new Error('Could not open the BLEX 4 schema. Apply the Prisma migrations and follow the BLEX 3.x upgrade guide for an existing database.', { cause: error });
      }
    } else await db.$executeRaw`PRAGMA query_only = ON`;
    await readPublicPost(db, '__schema_check__', '__schema_check__');
    if (auth?.deliverNotifications) stopDelivery = startNotificationWorker(db, siteUrl, auth.cipherKey, auth.fetchProvider);
  });

  const currentUser = (request: FastifyRequest) => auth
    ? readSession(db, requestCookies(request)[sessionCookie], auth.secretKey)
    : Promise.resolve(null);
  registerLegacyApiContract(app, db, { currentUser });
  const routeOptions = { currentUser, validateCsrf: (request: FastifyRequest) => validCsrf(request, siteUrl), siteUrl, mediaRoot };
  if (auth) {
    await app.register(cookie);
    registerUploadGuard(app, currentUser);
    if (auth.islandsRoot) registerSettingsHost(app, db, { currentUser, siteUrl, islandsRoot: auth.islandsRoot, cipherKey: auth.cipherKey });
    registerAuthentication(app, db, siteUrl, { ...auth, mediaRoot });
    registerPersonalSettings(app, db, { ...routeOptions, updatePassword: passwordUpdater(db, siteUrl, auth) });
    registerNotifications(app, db, routeOptions);
    registerAdminSettings(app, db, { ...routeOptions, cipherKey: auth.cipherKey, secretKey: auth.secretKey, fetchProvider: auth.fetchProvider });
    registerDeveloperTokens(app, db, { ...routeOptions, secretKey: auth.secretKey });
    await registerDeveloperDocumentation(app, db, routeOptions);
    registerContentMedia(app, db, routeOptions);
    registerAuthoring(app, db, { ...routeOptions, editorAssets: {
      script: '/assets/blex/editor.js', css: ['/assets/blex/editor.css'],
    } });
    registerAuthorForms(app, db, routeOptions);
    registerAuthorCollections(app, db, routeOptions);
    registerTelegram(app, db, { ...routeOptions, cipherKey: auth.cipherKey, secretKey: auth.secretKey, fetchProvider: auth.fetchProvider });
    registerWebhooks(app, db, routeOptions);
    registerSubscriptionPage(app, db, routeOptions);
  }
  if (mediaRoot) await registerPublicMedia(app, mediaRoot);
  registerSiteAssets(app);
  registerPublicDiscovery(app, db, siteUrl);
  registerDeveloperApi(app, db, { writable: Boolean(auth), mediaRoot, mutations: {
    create: (editor, body, draft) => createAuthorPost(db, editor, body, draft),
    update: (editor, id, body, expected) => updateAuthorPost(db, editor, id, body, expected),
    publish: (editor, id, body, expected) => publishAuthorDraft(db, editor, id, body, expected),
    trash: async (editor, id) => (await deleteAuthorPost(db, editor, id)).deletedDate,
    error: (failure) => {
      if (!(failure instanceof PostValidationError)) return null;
      const message = failure.message;
      if (failure.errorCode === 'CF') return { code: 'post.version_conflict', message, statusCode: 409 };
      if (message === 'The post was not found.') return { code: 'post.not_found', message, statusCode: 404 };
      if (message === 'Only drafts can be published here.') return { code: 'post.not_draft', message, statusCode: 409 };
      if (message === 'Author access is required.') return { code: 'auth.editor_required', message, statusCode: 403 };
      return { code: `post.${failure.errorCode.toLowerCase()}`, message, statusCode: 400 };
    },
  } });
  registerPublicPages(app, db, siteUrl, { currentUser, requiresSetup: auth?.setupToken ? async () => !await hasAdministrator(db) : undefined });
  registerPublicActivity(app, db, routeOptions);
  registerPostShare(app, db, { ...routeOptions, writable: Boolean(auth) });
  registerReaderActions(app, db, { ...routeOptions, cipherKey: auth?.cipherKey });
  registerWorkLogs(app, db, routeOptions);
  app.post('/v1/report/error', { bodyLimit: 64 * 1024 }, async (request, reply) => {
    if (!routeOptions.validateCsrf(request)) return reply.code(403).send();
    return reply.code(200).send();
  });

  app.get<{ Params: { username: string; slug: string } }>('/@:username/:slug', async (request, reply) => {
    const { username, slug } = request.params;
    const viewer = await currentUser(request);
    const post = await readPublicPost(db, username, slug, viewer?.id);
    if (!post) return reply.code(404).send('Not found');
    if (post.username !== username) return reply.redirect(publicPostPath(post.username, post.slug), 302);

    const presentation = await readPostPresentation(db, post);
    const publicArticle = auth && post.visibility === 'public';
    const canManage = viewer?.username === post.username && Boolean(viewer.hasEditorRole);
    const [reader, related, history] = await Promise.all([
      publicArticle || (auth && canManage && post.visibility !== 'draft')
        ? readReaderPostView(db, post.slug, viewer?.id ?? null, post.visibility !== 'public')
        : null,
      publicArticle && presentation.tags.length ? relatedPosts(db, post.id, post.authorId) : [],
      canManage ? db.$queryRaw<unknown[]>`SELECT 1 FROM board_edithistory WHERE post_id = ${post.id} LIMIT 1` : [],
    ]);
    let csrf = requestCookies(request)[csrfCookie] ?? '';
    if (viewer) {
      reply.header('Cache-Control', 'private, no-store');
      if (!csrfPattern.test(csrf)) {
        csrf = createToken();
        reply.setCookie(csrfCookie, csrf, authCookieOptions(siteUrl));
      }
    }
    if (post.visibility !== 'public') reply.header('X-Robots-Tag', 'noindex, nofollow, noarchive');
    if (presentation.aeoEnabled && post.visibility === 'public') {
      const markdown = new URL(`${publicPostPath(post.username, post.slug)}.md`, siteUrl);
      const llms = new URL('/llms.txt', siteUrl);
      reply.header('Link', `<${markdown.href}>; rel="alternate"; type="text/markdown", <${llms.href}>; rel="llms-txt"`);
      reply.header('X-Llms-Txt', llms.href);
    }
    return reply.type('text/html; charset=utf-8')
      .header('Vary', 'Cookie')
      .header('Content-Security-Policy', postContentSecurityPolicy)
      .send(renderPublicPostPage(post, presentation, siteUrl, reader, csrf, canManage, viewer, related, undefined, history.length > 0));
  });

  return app;
}
