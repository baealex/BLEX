import cookie from '@fastify/cookie';
import { PrismaClient } from '@prisma/client';
import Fastify, { type FastifyError, type FastifyRequest } from 'fastify';
import mercurius from 'mercurius';
import { stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { registerAdminSettings } from './admin-settings/index.js';
import { applicationContentSecurityPolicy, isApplicationDocument } from './application/document.js';
import { authCookieOptions, csrfCookie, requestCookies, sessionCookie } from './auth/cookies.js';
import { csrfPattern, validCsrf } from './auth/csrf.js';
import { registerAuthentication, type AuthConfig } from './auth/http.js';
import { passwordUpdater } from './auth/security.js';
import { createToken, readSession } from './auth/session.js';
import { hasAdministrator } from './auth/setup.js';
import { registerAuthorCollections } from './author-collections/index.js';
import { createAuthorPost, deleteAuthorPost, PostValidationError, publishAuthorDraft, registerAuthoring, updateAuthorPost } from './authoring/index.js';
import { registerAuthorForms } from './author-forms.js';
import { registerContentMedia } from './content-media.js';
import { registerDeveloperDocumentation } from './developer-api/docs.js';
import { registerDeveloperApi } from './developer-api/index.js';
import { registerDeveloperTokens } from './developer-api/tokens.js';
import { registeredOperations, schema } from './graphql.js';
import { startNotificationWorker } from './notifications/delivery.js';
import { registerNotifications } from './notifications/index.js';
import { registerPersonalSettings } from './personal-settings/index.js';
import { youtubeFrameSources } from './post-html.js';
import { registerPostShare } from './post-share.js';
import { publicPostPath, readPostPresentation, readPublicPost } from './posts.js';
import { registerPublicActivity, relatedPosts } from './public-activity.js';
import { registerPublicDiscovery, searchIndexingEnabled } from './public-discovery/index.js';
import { registerPublicMedia } from './public-media.js';
import { readPublicFeed, registerPublicPages } from './public-pages/index.js';
import { postContentSecurityPolicy, renderPublicPostPage } from './public-post-page.js';
import { registerLegacyApiContract } from './legacy-api-contract.js';
import { readReaderPostView, registerReaderActions } from './reader-actions/index.js';
import { registerSubscriptionPage } from './reader-ui/subscriptions.js';
import { registerSettingsHost } from './settings-host/index.js';
import { registerSiteAssets } from './site-assets.js';
import { registerTelegram } from './telegram.js';
import { registerUploadGuard } from './upload-guard.js';
import { registerWebhooks } from './webhooks/index.js';
import { registerWorkLogs } from './work-logs/index.js';

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
  const db = new PrismaClient({ datasourceUrl: `file:${file}?connection_limit=1` });
  const app = Fastify({ bodyLimit: 8 * 1024, requestTimeout: 300_000, routerOptions: { ignoreDuplicateSlashes: true, maxParamLength: 150 }, trustProxy: auth?.trustedProxies ?? false });
  app.addHook('onSend', async (_request, reply, payload) => {
    const contentType = String(reply.getHeader('Content-Type') ?? '');
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
    await registerDeveloperDocumentation(app, routeOptions);
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

  app.register(mercurius, {
    schema,
    context: (_request, reply) => {
      reply.header('Cache-Control', 'private, no-store');
      return {};
    },
    resolvers: {
      Query: {
        post: (_root: unknown, { username, slug }: { username: string; slug: string }) =>
          readPublicPost(db, username, slug),
        feed: (_root: unknown, { limit }: { limit: number | null }) => readPublicFeed(db, limit),
        viewer: (_root, _input, context) => currentUser(context.reply.request),
      },
    },
    graphiql: false,
    allowBatchedQueries: false,
    onlyPersisted: true,
    persistedQueries: registeredOperations,
    errorFormatter(execution, context) {
      const formatted = mercurius.defaultErrorFormatter(execution, context);
      formatted.response.errors = formatted.response.errors?.map((error) => error.path
        ? { message: 'Could not complete the operation', path: error.path }
        : error);
      return formatted;
    },
  });

  app.get<{ Params: { username: string; slug: string } }>('/@:username/:slug', async (request, reply) => {
    const { username, slug } = request.params;
    const viewer = await currentUser(request);
    const post = await readPublicPost(db, username, slug, viewer?.id);
    if (!post) return reply.code(404).send('Not found');
    if (post.username !== username) return reply.redirect(publicPostPath(post.username, post.slug), 302);

    const presentation = await readPostPresentation(db, post);
    const publicArticle = auth && post.visibility === 'public';
    const [reader, related] = await Promise.all([
      publicArticle ? readReaderPostView(db, post.slug, viewer?.id ?? null) : null,
      publicArticle && presentation.tags.length ? relatedPosts(db, post.id, post.authorId) : [],
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
      .send(renderPublicPostPage(post, presentation, siteUrl, reader, csrf, viewer?.username === post.username && viewer.hasEditorRole, viewer, related));
  });

  return app;
}
