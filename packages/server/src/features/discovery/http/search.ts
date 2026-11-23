import { renderPage } from '../../../platform/views.js';
import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import { rankPublicSearch, readSearchPage } from '../services/public-posts.js';
import {
  type PostRow,
  type PublicPageOptions,
  dateValue,
  makeAbsolute,
  makePaginationMeta,
  pageFrom,
  sendNotFound,
  totalPages,
  validPublicPage,
} from '../shared.js';
import { getLayoutContext, renderHtml } from '../page-context.js';
import { searchTerm } from '../../../platform/search-term.js';

export function registerSearchRoutes(
  app: FastifyInstance,
  db: PrismaClient,
  siteUrl: URL,
  options: PublicPageOptions = {},
) {
  app.get('/v1/search', async (request) => {
    const parameters = new URL(request.url, siteUrl).searchParams;
    const query = searchTerm(parameters.get('q'));
    const username = (parameters.get('username') ?? '').trim();
    const invalid = (key: string, errorMessage: string) => ({
      status: 'ERROR',
      errorCode: 'error:VA',
      errorMessage,
      messageKey: `search.validation.${key}`,
      messageParams: {},
    });
    if (!query) return invalid('query_required', '검색어를 입력하세요.');
    const rawPage = parameters.get('page') ?? '1';
    const page = Math.max(1, Number(rawPage));
    if (!/^[+-]?\d+$/.test(rawPage) || !Number.isSafeInteger(page))
      return invalid('invalid_page', '잘못된 페이지 번호입니다.');
    const started = performance.now();
    const ranked = await rankPublicSearch(db, query.split(/\s+/), username);
    const totalSize = ranked.length;
    const lastPage = totalPages(totalSize, 30);
    if (page > lastPage) return invalid('invalid_page', '잘못된 페이지 번호입니다.');
    const matches = await readSearchPage(db, ranked, 30, (page - 1) * 30);
    const fields = [
      ['titleScore', 'title', '제목'],
      ['descriptionScore', 'description', '설명'],
      ['tagScore', 'tag', '태그'],
      ['contentScore', 'content', '내용'],
    ] as const;
    const results = matches.map((post) => {
      const scored = fields.filter(([key]) => (post[key] ?? 0) > 0);
      const published = dateValue(post.publishedDate);
      const timeZone = process.env.TZ || 'Asia/Seoul';
      return {
        url: post.slug,
        title: post.title,
        image: post.image,
        description: post.description,
        readTime: post.readTime,
        createdDate: published
          ? new Intl.DateTimeFormat('ko-KR', { timeZone, dateStyle: 'long' }).format(new Date(published))
          : '',
        publishedDate: published
          ? new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(
              new Date(published),
            )
          : '',
        authorImage: post.authorAvatar,
        author: post.authorUsername,
        positions: scored.map(([, , label]) => label),
        matchedFields: scored.map(([, key]) => key),
      };
    });
    return {
      status: 'DONE',
      body: { elapsedTime: Math.round(performance.now() - started) / 1_000, totalSize, lastPage, query, results },
    };
  });

  app.get('/search', async (request, reply) => {
    const url = new URL(request.url, siteUrl);
    const query = url.searchParams;
    const searchText = searchTerm(query.get('q'));
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
    return renderHtml(
      reply,
      renderPage('search', {
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
        searchText,
        username,
        posts,
        count,
        checkedPage,
        pages,
      }),
    );
  });
}
