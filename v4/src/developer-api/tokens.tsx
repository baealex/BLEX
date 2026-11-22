import formBody from '@fastify/formbody';
import { Prisma, type PrismaClient } from '@prisma/client';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { createHash, randomBytes } from 'node:crypto';
import { authCookieOptions, csrfCookie, requestCookies } from '../auth/cookies.js';
import { csrfPattern, formInput } from '../auth/csrf.js';
import { reauthenticationPath, securityError, verificationRequired } from '../auth/security.js';
import { createToken } from '../auth/session.js';
import { acquireVerification, hasVerification, readVerificationAccount, type VerificationAccount } from '../auth/verification.js';
import { SiteIcon } from '../appearance/shell.js';
import { renderSettingsShell } from '../settings-shell.js';
import { parseScopes, toIsoDateTime } from './index.js';

interface TokenUser { id: number; username: string; hasEditorRole: boolean; isStaff?: boolean; notifyCount?: number }
interface TokenOptions {
  currentUser: (request: FastifyRequest) => Promise<TokenUser | null>;
  validateCsrf: (request: FastifyRequest) => boolean;
  secretKey: string;
  siteUrl: URL;
}

interface TokenRow {
  id: number;
  name: string;
  tokenPrefix: string;
  scopes: string;
  expiresAt: string | null;
  revokedAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
}

const tokenFields = Prisma.sql`id, name, token_prefix AS tokenPrefix, scopes,
  CAST(expires_at AS TEXT) AS expiresAt, CAST(revoked_at AS TEXT) AS revokedAt,
  CAST(last_used_at AS TEXT) AS lastUsedAt, CAST(created_date AS TEXT) AS createdAt`;
const managePath = '/settings/developer-api';

function done(body: object = {}) { return { status: 'DONE', body }; }

function serialize(token: TokenRow) {
  return { ...token, scopes: parseScopes(token.scopes), expiresAt: toIsoDateTime(token.expiresAt), revokedAt: toIsoDateTime(token.revokedAt),
    lastUsedAt: toIsoDateTime(token.lastUsedAt), createdAt: toIsoDateTime(token.createdAt) };
}

function listTokens(db: PrismaClient, userId: number) {
  return db.$queryRaw<TokenRow[]>`SELECT ${tokenFields} FROM board_developertoken WHERE user_id = ${userId} ORDER BY created_date DESC`;
}

function timestamp(date: Date) { return date.toISOString().slice(0, -1).replace('T', ' '); }

async function issueToken(db: PrismaClient, account: VerificationAccount | null, input: Record<string, unknown>) {
  if (!account || !hasVerification(account)) return verificationRequired;
  const rawScopes = input.scopes ?? ['posts:read'];
  const provided = typeof rawScopes === 'string' ? rawScopes.split(',').map((scope) => scope.trim()).filter(Boolean) : rawScopes;
  if (!Array.isArray(provided) || !provided.length || provided.some((scope) => !['posts:write', 'posts:read'].includes(scope))) {
    return securityError('VA', '지원되는 권한을 선택해 주세요.');
  }
  const scopes = [...new Set(provided)].sort();
  const rawDays = input.expires_in_days ?? input.expiresInDays ?? 90;
  const days = rawDays === '' ? 90 : typeof rawDays === 'number' || /^\d+$/.test(String(rawDays)) ? Number(rawDays) : NaN;
  if (!Number.isInteger(days) || days < 1 || days > 365) return securityError('VA', '유효 기간은 1일부터 365일까지 입력해 주세요.');
  if (input.name !== undefined && typeof input.name !== 'string') return securityError('VA', '토큰 이름을 확인해 주세요.');
  const name = typeof input.name === 'string' && input.name.trim() ? input.name.slice(0, 100) : 'Developer token';
  const prefix = randomBytes(6).toString('hex');
  const token = `blex_pat_${prefix}_${createToken()}`;
  const hash = createHash('sha256').update(token).digest('hex');
  const now = Date.now();
  const created = timestamp(new Date(now));
  const expiry = timestamp(new Date(now + days * 86_400_000));
  return db.$transaction(async (tx) => {
    if (!await acquireVerification(tx, account)) return verificationRequired;
    const [row] = await tx.$queryRaw<TokenRow[]>`
      INSERT INTO board_developertoken (name, token_prefix, token_hash, scopes, expires_at, created_date, updated_date, user_id)
      SELECT ${name}, ${prefix}, ${hash}, ${JSON.stringify(scopes)}, ${expiry}, ${created}, ${created}, id
        FROM auth_user AS account WHERE account.id = ${account.id} AND account.is_active = 1
          AND EXISTS(SELECT 1 FROM board_profile WHERE user_id = account.id AND role = 'EDITOR')
      RETURNING ${tokenFields}
    `;
    return row ? done({ ...serialize(row), token }) : securityError('AT');
  });
}

