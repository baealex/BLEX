import { createElement, type ReactNode } from 'react';
import { renderSettingsShell } from '../../application/settings-shell.js';

export interface CollectionUser {
  id: number;
  username: string;
  isStaff?: boolean;
  notifyCount?: number;
  hasConnectedTelegram?: boolean;
}

export interface SeriesListItem {
  id: number;
  url: string;
  name: string;
  order: number;
  totalPosts: number;
}

export interface SeriesPostOption {
  id: number;
  title: string;
  publishedDate: string | null;
}

export interface PinnedPostItem {
  id: number;
  order: number;
  post: {
    url: string;
    title: string;
    image: string | null;
    createdDate: string;
  };
}

export interface PinnablePostItem {
  url: string;
  title: string;
  image: string | null;
  createdDate: string;
}

export interface PinnablePagination {
  page: number;
  limit: number;
  lastPage: number;
  totalCount: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

const h = createElement;
const styles = `
  .author-collection .collection-list { display: grid; gap: .5rem; margin-top: .75rem; }
  .author-collection .collection-item { border-bottom: 1px solid var(--color-line-light); padding: .75rem 0; }
  .author-collection .row { display: flex; flex-wrap: wrap; align-items: center; gap: .65rem; }
  .author-collection .row > .grow { flex: 1 1 12rem; }
  .author-collection input[type=number] { width: 5rem; }
  .author-collection input[type=checkbox] { margin: 0 .65rem 0 0; }
  .author-collection .post-option { display: flex; align-items: center; padding: .55rem 0; border-top: 1px solid var(--color-line-light); }
  .author-collection .pagination { display: flex; justify-content: space-between; gap: 1rem; margin-top: 1rem; }
`;

function displayDate(value: string | null): string {
  if (!value) return '';
  const timestamp = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00+09:00` : value;
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) return '';
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: 'long', day: 'numeric',
  }).format(date);
}

function frame(title: string, user: CollectionUser, currentPath: string, csrfToken: string, content: ReactNode, status?: { saved?: boolean; error?: string }): string {
  const message = status?.error ? h('p', { className: 'status error', role: 'alert' }, status.error)
    : status?.saved ? h('p', { className: 'status success', role: 'status' }, '변경 사항을 저장했습니다.') : null;
  return renderSettingsShell({ mode: 'personal', title, currentPath, csrfToken,
    user: { username: user.username, hasEditorRole: true, isStaff: user.isStaff, unreadCount: user.notifyCount },
    canUseTelegramIntegration: user.hasConnectedTelegram,
    content: h('div', { className: 'author-collection space-y-4' }, h('style', null, styles), message, content),
  });
}

function csrf(csrfToken: string) {
  return h('input', { type: 'hidden', name: 'csrfmiddlewaretoken', value: csrfToken });
}

export function renderSeriesEditorPage(props: {
  user: CollectionUser;
  csrfToken: string;
  series: SeriesListItem | null;
  description: string;
  selectedPostIds: number[];
  availablePosts: SeriesPostOption[];
  error?: string;
}): string {
  const series = props.series;
  const edit = series !== null;
  const action = series ? `/series/edit/${series.id}` : '/series/create';
  return frame(edit ? '시리즈 수정' : '새 시리즈 생성', props.user, '/settings/series', props.csrfToken, <>
    <p><a href="/settings/series">목록으로</a></p>
    <section className="panel">
      <form method="post" action={action}>
        {csrf(props.csrfToken)}
        {series && <input type="hidden" name="series_id" value={series.id} />}
        <div className="field"><label htmlFor="series-name">시리즈 제목</label><input id="series-name" name="name" maxLength={50} required defaultValue={series?.name ?? ''} placeholder="시리즈 제목을 입력해 주세요" /></div>
        {!edit && <div className="field"><label htmlFor="series-url">시리즈 URL (선택)</label><input id="series-url" name="url" maxLength={50} defaultValue="" placeholder="비우면 제목으로 URL을 만듭니다" /><small className="muted">영문, 숫자, 한글, 밑줄, 하이픈을 사용할 수 있습니다.</small></div>}
        <div className="field"><label htmlFor="series-description">시리즈 설명</label><textarea id="series-description" name="description" maxLength={500} rows={5} defaultValue={props.description} placeholder="이 시리즈에서 다루는 내용을 입력해 주세요." /></div>
        <section aria-labelledby="series-posts-heading">
          <h2 id="series-posts-heading">포함할 포스트 선택</h2>
          <p className="muted">비공개 포스트는 소유자에게만 편집 목록으로 표시되고 공개 페이지에서는 감춰집니다.</p>
          {props.availablePosts.length ? props.availablePosts.map((post) => <label className="post-option" key={post.id}>
            <input type="checkbox" name="post_ids" value={post.id} defaultChecked={props.selectedPostIds.includes(post.id)} />
            <span>{post.title}<span className="muted"> · {displayDate(post.publishedDate) || '임시 포스트'}</span></span>
          </label>) : <p className="muted">추가할 수 있는 포스트가 없습니다.</p>}
        </section>
        <div className="actions"><button type="submit">{edit ? '시리즈 수정' : '시리즈 생성'}</button></div>
      </form>
      {series && <form method="post" action={action} className="actions">
        {csrf(props.csrfToken)}
        <input type="hidden" name="intent" value="delete" />
        <input type="hidden" name="series_id" value={series.id} />
        <button type="submit">시리즈 삭제</button>
      </form>}
    </section>
  </>, { error: props.error });
}
