import { renderApplicationDocument } from '../../../platform/views.js';
import type { FastifyReply } from 'fastify';
import { sanitizePostHtml } from '../post-html.js';
import { managementDate } from '../services/management.js';
import { StoredRevision, TimelapseResult } from '../services/revisions.js';
import { StoredPost, dateAsIso, h1 } from '../shared.js';

interface RevisionHistoryPageModel {
  username: string;
  slug: string;
  title: string;
  updatedDate: string;
  csrfToken: string;
  page: number;
  lastPage: number;
  totalCount: number;
  revisions: StoredRevision[];
  notice: string;
}

const historyPageCss = `
  :root { color-scheme: light dark; font: 16px/1.65 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color:CanvasText; background:Canvas; }
  * { box-sizing:border-box; }
  body { margin:0; }
  a { color:inherit; text-underline-offset:.2em; }
  header, main { max-width:70rem; margin:auto; padding:1rem 1.25rem; }
  header { display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:.75rem; border-bottom:1px solid color-mix(in srgb,CanvasText 16%,Canvas); }
  header a { font-weight:700; text-decoration:none; }
  nav { display:flex; flex-wrap:wrap; gap:.8rem; }
  main { max-width:58rem; padding-top:clamp(1.5rem,4vw,3rem); }
  h1 { line-height:1.2; letter-spacing:-.025em; }
  .meta { color:GrayText; font-size:.9rem; }
  .notice { border-left:3px solid color-mix(in srgb,CanvasText 35%,Canvas); padding:.45rem .8rem; }
  .revision, .frame { margin:1rem 0; border:1px solid color-mix(in srgb,CanvasText 18%,Canvas); border-radius:.75rem; }
  summary { cursor:pointer; padding:1rem; }
  summary span { display:block; color:GrayText; font-size:.88rem; }
  .revision-body, .frame-body { padding:0 1rem 1rem; overflow-wrap:anywhere; }
  .revision-body > div, .frame-body > div { line-height:1.8; }
  .forms { display:flex; flex-wrap:wrap; gap:.6rem; margin-top:1rem; }
  button { min-height:2.75rem; border:1px solid color-mix(in srgb,CanvasText 24%,Canvas); border-radius:.55rem; padding:.55rem .8rem; background:Canvas; color:CanvasText; font:inherit; cursor:pointer; }
  .danger { color:#b42318; }
  .pager { display:flex; justify-content:center; gap:1rem; padding:1.5rem; }
  .empty { margin:3rem 0; text-align:center; color:GrayText; }
  @media(max-width:36rem) { header { align-items:flex-start; flex-direction:column; } }
`;

export function renderRevisionHistoryPage(model: RevisionHistoryPageModel): string {
  const postPath = `/@${encodeURIComponent(model.username)}/${encodeURIComponent(model.slug)}`;
  const pagination = model.lastPage > 1 ? h1('nav', { className: 'pager', 'aria-label': '페이지 이동' },
    model.page > 1 ? h1('a', { href: `${postPath}/revisions?page=${model.page - 1}` }, '이전') : null,
    h1('span', null, `${model.page} / ${model.lastPage}`),
    model.page < model.lastPage ? h1('a', { href: `${postPath}/revisions?page=${model.page + 1}` }, '다음') : null,
  ) : null;
  const rows = model.revisions.map((revision) => {
    const label = revision.changeType === 'restore' ? '복원 전 기록'
      : revision.changeType === 'legacy' ? '이전 기록'
        : '수정 전 기록';
    const revisionTitle = revision.title === '_NO_CHANGED_' ? '제목 기록 없음' : revision.title || '제목 없는 글';
    const content = revision.content === '_NO_CHANGED_' ? '' : sanitizePostHtml(revision.content);
    const date = dateAsIso(revision.sourceUpdatedDate ?? revision.createdDate);
    const revisionPath = `${postPath}/revisions/${revision.id}`;
    return h1('details', { className: 'revision', key: revision.id },
      h1('summary', null,
        h1('strong', null, revisionTitle),
        h1('span', null, `${label} · ${managementDate(revision.sourceUpdatedDate ?? revision.createdDate)} · ${revision.actor ? `@${revision.actor}` : '작성자 없음'}`)),
      h1('div', { className: 'revision-body' },
        date ? h1('time', { className: 'meta', dateTime: date }, date) : null,
        revision.contentExcerpt ? h1('p', { className: 'meta' }, revision.contentExcerpt) : null,
        content ? h1('div', { dangerouslySetInnerHTML: { __html: content } }) : h1('p', { className: 'meta' }, '이전 본문은 보관되지 않았습니다.'),
        h1('div', { className: 'forms' },
          revision.changeType !== 'legacy' ? h1('form', { method: 'post', action: `${revisionPath}/restore` },
            h1('input', { type: 'hidden', name: 'csrfmiddlewaretoken', value: model.csrfToken }),
            h1('input', { type: 'hidden', name: 'expectedUpdatedDate', value: model.updatedDate }),
            h1('button', { type: 'submit' }, '이 기록으로 복원')) : null,
          h1('form', { method: 'post', action: `${revisionPath}/delete` },
            h1('input', { type: 'hidden', name: 'csrfmiddlewaretoken', value: model.csrfToken }),
            h1('input', { type: 'hidden', name: 'expectedUpdatedDate', value: model.updatedDate }),
            h1('label', null, h1('input', { type: 'checkbox', name: 'confirmDelete', value: 'yes', required: true }), '기록 삭제 확인'),
            h1('button', { className: 'danger', type: 'submit' }, '기록 삭제')),
        ),
      ),
    );
  });
  return renderApplicationDocument(h1('html', { lang: 'ko' },
    h1('head', null,
      h1('meta', { charSet: 'utf-8' }),
      h1('meta', { name: 'viewport', content: 'width=device-width, initial-scale=1' }),
      h1('meta', { name: 'color-scheme', content: 'light dark' }),
      h1('meta', { name: 'robots', content: 'noindex,nofollow' }),
      h1('title', null, `수정 기록 · ${model.title} · BLEX`),
      h1('style', null, historyPageCss),
    ),
    h1('body', null,
      h1('header', null,
        h1('a', { href: `${postPath}/edit` }, '글 편집'),
        h1('nav', null,
          h1('a', { href: `${postPath}/timelapse` }, '작성 타임라인'),
          h1('a', { href: '/settings/posts' }, '글 관리'))),
      h1('main', null,
        h1('h1', null, '수정 기록'),
        h1('p', { className: 'meta' }, `${model.title} · ${model.totalCount}개 기록 · 무제한 보관`),
        model.notice ? h1('p', { className: 'notice', role: 'status' }, model.notice) : null,
        rows.length ? h1('section', { 'aria-label': '수정 기록 목록' }, ...rows) : h1('p', { className: 'empty' }, '저장된 수정 기록이 없습니다.'),
        pagination,
      ),
    ),
  ));
}

