import { createHash, randomBytes } from 'node:crypto';
import type { Prisma, PrismaClient } from '@prisma/client';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { signupRegion } from './account-validation.js';
import { authCookieOptions, sessionCookie, setSessionCookies } from '../../platform/cookies.js';
import { formInput, validCsrf } from '../../platform/csrf.js';
import { decryptSecret } from './encrypted-secret.js';
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

async function configuredProviders(db: PrismaClient, cipherKey: string) {
  const rows = await db.socialProvider.findMany({
    where: { isEnabled: true, clientId: { not: '' }, clientSecret: { not: '' }, key: { in: ['google', 'github'] } },
    orderBy: { id: 'asc' },
    select: { id: true, key: true, clientId: true, clientSecret: true },
  });
  return rows.flatMap(({ id, key, clientId, clientSecret: stored }) => {
    const clientSecret = decryptSecret(stored, cipherKey);
    return supportedProvider(key) && clientSecret ? [{ id, key, clientId, clientSecret }] : [];
  });
}

export async function publicOAuthProviders(db: PrismaClient, cipherKey: string) {
  const configured = await configuredProviders(db, cipherKey);
  return configured.map(({ key, clientId }) => ({ key, name: providers[key].name, clientId }));
}

interface LinkedAccount {
  socialAccountId: number;
  userId: number;
  username: string;
  passwordHash: string;
  totpSecret: string | null;
  recoveryKey: string | null;
}

interface OAuthFlowRow {
  verifier: string;
  returnPath: string;
  language: string;
  timeZone: string;
}

interface ProviderIdentity {
  uid: string;
  profile: Record<string, unknown>;
}

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
        client_id: credentials.clientId,
        client_secret: credentials.clientSecret,
        code,
        redirect_uri: redirectUri,
        code_verifier: verifier,
        grant_type: 'authorization_code',
      }),
      redirect: 'error',
      signal: AbortSignal.timeout(10_000),
    });
    if (!tokens.ok) return null;
    const { access_token: accessToken } = (await tokens.json()) as { access_token?: unknown };
    if (typeof accessToken !== 'string' || !accessToken) return null;
    const profile = await fetchProvider(endpoints.user, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json', 'User-Agent': 'BLEX' },
      redirect: 'error',
      signal: AbortSignal.timeout(10_000),
    });
    if (!profile.ok) return null;
    const details = (await profile.json()) as Record<string, unknown>;
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

async function createSocialAccount(
  db: PrismaClient,
  provider: Provider,
  providerId: number,
  identity: ProviderIdentity,
  flow: OAuthFlowRow,
) {
  const name = identityField(identity.profile, 'name', 150);
  const email = provider === 'google' ? identityField(identity.profile, 'email', 254) : '';
  const login = provider === 'github' ? identityField(identity.profile, 'login', 64) : email.split('@')[0];
  if (!login) return null;
  const base =
    login
      .toLowerCase()
      .replace(/[^a-z0-9_.-]/g, '')
      .slice(0, 64) || 'member';
  return db.$transaction(async (tx) => {
    // A write, so the checks below run under SQLite's write lock.
    const { count: enabled } = await tx.socialProvider.updateMany({
      where: { id: providerId, isEnabled: true },
      data: { isEnabled: true },
    });
    if (!enabled || !(await hasAdministrator(tx))) return null;
    const exists = await tx.socialAccount.findUnique({
      where: { providerId_uid: { providerId, uid: identity.uid } },
      select: { id: true },
    });
    if (exists) return null;
    // LIKE may return extra names, which only the exact lookup in `taken` ever reads.
    const usernames = await tx.user.findMany({ where: { username: { startsWith: base } }, select: { username: true } });
    const taken = new Set(usernames.map((user) => user.username));
    let username = base;
    for (let suffix = 1; taken.has(username); suffix += 1) username = `${base}${suffix}`;
    const passwordHash = `!${createToken()}`;
    const userId = await insertAccount(tx, {
      username,
      displayName: name,
      email,
      passwordHash,
      language: flow.language,
      timeZone: flow.timeZone,
    });
    const link = await tx.socialAccount.create({
      data: { providerId, uid: identity.uid, userId, extraData: JSON.stringify(identity.profile) },
      select: { id: true },
    });
    if (provider === 'github' && /^[a-z\d-]+$/i.test(login)) {
      await tx.socialLink.create({
        data: { userId, platform: 'github', url: `https://github.com/${login}`, order: 0 },
        select: { id: true },
      });
    }
    return {
      socialAccountId: link.id,
      userId,
      username,
      passwordHash,
      totpSecret: null,
      recoveryKey: null,
    } satisfies LinkedAccount;
  });
}

interface PendingOAuth extends LinkedAccount {
  returnPath: string;
}

const linkedAccountSelect = {
  id: true,
  user: {
    select: {
      id: true,
      username: true,
      passwordHash: true,
      isActive: true,
      twoFactor: { select: { totpSecret: true, recoveryKey: true } },
    },
  },
} satisfies Prisma.SocialAccountSelect;