async function revokeToken(db: PrismaClient, account: TokenUser, tokenId: unknown) {
  const id = typeof tokenId === 'string' && /^\d+$/.test(tokenId) ? Number(tokenId) : tokenId;
  if (typeof id !== 'number' || !Number.isSafeInteger(id) || id < 1) return null;
  const now = timestamp(new Date());
  const [token] = await db.$queryRaw<TokenRow[]>`
    UPDATE board_developertoken SET revoked_at = ${now}, updated_date = ${now}
     WHERE id = ${id} AND user_id = ${account.id}
    RETURNING ${tokenFields}
  `;
  return token ? serialize(token) : null;
}

function tokenPage(tokens: TokenRow[], csrf: string, verified: boolean, user: TokenUser, newToken = '', error = '') {
  const expiryDate = (value: string | null) => toIsoDateTime(value)?.slice(0, 10) ?? '없음';
  const expired = (token: TokenRow) => Boolean(token.expiresAt && Date.parse(`${token.expiresAt.replace(' ', 'T')}Z`) <= Date.now());
  const status = (token: TokenRow) => token.revokedAt ? '폐기됨' : expired(token) ? '만료됨' : '활성';
  const active = tokens.filter((token) => !token.revokedAt && !expired(token));
  const inactive = tokens.filter((token) => token.revokedAt || expired(token));
  const scopeLabel = (scope: string) => scope === 'posts:read' ? '포스트 읽기' : scope === 'posts:write' ? '포스트 작성' : scope;
  const hiddenCsrf = <input type="hidden" name="csrfmiddlewaretoken" value={csrf} />;
  const tokenList = (items: TokenRow[]) => items.length ? <ul className="token-list">
    {items.map((token) => <li className="panel token-item" key={token.id}>
      <div className="flex flex-wrap items-center gap-2">
        <strong className="text-sm font-semibold text-content">{token.name}</strong>
        <span className={`token-status ${status(token) === '활성' ? 'active' : status(token) === '만료됨' ? 'expired' : 'revoked'}`}>{status(token)}</span>
      </div>
      <code className="mt-2 block break-all font-mono text-xs text-content-hint">blex_pat_{token.tokenPrefix}_...</code>
      <div className="mt-3 flex flex-wrap gap-2">{parseScopes(token.scopes).map((scope) =>
        <span className="rounded-md bg-surface-subtle px-2 py-1 text-xs font-medium text-content-secondary" key={scope}>{scopeLabel(scope)}</span>)}</div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-content-secondary">
        <span><strong>발급</strong> {expiryDate(token.createdAt)}</span>
        <span><strong>만료</strong> {expiryDate(token.expiresAt)}</span>
        <span><strong>마지막 사용</strong> {expiryDate(token.lastUsedAt)}</span>
      </div>
      {!token.revokedAt && !expired(token) && <form className="actions" method="post" action={managePath}>
        {hiddenCsrf}<input type="hidden" name="intent" value="revoke" />
        <input type="hidden" name="id" value={token.id} /><button type="submit">토큰 폐기</button>
      </form>}
    </li>)}
  </ul> : null;
  const content = <>
    <p className="mb-6 text-sm leading-relaxed text-content-secondary">외부 도구에서 내 포스트를 읽거나 작성할 수 있는 개인 API 토큰을 발급하고 관리합니다.</p>
    {newToken && <section className="panel token-created" aria-label="생성된 토큰">
      <div className="flex items-center gap-3"><span className="settings-card-mark"><SiteIcon name="settings" className="h-5 w-5" /></span>
        <div><h2 className="mb-1 text-base font-semibold text-content">지금 토큰을 복사하세요</h2>
          <p className="m-0 text-sm text-content-secondary">전체 값은 이 화면에서 한 번만 표시됩니다.</p></div></div>
      <pre className="mt-4" tabIndex={0} aria-label="새 토큰 전체 값">{newToken}</pre>
      <p className="mb-0 mt-3 text-sm text-warning">새로고침하거나 이 화면을 벗어나면 다시 확인할 수 없습니다. 분실하거나 노출했다면 아래에서 즉시 폐기하고 새로 발급하세요.</p>
    </section>}
    {error && <p className="status error" role="alert">{error}</p>}
    <section className="panel" aria-labelledby="token-create-heading">
      <h2 id="token-create-heading">새 토큰 발급</h2>
      <p className="muted">이름, 권한, 만료 기간을 정하고 외부 도구별로 발급합니다.</p>
      {verified ? <form method="post" action={managePath}>
        {hiddenCsrf}<input type="hidden" name="intent" value="create" />
        <div className="field"><label htmlFor="developer-token-name">토큰 이름</label>
          <input id="developer-token-name" name="name" maxLength={100} placeholder="예: 개인 자동화, Raycast, 배포 스크립트" defaultValue="개발자 API 토큰" />
          <span className="muted">나중에 구분할 수 있는 이름으로 적어주세요.</span>
        </div>
        <fieldset className="mt-5 rounded-xl border border-line p-4">
          <legend className="px-1 text-sm font-semibold text-content">권한</legend>
          <p className="muted">이 도구에 필요한 최소 권한만 선택하세요.</p>
          <label className="scope-option"><input type="checkbox" name="read" value="true" defaultChecked />
            <span><strong>포스트 읽기</strong><span>내 포스트 목록과 상세 내용을 조회합니다.</span></span></label>
          <label className="scope-option"><input type="checkbox" name="write" value="true" />
            <span><strong>포스트 작성</strong><span>내 포스트를 만들고 수정하고 발행합니다.</span></span></label>
        </fieldset>
        <div className="field"><label htmlFor="developer-token-expiry">만료 기간(일)</label>
          <input id="developer-token-expiry" type="number" name="expires_in_days" min={1} max={365} defaultValue={90} />
          <span className="muted">1일부터 365일까지 설정할 수 있습니다.</span>
        </div>
        <aside className="token-security-note"><SiteIcon name="settings" className="mt-0.5 h-5 w-5 shrink-0" />
          <p>전체 토큰 값은 발급 직후 한 번만 표시됩니다. 필요한 최소 권한과 사용 기간만 선택하고 안전한 곳에 보관하세요.</p></aside>
        <div className="actions"><button type="submit">토큰 발급</button></div>
      </form> : <a href={reauthenticationPath(managePath)}>본인 확인 후 토큰 발급</a>}
    </section>
    <section className="panel" aria-labelledby="token-list-heading">
      <h2 id="token-list-heading">발급한 토큰</h2>
      {!tokens.length ? <p className="muted">발급한 토큰이 없습니다.</p> : <div className="space-y-6">
        {active.length ? <section><h3>활성 토큰 ({active.length})</h3>{tokenList(active)}</section> : null}
        {inactive.length ? <section><h3>만료·폐기 기록 ({inactive.length})</h3>{tokenList(inactive)}</section> : null}
      </div>}
    </section>
  </>;
  const headerAction = <div className="flex flex-wrap gap-2">
    <a className="settings-secondary-link" href="/docs/developer-api/quickstart"><SiteIcon name="book" className="h-4 w-4" /> 빠른 시작</a>
    <a className="settings-secondary-link" href="/api/developer/v1/docs"><SiteIcon name="book" className="h-4 w-4" /> API 문서</a>
  </div>;
  return renderSettingsShell({
    mode: 'personal', title: '개발자 API', currentPath: managePath,
    user: { username: user.username, hasEditorRole: user.hasEditorRole, isStaff: user.isStaff, unreadCount: user.notifyCount },
    csrfToken: csrf, content, headerAction,
  });
}

