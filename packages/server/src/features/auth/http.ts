import formBody from '@fastify/formbody';
import type { PrismaClient } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import type { DeveloperRateLimit } from '../developer-api/services/rate-limit.js';
import { authCookieOptions, csrfCookie, refreshCsrf, sessionCookie, setSessionCookies } from '../../platform/cookies.js';
import { csrfPattern, formInput, validCsrf } from '../../platform/csrf.js';
import { registerLoginPage } from './login-page.js';
import { reserveLoginAttempt } from './login-attempts.js';
import { consumePendingOAuth, oauthChallengeCookie, readPendingOAuth, registerOAuthRoutes } from './oauth.js';
import { authenticatePassword } from './password-login.js';
import { createSession, deleteSession, loginBody, readSession } from './session.js';
import { registerAccountSecurity } from './security.js';
import { registerSetup } from './setup.js';
import { registerSignup } from './signup.js';
import { isRecoveryCode, verifySecondFactor } from './two-factor.js';
import { done as success, failure } from '../../platform/response.js';

export interface AuthConfig {
  secretKey: string;
  cipherKey: string;
  fetchProvider?: typeof fetch;
  setupToken?: string;
  mediaRoot?: string;
  deliverNotifications?: boolean;
  trustedProxies?: string[];
  webAssetsRoot?: string;
  developerRateLimit?: Partial<DeveloperRateLimit>;
}

/** Tells the login screen to send the owner on to replace the key they just used. */
function signedInBody(user: Parameters<typeof loginBody>[0], spentRecoveryKey: string | undefined) {
  return spentRecoveryKey === undefined ? loginBody(user) : { ...loginBody(user), recoveryKeyUsed: true };
}

export function registerAuthentication(app: FastifyInstance, db: PrismaClient, siteUrl: URL, config: AuthConfig) {
  const cookieOptions = authCookieOptions(siteUrl);

  app.register(async (routes) => {
    await routes.register(formBody);
    routes.removeContentTypeParser('application/json');
    // The v1 login treats invalid JSON as an empty authentication payload.
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
      const { username = '', password = '', code = '', oauth2fa: oauthTwoFactor, oauthToken } = formInput(request);
      const oauthRequest = oauthTwoFactor === true || oauthTwoFactor === 'true' || Boolean(oauthToken);
      const challengeToken = request.cookies[oauthChallengeCookie];
      const pending = oauthRequest || (!password && code) ? await readPendingOAuth(db, challengeToken) : null;
      if (oauthRequest || (pending && !password && code && username === pending.username)) {
        if (!pending) return failure('RJ', 'The authentication token has expired. Please log in again.');
        if (typeof code !== 'string' || !code) return failure('VA', 'A two-factor authentication code is required.');
        if (pending.totpSecret === null || pending.recoveryKey === null) return failure('RJ');
        const release = await reserveLoginAttempt(db, config.secretKey, request.ip, pending.username);
        if (!release) return failure('RJ', 'Too many failed attempts. Please try again later.');
        const valid = verifySecondFactor({ totpSecret: pending.totpSecret, recoveryKey: pending.recoveryKey }, code, config.cipherKey);
        if (!valid) return failure('RJ', 'The two-factor authentication code is incorrect.');
        if (!await consumePendingOAuth(db, challengeToken)) return failure('RJ', 'The authentication token has expired. Please log in again.');

        await release();
        const spentRecoveryKey = isRecoveryCode(code) ? pending.recoveryKey : undefined;
        const token = await createSession(db, { ...pending, spentRecoveryKey }, config.secretKey, request.cookies[sessionCookie]);
        if (!token && spentRecoveryKey !== undefined) return failure('RJ', 'The two-factor authentication code is incorrect.');
        const user = await readSession(db, token ?? undefined, config.secretKey);
        if (!token || !user) return failure('AT');
        reply.clearCookie(oauthChallengeCookie, cookieOptions);
        setSessionCookies(reply, siteUrl, token);
        return success(signedInBody(user, spentRecoveryKey));
      }
      if (typeof username !== 'string' || typeof password !== 'string' || typeof code !== 'string') return failure('AT');

      const release = await reserveLoginAttempt(db, config.secretKey, request.ip, username);
      if (!release) return failure('RJ', 'Too many failed attempts. Please try again later.');
      const result = await authenticatePassword(db, username, password, code, config.cipherKey);
      if (result.status === 'invalid-credentials') return failure('AT');
      if (result.status === 'invalid-second-factor') return failure('RJ', 'The two-factor authentication code is incorrect.');
      if (result.status === 'recovery-key-spent') {
        return failure('RJ', 'This recovery key has already been used. Two-factor authentication is now off, so sign in with your password only.');
      }

      await release();
      if (result.status === 'second-factor-required') return success({ username: result.username, security: true, isOauth: false });

      const token = await createSession(db, result, config.secretKey, request.cookies[sessionCookie]);
      if (!token && result.spentRecoveryKey !== undefined) return failure('RJ', 'The two-factor authentication code is incorrect.');
      const user = await readSession(db, token ?? undefined, config.secretKey);
      if (!token || !user) return failure('AT');

      if (challengeToken) {
        await consumePendingOAuth(db, challengeToken);
        reply.clearCookie(oauthChallengeCookie, cookieOptions);
      }
      setSessionCookies(reply, siteUrl, token);
      return success(signedInBody(user, result.spentRecoveryKey));
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
