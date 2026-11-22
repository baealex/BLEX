import type { PrismaClient } from '@prisma/client';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { prepareUsernameChange } from './account-identity.js';
import { accountUsernamePattern, describeInvalidPassword } from './account-validation.js';
import { authCookieOptions, csrfCookie, sessionCookie, setSessionCookies } from '../../platform/cookies.js';
import { csrfPattern, formInput, validCsrf } from '../../platform/csrf.js';
import { deleteAccount } from './delete-account.js';
import { hashDjangoPassword, verifyDjangoPassword } from './django-password.js';
import { activateFactor, beginFactorSetup, disableFactor } from './factor-management.js';
import type { AuthConfig } from './http.js';
import { reserveLoginAttempt } from './login-attempts.js';
import { publicOAuthProviders, safeReturnPath } from './oauth.js';
import { credentialTag, createToken, tokenHash } from './session.js';
import { verifyDjangoSecondFactor } from './two-factor.js';
import { acquireVerification, hasVerification, readVerificationAccount, recordVerification } from './verification.js';
import { renderApplicationDocument } from '../../application/document.js';
import { SiteFooter, SiteHeader, SiteTheme } from '../../appearance/shell.js';
import { readPublicSiteBrand } from '../discovery/pages/index.js';
import { done, failure } from '../../platform/response.js';

const success = done();

export function securityError(code: string, errorMessage = '') {
  return failure(code, errorMessage);
}

export const verificationRequired = {
  ...securityError('RE', '계속하려면 본인 확인을 해주세요.'),
  messageKey: 'auth.reauthentication_required',
  messageParams: {},
};

export function reauthenticationPath(next: string) {
  return `/reauthenticate?${new URLSearchParams({ next })}`;
}

function factorError(code: string | null, action?: string) {
  if (!code) return success;
  if (code === 'RE') return verificationRequired;
  const messages: Record<string, string> = {
    AU: '2단계 인증을 이미 해제했습니다.', AC: '2단계 인증을 이미 연결했습니다.', EP: '2FA 설정 세션이 만료되었습니다. 다시 시도해주세요.',
    IP: '인증 코드를 입력해주세요.', RJ: action === 'disable' ? '24시간 동안 해제할 수 없습니다.' : '잘못된 인증 코드입니다.',
  };
  return securityError(code, messages[code]);
}

async function readSecurityViewer(db: PrismaClient, accountId: number) {
  const [viewer] = await db.$queryRaw<Array<{ role: string | null; isStaff: number | bigint | boolean }>>`
    SELECT profile.role AS role, account.is_staff AS isStaff
      FROM auth_user AS account
      LEFT JOIN board_profile AS profile ON profile.user_id = account.id
     WHERE account.id = ${accountId}
     LIMIT 1
  `;
  return viewer && { ...viewer, unreadCount: await db.notification.count({ where: { userId: accountId, isRead: false } }) };
}

function csrfForPage(request: FastifyRequest, reply: FastifyReply, siteUrl: URL) {
  const previous = request.cookies[csrfCookie];
  if (previous && csrfPattern.test(previous)) return previous;
  const token = createToken();
  reply.setCookie(csrfCookie, token, authCookieOptions(siteUrl));
  return token;
}

function submittedPasswordError(password: string, account: { username: string; name: string; email: string }) {
  if (!/\p{N}/u.test(password) || !/\p{Ll}/u.test(password) || !/\p{Lu}/u.test(password) || !/[^\p{N}\p{Ll}\p{Lu}]/u.test(password)) {
    return '비밀번호에는 숫자, 소문자, 대문자, 특수문자를 모두 넣어 주세요.';
  }
  return describeInvalidPassword(password, [account.username, account.name, account.email]);
}

type PasswordUpdate = typeof success | ReturnType<typeof securityError> | typeof verificationRequired;

