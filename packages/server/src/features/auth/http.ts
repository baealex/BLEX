import formBody from '@fastify/formbody';
import type { PrismaClient } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import { authCookieOptions, csrfCookie, refreshCsrf, sessionCookie, setSessionCookies } from './cookies.js';
import { csrfPattern, formInput, validCsrf } from './csrf.js';
import { registerLoginPage } from './login-page.js';
import { reserveLoginAttempt } from './login-attempts.js';
import { consumePendingOAuth, oauthChallengeCookie, readPendingOAuth, registerOAuthRoutes } from './oauth.js';
import { authenticatePassword } from './password-login.js';
import { createSession, deleteSession, loginBody, readSession } from './session.js';
import { registerAccountSecurity } from './security.js';
import { registerSetup } from './setup.js';
import { registerSignup } from './signup.js';
import { verifyDjangoSecondFactor } from './two-factor.js';
import { done as success, failure } from '../../platform/response.js';

export interface AuthConfig {
  secretKey: string;
  cipherKey: string;
  fetchProvider?: typeof fetch;
  setupToken?: string;
  mediaRoot?: string;
  deliverNotifications?: boolean;
  trustedProxies?: string[];
  islandsRoot?: string;
}

export function registerAuthentication(app: FastifyInstance, db: PrismaClient, siteUrl: URL, config: AuthConfig) {
  const cookieOptions = authCookieOptions(siteUrl);

  app.register(async (routes) => {
    await routes.register(formBody);
    routes.removeContentTypeParser('application/json');
    // Django's v1 login handles invalid JSON as an empty authentication payload.
    routes.addContentTypeParser('application/json', { parseAs: 'string' }, (_request, body, done) => {
      try {
        done(null, JSON.parse(body as string));
      } catch {
        done(null, {});
      }
    });

    routes.addHook('onRequest', async (_request, reply) => {
      reply.header('Cache-Control', 'private, no-store');
    });

    registerOAuthRoutes(routes, db, siteUrl, config);
    registerSignup(routes, db, siteUrl, config);
    registerAccountSecurity(routes, db, siteUrl, config);
    if (config.setupToken) registerSetup(routes, db, siteUrl, config.setupToken, config.secretKey);
    await registerLoginPage(routes, db, siteUrl, config);

    routes.get('/v1/login', async (request, reply) => {
      if (!csrfPattern.test(request.cookies[csrfCookie] ?? '')) refreshCsrf(reply, siteUrl);
      const user = await readSession(db, request.cookies[sessionCookie], config.secretKey);
      if (!user) return failure('NL');
      return success(loginBody(user));
    });

    routes.post('/v1/login', async (request, reply) => {
      if (!validCsrf(request, siteUrl)) return reply.code(403).send(failure('RJ'));
      const { username = '', password = '', code = '', oauth_2fa: oauthTwoFactor, oauth_token: oauthToken } = formInput(request);
      const oauthRequest = oauthTwoFactor === true || oauthTwoFactor === 'true' || Boolean(oauthToken);
      const challengeToken = request.cookies[oauthChallengeCookie];
      const pending = oauthRequest || (!password && code) ? await readPendingOAuth(db, challengeToken) : null;
      if (oauthRequest || (pending && !password && code && username === pending.username)) {
        if (!pending) return failure('RJ', 'The authentication token has expired. Please log in again.');
        if (typeof code !== 'string' || !code) return failure('VA', 'A two-factor authentication code is required.');
        if (pending.totpSecret === null || pending.recoveryKey === null) return failure('RJ');
        const release = await reserveLoginAttempt(db, config.secretKey, request.ip, pending.username);
        if (!release) return failure('RJ', 'Too many failed attempts. Please try again later.');
        const valid = verifyDjangoSecondFactor({ totpSecret: pending.totpSecret, recoveryKey: pending.recoveryKey }, code, config.cipherKey);
        if (!valid) return failure('RJ', 'The two-factor authentication code is incorrect.');
        if (!await consumePendingOAuth(db, challengeToken)) return failure('RJ', 'The authentication token has expired. Please log in again.');

        await release();
        const token = await createSession(db, pending, config.secretKey, request.cookies[sessionCookie]);
        const user = await readSession(db, token ?? undefined, config.secretKey);
        if (!token || !user) return failure('AT');
        reply.clearCookie(oauthChallengeCookie, cookieOptions);
        setSessionCookies(reply, siteUrl, token);
        return success(loginBody(user));
      }
      if (typeof username !== 'string' || typeof password !== 'string' || typeof code !== 'string') return failure('AT');

      const release = await reserveLoginAttempt(db, config.secretKey, request.ip, username);
      if (!release) return failure('RJ', 'Too many failed attempts. Please try again later.');
      const result = await authenticatePassword(db, username, password, code, config.cipherKey);
      if (result.status === 'invalid-credentials') return failure('AT');
      if (result.status === 'invalid-second-factor') return failure('RJ', 'The two-factor authentication code is incorrect.');

      await release();
      if (result.status === 'second-factor-required') return success({ username: result.username, security: true, isOauth: false });

      const token = await createSession(db, result, config.secretKey, request.cookies[sessionCookie]);
      const user = await readSession(db, token ?? undefined, config.secretKey);
      if (!token || !user) return failure('AT');

      if (challengeToken) {
        await consumePendingOAuth(db, challengeToken);
        reply.clearCookie(oauthChallengeCookie, cookieOptions);
      }
      setSessionCookies(reply, siteUrl, token);
      return success(loginBody(user));
    });

    routes.post('/v1/logout', async (request, reply) => {
      if (!validCsrf(request, siteUrl)) return reply.code(403).send(failure('RJ'));
      const token = request.cookies[sessionCookie];
      const user = await readSession(db, token, config.secretKey);
      if (!user) return failure('NL');
      await deleteSession(db, token);
      reply.clearCookie(sessionCookie, cookieOptions);
      return success();
    });

    routes.post('/logout', async (request, reply) => {
      if (!validCsrf(request, siteUrl)) return reply.code(403).send(failure('RJ'));
      await deleteSession(db, request.cookies[sessionCookie]);
      return reply.clearCookie(sessionCookie, cookieOptions).redirect('/', 302);
    });
  });
}
