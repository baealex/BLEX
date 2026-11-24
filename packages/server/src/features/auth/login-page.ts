import { renderPage } from '../../platform/views.js';
import type { PrismaClient } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import type { LoginModel } from '../../platform/views.js';
import { readPublicSiteBrand } from '../discovery/http/pages.js';
import { readUiAsset } from '../../platform/ui-assets.js';
import { authCookieOptions, csrfCookie, sessionCookie } from '../../platform/cookies.js';
import { csrfPattern } from '../../platform/csrf.js';
import type { AuthConfig } from './http.js';
import {
  consumePendingOAuth,
  oauthChallengeCookie,
  publicOAuthProviders,
  readPendingOAuth,
  safeReturnPath,
} from './oauth.js';
import { createToken, readSession } from './session.js';
import { hasAdministrator } from './setup.js';

export async function registerLoginPage(app: FastifyInstance, db: PrismaClient, siteUrl: URL, config: AuthConfig) {
  app.get<{ Querystring: { next?: string; restart?: string } }>('/login', async (request, reply) => {
    const returnPath = safeReturnPath(request.query.next, siteUrl);
    if (config.setupToken && !(await hasAdministrator(db))) return reply.redirect('/setup', 302);
    if (await readSession(db, request.cookies[sessionCookie], config.secretKey)) return reply.redirect(returnPath, 302);
    const cookieOptions = authCookieOptions(siteUrl);
    const candidate = request.cookies[csrfCookie];
    const csrfToken = candidate && csrfPattern.test(candidate) ? candidate : createToken();
    if (candidate !== csrfToken) reply.setCookie(csrfCookie, csrfToken, cookieOptions);

    const challengeToken = request.cookies[oauthChallengeCookie];
    if (request.query.restart === '1') {
      await consumePendingOAuth(db, challengeToken);
      reply.clearCookie(oauthChallengeCookie, cookieOptions);
    }
    const pending = request.query.restart === '1' ? null : await readPendingOAuth(db, challengeToken);
    const [configured, brand, { css }] = await Promise.all([
      publicOAuthProviders(db, config.cipherKey),
      readPublicSiteBrand(db),
      readUiAsset('src/features/auth/ui/login-page.tsx'),
    ]);
    const model: LoginModel = {
      csrfToken,
      next: pending?.returnPath ?? returnPath,
      providers: configured.map(({ key, name }) => ({ key, name })),
      pendingOAuth: pending ? { username: pending.username } : null,
    };

    // The stylesheet still loads from the head, so the form is styled before its code arrives.
    const html = renderPage('login', { brand, loginAssets: { css }, model });
    return reply.type('text/html; charset=utf-8').send(html);
  });
}
