import { renderApplicationDocument } from '~/application/document';
import type { PageProps } from '~/contracts/pages';
import { h as h1 } from '~/features/discovery/view-helpers';
import { historyPageCss } from '~/features/posts/history-pages-parts';

export default function renderPage(model: PageProps['@{$username}/{$slug}/revisions']): string {
  const postPath = `/@${encodeURIComponent(model.username)}/${encodeURIComponent(model.slug)}`;
  const pagination = model.lastPage > 1 ? h1('nav', {
 className: 'pager',
'aria-label': '페이지 이동'
},
    model.page > 1 ? h1('a', { href: `${postPath}/revisions?page=${model.page - 1}` }, '이전') : null,
    h1('span', null, `${model.page} / ${model.lastPage}`),
    model.page < model.lastPage ? h1('a', { href: `${postPath}/revisions?page=${model.page + 1}` }, '다음') : null
  ) : null;
  const rows = model.revisions.map((revision) => {
    const label = revision.changeType === 'restore' ? '복원 전 기록'
      : revision.changeType === 'legacy' ? '이전 기록'
        : '수정 전 기록';
    const revisionTitle = revision.title === '_NO_CHANGED_' ? '제목 기록 없음' : revision.title || '제목 없는 글';
    const revisionPath = `${postPath}/revisions/${revision.id}`;
    return h1('details', {
 className: 'revision',
key: revision.id
},
      h1('summary', null,
        h1('strong', null, revisionTitle),
        h1('span', null, `${label} · ${revision.savedLabel} · ${revision.actor ? `@${revision.actor}` : '작성자 없음'}`)),
      h1('div', { className: 'revision-body' },
        revision.date ? h1('time', {
 className: 'meta',
dateTime: revision.date
}, revision.date) : null,
        revision.contentExcerpt ? h1('p', { className: 'meta' }, revision.contentExcerpt) : null,
        revision.contentHtml ? h1('div', { dangerouslySetInnerHTML: { __html: revision.contentHtml } }) : h1('p', { className: 'meta' }, '이전 본문은 보관되지 않았습니다.'),
        h1('div', { className: 'forms' },
          revision.changeType !== 'legacy' ? h1('form', {
 method: 'post',
action: `${revisionPath}/restore`
},
            h1('input', {
 type: 'hidden',
name: 'csrfmiddlewaretoken',
value: model.csrfToken
}),
            h1('input', {
 type: 'hidden',
name: 'expectedUpdatedDate',
value: model.updatedDate
}),
            h1('button', { type: 'submit' }, '이 기록으로 복원')) : null,
          h1('form', {
 method: 'post',
action: `${revisionPath}/delete`
},
            h1('input', {
 type: 'hidden',
name: 'csrfmiddlewaretoken',
value: model.csrfToken
}),
            h1('input', {
 type: 'hidden',
name: 'expectedUpdatedDate',
value: model.updatedDate
}),
            h1('label', null, h1('input', {
 type: 'checkbox',
name: 'confirmDelete',
value: 'yes',
required: true
}), '기록 삭제 확인'),
            h1('button', {
 className: 'danger',
type: 'submit'
}, '기록 삭제'))
        )
      )
    );
  });
  return renderApplicationDocument(h1('html', { lang: 'ko' },
    h1('head', null,
      h1('meta', { charSet: 'utf-8' }),
      h1('meta', {
 name: 'viewport',
content: 'width=device-width, initial-scale=1'
}),
      h1('meta', {
 name: 'color-scheme',
content: 'light dark'
}),
      h1('meta', {
 name: 'robots',
content: 'noindex,nofollow'
}),
      h1('title', null, `수정 기록 · ${model.title} · BLEX`),
      h1('style', null, historyPageCss)
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
        model.notice ? h1('p', {
 className: 'notice',
role: 'status'
}, model.notice) : null,
        rows.length ? h1('section', { 'aria-label': '수정 기록 목록' }, ...rows) : h1('p', { className: 'empty' }, '저장된 수정 기록이 없습니다.'),
        pagination
      )
    )
  ));
}
