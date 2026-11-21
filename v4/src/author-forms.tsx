import formBody from '@fastify/formbody';
import type { PrismaClient } from '@prisma/client';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { authCookieOptions, csrfCookie, requestCookies } from './auth/cookies.js';
import { csrfPattern, formInput } from './auth/csrf.js';
import { createToken } from './auth/session.js';
import { markdownToHtml } from './authoring/markdown.js';
import { toIsoDateTime } from './developer-api/index.js';
import { sanitizePostHtml } from './post-html.js';
import { renderSettingsShell } from './settings-shell.js';

interface FormViewer {
  id: number;
  username?: string;
  hasEditorRole: boolean;
  isStaff?: boolean;
  notifyCount?: number;
  hasConnectedTelegram?: boolean;
}

interface FormOptions {
  currentUser: (request: FastifyRequest) => Promise<FormViewer | null>;
  validateCsrf: (request: FastifyRequest) => boolean;
  siteUrl: URL;
}

interface AuthorForm { id: number; title: string; content: string; createdDate: string }
const formsPath = '/settings/forms';
const bodyLimit = 1024 * 1024;

function done(body: object = {}) { return { status: 'DONE', body }; }
function failure(code: string, errorMessage = '') { return { status: 'ERROR', errorCode: `error:${code}`, errorMessage }; }

function displayDate(value: string | null): string {
  if (!value) return '';
  const normalized = value.includes('T') ? value : value.replace(' ', 'T');
  const timestamp = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(normalized) ? normalized : `${normalized}Z`;
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) return '';
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: 'long', day: 'numeric',
  }).format(date);
}

function formPage(
  forms: AuthorForm[], selected: AuthorForm | null, csrf: string, viewer: FormViewer, error = '',
) {
  const content = <div className="author-forms space-y-4">
    <style>{'.author-forms .form-list{display:grid;gap:.75rem;margin:0;padding:0;list-style:none}.author-forms .form-item{display:flex;min-width:0;align-items:center;gap:1rem}.author-forms .form-item .settings-card-mark{font-size:.75rem;font-weight:700}.author-forms .form-content{min-height:11rem}.author-forms .form-actions{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:.6rem}.author-forms .danger-button{border:1px solid var(--color-danger-line);background:var(--color-surface);color:var(--color-danger)}.author-forms .danger-button:hover{background:var(--color-danger-surface)}'} </style>
    {error && <p className="status error" role="alert">{error}</p>}
    <section className="panel" aria-labelledby="saved-forms-heading">
      <h2 id="saved-forms-heading">저장된 서식 ({forms.length})</h2>
      {forms.length ? <ul className="form-list">
        {forms.map((item) => <li key={item.id}>
          <a className="settings-card form-item" href={`${formsPath}?id=${item.id}`} aria-current={selected?.id === item.id ? 'page' : undefined}>
            <span className="settings-card-mark" aria-hidden="true">Aa</span>
            <span><strong>{item.title || '제목 없음'}</strong><span>{displayDate(item.createdDate) ? `생성 ${displayDate(item.createdDate)}` : '포스트 작성에 사용할 서식'}</span></span>
          </a>
        </li>)}
      </ul> : <p className="muted">등록된 서식이 없습니다.</p>}
      {selected && <p className="mt-4"><a className="secondary-button inline-flex min-h-10 items-center rounded-lg px-3 py-2 text-sm no-underline" href={formsPath}>새 서식 추가</a></p>}
    </section>
    <section className="panel" aria-labelledby="form-editor-heading">
      <h2 id="form-editor-heading">{selected ? '서식 편집' : '서식 추가'}</h2>
      <p className="muted">새 포스트에 불러올 문구를 미리 저장합니다.</p>
      <form method="post" action={formsPath}>
        <input type="hidden" name="csrfmiddlewaretoken" value={csrf} />
        {selected && <input type="hidden" name="id" value={selected.id} />}
        <div className="field"><label htmlFor="form-title">제목</label><input id="form-title" name="title" defaultValue={selected?.title ?? ''} maxLength={50} required placeholder="서식 제목을 입력하세요" /></div>
        <div className="field"><label htmlFor="form-content">내용</label><textarea className="form-content" id="form-content" name="content" defaultValue={selected?.content ?? ''} required placeholder="서식 내용을 입력하세요" /></div>
        <div className="form-actions">
          <button type="submit" name="action" value="save">{selected ? '서식 수정' : '서식 생성'}</button>
          {selected && <button className="danger-button" type="submit" name="action" value="delete" formNoValidate>서식 삭제</button>}
        </div>
      </form>
    </section>
  </div>;
  return renderSettingsShell({
    mode: 'personal', title: '서식', currentPath: formsPath, csrfToken: csrf,
    user: { username: viewer.username ?? '', hasEditorRole: viewer.hasEditorRole, isStaff: viewer.isStaff, unreadCount: viewer.notifyCount },
    canUseTelegramIntegration: viewer.hasConnectedTelegram,
    headerAction: <a className="inline-flex min-h-10 items-center rounded-lg bg-action px-3 py-2 text-sm font-semibold text-content-inverted no-underline hover:bg-action-hover" href="/write">새 포스트 작성</a>,
    content,
  });
}

