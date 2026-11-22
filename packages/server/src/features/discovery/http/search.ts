import type { FastifyInstance } from 'fastify';
import { type PrismaClient } from '@prisma/client';
import { rankPublicSearch, readSearchPage } from '../services/public-posts.js';
import { PostRow, PublicPageOptions, dateValue, h, makeAbsolute, makePaginationMeta, pageFrom, sendNotFound, totalPages, validPublicPage } from '../shared.js';
import { PageLayout, getLayoutContext, renderHtml } from '../pages/layout.js';
import { EmptyState } from '../pages/post-list.js';
import { SearchPagination, SearchResultCard, searchForm } from '../pages/search.js';

export function registerSearchRoutes(app: FastifyInstance, db: PrismaClient, siteUrl: URL, options: PublicPageOptions = {}) {
  app.get('/v1/search', async (request) => {
    const parameters = new URL(request.url, siteUrl).searchParams;
    const query = (parameters.get('q') ?? '').slice(0, 100).trim();
    const username = (parameters.get('username') ?? '').trim();
    const invalid = (key: string, errorMessage: string) => ({ status: 'ERROR', errorCode: 'error:VA', errorMessage,
      messageKey: `search.validation.${key}`, messageParams: {} });
    if (!query) return invalid('query_required', '검색어를 입력하세요.');
    const rawPage = parameters.get('page') ?? '1';
    const page = Math.max(1, Number(rawPage));
    if (!/^[+-]?\d+$/.test(rawPage) || !Number.isSafeInteger(page)) return invalid('invalid_page', '잘못된 페이지 번호입니다.');
    const started = performance.now();
    const ranked = await rankPublicSearch(db, query.split(/\s+/), username);
    const totalSize = ranked.length;
    const lastPage = totalPages(totalSize, 30);
    if (page > lastPage) return invalid('invalid_page', '잘못된 페이지 번호입니다.');
    const matches = await readSearchPage(db, ranked, 30, (page - 1) * 30);
    const fields = [['titleScore', 'title', '제목'], ['descriptionScore', 'description', '설명'],
      ['tagScore', 'tag', '태그'], ['contentScore', 'content', '내용']] as const;
    const results = matches.map((post) => {
      const scored = fields.filter(([key]) => Number(post[key]) > 0);
      const published = dateValue(post.publishedDate);
      const timeZone = process.env.TZ || 'Asia/Seoul';
      return { url: post.slug, title: post.title, image: post.image, description: post.description, readTime: post.readTime,
        createdDate: published ? new Intl.DateTimeFormat('ko-KR', { timeZone, dateStyle: 'long' }).format(new Date(published)) : '',
        publishedDate: published ? new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(published)) : '',
        authorImage: post.authorAvatar, author: post.authorUsername, positions: scored.map(([, , label]) => label),
        matchedFields: scored.map(([, key]) => key) };
    });
    return { status: 'DONE', body: { elapsedTime: Math.round(performance.now() - started) / 1_000, totalSize, lastPage, query, results } };
  });

  app.get('/search', async (request, reply) => {
    const url = new URL(request.url, siteUrl);
    const query = url.searchParams;
    const searchText = (query.get('q') ?? '').slice(0, 100).trim();
    const username = (query.get('username') ?? '').trim();
    const page = pageFrom(query);
    if (page === null) return sendNotFound(reply);
    const { brand, siteName, viewer } = await getLayoutContext(request, reply, db, options);
    let posts: PostRow[] = [];
    let count = 0;
    let checkedPage = page;
    if (searchText) {
      const keywords = searchText.split(/\s+/).filter(Boolean);
      const ranked = await rankPublicSearch(db, keywords, username);
      count = ranked.length;
      checkedPage = validPublicPage(reply, page, count, 30) ?? 0;
      if (checkedPage === 0) return reply;
      posts = await readSearchPage(db, ranked, 30, (checkedPage - 1) * 30);
    }
    const pages = totalPages(count, 30);
    const path = '/search';
    const noindex = true;
    return renderHtml(reply, PageLayout({
      meta: {
        title: searchText ? `검색: ${searchText} - ${siteName}` : `검색 - ${siteName}`,
        description: '제목, 설명, 태그, 본문에서 글을 검색합니다.',
        canonical: makeAbsolute(siteUrl, path),
        siteName,
        brand,
        viewer,
        searchPage: true,
        robots: 'noindex,follow',
        ...(!noindex && count ? makePaginationMeta(siteUrl, path, query, ['q', 'username'], checkedPage, pages) : {}),
      },
      children: h('div', { className: 'mx-auto w-full max-w-7xl space-y-6 px-4 py-8 sm:px-6 sm:py-12' },
        h('section', null,
          h('h1', { className: 'mb-4 text-2xl font-bold tracking-tight text-content sm:text-3xl' }, '포스트 검색'),
          searchForm(searchText, username),
        ),
        searchText
          ? posts.length
            ? h('section', { className: 'space-y-4' },
              h('div', { className: 'rounded-2xl border border-line bg-surface-subtle px-4 py-3' },
                h('h2', { className: 'text-lg font-semibold text-content' },
                  h('strong', { className: 'text-content' }, count.toLocaleString('ko-KR')), '개의 결과',
                  h('span', { className: 'ml-2 text-xs font-normal text-content-hint' }, `“${searchText}” 검색`),
                ),
              ),
              h('div', { className: 'space-y-4' }, ...posts.map((post) => SearchResultCard({ post, query: searchText }))),
              SearchPagination({ page: checkedPage, pages, query: searchText, username }),
            )
            : EmptyState({ title: '검색 결과가 없습니다', message: '다른 검색어 또는 작성자 이름으로 다시 검색해 보세요.', icon: 'search', framed: true })
          : EmptyState({ title: '무엇을 찾고 있나요?', message: '검색어를 입력하면 제목, 설명, 태그, 본문에서 공개 글을 찾습니다.', icon: 'search', framed: true }),
      ),
    }));
  });
}
