import { SiteIcon } from '~/appearance/icons';
import { PageLayout } from '~/features/discovery/layout';
import { EmptyState, Pagination } from '~/features/discovery/post-list';
import { DropdownFilter, QueryFilter } from '~/features/discovery/search-ui';
import { h } from '~/features/discovery/view-helpers';
import type { PageProps } from '~/contracts/pages';

export default function renderPage({
 meta, query, sort, tags, searchText, path, preserve, checkedPage, pages
}: PageProps['tags']): string {
  return PageLayout({
 meta,
children: h('div', { className: 'mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 sm:py-12' },
        h('header', { className: 'mb-10 text-center' },
          h('h1', { className: 'mb-3 text-3xl font-bold tracking-tight text-content sm:text-4xl' }, '태그 클라우드'),
          h('p', { className: 'text-content-secondary' }, '전체 태그와 태그별 포스트를 확인할 수 있습니다')
        ),
        h('div', { className: 'mb-12 flex flex-col items-end justify-between gap-6 sm:flex-row sm:items-center' },
          h('div', { className: 'w-full sm:max-w-md sm:flex-1' },
            h('label', {
 htmlFor: 'tag-query',
className: 'mb-2 ml-1 block text-xs font-bold uppercase tracking-wider text-content-secondary'
}, '태그 검색'),
            QueryFilter({
 path: '/tags',
search: query,
placeholder: '검색어를 입력하세요.',
id: 'tag-query'
})
          ),
          h('div', { className: 'w-full sm:w-auto' },
            h('p', { className: 'mb-2 ml-1 block text-xs font-bold uppercase tracking-wider text-content-secondary' }, '정렬 방식'),
            DropdownFilter({
 path: '/tags',
search: query,
param: 'sort',
current: sort,
options: [
              {
 value: 'popular',
label: '인기순'
},
              {
 value: 'name',
label: '이름순'
},
              {
 value: 'recent',
label: '최신순'
}
            ]
})
          )
        ),
        tags.length ? h('div', { className: 'grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 md:grid-cols-3 lg:grid-cols-4' }, ...tags.map((tag) =>
          h('a', {
 className: 'group block rounded-2xl border border-line-light bg-surface-elevated p-6 transition-all duration-150 hover:ring-1 hover:ring-line/60 active:scale-[0.98]',
key: tag.id,
href: `/tag/${encodeURIComponent(tag.name)}`
},
            h('div', { className: 'flex h-full flex-col' },
              h('div', { className: 'mb-4 flex items-center justify-between' },
                h('span', { className: 'flex size-8 items-center justify-center rounded-full bg-surface-subtle text-content-hint transition-colors duration-300 group-hover:bg-action group-hover:text-content-inverted' },
                  h(SiteIcon, {
 name: 'hash',
className: 'text-sm'
})
                ),
                h('span', { className: 'rounded-md bg-surface-subtle px-2 py-1 text-xs font-bold text-content-hint transition-colors group-hover:bg-line-light' }, String(tag.count))
              ),
              h('h2', { className: 'mb-1 truncate text-lg font-bold text-content transition-colors duration-200 group-hover:text-content' }, tag.name),
              h('p', { className: 'line-clamp-2 text-sm text-content-secondary' }, `${tag.count.toLocaleString('ko-KR')}개 포스트에서 태그됨`)
            )
          )
        )) : EmptyState({
 title: '태그가 없습니다',
message: searchText ? '검색 조건에 맞는 태그가 없습니다.' : '포스트에 태그를 추가하면 여기에 표시됩니다.',
icon: 'tags',
framed: true
}),
        tags.length ? h('div', { className: 'mt-12' }, Pagination({
 path,
search: query,
preserve,
page: checkedPage,
pages
})) : null
      )
});
}
