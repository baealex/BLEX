import type { PrismaClient } from '@prisma/client';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { ReactNode } from 'react';
import { prepareUsernameChange } from './account-identity.js';
import { accountUsernamePattern, describeInvalidPassword } from './account-validation.js';
import { authCookieOptions, csrfCookie, sessionCookie, setSessionCookies } from './cookies.js';
import { csrfPattern, formInput, validCsrf } from './csrf.js';
import { deleteAccount } from './delete-account.js';
import { hashDjangoPassword, verifyDjangoPassword } from './django-password.js';
import { activateFactor, beginFactorSetup, disableFactor } from './factor-management.js';
import type { AuthConfig } from './http.js';
import { reserveLoginAttempt } from './login-attempts.js';
import { publicOAuthProviders, safeReturnPath } from './oauth.js';
import { credentialTag, createToken, tokenHash } from './session.js';
import { verifyDjangoSecondFactor } from './two-factor.js';
import { acquireVerification, hasVerification, readVerificationAccount, recordVerification } from './verification.js';
import { renderSettingsShell } from '../settings-shell.js';
import { renderApplicationDocument } from '../application/document.js';
import { SiteFooter, SiteHeader, SiteTheme } from '../appearance/shell.js';
import { readPublicSiteBrand } from '../public-pages/index.js';

const securityPath = '/settings/security';
const success = { status: 'DONE', body: {} };

export function securityError(code: string, errorMessage = '') {
  return { status: 'ERROR', errorCode: `error:${code}`, errorMessage };
}

export const verificationRequired = {
  ...securityError('RE', '계속하려면 본인 확인이 필요합니다.'),
  messageKey: 'auth.reauthentication_required',
  messageParams: {},
};

export function reauthenticationPath(next: string) {
  return `/reauthenticate?${new URLSearchParams({ next })}`;
}

function deletionRedirect(value: string, siteUrl: URL) {
  if (value.startsWith('/')) return safeReturnPath(value, siteUrl);
  const target = URL.parse(value);
  return target && ['https:', 'http:'].includes(target.protocol) && !target.username && !target.password ? target.href : '/';
}

function factorError(code: string | null) {
  if (!code) return success;
  if (code === 'RE') return verificationRequired;
  const messages: Record<string, string> = {
    AU: '2단계 인증을 이미 해제했습니다.', AC: '2단계 인증을 이미 연결했습니다.', EP: '설정 시간이 만료되었습니다. 다시 시도해 주세요.',
    IP: '인증 앱의 6자리 코드를 입력해 주세요.', RJ: '인증 코드 또는 2단계 인증 설정 시간을 확인해 주세요.',
  };
  return securityError(code, messages[code]);
}

async function readSecurityViewer(db: PrismaClient, accountId: number) {
  const [viewer] = await db.$queryRaw<Array<{ role: string | null; isStaff: number | bigint | boolean; unreadCount: number | bigint }>>`
    SELECT profile.role AS role, account.is_staff AS isStaff,
           (SELECT COUNT(*) FROM board_notify WHERE user_id = account.id AND has_read = 0) AS unreadCount
      FROM auth_user AS account
      LEFT JOIN board_profile AS profile ON profile.user_id = account.id
     WHERE account.id = ${accountId}
     LIMIT 1
  `;
  return viewer;
}

async function securityMarkup(db: PrismaClient, account: { id: number; username: string }, title: string, body: ReactNode, csrfToken: string) {
  const viewer = await readSecurityViewer(db, account.id);
  return renderSettingsShell({
    mode: 'personal', title, currentPath: securityPath,
    user: {
      username: account.username,
      hasEditorRole: viewer?.role === 'EDITOR',
      isStaff: Boolean(viewer?.isStaff),
      unreadCount: Number(viewer?.unreadCount ?? 0),
    },
    csrfToken,
    content: body,
  });
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
    const timestamp = new Date().toISOString().slice(0, -1).replace('T', ' ');

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
      if (revokeTokens === true || revokeTokens === 'true') await tx.$executeRaw`
        UPDATE board_developertoken SET revoked_at = ${timestamp}, updated_date = ${timestamp}
         WHERE user_id = ${account.id} AND revoked_at IS NULL
      `;
      return success;
    });
    if (result.status === 'DONE') setSessionCookies(reply, siteUrl, sessionToken);
    return result;
  };
}

