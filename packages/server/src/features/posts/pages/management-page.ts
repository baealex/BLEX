import { renderSettingsShell } from '../../../application/settings-shell.js';
import { managementDate } from '../services/management.js';
import { StoredDraftSummary, h1 } from '../shared.js';

export type ManagementTab = 'published' | 'scheduled' | 'drafts' | 'trash';

interface ManagementPageModel {
  username: string;
  isStaff?: boolean;
  notifyCount?: number;
  hasConnectedTelegram?: boolean;
  csrfToken: string;
  tab: ManagementTab;
  page: number;
  lastPage: number;
  totalCount: number;
  posts: Array<Record<string, unknown>>;
  drafts: StoredDraftSummary[];
  trash: Array<Record<string, unknown>>;
  filters: { search: string; tag: string; series: string; visibility: string; order: string };
}

function managementPageHref(tab: ManagementTab, page: number, filters: ManagementPageModel['filters']): string {
  const params = new URLSearchParams();
  if (tab !== 'published') params.set('tab', tab);
  if (page > 1) params.set('page', String(page));
  for (const [key, value] of Object.entries(filters)) if (value) params.set(key, value);
  const query = params.toString();
  return `/settings/posts${query ? `?${query}` : ''}`;
}

const managementCss = [
  ".post-management .management-tabs{display:flex;flex-wrap:wrap;gap:.45rem;border-bottom:1px solid var(--color-line-light);padding-bottom:.75rem}",
  ".post-management .management-tabs a{display:inline-flex;min-height:2.5rem;align-items:center;border-radius:.65rem;padding:.5rem .8rem;color:var(--color-content-secondary);font-size:.875rem;font-weight:550;text-decoration:none}",
  ".post-management .management-tabs a:hover,.post-management .management-tabs a[aria-current=page]{background:var(--color-surface-subtle);color:var(--color-content)}",
  ".post-management .management-tabs a[aria-current=page]{font-weight:650}",
  ".post-management .filters{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,12rem),1fr));gap:.85rem}",
  ".post-management .filter-field{display:grid;min-width:0;gap:.35rem}",
  ".post-management .filter-field label{font-size:.75rem}",
  ".post-management .post-list{display:grid;gap:.75rem}",
  ".post-management .post-item{display:flex;min-width:0;flex-wrap:wrap;align-items:flex-start;justify-content:space-between;gap:1rem;border:1px solid var(--color-line-light);border-radius:.9rem;background:var(--color-surface);padding:1rem}",
  ".post-management .post-copy{min-width:0;flex:1 1 18rem}",
  ".post-management .post-title{margin:0;overflow-wrap:anywhere;font-size:1rem;font-weight:650;line-height:1.45}",
  ".post-management .post-title a{color:var(--color-content);text-decoration:none}",
  ".post-management .post-title a:hover{text-decoration:underline;text-underline-offset:.2em}",
  ".post-management .post-meta{margin:.4rem 0 0;color:var(--color-content-secondary);font-size:.8rem;line-height:1.55}",
  ".post-management .post-actions{display:flex;flex:0 1 auto;flex-wrap:wrap;align-items:center;gap:.45rem}",
  ".post-management .post-actions form{display:inline-flex;margin:0}",
  ".post-management .post-actions .button,.post-management .post-actions button{display:inline-flex;min-height:2.5rem;align-items:center;justify-content:center;border:1px solid var(--color-line);border-radius:.65rem;background:var(--color-surface);padding:.45rem .75rem;color:var(--color-content-secondary);font:inherit;font-size:.8rem;font-weight:550;text-decoration:none;cursor:pointer}",
  ".post-management .post-actions .button:hover,.post-management .post-actions button:hover{background:var(--color-surface-subtle);color:var(--color-content)}",
  ".post-management .post-actions .danger-button{border-color:var(--color-danger-line);color:var(--color-danger)}",
  ".post-management .post-actions .danger-button:hover{background:var(--color-danger-surface)}",
  ".post-management .confirm{display:inline-flex;align-items:center;gap:.35rem;color:var(--color-content-secondary);font-size:.75rem}",
  ".post-management .notice{border-radius:.75rem;background:var(--color-warning-surface);padding:.75rem .9rem;color:var(--color-content-secondary);font-size:.85rem}",
  ".post-management .empty{margin:0;border:1px dashed var(--color-line);border-radius:.85rem;padding:2.5rem 1rem;color:var(--color-content-secondary);text-align:center}",
  ".post-management .pagination{display:flex;justify-content:space-between;gap:1rem;margin-top:1rem}",
  ".post-management .pagination a{display:inline-flex;min-height:2.5rem;align-items:center;border:1px solid var(--color-line);border-radius:.65rem;background:var(--color-surface);padding:.45rem .75rem;color:var(--color-content-secondary);font-size:.85rem;text-decoration:none}",
  "@media(max-width:42rem){.post-management .post-item{flex-direction:column}.post-management .post-actions{width:100%}}",
].join('');

