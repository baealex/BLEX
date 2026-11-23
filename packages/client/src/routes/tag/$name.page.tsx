import { SiteIcon } from '~/appearance/icons';
import { PageLayout } from '~/features/discovery/layout';
import { EmptyState, Pagination, PostGrid } from '~/features/discovery/post-list';
import { ReactFragment } from '~/features/discovery/search-ui';
import { h } from '~/features/discovery/view-helpers';
import type { PageProps } from '~/contracts/pages';

export default function renderPage({
 meta, tagName, posts, likes, path, query, checkedPage, pages
}: PageProps['tag/$name']): string {
  return PageLayout({
 meta,
children: h('div', { className: 'mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 sm:py-12' },
        h('nav', { className: 'mb-8' },
          h('a', {
 href: '/tags',
className: 'group inline-flex items-center text-sm font-medium text-content-secondary transition-colors duration-200 hover:text-content'
},
            h(SiteIcon, {
 name: 'arrow-left',
className: 'mr-2 text-xs transition-transform duration-200 group-hover:-translate-x-0.5'
}), '전체 태그'
          )
        ),
        h('header', { className: 'mb-12 text-center sm:mb-16' }, h('h1', { className: 'mb-4 text-3xl font-bold tracking-tight text-content' }, tagName)),
        posts.length ? h(ReactFragment, null,
          PostGrid({
 posts,
likes
}),
          h('div', { className: 'mt-16 mb-8' }, Pagination({
 path,
search: query,
preserve: [],
page: checkedPage,
pages
}))
        ) : EmptyState({
 title: '포스트가 없습니다',
message: `#${tagName} 태그로 작성된 포스트가 아직 없습니다.`,
icon: 'hash',
framed: true
})
      )
});
}