function linkedAccount({
  id,
  user,
}: Prisma.SocialAccountGetPayload<{ select: typeof linkedAccountSelect }>): LinkedAccount {
  return {
    socialAccountId: id,
    userId: user.id,
    username: user.username,
    passwordHash: user.passwordHash,
    totpSecret: user.twoFactor?.totpSecret ?? null,
    recoveryKey: user.twoFactor?.recoveryKey ?? null,
  };
}

/** Takes one OAuth state exactly once, so a replayed or concurrent callback finds nothing. */
async function claimOAuthFlow(db: PrismaClient, where: Prisma.OAuthFlowWhereInput) {
  return db.$transaction(async (tx) => {
    const flow = await tx.oAuthFlow.findFirst({
      where,
      select: { verifier: true, returnPath: true, language: true, timeZone: true },
    });
    if (!flow) return null;
    const { count } = await tx.oAuthFlow.deleteMany({ where });
    return count === 1 ? flow : null;
  });
}

export async function readPendingOAuth(db: PrismaClient, token: string | undefined): Promise<PendingOAuth | null> {
  if (!token || !tokenPattern.test(token)) return null;
  const challenge = await db.oAuthChallenge.findFirst({
    where: {
      tokenHash: hash(token),
      expiresAt: { gt: new Date() },
      socialAccount: { provider: { isEnabled: true }, user: { isActive: true, twoFactor: { isNot: null } } },
    },
    select: { returnPath: true, socialAccount: { select: linkedAccountSelect } },
  });
  return challenge && { ...linkedAccount(challenge.socialAccount), returnPath: challenge.returnPath };
}

export async function consumePendingOAuth(db: PrismaClient, token: string | undefined): Promise<boolean> {
  if (!token || !tokenPattern.test(token)) return false;
  const { count } = await db.oAuthChallenge.deleteMany({
    where: { tokenHash: hash(token), expiresAt: { gt: new Date() } },
  });
  return count === 1;
}

