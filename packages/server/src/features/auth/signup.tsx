import { renderApplicationDocument } from '../../application/document.js';
import type { Prisma, PrismaClient } from '@prisma/client';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { SiteFooter, SiteHeader, SiteTheme } from '../../appearance/shell.js';
import { AuthPanel, authField, authInput, authSubmit } from './ui/panel.js';
import { readPublicSiteBrand, type SiteBrand } from '../discovery/pages/index.js';
import { updateAccountIdentity } from './account-identity.js';
import { accountEmailPattern, accountUsernamePattern, describeInvalidPassword, normalizeAccountEmail, signupRegion } from './account-validation.js';
import { authCookieOptions, csrfCookie, sessionCookie, setSessionCookies } from '../../platform/cookies.js';
import { csrfPattern, formInput, validCsrf } from '../../platform/csrf.js';
import { hashDjangoPassword } from './django-password.js';
import { decryptDjangoSecret } from './django-secret.js';
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
  return settings ? {
    captchaEnabled: settings.hcaptchaEnabled,
    siteKey: settings.hcaptchaSiteKey,
    secretKey: settings.hcaptchaSecretKey,
    welcome: settings.welcomeNotificationMessage,
    welcomeUrl: settings.welcomeNotificationUrl,
  } : undefined;
}

/** Like 3.x, a captcha without a usable secret is treated as switched off. */
function activeCaptcha(settings: SignupSettings | undefined, cipherKey: string) {
  const secret = settings?.captchaEnabled ? decryptDjangoSecret(settings.secretKey, cipherKey) : null;
  return secret ? { secret, siteKey: settings!.siteKey.trim() } : null;
}

function legacyError(code: string, errorMessage: string) {
  return { status: 'ERROR', errorCode: `error:${code}`, errorMessage };
}

class InvalidSignup extends Error {
  constructor(message: string, readonly code = 'VA') { super(message); }
}

interface Invite { id: number; active: bigint | number | boolean; owner: number | null }

async function findInvite(db: PrismaClient | Prisma.TransactionClient, code: string): Promise<Invite | undefined> {
  if (!code) return;
  const [invite] = await db.$queryRaw<Invite[]>`
    SELECT id, is_active AS active, claimed_by_id AS owner FROM board_authorinvite WHERE code = ${code}
  `;
  if (!invite) throw new InvalidSignup('유효하지 않은 초대 코드입니다.', 'RJ');
  if (!invite.active || invite.owner !== null) throw new InvalidSignup('이미 사용되었거나 비활성화된 초대 코드입니다.', 'RJ');
  return invite;
}

function regularField(input: Record<string, unknown>, name: string) {
  const value = input[name];
  return typeof value === 'string' ? value : '';
}

async function verifyChallenge(fetchProvider: typeof fetch, secret: string, challenge: string) {
  try {
    const response = await fetchProvider('https://hcaptcha.com/siteverify', {
      method: 'POST', body: new URLSearchParams({ secret, response: challenge }),
      redirect: 'error', signal: AbortSignal.timeout(5_000),
    });
    return response.ok && (await response.json() as { success?: unknown }).success === true;
  } catch {
    return false;
  }
}

async function createPasswordAccount(db: PrismaClient, request: FastifyRequest, config: AuthConfig) {
  if (!await hasAdministrator(db)) throw new InvalidSignup('첫 관리자 계정을 먼저 만들어주세요.', 'RJ');
  const input = formInput(request);
  const username = regularField(input, 'username');
  const displayName = regularField(input, 'name');
  const email = regularField(input, 'email');
  const password = regularField(input, 'password');
  const inviteCode = regularField(input, 'invite_code').trim();
  if (await db.user.findUnique({ where: { username }, select: { id: true } })) throw new InvalidSignup('이미 사용중인 아이디입니다.');
  if (!accountUsernamePattern.test(username)) throw new InvalidSignup('사용자 이름은 4~15자 사이의 소문자 영어, 숫자만 가능합니다.');
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
    if (!await verifyChallenge(config.fetchProvider ?? fetch, captcha.secret, challenge)) {
      throw new InvalidSignup('보안 검증에 실패했습니다.', 'RJ');
    }
  }

  const passwordHash = await hashDjangoPassword(password);
  const { language, timeZone } = signupRegion(request, regularField(input, 'time_zone'));
  const timestamp = new Date().toISOString().slice(0, -1).replace('T', ' ');
  const userId = await db.$transaction(async (tx) => {
    // Acquire the SQLite write lock before rechecking the username and invitation.
    await tx.$executeRaw`UPDATE auth_user SET username = username WHERE username = ${username}`;
    if (await tx.user.findUnique({ where: { username }, select: { id: true } })) throw new InvalidSignup('이미 사용중인 아이디입니다.');
    const invite = await findInvite(tx, inviteCode);
    const id = await insertAccount(tx, {
      username, displayName, email: normalizeAccountEmail(email), passwordHash, editor: Boolean(invite), language, timeZone,
    });
    if (invite) await tx.$executeRaw`
      UPDATE board_authorinvite SET claimed_by_id = ${id}, claimed_date = ${timestamp}, is_active = 0 WHERE id = ${invite.id}
    `;
    if (settings?.welcome) {
      const createdAt = new Date();
      await tx.notification.create({
        data: {
          key: createToken(), url: settings.welcomeUrl || '/', userId: id,
          content: settings.welcome.replaceAll('{name}', () => displayName), messageParams: {}, createdAt, updatedAt: createdAt,
        },
      });
    }
    return id;
  });
  return { userId, passwordHash };
}

