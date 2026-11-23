import type { FastifyInstance } from 'fastify';
import type { Prisma, PrismaClient } from '@prisma/client';
import { SiteIcon } from '../../../appearance/icons.js';
import { publicPostWhere } from '../../posts/data/visibility.js';
import { readCardLikes, readPublicPostCount, readPublicPosts } from '../services/public-posts.js';
import { PAGE_SIZE, PublicPageOptions, TagRow, canonicalPageUrl, h, hasUnexpected, makeAbsolute, makePaginationMeta, pageFrom, sendNotFound, totalPages, validPublicPage } from '../shared.js';
import { PageLayout, getLayoutContext, renderHtml } from '../pages/layout.js';
import { EmptyState, Pagination, PostGrid } from '../pages/post-list.js';
import { DropdownFilter, QueryFilter, ReactFragment } from '../pages/search.js';
import { searchTerm } from '../../../platform/search-term.js';

export function registerTagsRoutes(app: FastifyInstance, db: PrismaClient, siteUrl: URL, options: PublicPageOptions = {}) {
  app.get('/tags', async (request, reply) => {
    const url = new URL(request.url, siteUrl);
    const query = url.searchParams;
    const page = pageFrom(query);
    if (page === null) return sendNotFound(reply);
    const searchText = searchTerm(query.get('q'));
    const requestedSort = query.get('sort') ?? 'popular';
    const sort = ['popular', 'name', 'recent'].includes(requestedSort) ? requestedSort : 'popular';
    const { brand, siteName, viewer } = await getLayoutContext(request, reply, db, options);
    const postFilter = publicPostWhere();
    const where: Prisma.TagWhereInput = { posts: { some: postFilter }, ...(searchText ? { name: { contains: searchText } } : {}) };
    const count = await db.tag.count({ where });
    const checkedPage = validPublicPage(reply, page, count, 50);
    if (checkedPage === null) return reply;
    const offset = (checkedPage - 1) * 50;
    // Popularity counts only public posts, which Prisma cannot sort by, so that order is built from the short tag list.
    const rows = await db.tag.findMany({
      where,
      ...(sort === 'popular' ? {} : { orderBy: sort === 'name' ? { name: 'asc' as const } : { id: 'desc' as const }, skip: offset, take: 50 }),
      select: { id: true, name: true, _count: { select: { posts: { where: postFilter } } } },
    });
    const ordered = sort === 'popular'
      ? rows.sort((left, right) => right._count.posts - left._count.posts || Buffer.compare(Buffer.from(left.name), Buffer.from(right.name))).slice(offset, offset + 50)
      : rows;
    const tags: TagRow[] = ordered.map((tag) => ({ id: tag.id, name: tag.name, count: tag._count.posts }));
    const pages = totalPages(count, 50);
    const path = '/tags';
    const noindex = hasUnexpected(query, ['page', 'q', 'sort']) || searchText.length > 0 || requestedSort !== 'popular';
    const canonical = noindex ? makeAbsolute(siteUrl, path) : canonicalPageUrl(siteUrl, path, checkedPage);
    const preserve = ['q', 'sort'];
    return renderHtml(reply, PageLayout({
      meta: {
        title: `${siteName} - 태그`,
        description: '태그를 살펴보고 관심 있는 주제의 글을 찾아보세요.',
        canonical,
        siteName,
        brand,
        viewer,
        robots: noindex ? 'noindex,follow' : undefined,
        ...makePaginationMeta(siteUrl, path, query, preserve, checkedPage, pages),
      },
      children: h('div', { className: 'mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 sm:py-12' },
        h('header', { className: 'mb-10 text-center' },
          h('h1', { className: 'mb-3 text-3xl font-bold tracking-tight text-content sm:text-4xl' }, '태그 클라우드'),
          h('p', { className: 'text-content-secondary' }, '전체 태그와 태그별 포스트를 확인할 수 있습니다'),
        ),
        h('div', { className: 'mb-12 flex flex-col items-end justify-between gap-6 sm:flex-row sm:items-center' },
          h('div', { className: 'w-full sm:max-w-md sm:flex-1' },
            h('label', { htmlFor: 'tag-query', className: 'mb-2 ml-1 block text-xs font-bold uppercase tracking-wider text-content-secondary' }, '태그 검색'),
            QueryFilter({ path: '/tags', search: query, placeholder: '검색어를 입력하세요.', id: 'tag-query' }),
          ),
          h('div', { className: 'w-full sm:w-auto' },
            h('p', { className: 'mb-2 ml-1 block text-xs font-bold uppercase tracking-wider text-content-secondary' }, '정렬 방식'),
            DropdownFilter({ path: '/tags', search: query, param: 'sort', current: sort, options: [
              { value: 'popular', label: '인기순' },
              { value: 'name', label: '이름순' },
              { value: 'recent', label: '최신순' },
            ] }),
          ),
        ),
        tags.length ? h('div', { className: 'grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 md:grid-cols-3 lg:grid-cols-4' }, ...tags.map((tag) =>
          h('a', { className: 'group block rounded-2xl border border-line-light bg-surface-elevated p-6 transition-all duration-150 hover:ring-1 hover:ring-line/60 active:scale-[0.98]', key: tag.id, href: `/tag/${encodeURIComponent(tag.name)}` },
            h('div', { className: 'flex h-full flex-col' },
              h('div', { className: 'mb-4 flex items-center justify-between' },
                h('span', { className: 'flex size-8 items-center justify-center rounded-full bg-surface-subtle text-content-hint transition-colors duration-300 group-hover:bg-action group-hover:text-content-inverted' },
                  h(SiteIcon, { name: 'hash', className: 'text-sm' }),
                ),
                h('span', { className: 'rounded-md bg-surface-subtle px-2 py-1 text-xs font-bold text-content-hint transition-colors group-hover:bg-line-light' }, String(tag.count)),
              ),
              h('h2', { className: 'mb-1 truncate text-lg font-bold text-content transition-colors duration-200 group-hover:text-content' }, tag.name),
              h('p', { className: 'line-clamp-2 text-sm text-content-secondary' }, `${tag.count.toLocaleString('ko-KR')}개 포스트에서 태그됨`),
            ),
          ),
        )) : EmptyState({ title: '태그가 없습니다', message: searchText ? '검색 조건에 맞는 태그가 없습니다.' : '포스트에 태그를 추가하면 여기에 표시됩니다.', icon: 'tags', framed: true }),
        tags.length ? h('div', { className: 'mt-12' }, Pagination({ path, search: query, preserve, page: checkedPage, pages })) : null,
      ),
    }));
  });

  app.get<{ Params: { name: string } }>('/tag/:name', async (request, reply) => {
    const url = new URL(request.url, siteUrl);
    const query = url.searchParams;
    const page = pageFrom(query);
    if (page === null) return sendNotFound(reply);
    const tagName = request.params.name;
    const tagged: Prisma.PostWhereInput = { tags: { some: { name: tagName } } };
    const count = await readPublicPostCount(db, tagged);
    if (count === 0) return sendNotFound(reply);
    const checkedPage = validPublicPage(reply, page, count, PAGE_SIZE);
    if (checkedPage === null) return reply;
    const posts = await readPublicPosts(db, {
      where: tagged,
      limit: PAGE_SIZE,
      offset: (checkedPage - 1) * PAGE_SIZE,
    });
    const { brand, siteName, viewer } = await getLayoutContext(request, reply, db, options);
    const pages = totalPages(count, PAGE_SIZE);
    const path = `/tag/${encodeURIComponent(tagName)}`;
    const likes = await readCardLikes(db, request, viewer, posts);
    const noindex = hasUnexpected(query, ['page']);
    return renderHtml(reply, PageLayout({
      meta: {
        title: `${siteName} - #${tagName}`,
        description: `#${tagName} 태그가 붙은 공개 글을 읽어보세요.`,
        canonical: noindex ? makeAbsolute(siteUrl, path) : canonicalPageUrl(siteUrl, path, checkedPage),
        siteName,
        brand,
        viewer,
        robots: noindex ? 'noindex,follow' : undefined,
        ...makePaginationMeta(siteUrl, path, query, [], checkedPage, pages),
      },
      children: h('div', { className: 'mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 sm:py-12' },
        h('nav', { className: 'mb-8' },
          h('a', { href: '/tags', className: 'group inline-flex items-center text-sm font-medium text-content-secondary transition-colors duration-200 hover:text-content' },
            h(SiteIcon, { name: 'arrow-left', className: 'mr-2 text-xs transition-transform duration-200 group-hover:-translate-x-0.5' }), '전체 태그',
          ),
        ),
        h('header', { className: 'mb-12 text-center sm:mb-16' }, h('h1', { className: 'mb-4 text-3xl font-bold tracking-tight text-content' }, tagName)),
        posts.length ? h(ReactFragment, null,
          PostGrid({ posts, likes }),
          h('div', { className: 'mt-16 mb-8' }, Pagination({ path, search: query, preserve: [], page: checkedPage, pages })),
        ) : EmptyState({ title: '포스트가 없습니다', message: `#${tagName} 태그로 작성된 포스트가 아직 없습니다.`, icon: 'hash', framed: true }),
      ),
    }));
  });
}