export function registerAuthorForms(app: FastifyInstance, db: PrismaClient, options: FormOptions) {
  app.register(async (routes) => {
    await routes.register(formBody);
    routes.addHook('onRequest', async (_request, reply) => { reply.header('Cache-Control', 'private, no-store'); });
    const handle = async (request: FastifyRequest<{ Params: { id?: string }; Querystring: { id?: string } }>, reply: FastifyReply) => {
      const html = !request.url.startsWith('/v1/');
      const editor = await options.currentUser(request);
      if (!editor) return html ? reply.redirect(`/login?${new URLSearchParams({ next: formsPath })}`, 302) : failure('NL');
      if (!editor.hasEditorRole) return html
        ? reply.code(404).type('text/plain; charset=utf-8').send('페이지를 찾을 수 없습니다.')
        : failure('AT');
      const input = formInput(request);
      const rawId = request.params?.id ?? (html ? request.query.id ?? input.id : undefined);
      const id = typeof rawId === 'string' && /^\d+$/.test(rawId) ? Number(rawId) : undefined;
      if (rawId !== undefined && (!id || !Number.isSafeInteger(id))) return html
        ? reply.code(404).type('text/plain; charset=utf-8').send('서식을 찾을 수 없습니다.')
        : reply.code(404).send('Not found');
      const [selected] = id ? await db.$queryRaw<AuthorForm[]>`
        SELECT id, title, content, CAST(created_date AS TEXT) AS createdDate FROM board_form WHERE id = ${id} AND user_id = ${editor.id}
      ` : [];
      if (id && !selected) return html
        ? reply.code(404).type('text/plain; charset=utf-8').send('서식을 찾을 수 없습니다.')
        : reply.code(404).send('Not found');
      const forms = () => db.$queryRaw<AuthorForm[]>`
        SELECT id, title, CAST(created_date AS TEXT) AS createdDate FROM board_form WHERE user_id = ${editor.id} ORDER BY created_date DESC
      `;
      const page = async (error?: string) => {
        const previous = requestCookies(request)[csrfCookie] ?? '';
        const csrf = csrfPattern.test(previous) ? previous : createToken();
        if (csrf !== previous) reply.setCookie(csrfCookie, csrf, authCookieOptions(options.siteUrl));
        return reply.type('text/html; charset=utf-8').send(formPage(await forms(), selected ?? null, csrf, editor, error));
      };
      if (request.method === 'GET') {
        if (html) return page();
        if (selected) return done({ id: selected.id, title: selected.title, content: selected.content });
        return done({ forms: (await forms()).map((row) => ({ ...row, createdDate: toIsoDateTime(row.createdDate) })) });
      }
      if (!options.validateCsrf(request)) {
        if (html) {
          reply.code(403);
          return page('요청을 확인할 수 없습니다.');
        }
        return reply.code(403).send(failure('RJ'));
      }
      if (request.method === 'DELETE' || input.action === 'delete') {
        if (!id) return html
          ? reply.code(404).type('text/plain; charset=utf-8').send('서식을 찾을 수 없습니다.')
          : reply.code(404).send('Not found');
        await db.$executeRaw`DELETE FROM board_form WHERE id = ${id} AND user_id = ${editor.id}`;
      } else {
        const title = input.title ?? '';
        const content = input.content ?? '';
        if (typeof title !== 'string' || title.length > 50 || typeof content !== 'string') {
          return html ? page('서식 제목과 내용을 확인해 주세요.') : failure('IP', '글 양식을 확인해 주세요.');
        }
        if (id) await db.$executeRaw`
          UPDATE board_form SET title = ${title}, content = ${content} WHERE id = ${id} AND user_id = ${editor.id}
        `;
        else {
          const timestamp = new Date().toISOString().slice(0, -1).replace('T', ' ');
          const [created] = await db.$queryRaw<Array<{ id: number }>>`
            INSERT INTO board_form (title, content, user_id, created_date)
            VALUES (${title}, ${content}, ${editor.id}, ${timestamp}) RETURNING id
          `;
          if (!html) return done({ id: created.id });
        }
      }
      return html ? reply.redirect(formsPath, 303) : done();
    };
    type Request = { Params: { id?: string }; Querystring: { id?: string } };
    routes.route<Request>({ method: ['GET', 'POST'], url: formsPath, bodyLimit, handler: handle });
    routes.route<Request>({ method: ['GET', 'POST'], url: '/v1/forms', bodyLimit, handler: handle });
    routes.route<Request>({ method: ['GET', 'PUT', 'DELETE'], url: '/v1/forms/:id', bodyLimit, handler: handle });
    routes.post('/v1/markdown', { bodyLimit }, async (request, reply) => {
      if (!options.validateCsrf(request)) return reply.code(403).send(failure('RJ'));
      const { text, source_type: sourceType } = formInput(request);
      return typeof text === 'string' && text ? done({ html: sourceType === 'html' ? sanitizePostHtml(text) : markdownToHtml(text) }) :
        failure('IP', '텍스트가 비어 있습니다.');
    });
  });
}
