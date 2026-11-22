import formBody from '@fastify/formbody';
import type { PrismaClient } from '@prisma/client';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { SiteIcon } from '../../../appearance/shell.js';
import { authCookieOptions, csrfCookie, requestCookies } from '../../auth/cookies.js';
import { csrfPattern, formInput } from '../../auth/csrf.js';
import { createToken } from '../../auth/session.js';
import { adminSettingsCapabilities, readAdminAccess, type UserAccess } from '../../site-admin/access.js';
import { djangoJsonUtc } from '../../../compat/django-format.js';
import type { AdminCapabilities } from '../../site-admin/pages.js';
import { renderSettingsShell } from '../../../application/settings-shell.js';
import { parseWebhookUrl, sendWebhook, type SendWebhook } from './transport.js';
import { done, failure } from '../../../platform/response.js';

interface ChannelOptions {
  currentUser: (request: FastifyRequest) => Promise<{
    id: number; username: string; hasEditorRole: boolean; isStaff: boolean; notifyCount?: number;
  } | null>;
  validateCsrf: (request: FastifyRequest) => boolean;
  siteUrl: URL;
  send?: SendWebhook;
}

interface Channel { id: number; name: string; webhookUrl: string; isActive: number | bigint; failureCount: number | bigint; createdDate: string }
type Scope = 'user' | 'global';

async function channels(db: PrismaClient, scope: Scope, owner: number | null) {
  return db.$queryRaw<Channel[]>`
    SELECT id, name, webhook_url AS webhookUrl, CAST(is_active AS INTEGER) AS isActive,
      CAST(failure_count AS INTEGER) AS failureCount, CAST(created_date AS TEXT) AS createdDate
    FROM board_webhooksubscription WHERE scope = ${scope} AND author_id IS ${owner} ORDER BY created_date DESC, id DESC
  `;
}

async function saveChannel(db: PrismaClient, scope: Scope, owner: number | null, url: string, name: string) {
  return db.$transaction(async (tx) => {
    const [existing] = await tx.$queryRaw<Array<{ id: number }>>`
      UPDATE board_webhooksubscription SET name = COALESCE(NULLIF(${name}, ''), name), is_active = 1, failure_count = 0
       WHERE id = (SELECT id FROM board_webhooksubscription WHERE scope = ${scope} AND author_id IS ${owner}
         AND webhook_url = ${url} ORDER BY id LIMIT 1)
      RETURNING id
    `;
    if (existing) return existing.id;
    const now = new Date().toISOString().slice(0, -1).replace('T', ' ');
    const [created] = await tx.$queryRaw<Array<{ id: number }>>`
      INSERT INTO board_webhooksubscription (name, webhook_url, author_id, scope, is_active, failure_count, created_date)
      VALUES (${name}, ${url}, ${owner}, ${scope}, 1, 0, ${now}) RETURNING id
    `;
    return created.id;
  });
}