export function registerAccountSecurity(app: FastifyInstance, db: PrismaClient, siteUrl: URL, config: AuthConfig) {
  const updatePassword = passwordUpdater(db, siteUrl, config);

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

  app.get(securityPath, async (request, reply) => {
    const account = await readVerificationAccount(db, request, config.secretKey);
    if (!account) return reply.redirect(`/login?${new URLSearchParams({ next: securityPath })}`, 302);
    const csrf = csrfForPage(request, reply, siteUrl);
    const query = request.query as { updated?: string; factor?: string };
    return reply.type('text/html; charset=utf-8').send(await securityMarkup(db, account, '계정 보안', <>
      {query.updated === '1' && <p className="status success" role="status">비밀번호를 변경했습니다.</p>}
      <section className="panel" aria-labelledby="security-password-heading">
        <h2 id="security-password-heading">비밀번호</h2>
        {hasVerification(account) ? <form action={`${securityPath}/password`} method="post">
          <input type="hidden" name="csrfmiddlewaretoken" value={csrf} />
          <div className="field"><label htmlFor="security-new-password">새 비밀번호</label><input id="security-new-password" type="password" name="password" autoComplete="new-password" required minLength={8} /></div>
          <div className="field"><label htmlFor="security-password-confirmation">새 비밀번호 확인</label><input id="security-password-confirmation" type="password" name="password_confirmation" autoComplete="new-password" required minLength={8} /></div>
          <label><input type="checkbox" value="true" name="revoke_tokens" /> 개발자 API 토큰도 폐기</label>
          <div className="actions"><button type="submit">비밀번호 변경</button></div>
        </form> : <a href={reauthenticationPath(securityPath)}>본인 확인 후 비밀번호 변경</a>}
      </section>
      <section className="panel" aria-labelledby="security-factor-heading">
        <h2 id="security-factor-heading">2단계 인증</h2>
        <p>{account.factorId === null ? '사용 안 함' : '사용 중'}</p>
        {query.factor === '1' && <p className="status success" role="status">2단계 인증을 설정했습니다.</p>}
        {query.factor === '0' && <p className="status success" role="status">2단계 인증을 해제했습니다.</p>}
        {hasVerification(account) ? <form action={`${securityPath}/factor/${account.factorId === null ? 'setup' : 'disable'}`} method="post">
          <input type="hidden" name="csrfmiddlewaretoken" value={csrf} />
          <button type="submit">{account.factorId === null ? '2단계 인증 설정' : '2단계 인증 해제'}</button>
        </form> : <a href={reauthenticationPath(securityPath)}>본인 확인 후 2단계 인증 관리</a>}
      </section>
      <section className="rounded-2xl border border-danger-line bg-danger-surface/40 p-6 md:p-8" aria-labelledby="security-delete-heading">
        <h2 id="security-delete-heading" className="text-base font-semibold text-danger">계정 삭제</h2>
        <p className="text-sm text-content-secondary">계정과 작성한 글은 삭제 후 복구할 수 없습니다.</p>
        {hasVerification(account) ? <form action={`${securityPath}/delete`} method="post">
          <input type="hidden" name="csrfmiddlewaretoken" value={csrf} />
          <div className="field"><label htmlFor="security-delete-username">계정을 삭제하려면 사용자 이름을 입력하세요.</label><input id="security-delete-username" name="username" autoComplete="off" required /></div>
          <button type="submit">계정 삭제</button>
        </form> : <a href={reauthenticationPath(securityPath)}>본인 확인 후 계정 삭제</a>}
      </section>
    </>, csrf));
  });

  app.post(`${securityPath}/password`, async (request, reply) => {
    if (!validCsrf(request, siteUrl)) return reply.code(403).send('요청을 확인해 주세요.');
    const account = await readVerificationAccount(db, request, config.secretKey);
    if (!account || !hasVerification(account)) return reply.redirect(reauthenticationPath(securityPath), 302);
    const input = formInput(request);
    const result = input.password === input.password_confirmation ? await updatePassword(request, reply, account, input) :
      securityError('VA', '새 비밀번호가 일치하지 않습니다.');
    if (result.status === 'DONE') return reply.redirect(`${securityPath}?updated=1`, 302);
    if ('errorCode' in result && result.errorCode === 'error:RE') return reply.redirect(reauthenticationPath(securityPath), 302);
    return reply.type('text/html; charset=utf-8').send(await securityMarkup(db, account, '비밀번호 변경', <section className="panel">
      <p className="status error" role="alert">{'errorMessage' in result && result.errorMessage}</p><a href={securityPath}>다시 시도</a>
    </section>, csrfForPage(request, reply, siteUrl)));
  });

  app.get('/v1/auth/security', async (request) => {
    const account = await readVerificationAccount(db, request, config.secretKey);
    if (!account) return securityError('NL');
    if (account.factorId === null) return securityError('NF');
    return { status: 'DONE', body: { isEnabled: true, hasRecoveryKey: Boolean(account.recoveryKey) } };
  });

  for (const { method, url } of [{ method: 'DELETE', url: '/v1/sign' }, { method: 'POST', url: `${securityPath}/delete` }] as const) {
    app.route({ method, url, async handler(request, reply) {
      const html = method === 'POST';
      const account = await readVerificationAccount(db, request, config.secretKey);
      if (!account || !hasVerification(account)) {
        return html ? reply.redirect(reauthenticationPath(securityPath), 302) : account ? verificationRequired : securityError('NL');
      }
      if (!validCsrf(request, siteUrl)) return reply.code(403).send(securityError('RJ'));
      if (html && formInput(request).username !== account.username) return reply.type('text/html; charset=utf-8')
        .send(await securityMarkup(db, account, '계정 삭제', <section className="panel"><p className="status error" role="alert">사용자 이름을 확인해 주세요.</p><a href={securityPath}>계정 보안</a></section>, csrfForPage(request, reply, siteUrl)));
      const deleted = await deleteAccount(db, account, config.mediaRoot);
      if (deleted.error === 'RE') return html ? reply.redirect(reauthenticationPath(securityPath), 302) : verificationRequired;
      if (deleted.error === 'RJ') return html ? reply.type('text/html; charset=utf-8')
        .send(await securityMarkup(db, account, '계정 삭제', <section className="panel"><p className="status error" role="alert">마지막 관리자 계정은 삭제할 수 없습니다.</p><a href={securityPath}>계정 보안으로 돌아가기</a></section>, csrfForPage(request, reply, siteUrl))) :
        securityError('RJ', '마지막 관리자 계정은 삭제할 수 없습니다.');
      reply.clearCookie(sessionCookie, authCookieOptions(siteUrl));
      return html ? reply.redirect(deletionRedirect(deleted.url, siteUrl), 302) : success;
    } });
  }

  const factorRoutes = [
    { api: '/v1/auth/security', method: 'POST', page: `${securityPath}/factor/setup`, action: 'setup' },
    { api: '/v1/auth/security/verify', method: 'POST', page: `${securityPath}/factor/activate`, action: 'activate' },
    { api: '/v1/auth/security', method: 'DELETE', page: `${securityPath}/factor/disable`, action: 'disable' },
  ] as const;
  for (const { api, method, page, action } of factorRoutes) {
    const changeFactor = async (request: FastifyRequest, reply: FastifyReply) => {
      const account = await readVerificationAccount(db, request, config.secretKey);
      const html = request.url === page;
      if (!account || !hasVerification(account)) {
        return html ? reply.redirect(reauthenticationPath(securityPath), 302) : account ? verificationRequired : securityError('NL');
      }
      if (!validCsrf(request, siteUrl)) return reply.code(403).send(securityError('RJ'));
      let error: string | null;
      if (action === 'setup') {
        const setup = await beginFactorSetup(db, account, config.cipherKey);
        if (setup.error) error = setup.error;
        else if (!html) return { status: 'DONE', body: { qrCode: setup.image, recoveryKey: setup.recovery } };
        else return reply.type('text/html; charset=utf-8').send(await securityMarkup(db, account, '2단계 인증 설정', <section className="panel">
          <p>인증 앱으로 아래 QR 코드를 스캔한 뒤 6자리 코드를 입력해 주세요.</p>
          <img src={setup.image} alt="인증 앱 설정 QR 코드" width="210" height="210" />
          <p>복구 코드 <code>{setup.recovery}</code></p>
          <p>인증 앱을 잃어버렸을 때 사용할 수 있도록 복구 코드를 안전한 곳에 보관해 주세요.</p>
          <form action={`${securityPath}/factor/activate`} method="post">
            <input type="hidden" name="csrfmiddlewaretoken" value={request.cookies[csrfCookie]} />
            <label>인증 코드<input name="code" autoComplete="one-time-code" inputMode="numeric" required pattern="[0-9]{6}" /></label>
            <button type="submit">인증 확인</button>
          </form>
        </section>, csrfForPage(request, reply, siteUrl)));
      } else {
        error = action === 'activate' ? await activateFactor(db, account, config.cipherKey, formInput(request).code) :
          await disableFactor(db, account);
        if (!error && html) return reply.redirect(`${securityPath}?factor=${action === 'activate' ? 1 : 0}`, 302);
        if (!error && action === 'activate') return { status: 'DONE', body: { message: '2단계 인증을 설정했습니다.' } };
      }
      const result = factorError(error);
      if (!html) return result;
      if (error === 'RE') return reply.redirect(reauthenticationPath(securityPath), 302);
      return reply.type('text/html; charset=utf-8').send(await securityMarkup(db, account, '2단계 인증', <section className="panel">
        <p className="status error" role="alert">{'errorMessage' in result && result.errorMessage}</p><a href={securityPath}>다시 시도</a>
      </section>, csrfForPage(request, reply, siteUrl)));
    };
    app.route({ method, url: api, handler: changeFactor });
    app.post(page, changeFactor);
  }
}
