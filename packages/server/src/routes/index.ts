import cookie from '@fastify/cookie';
import type { PrismaClient } from '@prisma/client';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { registerPersonalSettings } from '../features/account/index.js';
import { registerAuthentication, type AuthConfig } from '../features/auth/http.js';
import { passwordUpdater } from '../features/auth/security.js';
import type { readSession } from '../features/auth/session.js';
import { hasAdministrator } from '../features/auth/setup.js';
import { registerPublicActivity } from '../features/authors/public-activity.js';
import { registerDeveloperOpenApi } from '../features/developer-api/openapi.js';
import { registerDeveloperDocumentation } from '../features/developer-api/docs.js';
import { registerDeveloperApi } from '../features/developer-api/index.js';
import { authenticate, requireScope } from '../features/developer-api/services/token-auth.js';
import { errorReply, formatError } from '../features/developer-api/shared.js';
import { isMultipart, registerBodyGuard } from '../platform/request-body.js';
import { registerDeveloperTokens } from '../features/developer-api/tokens.js';
import { registerPublicDiscovery } from '../features/discovery/feeds/index.js';
import { registerPublicPages } from '../features/discovery/http/pages.js';
import { registerReaderActions } from '../features/engagement/index.js';
import { registerTelegram } from '../features/integrations/telegram.js';
import { registerWebhooks } from '../features/integrations/webhooks/index.js';
import { registerContentMedia } from '../features/media/content-media.js';
import { registerPublicMedia } from '../features/media/public-media.js';
import { registerNotifications } from '../features/notifications/index.js';
import { registerAuthorForms } from '../features/posts/author-forms.js';
import {
  createAuthorPost,
  deleteAuthorPost,
  PostValidationError,
  publishAuthorDraft,
  registerAuthoring,
  updateAuthorPost,
} from '../features/posts/authoring/index.js';
import { registerPostShare } from '../features/posts/post-share.js';
import { registerPublicPostRoute } from '../features/posts/public-post-route.js';
import { registerAuthorCollections } from '../features/series/index.js';
import { registerAdminSettings } from '../features/site-admin/index.js';
import { registerWorkLogs } from '../features/work-logs/index.js';
import { registerApiMessages } from '../platform/api-messages.js';
import { validCsrf } from '../platform/csrf.js';
import { registerSiteAssets } from '../platform/site-assets.js';
import { registerScreenHost } from '../application/screen-host/index.js';

type RouteContext = {
  db: PrismaClient;
  siteUrl: URL;
  auth?: AuthConfig;
  mediaRoot?: string;
  currentUser: (request: FastifyRequest) => ReturnType<typeof readSession>;
};

/** Registration order is part of the HTTP contract, so feature routes are listed here and nowhere else. */
export async function registerRoutes(
  app: FastifyInstance,
  { db, siteUrl, auth, mediaRoot, currentUser }: RouteContext,
) {
  await registerDeveloperOpenApi(app);
  registerApiMessages(app, db, { currentUser });
  const routeOptions = {
    currentUser,
    validateCsrf: (request: FastifyRequest) => validCsrf(request, siteUrl),
    siteUrl,
    mediaRoot,
  };
  if (auth) {
    await app.register(cookie);
    registerBodyGuard(app, {
      currentUser,
      tokenAccount: async (request, reply) => {
        const { token, error } = await authenticate(db, request.headers.authorization);
        const denied =
          error ??
          (token ? requireScope(token, 'posts:write') : formatError('auth.invalid_token', 'Invalid token.', 401));
        if (!denied && token) return token.user.id;
        // The handler records a refused upload in the audit log before it reads the body.
        if (!isMultipart(request))
          errorReply(reply, denied ?? formatError('auth.invalid_token', 'Invalid token.', 401));
        return null;
      },
    });
    registerScreenHost(app, db, { currentUser, siteUrl, webAssetsRoot: auth.webAssetsRoot, cipherKey: auth.cipherKey });
    registerAuthentication(app, db, siteUrl, { ...auth, mediaRoot });
    registerPersonalSettings(app, db, { ...routeOptions, updatePassword: passwordUpdater(db, siteUrl, auth) });
    registerNotifications(app, db, routeOptions);
    registerAdminSettings(app, db, {
      ...routeOptions,
      cipherKey: auth.cipherKey,
      secretKey: auth.secretKey,
      fetchProvider: auth.fetchProvider,
    });
    registerDeveloperTokens(app, db, { ...routeOptions, secretKey: auth.secretKey });
    await registerDeveloperDocumentation(app, db, routeOptions);
    registerContentMedia(app, db, routeOptions);
    registerAuthoring(app, db, routeOptions);
    registerAuthorForms(app, db, routeOptions);
    registerAuthorCollections(app, db, routeOptions);
    registerTelegram(app, db, {
      ...routeOptions,
      cipherKey: auth.cipherKey,
      secretKey: auth.secretKey,
      fetchProvider: auth.fetchProvider,
    });
    registerWebhooks(app, db, routeOptions);
  }
  if (mediaRoot) await registerPublicMedia(app, mediaRoot);
  registerSiteAssets(app);
  registerPublicDiscovery(app, db, siteUrl);
  registerDeveloperApi(app, db, {
    writable: Boolean(auth),
    mediaRoot,
    rateLimit: auth?.developerRateLimit,
    mutations: {
      create: (editor, body, draft) => createAuthorPost(db, editor, body, draft),
      update: (editor, id, body, expected) => updateAuthorPost(db, editor, id, body, expected),
      publish: (editor, id, body, expected) => publishAuthorDraft(db, editor, id, body, expected),
      trash: async (editor, id) => (await deleteAuthorPost(db, editor, id)).deletedDate,
      error: (failure) => {
        if (!(failure instanceof PostValidationError)) return null;
        const message = failure.message;
        if (failure.errorCode === 'CF') return { code: 'post.version_conflict', message, statusCode: 409 };
        if (message === 'The post was not found.') return { code: 'post.not_found', message, statusCode: 404 };
        if (message === 'Only drafts can be published here.')
          return { code: 'post.not_draft', message, statusCode: 409 };
        if (message === 'Author access is required.') return { code: 'auth.editor_required', message, statusCode: 403 };
        return { code: `post.${failure.errorCode.toLowerCase()}`, message, statusCode: 400 };
      },
    },
  });
  registerPublicPages(app, db, siteUrl, {
    currentUser,
    requiresSetup: auth?.setupToken ? async () => !(await hasAdministrator(db)) : undefined,
  });
  registerPublicActivity(app, db, routeOptions);
  registerPostShare(app, db, { ...routeOptions, writable: Boolean(auth) });
  registerReaderActions(app, db, { ...routeOptions, cipherKey: auth?.cipherKey });
  registerWorkLogs(app, db, routeOptions);
  app.post('/v1/report/error', { bodyLimit: 64 * 1024, config: { bodyAccess: 'public' } }, async (request, reply) => {
    if (!routeOptions.validateCsrf(request)) return reply.code(403).send();
    return reply.code(200).send();
  });
  registerPublicPostRoute(app, db, { siteUrl, writable: Boolean(auth), currentUser });
}
