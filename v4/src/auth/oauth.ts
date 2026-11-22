import { createHash, randomBytes } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { signupRegion } from './account-validation.js';
import { authCookieOptions, sessionCookie, setSessionCookies } from './cookies.js';
import { formInput, validCsrf } from './csrf.js';
import { decryptDjangoSecret } from './django-secret.js';
import type { AuthConfig } from './http.js';
import { createSession, createToken, loginBody, readSession, tokenHash } from './session.js';
import { hasAdministrator, insertAccount } from './setup.js';
import { readVerificationAccount, recordVerification } from './verification.js';

const providers = {
  google: {
    name: 'Google',
    authorization: 'https://accounts.google.com/o/oauth2/v2/auth',
    token: 'https://oauth2.googleapis.com/token',
    user: 'https://www.googleapis.com/oauth2/v1/userinfo',
    scope: 'openid email profile',
    identityField: 'id',
  },
  github: {
    name: 'GitHub',
    authorization: 'https://github.com/login/oauth/authorize',
    token: 'https://github.com/login/oauth/access_token',
    user: 'https://api.github.com/user',
    scope: 'user:email',
    identityField: 'node_id',
  },
};

type Provider = keyof typeof providers;
const oauthCodeLifetime = 600;
const oauthChallengeLifetime = 300;
const tokenPattern = /^[a-zA-Z0-9_-]{43}$/;
export const oauthChallengeCookie = 'blex_oauth_challenge';

function supportedProvider(value: string): value is Provider {
  return value === 'google' || value === 'github';
}