export function registerDeveloperTokens(app: FastifyInstance, db: PrismaClient, options: TokenOptions) {
  app.register(async (routes) => {
    await routes.register(formBody);
    routes.addHook('onRequest', async (_request, reply) => { reply.header('Cache-Control', 'private, no-store'); });
    routes.get('/v1/developer-tokens', async (request) => {
      const user = await options.currentUser(request);
      if (!user) return securityError('NL');
      if (!user.hasEditorRole) return { status: 'ERROR', errorCode: 'error:RJ', errorMessage: 'Author access is required.' };
      return done({ tokens: (await listTokens(db, user.id)).map(serialize) });
    });
    routes.post('/v1/developer-tokens', async (request, reply) => {
      const user = await options.currentUser(request);
      if (!user?.hasEditorRole) return securityError(user ? 'AT' : 'NL');
      if (!options.validateCsrf(request)) return reply.code(403).send(securityError('RJ'));
      return issueToken(db, await readVerificationAccount(db, request, options.secretKey), formInput(request));
    });
    routes.delete<{ Params: { id: string } }>('/v1/developer-tokens/:id', async (request, reply) => {
      const user = await options.currentUser(request);
      if (!user?.hasEditorRole) return securityError(user ? 'AT' : 'NL');
      if (!options.validateCsrf(request)) return reply.code(403).send(securityError('RJ'));
      const token = await revokeToken(db, user, request.params.id);
      return token ? done(token) : reply.code(404).send('Not found');
    });
    routes.route({ method: ['GET', 'POST'], url: managePath, async handler(request, reply) {
      const user = await options.currentUser(request);
      if (!user) return reply.redirect(`/login?${new URLSearchParams({ next: managePath })}`, 302);
      if (!user.hasEditorRole) return reply.code(404).send('페이지를 찾을 수 없습니다.');
      const previous = requestCookies(request)[csrfCookie] ?? '';
      const csrf = csrfPattern.test(previous) ? previous : createToken();
      if (csrf !== previous) reply.setCookie(csrfCookie, csrf, authCookieOptions(options.siteUrl));
      const account = await readVerificationAccount(db, request, options.secretKey);
      const verified = Boolean(account && hasVerification(account));
      let newToken = '';
      let error = '';
      if (request.method === 'POST') {
        if (!options.validateCsrf(request)) return reply.code(403).send('요청이 거부되었습니다.');
        const input = formInput(request);
        if (input.intent === 'revoke') {
          if (!await revokeToken(db, user, input.id)) return reply.code(404).send('토큰을 찾을 수 없습니다.');
          return reply.redirect(managePath, 303);
        }
        if (!verified) return reply.redirect(reauthenticationPath(managePath), 302);
        const scopes = [input.read ? 'posts:read' : '', input.write ? 'posts:write' : ''].filter(Boolean);
        const result = await issueToken(db, account, { ...input, scopes });
        if ('errorMessage' in result) error = result.errorMessage;
        if ('body' in result && 'token' in result.body) newToken = String(result.body.token);
      }
      const tokens = await listTokens(db, user.id);
      return reply.type('text/html; charset=utf-8').send(tokenPage(tokens, csrf, verified, user, newToken, error));
    } });
  });
}
