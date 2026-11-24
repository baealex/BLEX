import { PrismaClient } from '@prisma/client';
import Fastify, { type FastifyError, type FastifyRequest } from 'fastify';
import { stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { applicationContentSecurityPolicy, isApplicationDocument } from './platform/document.js';
import type { AuthConfig } from './features/auth/http.js';
import { readSession } from './features/auth/session.js';
import { searchIndexingEnabled } from './features/discovery/feeds/index.js';
import { renderForbiddenPage, renderNotFoundPage, wantsNotFoundPage } from './features/discovery/not-found.js';
import { startNotificationWorker } from './features/notifications/delivery.js';
import { readPublicPost } from './features/posts/public-post.js';
import { csrfCookie, requestCookies, sessionCookie } from './platform/cookies.js';
import { makeConnectionReadOnly } from './platform/data/read-only-connection.js';
import { applySecurityHeaders } from './platform/security-headers.js';
import { registerRoutes } from './routes/index.js';
import { requestLocale } from './platform/request-locale.js';

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
  const app = Fastify({
    bodyLimit: 8 * 1024,
    requestTimeout: 300_000,
    routerOptions: { ignoreDuplicateSlashes: true, maxParamLength: 150 },
    trustProxy: auth?.trustedProxies ?? false,
  });
  const httpsSite = siteUrl.protocol === 'https:';
  const documentPolicy = applicationContentSecurityPolicy(siteUrl);
  app.addHook('onRequest', async (request, reply) => {
    const forwarded = String(request.headers['x-forwarded-proto'] ?? '')
      .split(',')[0]
      ?.trim()
      .toLowerCase();
    if (httpsSite && forwarded === 'http') return reply.redirect(`${siteUrl.origin}${request.url}`, 301);
  });
  app.addHook('onSend', async (request, reply, payload) => {
    applySecurityHeaders(reply, httpsSite);
    // Shared caches already skip Authorization requests, but not cookies, which may put a visitor's data in the page.
    if (!reply.hasHeader('Cache-Control')) {
      const cookies = requestCookies(request);
      if (cookies[sessionCookie] || cookies[csrfCookie]) reply.header('Cache-Control', 'private, no-store');
    }
    const contentType = String(reply.getHeader('Content-Type') ?? '');
    if (contentType.startsWith('text/html')) reply.header('Content-Language', requestLocale());
    if (
      (reply.statusCode === 404 || reply.statusCode === 403) &&
      !contentType.startsWith('text/html') &&
      wantsNotFoundPage(request)
    ) {
      try {
        const render = reply.statusCode === 403 ? renderForbiddenPage : renderNotFoundPage;
        const page = await render(db, await currentUser(request), requestCookies(request)[csrfCookie] ?? '');
        reply
          .type('text/html; charset=utf-8')
          .header('Content-Language', requestLocale())
          .header('Content-Security-Policy', documentPolicy)
          .removeHeader('Content-Length');
        return page;
      } catch (error) {
        request.log.warn(error);
      }
    }
    if (
      contentType.startsWith('text/html') &&
      isApplicationDocument(payload) &&
      !request.routeOptions.config.framedBySite
    ) {
      reply.header('Content-Security-Policy', documentPolicy);
    }
    if (
      reply.statusCode === 200 &&
      !reply.hasHeader('X-Robots-Tag') &&
      indexableContentType.test(contentType) &&
      !(await searchIndexingEnabled(db))
    ) {
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
        // Each read fails if the running server's table or column is missing.
        await db.session.findFirst({ select: { verifiedUntil: true } });
        await db.oAuthFlow.findFirst({ select: { stateHash: true } });
        await db.oAuthChallenge.findFirst({ select: { tokenHash: true } });
        await db.factorSetup.findFirst({ select: { sessionHash: true } });
        await db.notificationDelivery.findFirst({ select: { notificationId: true } });
        await db.scheduledPublication.findFirst({ select: { postId: true } });
        await db.webhookDelivery.findFirst({ select: { postId: true } });
      } catch (error) {
        throw new Error(
          'Could not open the BLEX 4 schema. Apply the Prisma migrations and follow the BLEX 3.x upgrade guide for an existing database.',
          { cause: error },
        );
      }
    } else await makeConnectionReadOnly(db);
    await readPublicPost(db, '__schema_check__', '__schema_check__');
    if (auth?.deliverNotifications)
      stopDelivery = startNotificationWorker(db, siteUrl, auth.cipherKey, auth.fetchProvider);
  });

  const currentUser = (request: FastifyRequest) =>
    auth ? readSession(db, requestCookies(request)[sessionCookie], auth.secretKey) : Promise.resolve(null);
  await registerRoutes(app, { db, siteUrl, auth, mediaRoot, currentUser });

  return app;
}