function renderChannels(
  path: string,
  rows: Channel[],
  csrf: string,
  scope: Scope,
  user: NonNullable<Awaited<ReturnType<ChannelOptions['currentUser']>>>,
  message = '',
  capabilities?: AdminCapabilities,
) {
  const global = scope === 'global';
  const title = global ? '전체 발행 채널' : '발행 채널';
  const description = global
    ? '모든 작성자가 발행한 포스트를 Discord, Slack 또는 일반 웹훅 URL로 전송합니다.'
    : '내가 발행한 새 포스트를 Discord, Slack 또는 일반 웹훅 URL로 전송합니다.';
  const content = <>
    <p className="mb-6 text-sm leading-relaxed text-content-secondary">{description}</p>
    {message && <p className="status" role="status">{message}</p>}
    <section className="panel" aria-labelledby="webhook-list-heading">
      <h2 id="webhook-list-heading">등록한 웹훅</h2>
      {rows.length ? <ul className="webhook-channel-list">
        {rows.map((channel) => <li className="webhook-channel-card" key={channel.id}>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <strong className="text-sm font-semibold text-content">{channel.name || parseWebhookUrl(channel.webhookUrl)?.hostname || '이름 없는 전송 대상'}</strong>
              <span className={`webhook-channel-status ${channel.isActive ? 'active' : 'inactive'}`}>{channel.isActive ? '활성' : '비활성'}</span>
            </div>
            <p className="mb-0 mt-2 text-xs text-content-secondary">실패 {Number(channel.failureCount)}회</p>
          </div>
          <form method="post" action={path}>
            <input type="hidden" name="csrfmiddlewaretoken" value={csrf} />
            <input type="hidden" name="channel_id" value={channel.id} />
            <button className="secondary-button" type="submit" name="action" value="delete">삭제</button>
          </form>
        </li>)}
      </ul> : <div className="webhook-empty-state" role="status">
        <span className="settings-card-mark"><SiteIcon name="settings" className="h-5 w-5" /></span>
        <p>등록된 웹훅이 없습니다.</p>
      </div>}
    </section>
    <section className="panel" aria-labelledby="webhook-create-heading">
      <h2 id="webhook-create-heading">새 웹훅 추가</h2>
      <form method="post" action={path}>
        <input type="hidden" name="csrfmiddlewaretoken" value={csrf} />
        <div className="field"><label htmlFor={`webhook-name-${scope}`}>표시 이름 (선택)</label>
          <input id={`webhook-name-${scope}`} name="name" maxLength={100} placeholder="예: 새 포스트 알림" />
        </div>
        <div className="field"><label htmlFor={`webhook-url-${scope}`}>웹훅 URL</label>
          <input id={`webhook-url-${scope}`} name="webhook_url" type="url" maxLength={500} autoComplete="off" required />
          <span className="muted">Discord, Slack 또는 일반 웹훅 URL을 입력해 주세요.</span>
        </div>
        <div className="actions">
          <button className="secondary-button" type="submit" name="action" value="test">테스트</button>
          <button type="submit" name="action" value="add">추가</button>
        </div>
      </form>
    </section>
  </>;
  return renderSettingsShell({
    mode: global ? 'admin' : 'personal', title, currentPath: path,
    user: { username: user.username, hasEditorRole: user.hasEditorRole, isStaff: user.isStaff, unreadCount: user.notifyCount },
    csrfToken: csrf, content, capabilities: global ? capabilities : undefined,
  });
}

