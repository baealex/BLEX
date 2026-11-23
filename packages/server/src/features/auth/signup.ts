import { renderPage } from '../../platform/views.js';
import type { Prisma, PrismaClient } from '@prisma/client';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { readPublicSiteBrand, type SiteBrand } from '../discovery/http/pages.js';
import { updateAccountIdentity } from './account-identity.js';
import {
  accountEmailPattern,
  accountUsernamePattern,
  describeInvalidPassword,
  normalizeAccountEmail,
  signupRegion,
} from './account-validation.js';
import { authCookieOptions, csrfCookie, sessionCookie, setSessionCookies } from '../../platform/cookies.js';
import { csrfPattern, formInput, validCsrf } from '../../platform/csrf.js';
import { hashPassword } from './password-hash.js';
import { decryptSecret } from './encrypted-secret.js';
import type { AuthConfig } from './http.js';
import { reserveLoginAttempt } from './login-attempts.js';
import { publicOAuthProviders, safeReturnPath } from './oauth.js';
import { createSession, createToken, loginBody, readSession } from './session.js';
import { hasAdministrator, insertAccount } from './setup.js';

interface SignupSettings {
  captchaEnabled: boolean;
  siteKey: string;
  secretKey: string;
  welcome: string;
  welcomeUrl: string;
}

async function signupSettings(db: PrismaClient) {
  const settings = await db.loginSetting.findUnique({
    where: { id: 1 },
    select: {
      hcaptchaEnabled: true,
      hcaptchaSiteKey: true,
      hcaptchaSecretKey: true,
      welcomeNotificationMessage: true,
      welcomeNotificationUrl: true,
    },
  });
  return settings
    ? {
        captchaEnabled: settings.hcaptchaEnabled,
        siteKey: settings.hcaptchaSiteKey,
        secretKey: settings.hcaptchaSecretKey,
        welcome: settings.welcomeNotificationMessage,
        welcomeUrl: settings.welcomeNotificationUrl,
      }
    : undefined;
}

/** Requires a usable decrypted CAPTCHA secret. */
function activeCaptcha(settings: SignupSettings | undefined, cipherKey: string) {
  const secret = settings?.captchaEnabled ? decryptSecret(settings.secretKey, cipherKey) : null;
  return secret ? { secret, siteKey: settings!.siteKey.trim() } : null;
}

function legacyError(code: string, errorMessage: string) {
  return { status: 'ERROR', errorCode: `error:${code}`, errorMessage };
}

class InvalidSignup extends Error {
  constructor(
    message: string,
    readonly code = 'VA',
  ) {
    super(message);
  }
}

const usedInvite = '이미 사용되었거나 비활성화된 초대 코드입니다.';

async function findInvite(db: PrismaClient | Prisma.TransactionClient, code: string) {
  if (!code) return;
  const invite = await db.authorInvite.findUnique({
    where: { code },
    select: { id: true, isActive: true, claimedById: true },
  });
  if (!invite) throw new InvalidSignup('유효하지 않은 초대 코드입니다.', 'RJ');
  if (!invite.isActive || invite.claimedById !== null) throw new InvalidSignup(usedInvite, 'RJ');
  return invite;
}

function regularField(input: Record<string, unknown>, name: string) {
  const value = input[name];
  return typeof value === 'string' ? value : '';
}

async function verifyChallenge(fetchProvider: typeof fetch, secret: string, challenge: string) {
  try {
    const response = await fetchProvider('https://hcaptcha.com/siteverify', {
      method: 'POST',
      body: new URLSearchParams({ secret, response: challenge }),
      redirect: 'error',
      signal: AbortSignal.timeout(5_000),
    });
    return response.ok && ((await response.json()) as { success?: unknown }).success === true;
  } catch {
    return false;
  }
}

async function createPasswordAccount(db: PrismaClient, request: FastifyRequest, config: AuthConfig) {
  if (!(await hasAdministrator(db))) throw new InvalidSignup('첫 관리자 계정을 먼저 만들어주세요.', 'RJ');
  const input = formInput(request);
  const username = regularField(input, 'username');
  const displayName = regularField(input, 'name');
  const email = regularField(input, 'email');
  const password = regularField(input, 'password');
  const inviteCode = regularField(input, 'inviteCode').trim();
  if (await db.user.findUnique({ where: { username }, select: { id: true } }))
    throw new InvalidSignup('이미 사용중인 아이디입니다.');
  if (!accountUsernamePattern.test(username))
    throw new InvalidSignup('사용자 이름은 4~15자 사이의 소문자 영어, 숫자만 가능합니다.');
  if (email.length > 254 || !accountEmailPattern.test(email)) throw new InvalidSignup('올바른 이메일 주소가 아닙니다.');
  if (displayName.length > 150) throw new InvalidSignup('표시 이름은 150자까지 입력할 수 있습니다.');
  const passwordError = describeInvalidPassword(password, [username, displayName, email]);
  if (passwordError) throw new InvalidSignup(passwordError);
  await findInvite(db, inviteCode);
  const settings = await signupSettings(db);
  const attempt = await reserveLoginAttempt(db, `${config.secretKey}:signup`, request.ip, username);
  if (!attempt) throw new InvalidSignup('가입 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.', 'RJ');
  const captcha = activeCaptcha(settings, config.cipherKey);
  if (captcha) {
    const challenge = regularField(input, 'h-captcha-response').trim();
    if (!challenge) throw new InvalidSignup('보안 검증이 필요합니다.');
    if (!(await verifyChallenge(config.fetchProvider ?? fetch, captcha.secret, challenge))) {
      throw new InvalidSignup('보안 검증에 실패했습니다.', 'RJ');
    }
  }

  const passwordHash = await hashPassword(password);
  const { language, timeZone } = signupRegion(request, regularField(input, 'timeZone'));
  const userId = await db.$transaction(async (tx) => {
    // Acquire the SQLite write lock before rechecking the username and invitation.
    await tx.user.updateMany({ where: { username }, data: { username } });
    if (await tx.user.findUnique({ where: { username }, select: { id: true } }))
      throw new InvalidSignup('이미 사용중인 아이디입니다.');
    const invite = await findInvite(tx, inviteCode);
    const id = await insertAccount(tx, {
      username,
      displayName,
      email: normalizeAccountEmail(email),
      passwordHash,
      editor: Boolean(invite),
      language,
      timeZone,
    });
    if (invite) {
      const { count } = await tx.authorInvite.updateMany({
        where: { id: invite.id, isActive: true, claimedById: null },
        data: { claimedById: id, claimedAt: new Date(), isActive: false },
      });
      if (count !== 1) throw new InvalidSignup(usedInvite, 'RJ');
    }
    if (settings?.welcome) {
      const createdAt = new Date();
      await tx.notification.create({
        data: {
          key: createToken(),
          url: settings.welcomeUrl || '/',
          userId: id,
          content: settings.welcome.replaceAll('{name}', () => displayName),
          messageParams: {},
          createdAt,
          updatedAt: createdAt,
        },
      });
    }
    return id;
  });
  return { userId, passwordHash };
}