export function renderManagementPage(model: ManagementPageModel): string {
  const tabLinks: Array<[ManagementTab, string, string]> = [
    ['published', '발행 포스트', '/settings/posts'],
    ['scheduled', '예약 포스트', '/settings/posts?tab=scheduled'],
    ['drafts', '임시 포스트', '/settings/posts?tab=drafts'],
    ['trash', '휴지통', '/settings/posts?tab=trash'],
  ];
  const selectedTab = model.tab;
  const activePosts = model.posts.map((post) => {
    const slug = String(post.url ?? '');
    const title = String(post.title || '제목 없는 포스트');
    const editUrl = '/@' + encodeURIComponent(model.username) + '/' + encodeURIComponent(slug) + '/edit';
    const detailUrl = '/@' + encodeURIComponent(model.username) + '/' + encodeURIComponent(slug);
    return h1('article', { className: 'post-item', key: slug },
      h1('div', { className: 'post-copy' },
        h1('h2', { className: 'post-title' }, h1('a', { href: editUrl }, title)),
        h1('p', { className: 'post-meta' },
          model.tab === 'scheduled' ? '예약 발행 ' + String(post.createdDate ?? '') : '발행 ' + String(post.createdDate ?? ''),
          ' · 수정 ' + String(post.updatedDate ?? ''),
          ' · 좋아요 ' + String(post.countLikes ?? 0) + ' · 댓글 ' + String(post.countComments ?? 0),
          ' · ' + Number(post.readTime ?? 0) + '분 읽기',
        ),
        h1('p', { className: 'post-meta' },
          '태그: ' + String(post.tag || '없음') + ' · 시리즈: ' + String(post.series || '선택 안 함') + ' · 공개 상태: ' + (post.isHide ? '숨김' : '공개'),
        ),
      ),
      h1('div', { className: 'post-actions' },
        h1('a', { className: 'button', href: editUrl }, '편집'),
        model.tab === 'scheduled'
          ? h1('form', { method: 'post', action: '/settings/posts/' + encodeURIComponent(slug) + '/schedule/cancel' },
              h1('input', { type: 'hidden', name: 'csrfmiddlewaretoken', value: model.csrfToken }),
              h1('button', { type: 'submit' }, '예약 취소'))
          : h1('a', { className: 'button', href: detailUrl }, '보기'),
        h1('form', { method: 'post', action: '/settings/posts/' + encodeURIComponent(slug) + '/visibility' },
          h1('input', { type: 'hidden', name: 'csrfmiddlewaretoken', value: model.csrfToken }),
          h1('button', { type: 'submit' }, post.isHide ? '공개하기' : '숨기기')),
        h1('form', { method: 'post', action: '/settings/posts/' + encodeURIComponent(slug) + '/trash' },
          h1('input', { type: 'hidden', name: 'csrfmiddlewaretoken', value: model.csrfToken }),
          h1('button', { className: 'danger-button', type: 'submit' }, '휴지통으로 이동')),
      ),
    );
  });
  const draftItems = model.drafts.map((draft) => h1('article', { className: 'post-item', key: draft.url },
    h1('div', { className: 'post-copy' },
      h1('h2', { className: 'post-title' }, h1('a', { href: '/write?draft=' + encodeURIComponent(draft.url) }, draft.title || '제목 없는 포스트')),
      h1('p', { className: 'post-meta' }, '마지막 수정 ' + managementDate(draft.updatedDate)),
    ),
    h1('div', { className: 'post-actions' },
      h1('a', { className: 'button', href: '/write?draft=' + encodeURIComponent(draft.url) }, '계속 쓰기'),
      h1('a', { className: 'button', href: '/write/preview/' + encodeURIComponent(draft.url) }, '미리보기'),
      h1('form', { method: 'post', action: '/settings/drafts/' + encodeURIComponent(draft.url) + '/trash' },
        h1('input', { type: 'hidden', name: 'csrfmiddlewaretoken', value: model.csrfToken }),
        h1('button', { className: 'danger-button', type: 'submit' }, '휴지통으로 이동')),
    ),
  ));
  const trashItems = model.trash.map((post) => {
    const slug = String(post.url ?? '');
    const rawDeletedDate = String(post.deletedDate ?? '');
    const deletedDate = managementDate(rawDeletedDate, true);
    const status = String(post.sourceStatus ?? 'draft');
    const statusLabel = status === 'scheduled' ? '예약 포스트' : status === 'published' ? '발행 포스트' : '임시 포스트';
    return h1('article', { className: 'post-item', key: slug + ':' + rawDeletedDate },
      h1('div', { className: 'post-copy' },
        h1('h2', { className: 'post-title' }, String(post.title || '제목 없는 포스트')),
        h1('p', { className: 'post-meta' }, '휴지통 이동 ' + deletedDate + ' · 이전 상태 ' + statusLabel + (post.isHide ? ' · 숨김' : '')),
        post.scheduleElapsed ? h1('p', { className: 'notice' }, '예약 시각이 지나 복원하면 발행 상태가 됩니다. 기존 비공개 설정은 그대로 유지됩니다.') : null,
      ),
      h1('div', { className: 'post-actions' },
        h1('form', { method: 'post', action: '/settings/posts/trash/' + encodeURIComponent(slug) + '/restore' },
          h1('input', { type: 'hidden', name: 'csrfmiddlewaretoken', value: model.csrfToken }),
          h1('input', { type: 'hidden', name: 'expected_deleted_date', value: rawDeletedDate }),
          h1('button', { type: 'submit' }, '복원')),
        h1('form', { method: 'post', action: '/settings/posts/trash/' + encodeURIComponent(slug) + '/purge' },
          h1('input', { type: 'hidden', name: 'csrfmiddlewaretoken', value: model.csrfToken }),
          h1('input', { type: 'hidden', name: 'expected_deleted_date', value: rawDeletedDate }),
          h1('label', { className: 'confirm' }, h1('input', { type: 'checkbox', name: 'confirm_permanent', value: 'yes', required: true }), '영구 삭제를 확인합니다'),
          h1('button', { className: 'danger-button', type: 'submit' }, '영구 삭제')),
      ),
    );
  });
  const rows = selectedTab === 'drafts' ? draftItems : selectedTab === 'trash' ? trashItems : activePosts;
  const empty = rows.length === 0 ? h1('p', { className: 'empty' }, selectedTab === 'trash' ? '휴지통이 비어 있습니다.' : selectedTab === 'drafts' ? '임시 포스트가 없습니다.' : selectedTab === 'scheduled' ? '예약 포스트가 없습니다.' : '발행 포스트가 없습니다.') : null;
  const filters = model.tab === 'published' || model.tab === 'scheduled'
    ? h1('form', { className: 'filters', method: 'get', action: '/settings/posts' },
        model.tab !== 'published' ? h1('input', { type: 'hidden', name: 'tab', value: model.tab }) : null,
        h1('div', { className: 'filter-field' }, h1('label', { htmlFor: 'management-search' }, '포스트 제목 검색'), h1('input', { id: 'management-search', name: 'search', defaultValue: model.filters.search, placeholder: '포스트 제목 검색...' })),
        h1('div', { className: 'filter-field' }, h1('label', { htmlFor: 'management-tag' }, '태그'), h1('input', { id: 'management-tag', name: 'tag', defaultValue: model.filters.tag, placeholder: '태그 이름' })),
        h1('div', { className: 'filter-field' }, h1('label', { htmlFor: 'management-series' }, '시리즈'), h1('input', { id: 'management-series', name: 'series', defaultValue: model.filters.series, placeholder: '시리즈 URL' })),
        h1('div', { className: 'filter-field' }, h1('label', { htmlFor: 'management-visibility' }, '공개 상태'), h1('select', { id: 'management-visibility', name: 'visibility', defaultValue: model.filters.visibility },
          h1('option', { value: '' }, '모든 공개 상태'), h1('option', { value: 'public' }, '공개'), h1('option', { value: 'hidden' }, '숨김'))),
        h1('div', { className: 'filter-field' }, h1('label', { htmlFor: 'management-order' }, '정렬'), h1('select', { id: 'management-order', name: 'order', defaultValue: model.filters.order },
          ...[['-published_date', '최신순'], ['published_date', '오래된 순'], ['-updated_date', '최근 수정순'], ['updated_date', '오래전 수정순'], ['title', '제목 오름차순'], ['-title', '제목 내림차순'], ['-count_likes', '좋아요 많은 순'], ['count_likes', '좋아요 적은 순'], ['-count_comments', '댓글 많은 순'], ['count_comments', '댓글 적은 순'], ['read_time', '짧은 글 순'], ['-read_time', '긴 글 순']].map(([value, label]) => h1('option', { key: value, value }, label)))),
        h1('div', { className: 'col-span-full flex justify-end' }, h1('button', { type: 'submit' }, '필터 적용')),
      ) : null;
  const pagination = model.lastPage > 1 ? h1('nav', { className: 'pagination', 'aria-label': '페이지 이동' },
    model.page > 1 ? h1('a', { href: managementPageHref(model.tab, model.page - 1, model.filters) }, '이전') : null,
    h1('span', { className: 'muted' }, model.page + ' / ' + model.lastPage + '페이지'),
    model.page < model.lastPage ? h1('a', { href: managementPageHref(model.tab, model.page + 1, model.filters) }, '다음') : null,
  ) : null;
  const pageTitle = selectedTab === 'trash' ? '휴지통' : selectedTab === 'drafts' ? '임시 포스트' : selectedTab === 'scheduled' ? '예약 포스트' : '포스트 관리';
  const content = h1('div', { className: 'post-management space-y-4' },
    h1('style', null, managementCss),
    h1('nav', { className: 'management-tabs', 'aria-label': '포스트 상태' }, ...tabLinks.map(([value, label, href]) => h1('a', {
      key: value, href, ...(value === selectedTab ? { 'aria-current': 'page' } : {}),
    }, label))),
    selectedTab === 'trash' ? h1('p', { className: 'muted' }, '휴지통의 포스트는 자동으로 삭제되지 않습니다.') : null,
    filters ? h1('section', { className: 'panel', 'aria-label': '포스트 필터' }, filters) : null,
    h1('section', { className: 'panel' },
      rows.length ? h1('p', { className: 'muted mb-4' }, '총 ' + model.totalCount + '개') : null,
      rows.length ? h1('div', { className: 'post-list' }, ...rows) : empty,
      pagination,
    ),
  );
  return renderSettingsShell({
    mode: 'personal', title: pageTitle, currentPath: '/settings/posts',
    user: { username: model.username, hasEditorRole: true, isStaff: model.isStaff, unreadCount: model.notifyCount }, csrfToken: model.csrfToken,
    canUseTelegramIntegration: model.hasConnectedTelegram,
    headerAction: h1('a', { className: 'inline-flex min-h-10 items-center rounded-lg bg-action px-3 py-2 text-sm font-semibold text-content-inverted no-underline hover:bg-action-hover', href: '/write' }, '새 포스트 작성'),
    content,
  });
}
