import formBody from '@fastify/formbody';
import type { PrismaClient } from '@prisma/client';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { authCookieOptions, csrfCookie, requestCookies } from '../auth/cookies.js';
import { csrfPattern, formInput } from '../auth/csrf.js';
import { createToken } from '../auth/session.js';
import { SiteIcon } from '../../appearance/shell.js';
import { renderSettingsShell } from '../../application/settings-shell.js';
import { notificationParams, notificationPreferences, notificationText, type NotificationPreference } from './model.js';

interface NotificationUser {
  id: number;
  username: string;
  hasEditorRole: boolean;
  isStaff?: boolean;
  hasConnectedTelegram: boolean;
  notifyCount?: number;
}
interface NotificationOptions {
  currentUser: (request: FastifyRequest) => Promise<NotificationUser | null>;
  validateCsrf: (request: FastifyRequest) => boolean;
  siteUrl: URL;
}

const pagePath = '/settings/notify';
const pageSize = 50;
const labels: Record<NotificationPreference, string> = {
  NOTIFY_POSTS_LIKE: '내 글에 좋아요', NOTIFY_POSTS_COMMENT: '내 글에 댓글 또는 답글',
  NOTIFY_COMMENT_LIKE: '내 댓글에 좋아요', NOTIFY_MENTION: '댓글에서 나를 멘션',
};

function done(body: object = {}) { return { status: 'DONE', body }; }
function failure(code: string, errorMessage = '') { return { status: 'ERROR', errorCode: `error:${code}`, errorMessage }; }

function relativeTime(stored: string, language: string) {
  const date = new Date(stored.replace(' ', 'T') + 'Z');
  if (!Number.isFinite(date.getTime())) return '';
  const seconds = Math.max(0, (Date.now() - date.getTime()) / 1_000);
  if (seconds >= 31_536_000) return new Intl.DateTimeFormat(language, {
    dateStyle: 'long', timeZone: process.env.TZ || 'Asia/Seoul',
  }).format(date);
  const format = new Intl.RelativeTimeFormat(language, { numeric: 'always' });
  if (seconds >= 2_592_000) return format.format(-Math.floor(seconds / 2_592_000), 'month');
  if (seconds >= 604_800) return format.format(-Math.floor(seconds / 604_800), 'week');
  if (seconds >= 86_400) return format.format(-Math.floor(seconds / 86_400), 'day');
  if (seconds >= 3_600) return format.format(-Math.floor(seconds / 3_600), 'hour');
  return format.format(-Math.floor(seconds / 60), 'minute');
}

async function notificationList(db: PrismaClient, userId: number, limit = -1, offset = 0) {
  const since = new Date(Date.now() - 180 * 86_400_000).toISOString().slice(0, -1).replace('T', ' ');
  const [config] = await db.$queryRaw<Array<{ language: string | null }>>`SELECT language FROM board_config WHERE user_id = ${userId}`;
  const language = config?.language === 'en' && process.env.ENABLE_ENGLISH_UI === 'TRUE' ? 'en' : 'ko';
  const rows = await db.$queryRaw<Array<{
    id: number; url: string; content: string; key: string; params: string; has_read: number | bigint; date: string;
  }>>`
    SELECT id, url, content, message_key AS key, message_params AS params, has_read, CAST(created_date AS TEXT) AS date
      FROM board_notify WHERE user_id = ${userId} AND (created_date > ${since} OR has_read = 0)
     ORDER BY created_date DESC, id DESC LIMIT ${limit} OFFSET ${offset}
  `;
  return rows.map((row) => ({
    id: row.id, url: row.url, isRead: Boolean(row.has_read),
    content: notificationText(row.key, notificationParams(row.params), row.content, language), createdDate: relativeTime(row.date, language),
  }));
}

function visiblePreferences(user: NotificationUser) {
  return user.hasEditorRole ? notificationPreferences : notificationPreferences.slice(2);
}

async function readPreferences(db: PrismaClient, user: NotificationUser) {
  const existing = await db.$queryRaw<Array<{ name: string; value: string }>>`
    SELECT name, value FROM board_userconfigmeta WHERE user_id = ${user.id} ORDER BY id
  `;
  return visiblePreferences(user).map((name) => {
    const item = existing.find((preference) => preference.name === name);
    return { name, value: item ? item.value === 'true' : null };
  });
}