function signupMarkup(
  csrf: string,
  next: string,
  invite: string,
  siteKey: string,
  social: string[],
  brand: SiteBrand,
  error = '',
) {
  const params = new URLSearchParams(next === '/' ? {} : { next }).toString();
  return renderPage('sign', { brand, siteKey, social, params, error, csrf, invite });
}

export function registerSignup(app: FastifyInstance, db: PrismaClient, siteUrl: URL, config: AuthConfig) {
  app.patch('/v1/sign', async (request, reply) => {
    const user = await readSession(db, request.cookies[sessionCookie], config.secretKey);
    if (!user) return legacyError('NL', '');
    if (!validCsrf(request, siteUrl)) return reply.code(403).send(legacyError('RJ', ''));
    const invalid = await updateAccountIdentity(db, user.id, formInput(request), 'signup');
    return invalid ? legacyError('RJ', invalid) : { status: 'DONE', body: {} };
  });
  app.get<{ Querystring: { username?: string } }>('/v1/sign', async (request) => {
    const username = request.query.username;
    const exists =
      typeof username === 'string' && (await db.user.findUnique({ where: { username }, select: { id: true } }));
    return { status: 'DONE', body: { isAvailable: !exists } };
  });

  app.get<{ Querystring: { next?: string; invite?: string } }>('/sign', async (request, reply) => {
    const next = safeReturnPath(request.query.next, siteUrl);
    if (!(await hasAdministrator(db))) return reply.redirect('/setup', 302);
    if (await readSession(db, request.cookies[sessionCookie], config.secretKey)) return reply.redirect(next, 302);
    const csrf = csrfPattern.test(request.cookies[csrfCookie] ?? '') ? request.cookies[csrfCookie]! : createToken();
    const [settings, providers, brand] = await Promise.all([
      signupSettings(db),
      publicOAuthProviders(db, config.cipherKey),
      readPublicSiteBrand(db),
    ]);
    return reply
      .setCookie(csrfCookie, csrf, authCookieOptions(siteUrl))
      .type('text/html; charset=utf-8')
      .send(
        signupMarkup(
          csrf,
          next,
          typeof request.query.invite === 'string' ? request.query.invite : '',
          activeCaptcha(settings, config.cipherKey)?.siteKey ?? '',
          providers.map((provider) => provider.name),
          brand,
        ),
      );
  });

  for (const route of ['/sign', '/v1/sign']) {
    app.post<{ Querystring: { next?: string } }>(route, async (request, reply) => {
      if (!validCsrf(request, siteUrl)) return reply.code(403).send(legacyError('RJ', ''));
      const next = safeReturnPath(request.query.next, siteUrl);
      try {
        const input = formInput(request);
        if (
          route === '/sign' &&
          Object.hasOwn(input, 'passwordCheck') &&
          regularField(input, 'passwordCheck') !== regularField(input, 'password')
        ) {
          throw new InvalidSignup('두 비밀번호가 일치하지 않습니다.');
        }
        const account = await createPasswordAccount(db, request, config);
        const token = await createSession(db, account, config.secretKey, request.cookies[sessionCookie]);
        const user = await readSession(db, token ?? undefined, config.secretKey);
        if (!token || !user) return reply.code(500).send(legacyError('AT', ''));
        setSessionCookies(reply, siteUrl, token);
        if (route === '/sign') return reply.redirect(next, 302);
        return { status: 'DONE', body: loginBody(user, true) };
      } catch (error) {
        if (!(error instanceof InvalidSignup)) throw error;
        if (route === '/v1/sign') return legacyError(error.code, error.message);
        const [settings, providers, brand] = await Promise.all([
          signupSettings(db),
          publicOAuthProviders(db, config.cipherKey),
          readPublicSiteBrand(db),
        ]);
        return reply.type('text/html; charset=utf-8').send(
          signupMarkup(
            request.cookies[csrfCookie] ?? '',
            next,
            regularField(formInput(request), 'inviteCode'),
            activeCaptcha(settings, config.cipherKey)?.siteKey ?? '',
            providers.map((provider) => provider.name),
            brand,
            error.message,
          ),
        );
      }
    });
  }
}