function hash(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function safeReturnPath(value: unknown, siteUrl: URL): string {
  if (typeof value !== 'string') return '/';
  const input = value.trim();
  if (!input.startsWith('/') && !/^https?:\/\//i.test(input)) return '/';
  const url = URL.parse(input, siteUrl);
  if (!url || url.origin !== siteUrl.origin || url.username || url.password || input.includes('\\')) return '/';
  try {
    const decoded = decodeURIComponent(url.pathname);
    if (decoded.startsWith('//') || decoded.includes('\\')) return '/';
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return '/';
  }
}

function loginPath(next: string): string {
  return next === '/' ? '/login' : `/login?${new URLSearchParams({ next })}`;
}

interface ProviderRow { id: number; key: string; clientId: string; secret: string }

async function configuredProviders(db: PrismaClient, cipherKey: string) {
  const rows = await db.$queryRaw<ProviderRow[]>`
    SELECT id, key, client_id AS clientId, client_secret AS secret
      FROM board_socialauthprovider
     WHERE is_enabled = 1 AND client_id <> '' AND client_secret <> '' AND key IN ('google', 'github')
     ORDER BY id
  `;
  return rows.flatMap(({ id, key, clientId, secret }) => {
    const clientSecret = decryptDjangoSecret(secret, cipherKey);
    return supportedProvider(key) && clientSecret ? [{ id, key, clientId, clientSecret }] : [];
  });
}

export async function publicOAuthProviders(db: PrismaClient, cipherKey: string) {
  const configured = await configuredProviders(db, cipherKey);
  return configured.map(({ key, clientId }) => ({ key, name: providers[key].name, clientId }));
}

interface LinkedAccount {
  socialAuthId: number;
  userId: number;
  username: string;
  passwordHash: string;
  totpSecret: string | null;
  recoveryKey: string | null;
}

interface OAuthFlowRow { verifier: string; return_path: string; session_hash: string | null; language: string; time_zone: string }

interface ProviderIdentity { uid: string; profile: Record<string, unknown> }

async function exchangeCode(
  fetchProvider: typeof fetch,
  provider: Provider,
  credentials: { clientId: string; clientSecret: string },
  code: string,
  verifier: string,
  redirectUri: string,
): Promise<ProviderIdentity | null> {
  const endpoints = providers[provider];
  try {
    const tokens = await fetchProvider(endpoints.token, {
      method: 'POST',
      headers: { Accept: 'application/json' },
      body: new URLSearchParams({
        client_id: credentials.clientId, client_secret: credentials.clientSecret, code,
        redirect_uri: redirectUri, code_verifier: verifier, grant_type: 'authorization_code',
      }),
      redirect: 'error',
      signal: AbortSignal.timeout(10_000),
    });
    if (!tokens.ok) return null;
    const { access_token: accessToken } = await tokens.json() as { access_token?: unknown };
    if (typeof accessToken !== 'string' || !accessToken) return null;
    const profile = await fetchProvider(endpoints.user, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json', 'User-Agent': 'BLEX' },
      redirect: 'error',
      signal: AbortSignal.timeout(10_000),
    });
    if (!profile.ok) return null;
    const details = await profile.json() as Record<string, unknown>;
    const uid = details[endpoints.identityField];
    return typeof uid === 'string' && uid && uid.length <= 50 ? { uid, profile: details } : null;
  } catch {
    return null;
  }
}

function identityField(profile: Record<string, unknown>, key: string, limit: number) {
  const value = profile[key];
  return typeof value === 'string' ? value.slice(0, limit) : '';
}

async function createSocialAccount(db: PrismaClient, provider: Provider, providerId: number, identity: ProviderIdentity, flow: OAuthFlowRow) {
  const name = identityField(identity.profile, 'name', 150);
  const email = provider === 'google' ? identityField(identity.profile, 'email', 254) : '';
  const login = provider === 'github' ? identityField(identity.profile, 'login', 64) : email.split('@')[0];
  if (!login) return null;
  const base = login.toLowerCase().replace(/[^a-z0-9_.-]/g, '').slice(0, 64) || 'member';
  const now = new Date().toISOString().slice(0, -1).replace('T', ' ');
  return db.$transaction(async (tx) => {
    const status = await tx.$executeRaw`
      UPDATE board_socialauthprovider SET is_enabled = is_enabled WHERE id = ${providerId} AND is_enabled = 1
    `;
    if (!status || !await hasAdministrator(tx)) return null;
    const [exists] = await tx.$queryRaw<Array<{ id: number }>>`
      SELECT id FROM board_socialauth WHERE provider_id = ${providerId} AND uid = ${identity.uid}
    `;
    if (exists) return null;
    const usernames = await tx.$queryRaw<Array<{ username: string }>>`
      SELECT username FROM auth_user WHERE substr(username, 1, ${base.length}) = ${base}
    `;
    const taken = new Set(usernames.map((user) => user.username));
    let username = base;
    for (let suffix = 1; taken.has(username); suffix += 1) username = `${base}${suffix}`;
    const passwordHash = `!${createToken()}`;
    const userId = await insertAccount(tx, { username, displayName: name, email, passwordHash, language: flow.language, timeZone: flow.time_zone });
    const [link] = await tx.$queryRaw<Array<{ id: number }>>`
      INSERT INTO board_socialauth (provider_id, uid, user_id, extra_data, created_date)
      VALUES (${providerId}, ${identity.uid}, ${userId}, ${JSON.stringify(identity.profile)}, ${now}) RETURNING id
    `;
    if (provider === 'github' && /^[a-z\d-]+$/i.test(login)) await tx.$executeRaw`
      INSERT INTO board_userlinkmeta (user_id, name, value, created_date, updated_date, "order")
      VALUES (${userId}, 'github', ${`https://github.com/${login}`}, ${now}, ${now}, 0)
    `;
    return { socialAuthId: link.id, userId, username, passwordHash, totpSecret: null, recoveryKey: null } satisfies LinkedAccount;
  });
}

interface PendingOAuth extends LinkedAccount { returnPath: string }

export async function readPendingOAuth(db: PrismaClient, token: string | undefined): Promise<PendingOAuth | null> {
  if (!token || !tokenPattern.test(token)) return null;
  const [account] = await db.$queryRaw<PendingOAuth[]>`
    SELECT links.id AS socialAuthId, account.id AS userId, account.username,
           account.password AS passwordHash, factors.totp_secret AS totpSecret,
           factors.recovery_key AS recoveryKey, challenge.return_path AS returnPath
      FROM blex_oauth_challenge AS challenge
      JOIN board_socialauth AS links ON links.id = challenge.social_auth_id
      JOIN board_socialauthprovider AS provider ON provider.id = links.provider_id
      JOIN auth_user AS account ON account.id = links.user_id
      JOIN board_twofactorauth AS factors ON factors.user_id = account.id
     WHERE challenge.token_hash = ${hash(token)} AND challenge.expires_at > ${BigInt(Date.now())}
       AND account.is_active = 1 AND provider.is_enabled = 1
  `;
  return account ?? null;
}

export async function consumePendingOAuth(db: PrismaClient, token: string | undefined): Promise<boolean> {
  if (!token || !tokenPattern.test(token)) return false;
  const count = await db.$executeRaw`
    DELETE FROM blex_oauth_challenge WHERE token_hash = ${hash(token)} AND expires_at > ${BigInt(Date.now())}
  `;
  return count === 1;
}

export function registerOAuthRoutes(app: FastifyInstance, db: PrismaClient, siteUrl: URL, config: AuthConfig) {
  const cookieOptions = { ...authCookieOptions(siteUrl), httpOnly: true };
  const fetchProvider = config.fetchProvider ?? fetch;

  app.get('/v1/social-providers', async () => {
    return { status: 'DONE', body: await publicOAuthProviders(db, config.cipherKey) };
  });

  type StartRequest = { Params: { provider: string }; Querystring: { next?: string; time_zone?: string } };
  const start = async (request: FastifyRequest<StartRequest>, reply: FastifyReply) => {
    const { provider } = request.params;
    if (!supportedProvider(provider)) return reply.code(404).send('Not found');
    if (config.setupToken && !await hasAdministrator(db)) return reply.redirect('/setup', 302);
    const reauthenticate = request.method === 'POST';
    const next = safeReturnPath(request.query.next ?? (reauthenticate ? '/settings/account' : '/'), siteUrl);
    const session = request.cookies[sessionCookie];
    const user = await readSession(db, session, config.secretKey);
    const verificationPath = `/reauthenticate?${new URLSearchParams({ next })}`;
    if (reauthenticate) {
      if (!user) return reply.redirect(loginPath(verificationPath), 302);
      if (!validCsrf(request, siteUrl)) return reply.code(403).send('Forbidden');
      const [existing] = await db.$queryRaw<unknown[]>`
        SELECT 1 FROM board_socialauth AS link JOIN board_socialauthprovider AS provider ON provider.id = link.provider_id
         WHERE link.user_id = ${user.id} AND provider.key = ${provider}
      `;
      if (!existing) return reply.code(404).send('Not found');
    } else if (user) return reply.redirect(next, 302);

    const credentials = (await configuredProviders(db, config.cipherKey)).find((entry) => entry.key === provider);
    if (!credentials) return reply.redirect(reauthenticate ? verificationPath : loginPath(next), 302);
    const state = createToken();
    const browser = createToken();
    const verifier = randomBytes(48).toString('base64url');
    const now = Date.now();
    const sessionHash = reauthenticate ? tokenHash(session) ?? null : null;
    const region = signupRegion(request, typeof request.query.time_zone === 'string' ? request.query.time_zone : '');
    await db.$transaction([
      db.$executeRaw`DELETE FROM blex_oauth_flow WHERE expires_at <= ${BigInt(now)}`,
      db.$executeRaw`INSERT INTO blex_oauth_flow (state_hash, browser_hash, provider, verifier, return_path, expires_at, session_hash, language, time_zone)
                     VALUES (${hash(state)}, ${hash(browser)}, ${provider}, ${verifier}, ${next}, ${BigInt(now + oauthCodeLifetime * 1_000)},
                             ${sessionHash}, ${region.language}, ${region.timeZone})`,
    ]);
    const target = new URL(providers[provider].authorization);
    target.search = new URLSearchParams({
      client_id: credentials.clientId, redirect_uri: new URL(`/login/callback/${provider}`, siteUrl).href,
      response_type: 'code', scope: providers[provider].scope, state,
      code_challenge: createHash('sha256').update(verifier).digest('base64url'), code_challenge_method: 'S256',
    }).toString();
    if (reauthenticate) target.searchParams.set('prompt', 'select_account');
    reply.clearCookie(oauthChallengeCookie, cookieOptions);
    return reply.setCookie(`blex_oauth_${provider}`, browser, { ...cookieOptions, maxAge: oauthCodeLifetime }).redirect(target.href, 302);
  };
  app.get<StartRequest>('/login/start/:provider', start);
  app.post<StartRequest>('/login/start/:provider', start);

  type CallbackRequest = { Params: { provider: string }; Querystring: { state?: string; code?: string } };
  const callback = async (request: FastifyRequest<CallbackRequest>, reply: FastifyReply) => {
    const { provider } = request.params;
    if (!supportedProvider(provider)) return reply.code(404).send('Not found');
    const isApi = request.method === 'POST';
    const fail = (path = '/login', message = '소셜 로그인에 실패했습니다. 다시 시도해 주세요.') => isApi
      ? { status: 'ERROR', errorCode: 'error:RJ', errorMessage: message }
      : reply.redirect(path, 302);
    if (isApi && !validCsrf(request, siteUrl)) return reply.code(403).send({ status: 'ERROR', errorCode: 'error:RJ', errorMessage: '' });
    if (config.setupToken && !await hasAdministrator(db)) return fail('/setup', '먼저 관리자 계정을 만들어 주세요.');
    const browser = request.cookies[`blex_oauth_${provider}`];
    const { state, code } = isApi ? formInput(request) : request.query;
    if (isApi && (typeof code !== 'string' || !code)) return reply.code(404).send('Not found');
    if (!browser || !tokenPattern.test(browser) || typeof state !== 'string' || !tokenPattern.test(state) ||
        typeof code !== 'string' || !code) {
      return fail();
    }

    const session = request.cookies[sessionCookie];
    const verified = await readVerificationAccount(db, request, config.secretKey);
    if (isApi && verified) return fail();
    const sessionHash = verified?.sessionHash ?? null;
    const [flow] = await db.$queryRaw<OAuthFlowRow[]>`
      DELETE FROM blex_oauth_flow WHERE state_hash = ${hash(state)} AND browser_hash = ${hash(browser)}
        AND provider = ${provider} AND expires_at > ${BigInt(Date.now())} AND session_hash IS ${sessionHash}
        RETURNING verifier, return_path, session_hash, language, time_zone
    `;
    if (!flow) return fail();
    reply.clearCookie(`blex_oauth_${provider}`, cookieOptions);
    const verificationPath = `/reauthenticate?${new URLSearchParams({ next: flow.return_path })}`;
    const failurePath = verified ? verificationPath : loginPath(flow.return_path);
    const credentials = (await configuredProviders(db, config.cipherKey)).find((entry) => entry.key === provider);
    if (!credentials) return fail(failurePath, '소셜 로그인 설정이 완료되지 않았습니다.');

    const identity = await exchangeCode(fetchProvider, provider, credentials, code, flow.verifier, new URL(`/login/callback/${provider}`, siteUrl).href);
    if (!identity) return fail(failurePath);

    const [linked] = await db.$queryRaw<Array<LinkedAccount & { active: number | bigint }>>`
      SELECT links.id AS socialAuthId, account.id AS userId, account.username, account.password AS passwordHash,
             account.is_active AS active, factors.totp_secret AS totpSecret, factors.recovery_key AS recoveryKey
        FROM board_socialauth AS links
        JOIN board_socialauthprovider AS configured ON configured.id = links.provider_id
        JOIN auth_user AS account ON account.id = links.user_id
        LEFT JOIN board_twofactorauth AS factors ON factors.user_id = account.id
       WHERE configured.id = ${credentials.id} AND configured.is_enabled = 1 AND links.uid = ${identity.uid}
    `;
    if (verified) {
      if (!linked?.active || linked.userId !== verified.id) return fail(failurePath);
      const requireMfa = verified.factorId !== null;
      const token = await recordVerification(db, verified, requireMfa);
      if (!token) return fail(failurePath);
      return setSessionCookies(reply, siteUrl, token).redirect(requireMfa ? verificationPath : flow.return_path, 302);
    }
    if (linked && !linked.active) return fail(failurePath);
    const account = linked ?? await createSocialAccount(db, provider, credentials.id, identity, flow);
    if (!account) return fail(failurePath);

    if (account.totpSecret !== null && account.recoveryKey !== null) {
      const token = createToken();
      const now = Date.now();
      await db.$transaction([
        db.$executeRaw`DELETE FROM blex_oauth_challenge WHERE expires_at <= ${BigInt(now)}`,
        db.$executeRaw`INSERT INTO blex_oauth_challenge (token_hash, social_auth_id, return_path, expires_at)
                       VALUES (${hash(token)}, ${account.socialAuthId}, ${flow.return_path}, ${BigInt(now + oauthChallengeLifetime * 1_000)})`,
      ]);
      reply.setCookie(oauthChallengeCookie, token, { ...cookieOptions, maxAge: oauthChallengeLifetime });
      return isApi ? { status: 'DONE', body: { username: account.username, security: true, isOauth: true } } : reply.redirect('/login', 302);
    }

    const token = await createSession(db, account, config.secretKey, session);
    if (!token) return fail(failurePath);
    setSessionCookies(reply, siteUrl, token);
    if (!isApi) return reply.redirect(flow.return_path, 302);
    const user = await readSession(db, token, config.secretKey);
    if (!user) return fail(failurePath);
    return { status: 'DONE', body: loginBody(user, !linked) };
  };
  app.get<CallbackRequest>('/login/callback/:provider', callback);
  app.post<CallbackRequest>('/v1/sign/:provider', callback);
}