export function registerOAuthRoutes(app: FastifyInstance, db: PrismaClient, siteUrl: URL, config: AuthConfig) {
  const cookieOptions = { ...authCookieOptions(siteUrl), httpOnly: true };
  const fetchProvider = config.fetchProvider ?? fetch;

  app.get('/v1/social-providers', async () => {
    return { status: 'DONE', body: await publicOAuthProviders(db, config.cipherKey) };
  });

  type StartRequest = { Params: { provider: string }; Querystring: { next?: string; timeZone?: string } };
  const start = async (request: FastifyRequest<StartRequest>, reply: FastifyReply) => {
    const { provider } = request.params;
    if (!supportedProvider(provider)) return reply.code(404).send('Not found');
    if (config.setupToken && !(await hasAdministrator(db))) return reply.redirect('/setup', 302);
    const reauthenticate = request.method === 'POST';
    const next = safeReturnPath(request.query.next ?? (reauthenticate ? '/settings/account' : '/'), siteUrl);
    const session = request.cookies[sessionCookie];
    const user = await readSession(db, session, config.secretKey);
    const verificationPath = `/reauthenticate?${new URLSearchParams({ next })}`;
    if (reauthenticate) {
      if (!user) return reply.redirect(loginPath(verificationPath), 302);
      if (!validCsrf(request, siteUrl)) return reply.code(403).send('Forbidden');
      const existing = await db.socialAccount.findFirst({
        where: { userId: user.id, provider: { key: provider } },
        select: { id: true },
      });
      if (!existing) return reply.code(404).send('Not found');
    } else if (user) return reply.redirect(next, 302);

    const credentials = (await configuredProviders(db, config.cipherKey)).find((entry) => entry.key === provider);
    if (!credentials) return reply.redirect(reauthenticate ? verificationPath : loginPath(next), 302);
    const state = createToken();
    const browser = createToken();
    const verifier = randomBytes(48).toString('base64url');
    const now = new Date();
    const sessionHash = reauthenticate ? (tokenHash(session) ?? null) : null;
    const region = signupRegion(request, typeof request.query.timeZone === 'string' ? request.query.timeZone : '');
    await db.$transaction([
      db.oAuthFlow.deleteMany({ where: { expiresAt: { lte: now } } }),
      db.oAuthFlow.create({
        data: {
          stateHash: hash(state),
          browserHash: hash(browser),
          provider,
          verifier,
          returnPath: next,
          expiresAt: new Date(now.getTime() + oauthCodeLifetime * 1_000),
          sessionHash,
          language: region.language,
          timeZone: region.timeZone,
        },
        select: { stateHash: true },
      }),
    ]);
    const target = new URL(providers[provider].authorization);
    target.search = new URLSearchParams({
      client_id: credentials.clientId,
      redirect_uri: new URL(`/login/callback/${provider}`, siteUrl).href,
      response_type: 'code',
      scope: providers[provider].scope,
      state,
      code_challenge: createHash('sha256').update(verifier).digest('base64url'),
      code_challenge_method: 'S256',
    }).toString();
    if (reauthenticate) target.searchParams.set('prompt', 'select_account');
    reply.clearCookie(oauthChallengeCookie, cookieOptions);
    return reply
      .setCookie(`blex_oauth_${provider}`, browser, { ...cookieOptions, maxAge: oauthCodeLifetime })
      .redirect(target.href, 302);
  };
  app.get<StartRequest>('/login/start/:provider', start);
  app.post<StartRequest>('/login/start/:provider', start);

  type CallbackRequest = { Params: { provider: string }; Querystring: { state?: string; code?: string } };
  const callback = async (request: FastifyRequest<CallbackRequest>, reply: FastifyReply) => {
    const { provider } = request.params;
    if (!supportedProvider(provider)) return reply.code(404).send('Not found');
    const isApi = request.method === 'POST';
    const fail = (path = '/login', message = '소셜 로그인에 실패했습니다. 다시 시도해 주세요.') =>
      isApi ? { status: 'ERROR', errorCode: 'error:RJ', errorMessage: message } : reply.redirect(path, 302);
    if (isApi && !validCsrf(request, siteUrl))
      return reply.code(403).send({ status: 'ERROR', errorCode: 'error:RJ', errorMessage: '' });
    if (config.setupToken && !(await hasAdministrator(db))) return fail('/setup', '먼저 관리자 계정을 만들어 주세요.');
    const browser = request.cookies[`blex_oauth_${provider}`];
    const { state, code } = isApi ? formInput(request) : request.query;
    if (isApi && (typeof code !== 'string' || !code)) return reply.code(404).send('Not found');
    if (
      !browser ||
      !tokenPattern.test(browser) ||
      typeof state !== 'string' ||
      !tokenPattern.test(state) ||
      typeof code !== 'string' ||
      !code
    ) {
      return fail();
    }

    const session = request.cookies[sessionCookie];
    const verified = await readVerificationAccount(db, request, config.secretKey);
    if (isApi && verified) return fail();
    const sessionHash = verified?.sessionHash ?? null;
    const flow = await claimOAuthFlow(db, {
      stateHash: hash(state),
      browserHash: hash(browser),
      provider,
      expiresAt: { gt: new Date() },
      sessionHash,
    });
    if (!flow) return fail();
    reply.clearCookie(`blex_oauth_${provider}`, cookieOptions);
    const verificationPath = `/reauthenticate?${new URLSearchParams({ next: flow.returnPath })}`;
    const failurePath = verified ? verificationPath : loginPath(flow.returnPath);
    const credentials = (await configuredProviders(db, config.cipherKey)).find((entry) => entry.key === provider);
    if (!credentials) return fail(failurePath, '소셜 로그인 설정이 완료되지 않았습니다.');

    const identity = await exchangeCode(
      fetchProvider,
      provider,
      credentials,
      code,
      flow.verifier,
      new URL(`/login/callback/${provider}`, siteUrl).href,
    );
    if (!identity) return fail(failurePath);

    const link = await db.socialAccount.findFirst({
      where: { providerId: credentials.id, uid: identity.uid, provider: { isEnabled: true } },
      select: linkedAccountSelect,
    });
    const linked = link && linkedAccount(link);
    const linkedActive = link?.user.isActive === true;
    if (verified) {
      if (!linked || !linkedActive || linked.userId !== verified.id) return fail(failurePath);
      const requireMfa = verified.factorId !== null;
      const token = await recordVerification(db, verified, requireMfa);
      if (!token) return fail(failurePath);
      return setSessionCookies(reply, siteUrl, token).redirect(requireMfa ? verificationPath : flow.returnPath, 302);
    }
    if (linked && !linkedActive) return fail(failurePath);
    const account = linked ?? (await createSocialAccount(db, provider, credentials.id, identity, flow));
    if (!account) return fail(failurePath);

    if (account.totpSecret !== null && account.recoveryKey !== null) {
      const token = createToken();
      const now = new Date();
      await db.$transaction([
        db.oAuthChallenge.deleteMany({ where: { expiresAt: { lte: now } } }),
        db.oAuthChallenge.create({
          data: {
            tokenHash: hash(token),
            socialAccountId: account.socialAccountId,
            returnPath: flow.returnPath,
            expiresAt: new Date(now.getTime() + oauthChallengeLifetime * 1_000),
          },
          select: { tokenHash: true },
        }),
      ]);
      reply.setCookie(oauthChallengeCookie, token, { ...cookieOptions, maxAge: oauthChallengeLifetime });
      return isApi
        ? { status: 'DONE', body: { username: account.username, security: true, isOauth: true } }
        : reply.redirect('/login', 302);
    }

    const token = await createSession(db, account, config.secretKey, session);
    if (!token) return fail(failurePath);
    setSessionCookies(reply, siteUrl, token);
    if (!isApi) return reply.redirect(flow.returnPath, 302);
    const user = await readSession(db, token, config.secretKey);
    if (!user) return fail(failurePath);
    return { status: 'DONE', body: loginBody(user, !linked) };
  };
  app.get<CallbackRequest>('/login/callback/:provider', callback);
  app.post<CallbackRequest>('/v1/sign/:provider', callback);
}