export function passwordUpdater(db: PrismaClient, siteUrl: URL, config: AuthConfig) {
  return async (request: FastifyRequest, reply: FastifyReply, user: { id: number }, input: Record<string, unknown>): Promise<PasswordUpdate> => {
    const account = await readVerificationAccount(db, request, config.secretKey);
    if (!account || user.id !== account.id) return securityError('NL');
    if (!validCsrf(request, siteUrl)) return reply.code(403).send(securityError('RJ'));
    if (!hasVerification(account)) return verificationRequired;
    const { password, username, name, revoke_tokens: revokeTokens } = input;
    if (typeof password !== 'string' || !password ||
        (username !== undefined && typeof username !== 'string') || (name !== undefined && typeof name !== 'string')) return securityError('VA');
    const newUsername = username || account.username;
    const newName = name || account.name;
    if ((newUsername !== account.username && !accountUsernamePattern.test(newUsername)) || newName.length > 150) return securityError('VA');
    const passwordError = submittedPasswordError(password, { username: newUsername, name: newName, email: account.email });
    if (passwordError) return securityError('VA', passwordError);
    const newPasswordHash = await hashDjangoPassword(password);
    const sessionToken = createToken();
    const revokedAt = new Date();

    const result = await db.$transaction<PasswordUpdate>(async (tx) => {
      if (!await acquireVerification(tx, account)) return verificationRequired;
      if (username) {
        const [current] = await tx.$queryRaw<Array<{ username: string }>>`SELECT username FROM auth_user WHERE id = ${account.id}`;
        const invalid = await prepareUsernameChange(tx, account.id, current.username, newUsername, 'account');
        if (invalid) return securityError('VA', invalid);
      }
      await tx.$executeRaw`
        UPDATE auth_user SET password = ${newPasswordHash}, username = COALESCE(${username || null}, username),
               first_name = COALESCE(${name || null}, first_name) WHERE id = ${account.id}
      `;
      await tx.$executeRaw`DELETE FROM blex_session WHERE user_id = ${account.id} AND token_hash <> ${account.sessionHash}`;
      await tx.$executeRaw`DELETE FROM blex_factor_setup WHERE session_hash = ${account.sessionHash}`;
      await tx.$executeRaw`
        UPDATE blex_session SET token_hash = ${tokenHash(sessionToken)!}, credential_tag = ${credentialTag(newPasswordHash, config.secretKey)},
               verified_until = NULL, verified_factor_id = NULL, requires_factor = 0 WHERE token_hash = ${account.sessionHash}
      `;
      if (revokeTokens === true || revokeTokens === 'true') {
        await tx.developerToken.updateMany({ where: { userId: account.id, revokedAt: null }, data: { revokedAt, updatedAt: revokedAt } });
      }
      return success;
    });
    if (result.status === 'DONE') setSessionCookies(reply, siteUrl, sessionToken);
    return result;
  };
}