async function canUseTelegramIntegration(db: PrismaClient): Promise<boolean> {
  const [row] = await db.$queryRaw<Array<{ enabled: number | bigint }>>`
    SELECT CASE WHEN telegram_enabled = 1 AND TRIM(telegram_bot_username) <> '' AND TRIM(telegram_bot_token) <> ''
                THEN 1 ELSE 0 END AS enabled
      FROM board_integrationsetting WHERE id = 1 LIMIT 1
  `;
  return Boolean(row && Number(row.enabled));
}

async function savePreferences(db: PrismaClient, user: NotificationUser, input: Record<string, unknown>, page = false) {
  const timestamp = new Date().toISOString().slice(0, -1).replace('T', ' ');
  await db.$transaction(async (tx) => {
    for (const name of visiblePreferences(user)) {
      const value = input[name];
      if (!page && (value === null || value === undefined || value === '')) continue;
      const normalized = value === true || value === 'true' ? 'true' : 'false';
      const updated = await tx.$executeRaw`
        UPDATE board_userconfigmeta SET value = ${normalized} WHERE user_id = ${user.id} AND name = ${name}
      `;
      if (!updated) await tx.$executeRaw`
        INSERT INTO board_userconfigmeta (user_id, name, value, created_date, updated_date)
        VALUES (${user.id}, ${name}, ${normalized}, ${timestamp}, ${timestamp})
      `;
    }
  });
}

function markRead(db: PrismaClient, userId: number, input: unknown) {
  const id = typeof input === 'string' && /^\d+$/.test(input) ? Number(input) : input;
  if (typeof id !== 'number' || !Number.isSafeInteger(id) || id < 1) return Promise.resolve(0);
  return db.$executeRaw`UPDATE board_notify SET has_read = 1 WHERE id = ${id} AND user_id = ${userId}`;
}

function notificationUrl(value: string, base: URL) {
  if (!/^(\/[^/]|\/$|https?:\/\/)/i.test(value) || value.includes('\\')) return '';
  const url = URL.parse(value, base);
  return url && !url.username && !url.password && ['http:', 'https:'].includes(url.protocol) ? url.href : '';
}

function pageNumber(request: FastifyRequest) {
  const { page } = request.query as { page?: string };
  const number = typeof page === 'string' && /^\d+$/.test(page) ? Number(page) : 1;
  return Math.max(1, Math.min(100_000, number));
}