export function renderTimelapsePage(username: string, post: StoredPost, timelapse: TimelapseResult): string {
  const postPath = `/@${encodeURIComponent(username)}/${encodeURIComponent(post.url)}`;
  const frames = timelapse.frames.map((frame, index) => h1('details', { className: 'frame', key: `${frame.savedAt}:${index}`, open: index === timelapse.frames.length - 1 },
    h1('summary', null,
      h1('strong', null, frame.title || '제목 없는 글'),
      h1('span', null, `${frame.stage === 'draft' ? '임시 저장' : '발행 글'} · ${managementDate(frame.savedAt)}`)),
    h1('div', { className: 'frame-body' },
      h1('div', { dangerouslySetInnerHTML: { __html: sanitizePostHtml(frame.contentHtml) } })),
  ));
  return renderApplicationDocument(h1('html', { lang: 'ko' },
    h1('head', null,
      h1('meta', { charSet: 'utf-8' }),
      h1('meta', { name: 'viewport', content: 'width=device-width, initial-scale=1' }),
      h1('meta', { name: 'color-scheme', content: 'light dark' }),
      h1('meta', { name: 'robots', content: 'noindex,nofollow' }),
      h1('title', null, `작성 타임라인 · ${post.title} · BLEX`),
      h1('style', null, historyPageCss),
    ),
    h1('body', null,
      h1('header', null,
        h1('a', { href: `${postPath}/edit` }, '글 편집'),
        h1('nav', null,
          h1('a', { href: `${postPath}/revisions` }, '수정 기록'),
          h1('a', { href: '/settings/posts' }, '글 관리'))),
      h1('main', null,
        h1('h1', null, '작성 타임라인'),
        h1('p', { className: 'meta' }, `${post.title} · ${timelapse.totalCount}개 장면`),
        timelapse.totalCount > timelapse.frames.length
          ? h1('p', { className: 'notice' }, `오래된 기록을 포함해 ${timelapse.totalCount}개 중 ${timelapse.frames.length}개 장면을 표시합니다.`)
          : null,
        frames.length ? h1('section', { 'aria-label': '작성 기록 목록' }, ...frames) : h1('p', { className: 'empty' }, '표시할 작성 기록이 없습니다.'),
      ),
    ),
  ));
}

export function sendPrivateHistoryPage(reply: FastifyReply, html: string, statusCode = 200): FastifyReply {
  return reply.code(statusCode).type('text/html; charset=utf-8')
    .header('Cache-Control', 'private, no-store')
    .header('X-Robots-Tag', 'noindex, nofollow')
    .header('X-Frame-Options', 'DENY')
    .send(html);
}
