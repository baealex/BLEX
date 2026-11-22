import { renderApplicationDocument } from '../../application/document.js';
import type { PrismaClient } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import { LoginForm, type LoginModel } from './ui/login-form.js';
import { SiteFooter, SiteHeader, SiteTheme } from '../../appearance/shell.js';
import { readPublicSiteBrand } from '../discovery/pages/index.js';
import { readUiAsset } from '../../platform/ui-assets.js';
import { authCookieOptions, csrfCookie, sessionCookie } from './cookies.js';
import { csrfPattern } from './csrf.js';
import type { AuthConfig } from './http.js';
import { consumePendingOAuth, oauthChallengeCookie, publicOAuthProviders, readPendingOAuth, safeReturnPath } from './oauth.js';
import { createToken, readSession } from './session.js';
import { hasAdministrator } from './setup.js';

export async function registerLoginPage(app: FastifyInstance, db: PrismaClient, siteUrl: URL, config: AuthConfig) {
  app.get<{ Querystring: { next?: string; restart?: string } }>('/login', async (request, reply) => {
    const returnPath = safeReturnPath(request.query.next, siteUrl);
    if (config.setupToken && !await hasAdministrator(db)) return reply.redirect('/setup', 302);
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
    const [configured, brand, loginAssets] = await Promise.all([
      publicOAuthProviders(db, config.cipherKey), readPublicSiteBrand(db), readUiAsset('src/features/auth/ui/login-client.tsx'),
    ]);
    const model: LoginModel = {
      csrfToken,
      next: pending?.returnPath ?? returnPath,
      providers: configured.map(({ key, name }) => ({ key, name })),
      pendingOAuth: pending ? { username: pending.username } : null,
    };

    const html = renderApplicationDocument(<html lang="ko">
        <head>
          <meta charSet="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <meta name="robots" content="noindex" />
          <title>{`로그인 - ${brand.siteName}`}</title>
          <SiteTheme />
          {loginAssets.css.map((file) => <link key={file} rel="stylesheet" href={file} />)}
        </head>
        <body className="bg-surface-page text-content antialiased">
          <SiteHeader brand={brand} />
          <div id="blex-login" data-model={JSON.stringify(model)}><LoginForm model={model} /></div>
          <SiteFooter brand={brand} />
          <script type="module" src={loginAssets.script} data-blex-page-module="login" />
        </body>
      </html>, true);
    return reply.type('text/html; charset=utf-8')
      .header('Content-Security-Policy', "default-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'")
      .send(html);
  });
}