export function registerNotifications(app: FastifyInstance, db: PrismaClient, options: NotificationOptions) {
  app.register(async (routes) => {
    await routes.register(formBody);
    routes.addHook('onRequest', async (_request, reply) => { reply.header('Cache-Control', 'private, no-store'); });
    routes.get('/v1/setting/notify', async (request) => {
      const user = await options.currentUser(request);
      return user ? done({ notify: await notificationList(db, user.id), isTelegramSync: user.hasConnectedTelegram }) : failure('NL');
    });
    routes.get('/v1/setting/unread-notify', async (request) => {
      const user = await options.currentUser(request);
      if (!user) return failure('NL');
      const [row] = await db.$queryRaw<Array<{ count: bigint | number }>>`
        SELECT COUNT(*) AS count FROM board_notify WHERE user_id = ${user.id} AND has_read = 0
      `;
      return done({ count: Number(row.count) });
    });
    routes.get('/v1/setting/notify-config', async (request) => {
      const user = await options.currentUser(request);
      return user ? done({ config: await readPreferences(db, user) }) : failure('NL');
    });
    routes.put('/v1/setting/notify-config', async (request, reply) => {
      const user = await options.currentUser(request);
      if (!user) return failure('NL');
      if (!options.validateCsrf(request)) return reply.code(403).send(failure('RJ'));
      await savePreferences(db, user, formInput(request));
      return done();
    });
    routes.put('/v1/setting/notify', async (request, reply) => {
      const user = await options.currentUser(request);
      if (!user) return failure('NL');
      if (!options.validateCsrf(request)) return reply.code(403).send(failure('RJ'));
      return (await markRead(db, user.id, formInput(request).id)) ? done() : failure('NF', '알림을 찾을 수 없습니다.');
    });
    routes.get(pagePath, async (request, reply) => {
      const user = await options.currentUser(request);
      if (!user) return reply.redirect(`/login?${new URLSearchParams({ next: pagePath })}`, 302);
      const page = pageNumber(request);
      const items = await notificationList(db, user.id, pageSize + 1, (page - 1) * pageSize);
      const preferences = await readPreferences(db, user);
      const telegramAvailable = await canUseTelegramIntegration(db);
      const previous = requestCookies(request)[csrfCookie] ?? '';
      const csrf = csrfPattern.test(previous) ? previous : createToken();
      if (previous !== csrf) reply.setCookie(csrfCookie, csrf, authCookieOptions(options.siteUrl));
      const content = <>
        {telegramAvailable && <a className="settings-card telegram-prompt" href="/settings/integration">
          <span className="settings-card-mark"><SiteIcon name="settings" className="h-5 w-5" /></span>
          <span><strong>{user.hasConnectedTelegram ? '텔레그램 알림 관리' : '텔레그램 연결'}</strong>
            <span>새 글과 중요한 알림을 텔레그램에서도 받아보세요.</span></span>
          <SiteIcon name="chevron-down" className="h-4 w-4 shrink-0 text-content-hint" />
        </a>}
        {items.length ? <ul className="notification-list" aria-label="받은 알림">
          {items.slice(0, pageSize).map((item) => {
            const href = notificationUrl(item.url, options.siteUrl);
            return <li key={item.id} className={`notification-item${item.isRead ? '' : ' unread'}`}>
              <div className="notification-copy">
                {href ? <a className="notification-link" href={href}>{item.content}</a> : <span>{item.content}</span>}
                <div className="notification-meta"><time>{item.createdDate}</time>
                  {!item.isRead && <span className="notification-new">새 알림</span>}
                </div>
              </div>
              {!item.isRead && <form className="notification-read-form" method="post" action={pagePath}>
                <input type="hidden" name="csrfmiddlewaretoken" value={csrf} />
                <input type="hidden" name="id" value={item.id} />
                <button type="submit">읽음 처리</button>
              </form>}
            </li>;
          })}
        </ul> : <section className="panel flex flex-col items-center gap-3 py-12 text-center" role="status">
          <span className="settings-card-mark"><SiteIcon name="bell" className="h-5 w-5" /></span>
          <p className="m-0 text-sm text-content-secondary">알림이 없습니다.</p>
        </section>}
        {(page > 1 || items.length > pageSize) && <nav className="pagination" aria-label="알림 페이지">
          {page > 1 ? <a href={`${pagePath}?page=${page - 1}`}>← 이전 알림</a> : <span />}
          {items.length > pageSize && <a href={`${pagePath}?page=${page + 1}`}>다음 알림 →</a>}
        </nav>}
      </>;
      const headerAction = <details className="notification-config">
        <summary><SiteIcon name="settings" className="h-4 w-4" /> 알림 설정</summary>
        <div className="notification-config-panel">
          <form method="post" action={pagePath}>
            <input type="hidden" name="csrfmiddlewaretoken" value={csrf} />
            <input type="hidden" name="intent" value="preferences" />
            <h2 className="mb-2 text-sm font-semibold text-content">알림 받을 항목</h2>
            {preferences.map(({ name, value }) => <label className="notification-option" key={name}>
              <span>{labels[name]}</span>
              <input type="checkbox" name={name} value="true" defaultChecked={Boolean(value)} />
            </label>)}
            <div className="actions"><button type="submit">저장</button></div>
          </form>
        </div>
      </details>;
      const html = renderSettingsShell({
        mode: 'personal', title: '알림', currentPath: pagePath,
        user: { username: user.username, hasEditorRole: user.hasEditorRole, isStaff: user.isStaff, unreadCount: user.notifyCount },
        csrfToken: csrf, content, headerAction, canUseTelegramIntegration: telegramAvailable,
      });
      return reply.type('text/html; charset=utf-8').send(html);
    });
    routes.post(pagePath, async (request, reply) => {
      const user = await options.currentUser(request);
      if (!user) return reply.redirect(`/login?${new URLSearchParams({ next: pagePath })}`, 302);
      if (!options.validateCsrf(request)) return reply.code(403).send('요청을 확인해 주세요.');
      const input = formInput(request);
      if (input.intent === 'preferences') await savePreferences(db, user, input, true);
      else if (!await markRead(db, user.id, input.id)) return reply.code(404).send('알림을 찾을 수 없습니다.');
      return reply.redirect(pagePath, 303);
    });
  });
}