export function registerWebhooks(app: FastifyInstance, db: PrismaClient, options: ChannelOptions) {
  const send = options.send ?? sendWebhook;
  let testRequests = 0;
  async function test(url: URL) {
    if (testRequests >= 2) return false;
    testRequests += 1;
    try {
      return await send(url, 'BLEX 웹훅 연결 테스트입니다.', options.siteUrl.origin);
    } finally {
      testRequests -= 1;
    }
  }

  app.register(async (routes) => {
    await routes.register(formBody);
    routes.addHook('onRequest', async (_request, reply) => { reply.header('Cache-Control', 'private, no-store'); });
    for (const scope of ['user', 'global'] as const) {
      const global = scope === 'global';
      const apiPath = `/v1/webhook/${global ? 'global-' : ''}channels`;
      const pagePath = global ? '/admin-settings/global-webhook' : '/settings/webhook';
      type Params = { Params: { id?: string } };
      const handler = async (request: FastifyRequest<Params>, reply: FastifyReply) => {
        const html = !request.url.startsWith('/v1/');
        const user = await options.currentUser(request);
        if (!user) return html ? reply.redirect(`/login?${new URLSearchParams({ next: pagePath })}`, 302) : failure('NL');
        if (!(global ? user.isStaff : user.hasEditorRole)) return html ? reply.code(404).send('페이지를 찾을 수 없습니다.') : failure('RJ', global ? 'Administrator access is required.' : 'Author access is required.');
        const profile = global ? null : await db.board_profile.findUnique({ where: { user_id: user.id }, select: { id: true } });
        if (!global && !profile) return html ? reply.code(404).send('페이지를 찾을 수 없습니다.') : failure('NF');
        const owner = profile?.id ?? null;
        const page = async (message?: string) => {
          const stored = requestCookies(request)[csrfCookie] ?? '';
          const csrf = csrfPattern.test(stored) ? stored : createToken();
          if (csrf !== stored) reply.setCookie(csrfCookie, csrf, authCookieOptions(options.siteUrl));
          let capabilities: AdminCapabilities | undefined;
          if (global) {
            const access: UserAccess | null = await readAdminAccess(db, user.id);
            if (!access?.active || !access.staff) return reply.code(404).type('text/plain; charset=utf-8').send('페이지를 찾을 수 없습니다.');
            capabilities = adminSettingsCapabilities(access);
          }
          return reply.type('text/html; charset=utf-8').send(renderChannels(
            pagePath, await channels(db, scope, owner), csrf, scope, user, message, capabilities,
          ));
        };
        if (request.method === 'GET') {
          if (html) return page();
          return done({ channels: (await channels(db, scope, owner)).map((channel) => ({ ...channel,
            isActive: Boolean(channel.isActive), failureCount: Number(channel.failureCount), createdDate: djangoJsonUtc(channel.createdDate) })) });
        }
        if (!options.validateCsrf(request)) return html
          ? reply.code(403).send('요청이 거부되었습니다.')
          : reply.code(403).send(failure('RJ'));
        const body = formInput(request);
        if (request.method === 'DELETE' || body.action === 'delete') {
          const raw = request.params?.id ?? body.channel_id;
          const id = typeof raw === 'string' && /^\d+$/.test(raw) ? Number(raw) : 0;
          if (!Number.isSafeInteger(id) || id < 1) return failure('NF');
          const removed = await db.$executeRaw`DELETE FROM board_webhooksubscription WHERE id = ${id} AND scope = ${scope} AND author_id IS ${owner}`;
          if (!removed) return html ? reply.code(404).send('웹훅을 찾을 수 없습니다.') : failure('NF');
          return html ? reply.redirect(pagePath, 303) : done({ success: true });
        }
        const url = typeof body.webhook_url === 'string' ? body.webhook_url.trim() : '';
        const parsed = parseWebhookUrl(url);
        if (!parsed) return html ? page('올바른 URL을 입력해 주세요.') : failure(url ? 'VA' : 'RE', 'Webhook URL을 확인해 주세요.');
        if (html && body.action === 'test') return page(await test(parsed)
          ? '테스트 메시지가 전송되었습니다.'
          : '웹훅 테스트에 실패했습니다. URL을 확인한 뒤 다시 시도해 주세요.');
        const name = typeof body.name === 'string' ? body.name.trim().slice(0, 100) : '';
        const channelId = await saveChannel(db, scope, owner, url, name);
        return html ? reply.redirect(pagePath, 303) : done({ success: true, channelId });
      };
      routes.route<Params>({ method: ['GET', 'POST'], url: apiPath, handler });
      routes.route<Params>({ method: ['GET', 'POST'], url: pagePath, handler });
      routes.route<Params>({ method: 'DELETE', url: `${apiPath}/:id`, handler });
    }
    routes.post('/v1/webhook/test', async (request, reply) => {
      const user = await options.currentUser(request);
      if (!user) return failure('NL');
      if (!user.hasEditorRole && !user.isStaff) return failure('RJ');
      if (!options.validateCsrf(request)) return reply.code(403).send(failure('RJ'));
      const url = parseWebhookUrl(formInput(request).webhook_url);
      if (!url) return failure('VA', 'Webhook URL을 확인해 주세요.');
      return done({ success: await test(url) });
    });
  });
}
