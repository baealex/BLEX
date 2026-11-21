import { createElement, type ReactNode } from 'react';
import { renderSettingsShell } from '../settings-shell.js';

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

export function renderSeriesListPage(props: {
  user: CollectionUser;
  csrfToken: string;
  series: SeriesListItem[];
  saved?: boolean;
  error?: string;
}): string {
  return frame('시리즈', props.user, '/settings/series', props.csrfToken, <>
    <div className="row justify-end"><a className="button-link" href="/series/create">새 시리즈 생성</a></div>
    {props.series.length ? <>
      <form className="panel" method="post" action="/settings/series">
        {csrf(props.csrfToken)}
        <input type="hidden" name="intent" value="order" />
        <ul className="collection-list">
          {props.series.map((item) => <li className="collection-item row" key={item.id}>
            <div className="grow"><a href={`/series/edit/${item.id}`}><strong>{item.name}</strong></a><div className="muted">/{item.url} · {item.totalPosts}개 포스트</div></div>
            <label htmlFor={`series-order-${item.id}`}>표시 순서</label>
            <input id={`series-order-${item.id}`} type="number" name={`order_${item.id}`} defaultValue={item.order} />
            <a href={`/series/edit/${item.id}`}>편집</a>
          </li>)}
        </ul>
        <div className="actions"><button type="submit">순서 저장</button></div>
      </form>
      <section className="panel" aria-labelledby="delete-series-heading">
        <h2 id="delete-series-heading">시리즈 삭제</h2>
        <ul className="collection-list">
          {props.series.map((item) => <li className="collection-item row" key={`delete-${item.id}`}>
            <span className="grow">{item.name}</span>
            <form method="post" action="/settings/series">
              {csrf(props.csrfToken)}
              <input type="hidden" name="intent" value="delete" />
              <input type="hidden" name="series_id" value={item.id} />
              <button type="submit" aria-label={`${item.name} 시리즈 삭제`}>삭제</button>
            </form>
          </li>)}
        </ul>
      </section>
    </> : <section className="panel"><p>시리즈가 없습니다.</p><a className="button-link" href="/series/create">새 시리즈 생성</a></section>}
  </>, { saved: props.saved, error: props.error });
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

export function renderPinnedPostsPage(props: {
  user: CollectionUser;
  csrfToken: string;
  pinnedPosts: PinnedPostItem[];
  maxCount: number;
  reservedCount: number;
  pinnablePosts: PinnablePostItem[];
  pagination: PinnablePagination;
  query: string;
  saved?: boolean;
  error?: string;
}): string {
  const nextPage = props.pagination.page + 1;
  const previousPage = props.pagination.page - 1;
  const pageUrl = (page: number) => `/settings/pinned-posts?${new URLSearchParams({ q: props.query, page: String(page) })}`;
  return frame('고정 포스트', props.user, '/settings/pinned-posts', props.csrfToken, <>
    <section className="panel" aria-labelledby="pinned-list-heading">
      <h2 id="pinned-list-heading">고정 포스트 {props.pinnedPosts.length}/{props.maxCount}</h2>
      <p className="muted">아래 URL 순서를 바꾸면 프로필에 표시되는 순서가 바뀝니다.</p>
      {props.reservedCount > 0 && <p className="status">휴지통의 고정 포스트 {props.reservedCount}개가 고정 한도를 유지합니다. 복원하면 다시 표시됩니다.</p>}
      {props.pinnedPosts.length ? <>
        <ol className="collection-list">
          {props.pinnedPosts.map((item) => <li className="collection-item row" key={item.id}>
            <div className="grow"><a href={`/@${props.user.username}/${encodeURIComponent(item.post.url)}`}><strong>{item.post.title}</strong></a><div className="muted">{displayDate(item.post.createdDate)}</div></div>
            <form method="post" action="/settings/pinned-posts">
              {csrf(props.csrfToken)}
              <input type="hidden" name="intent" value="remove" />
              <input type="hidden" name="post_url" value={item.post.url} />
              <button type="submit">해제</button>
            </form>
          </li>)}
        </ol>
        <form method="post" action="/settings/pinned-posts" className="field">
          {csrf(props.csrfToken)}
          <input type="hidden" name="intent" value="order" />
          <label htmlFor="pinned-post-order">표시 순서 (한 줄에 포스트 URL 하나)</label>
          <textarea id="pinned-post-order" name="post_urls" rows={Math.min(6, Math.max(2, props.pinnedPosts.length))} defaultValue={props.pinnedPosts.map((item) => item.post.url).join('\n')} />
          <div className="actions"><button type="submit">순서 저장</button></div>
        </form>
      </> : <p className="muted">아직 고정한 포스트가 없습니다.</p>}
    </section>
    <section className="panel" aria-labelledby="available-posts-heading">
      <div className="row"><div className="grow"><h2 id="available-posts-heading">고정 가능한 포스트</h2><p className="muted">총 {props.pagination.totalCount}개 중 {props.pagination.page}페이지</p></div>
        <form method="get" action="/settings/pinned-posts" className="row"><label htmlFor="pinned-search">포스트 제목 검색</label><input id="pinned-search" type="search" name="q" defaultValue={props.query} placeholder="포스트 제목 검색..." /><button type="submit">검색</button></form>
      </div>
      {props.pinnablePosts.length ? <ul className="collection-list">
        {props.pinnablePosts.map((post) => <li className="collection-item row" key={post.url}>
          <div className="grow"><strong>{post.title}</strong><div className="muted">{displayDate(post.createdDate)}</div></div>
          <form method="post" action="/settings/pinned-posts">
            {csrf(props.csrfToken)}
            <input type="hidden" name="intent" value="add" />
            <input type="hidden" name="post_url" value={post.url} />
            <button type="submit" disabled={props.pinnedPosts.length + props.reservedCount >= props.maxCount}>포스트 고정</button>
          </form>
        </li>)}
      </ul> : <p className="muted">검색 조건에 맞는 공개 포스트가 없습니다.</p>}
      <div className="pagination">
        {props.pagination.hasPrevious ? <a href={pageUrl(previousPage)}>← 이전</a> : <span />}
        {props.pagination.hasNext ? <a href={pageUrl(nextPage)}>다음 →</a> : <span />}
      </div>
    </section>
  </>, { saved: props.saved, error: props.error });
}