function signupMarkup(csrf: string, next: string, invite: string, siteKey: string, social: string[], brand: SiteBrand, error = '') {
  const params = new URLSearchParams(next === '/' ? {} : { next }).toString();
  return renderApplicationDocument(<html lang="ko">
      <head>
        <meta charSet="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="noindex" /><title>{`회원가입 - ${brand.siteName}`}</title>
        <SiteTheme />
        {siteKey && <script src="https://js.hcaptcha.com/1/api.js" async defer data-blex-trusted-script="hcaptcha" />}
      </head>
      <body className="bg-surface-page text-content antialiased"><SiteHeader brand={brand} />
        <main className="flex min-h-[calc(100vh-10.5rem)] justify-center px-4 py-16 md:px-6">
          <div className="w-full max-w-[420px]">
            <AuthPanel title="회원가입" description={`${brand.siteName}에서 새 계정을 만드세요`} id="signup-title">
              {social.length > 0 && <div className="mb-6 grid gap-2">{social.map((name) => <a key={name}
                className="rounded-lg border border-line py-3 text-center text-sm font-semibold hover:bg-surface-subtle"
                href={`/login/start/${name.toLowerCase()}${params ? `?${params}` : ''}`}>{name} 계정으로 계속</a>)}
                <p className="text-center text-xs text-content-hint">또는</p></div>}
              {error && <p role="alert" className="mb-4 rounded-xl border border-danger-line bg-danger-surface p-3 text-sm text-danger">{error}</p>}
              <form action={params ? `/sign?${params}` : '/sign'} method="post" className="space-y-4">
                <input type="hidden" name="csrfmiddlewaretoken" value={csrf} />
                <label className={authField}>아이디<input className={authInput} name="username" autoComplete="username" placeholder="아이디를 입력하세요" pattern="[a-z0-9]{4,15}" required /></label>
                <label className={authField}>표시 이름<input className={authInput} name="name" autoComplete="name" placeholder="표시 이름을 입력하세요" maxLength={150} required /></label>
                <label className={authField}>이메일<input className={authInput} name="email" type="email" autoComplete="email" placeholder="이메일을 입력하세요" maxLength={254} required /></label>
                <label className={authField}>비밀번호<input className={authInput} name="password" type="password" placeholder="비밀번호를 입력하세요" minLength={8} autoComplete="new-password" required /></label>
                <label className={authField}>비밀번호 확인<input className={authInput} name="password_check" type="password" placeholder="비밀번호를 한 번 더 입력하세요" minLength={8} autoComplete="new-password" required /></label>
                <details open={Boolean(invite)}><summary className="cursor-pointer text-xs font-semibold text-content-secondary">초대 코드</summary>
                  <input className={authInput} name="invite_code" aria-label="초대 코드" defaultValue={invite} maxLength={64} /></details>
                {siteKey && <div className="h-captcha" data-sitekey={siteKey} data-blex-hcaptcha-widget="" />}
                <button className={authSubmit} type="submit">가입하기</button>
              </form>
              <p className="mt-6 border-t border-line-light pt-6 text-center text-sm font-medium text-content-secondary">이미 계정이 있나요? <a href={params ? `/login?${params}` : '/login'} className="ml-1 font-bold text-content underline">로그인</a></p>
            </AuthPanel>
          </div>
        </main><SiteFooter brand={brand} /></body>
    </html>);
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
    const exists = typeof username === 'string' && await db.user.findUnique({ where: { username }, select: { id: true } });
    return { status: 'DONE', body: { is_available: !exists } };
  });

  app.get<{ Querystring: { next?: string; invite?: string } }>('/sign', async (request, reply) => {
    const next = safeReturnPath(request.query.next, siteUrl);
    if (!await hasAdministrator(db)) return reply.redirect('/setup', 302);
    if (await readSession(db, request.cookies[sessionCookie], config.secretKey)) return reply.redirect(next, 302);
    const csrf = csrfPattern.test(request.cookies[csrfCookie] ?? '') ? request.cookies[csrfCookie]! : createToken();
    const [settings, providers, brand] = await Promise.all([signupSettings(db), publicOAuthProviders(db, config.cipherKey), readPublicSiteBrand(db)]);
    return reply.setCookie(csrfCookie, csrf, authCookieOptions(siteUrl)).type('text/html; charset=utf-8')
      .send(signupMarkup(csrf, next, typeof request.query.invite === 'string' ? request.query.invite : '',
        activeCaptcha(settings, config.cipherKey)?.siteKey ?? '', providers.map((provider) => provider.name), brand));
  });

  for (const route of ['/sign', '/v1/sign']) {
    app.post<{ Querystring: { next?: string } }>(route, async (request, reply) => {
      if (!validCsrf(request, siteUrl)) return reply.code(403).send(legacyError('RJ', ''));
      const next = safeReturnPath(request.query.next, siteUrl);
      try {
        const input = formInput(request);
        if (route === '/sign' && Object.hasOwn(input, 'password_check') && regularField(input, 'password_check') !== regularField(input, 'password')) {
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
        const [settings, providers, brand] = await Promise.all([signupSettings(db), publicOAuthProviders(db, config.cipherKey), readPublicSiteBrand(db)]);
        return reply.type('text/html; charset=utf-8').send(signupMarkup(request.cookies[csrfCookie] ?? '', next,
          regularField(formInput(request), 'invite_code'), activeCaptcha(settings, config.cipherKey)?.siteKey ?? '', providers.map((provider) => provider.name), brand, error.message));
      }
    });
  }
}
