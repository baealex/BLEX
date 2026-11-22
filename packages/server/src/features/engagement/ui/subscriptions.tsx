import type { PrismaClient } from '@prisma/client';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { SiteIcon } from '../../../appearance/shell.js';
import { authCookieOptions, csrfCookie, requestCookies } from '../../../platform/cookies.js';
import { csrfPattern } from '../../../platform/csrf.js';
import { createToken } from '../../auth/session.js';
import { mySubscriptions } from '../index.js';
import { renderSettingsShell } from '../../../application/settings-shell.js';

interface Options {
  currentUser: (request: FastifyRequest) => Promise<{
    id: number; username: string; hasEditorRole?: boolean; isStaff?: boolean;
  } | null>;
  siteUrl: URL;
}

const path = '/settings/subscriptions';

async function canUseTelegramIntegration(db: PrismaClient): Promise<boolean> {
  const [row] = await db.$queryRaw<Array<{ enabled: number | bigint }>>`
    SELECT CASE WHEN telegram_enabled = 1 AND TRIM(telegram_bot_username) <> '' AND TRIM(telegram_bot_token) <> ''
                THEN 1 ELSE 0 END AS enabled
      FROM board_integrationsetting WHERE id = 1 LIMIT 1
  `;
  return Boolean(row && Number(row.enabled));
}

export function registerSubscriptionPage(app: FastifyInstance, db: PrismaClient, options: Options) {
  app.get(path, async (request, reply) => {
    const user = await options.currentUser(request);
    if (!user) return reply.redirect(`/login?${new URLSearchParams({ next: path })}`, 302);
    const { subscriptions, isTelegramConnected } = await mySubscriptions(db, user.id);
    const telegramAvailable = await canUseTelegramIntegration(db);
    const previous = requestCookies(request)[csrfCookie] ?? '';
    const csrf = csrfPattern.test(previous) ? previous : createToken();
    if (previous !== csrf) reply.setCookie(csrfCookie, csrf, authCookieOptions(options.siteUrl));
    const content = <>
      <p className="mb-6 text-sm leading-relaxed text-content-secondary">구독한 작가가 새 글을 발행하면 알림을 보내드립니다.</p>
      {telegramAvailable && !isTelegramConnected && <a className="settings-card telegram-prompt" href="/settings/integration">
        <span className="settings-card-mark"><SiteIcon name="settings" className="h-5 w-5" /></span>
        <span><strong>텔레그램으로 새 글 받기</strong>
          <span>텔레그램을 연결하면 새 글 알림을 텔레그램으로도 받을 수 있습니다.</span></span>
        <SiteIcon name="chevron-down" className="h-4 w-4 shrink-0 text-content-hint" />
      </a>}
      {subscriptions.length ? <ul className="subscription-list" aria-label="구독한 작가">
        {subscriptions.map((author) => <li className="subscription-item" key={author.username}>
          <img className="subscription-avatar" src={author.avatar} alt="" width="44" height="44" loading="lazy" />
          <div className="subscription-copy">
            <a className="notification-link" href={`/@${encodeURIComponent(author.username)}`}>{author.name || author.username}</a>
            <div className="notification-meta"><span>@{author.username}</span><span>{author.subscribedDate}부터 구독</span>
              {!author.isPublishing && <span>더 이상 글을 발행하지 않습니다.</span>}
            </div>
            {author.isPublishing && author.bio && <p className="mt-2 text-sm leading-relaxed text-content-secondary">{author.bio}</p>}
          </div>
          <form className="subscription-action" method="post" action={`/v1/users/@${encodeURIComponent(author.username)}/subscription`}>
            <input type="hidden" name="csrfmiddlewaretoken" value={csrf} />
            <input type="hidden" name="action" value="unsubscribe" />
            <input type="hidden" name="return_to" value={path} />
            <button type="submit">구독 취소</button>
          </form>
        </li>)}</ul> : <section className="panel flex flex-col items-center gap-3 py-12 text-center" role="status">
        <span className="settings-card-mark"><SiteIcon name="bell" className="h-5 w-5" /></span>
        <p className="m-0 text-sm font-semibold text-content">구독한 작가가 없습니다.</p>
        <p className="m-0 text-sm text-content-secondary">작가 페이지나 글 아래에서 새 글 구독을 시작할 수 있습니다.</p>
      </section>}
    </>;
    const html = renderSettingsShell({
      mode: 'personal', title: '구독', currentPath: path,
      user: { username: user.username, hasEditorRole: user.hasEditorRole, isStaff: user.isStaff },
      csrfToken: csrf, content, canUseTelegramIntegration: telegramAvailable,
    });
    return reply.header('Cache-Control', 'private, no-store').type('text/html; charset=utf-8').send(html);
  });
}