export function registerAccountSecurity(app: FastifyInstance, db: PrismaClient, siteUrl: URL, config: AuthConfig) {
  const reauthenticate = async (request: FastifyRequest<{ Querystring: { next?: string } }>, reply: FastifyReply) => {
    const next = safeReturnPath(request.query.next ?? '/settings/account', siteUrl);
    const account = await readVerificationAccount(db, request, config.secretKey);
    if (!account) return reply.redirect(`/login?${new URLSearchParams({ next: reauthenticationPath(next) })}`, 302);
    if (hasVerification(account)) return reply.redirect(next, 302);
    const pendingFactor = hasVerification(account, true);
    const hasPassword = /^[a-z0-9_]+\$/.test(account.password);
    let error = '';
    if (request.method === 'POST') {
      if (!validCsrf(request, siteUrl)) return reply.code(403).send('요청을 확인해 주세요.');
      const input = formInput(request);
      const attempt = await reserveLoginAttempt(db, config.secretKey, request.ip, account.username);
      if (!attempt) error = '너무 많은 실패로 인해 잠시 후 다시 시도해주세요.';
      else {
        const isAccount = pendingFactor || (hasPassword && typeof input.password === 'string' && await verifyDjangoPassword(input.password, account.password));
        const isFactor = account.factorId === null || (typeof input.code === 'string' && account.totpSecret !== null && account.recoveryKey !== null &&
          verifyDjangoSecondFactor({ totpSecret: account.totpSecret, recoveryKey: account.recoveryKey }, input.code, config.cipherKey));
        if (!isAccount || !isFactor) error = '비밀번호 또는 인증 코드가 올바르지 않습니다.';
        else {
          const token = await recordVerification(db, account);
          await attempt();
          if (token) return setSessionCookies(reply, siteUrl, token).redirect(next, 302);
          return reply.redirect(reauthenticationPath(next), 302);
        }
      }
    }

    const csrf = csrfForPage(request, reply, siteUrl);
    const links = await db.$queryRaw<Array<{ key: string }>>`
      SELECT provider.key FROM board_socialauth AS link JOIN board_socialauthprovider AS provider ON provider.id = link.provider_id
       WHERE link.user_id = ${account.id} AND provider.is_enabled = 1
    `;
    const providers = (await publicOAuthProviders(db, config.cipherKey)).filter((choice) => links.some((link) => link.key === choice.key));
    const showForm = hasPassword || pendingFactor;
    const visibleProviders = pendingFactor ? [] : providers;
    const viewer = await readSecurityViewer(db, account.id);
    const brand = await readPublicSiteBrand(db);
    const fieldClass = 'block h-12 w-full rounded-lg border border-line bg-surface px-3';
    return reply.type('text/html; charset=utf-8').header('Cache-Control', 'private, no-store').send(renderApplicationDocument(<html lang="ko">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="noindex,nofollow,noarchive" />
        <title>{`본인 확인 - ${brand.siteName}`}</title>
        <SiteTheme />
      </head>
      <body className="bg-surface-page text-content antialiased">
        <SiteHeader brand={brand} viewer={{ username: account.username, hasEditorRole: viewer?.role === 'EDITOR', isStaff: Boolean(viewer?.isStaff), unreadCount: Number(viewer?.unreadCount ?? 0), csrfToken: csrf }} />
        <main className="min-h-[calc(100vh-10.5rem)]"><div className="mx-auto my-16 w-full max-w-md px-4">
          <section className="rounded-2xl border border-line bg-surface p-6 shadow-subtle">
            <h1 className="text-xl font-semibold text-content">본인 확인</h1>
            <p className="mt-2 text-sm text-content-secondary">본인 확인을 마치면 설정으로 돌아가 변경을 다시 시도할 수 있습니다.</p>
            {error && <p className="mt-4 text-danger" role="alert">{error}</p>}
            {showForm && <form action={reauthenticationPath(next)} method="post" className="mt-5 space-y-4">
              <input type="hidden" name="csrfmiddlewaretoken" value={csrf} />
              {!pendingFactor && <label className="block space-y-1"><span className="text-sm text-content">현재 비밀번호</span>
                <input className={fieldClass} type="password" name="password" autoComplete="current-password" required /></label>}
              {account.factorId !== null && <label className="block space-y-1"><span className="text-sm text-content">인증 앱 코드 또는 복구 키</span>
                <input className={fieldClass} name="code" autoComplete="one-time-code" maxLength={64} required /></label>}
              <button className="min-h-11 w-full rounded-lg bg-action px-4 text-content-inverted hover:bg-action-hover active:scale-95" type="submit">확인</button>
            </form>}
            {visibleProviders.length > 0 ? <div className="mt-5 space-y-3">{visibleProviders.map((provider) => <form key={provider.key}
              action={`/login/start/${provider.key}?${new URLSearchParams({ next })}`} method="post">
              <input type="hidden" name="csrfmiddlewaretoken" value={csrf} />
              <button className="min-h-11 w-full rounded-lg border border-line px-4 hover:bg-surface-subtle active:scale-95" type="submit">{`${provider.name}로 계속하기`}</button>
            </form>)}</div> : !showForm && <p className="mt-4 text-sm text-content-secondary">계정 접근을 복구하려면 사이트 관리자에게 문의하세요.</p>}
            <a className="mt-4 inline-flex min-h-11 items-center text-sm text-content-secondary hover:underline" href={next}>취소</a>
          </section>
        </div></main>
        <SiteFooter brand={brand} />
      </body>
    </html>));
  };

  app.get('/reauthenticate', reauthenticate);
  app.post('/reauthenticate', reauthenticate);

  app.get('/v1/auth/security', async (request) => {
    const account = await readVerificationAccount(db, request, config.secretKey);
    if (!account) return securityError('NL');
    if (account.factorId === null) return securityError('NF');
    return { status: 'DONE', body: { isEnabled: true, hasRecoveryKey: Boolean(account.recoveryKey) } };
  });

  app.delete('/v1/sign', async (request, reply) => {
    const account = await readVerificationAccount(db, request, config.secretKey);
    if (!account || !hasVerification(account)) return account ? verificationRequired : securityError('NL');
    if (!validCsrf(request, siteUrl)) return reply.code(403).send(securityError('RJ'));
    const deleted = await deleteAccount(db, account, config.mediaRoot);
    if (deleted.error === 'RE') return verificationRequired;
    if (deleted.error === 'RJ') return securityError('RJ', '마지막 관리자 계정은 삭제할 수 없습니다.');
    reply.clearCookie(sessionCookie, authCookieOptions(siteUrl));
    return success;
  });

  const factorRoutes = [
    { url: '/v1/auth/security', method: 'POST', action: 'setup' },
    { url: '/v1/auth/security/verify', method: 'POST', action: 'activate' },
    { url: '/v1/auth/security', method: 'DELETE', action: 'disable' },
  ] as const;
  for (const { url, method, action } of factorRoutes) {
    app.route({ method, url, async handler(request, reply) {
      const account = await readVerificationAccount(db, request, config.secretKey);
      if (!account || !hasVerification(account)) return account ? verificationRequired : securityError('NL');
      if (!validCsrf(request, siteUrl)) return reply.code(403).send(securityError('RJ'));
      let error: string | null;
      if (action === 'setup') {
        const setup = await beginFactorSetup(db, account, config.cipherKey);
        if (!setup.error) return { status: 'DONE', body: { qrCode: setup.image, recoveryKey: setup.recovery } };
        error = setup.error;
      } else {
        error = action === 'activate' ? await activateFactor(db, account, config.cipherKey, formInput(request).code) :
          await disableFactor(db, account);
        if (!error && action === 'activate') return { status: 'DONE', body: { message: '2차 인증이 활성화되었습니다.' } };
      }
      return factorError(error, action);
    } });
  }
}
