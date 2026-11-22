import type { FastifyInstance } from 'fastify';
import { type PrismaClient } from '@prisma/client';
import { SiteIcon } from '../../../appearance/icons.js';
import { sanitizePostHtml } from '../../posts/post-html.js';
import { readCardLikes, readPublicPostCount, readPublicPosts } from '../services/public-posts.js';
import { PAGE_SIZE, PageMeta, PublicPageOptions, StaticPageRow, canonicalPageUrl, description, h, hasUnexpected, makeAbsolute, makePaginationMeta, pageFrom, safeStructuredPageData, sendNotFound, staticPageStyles, totalPages, validPublicPage } from '../shared.js';
import { NoticeSection, PageLayout, advertiseMarkdown, csrfCookie, getLayoutContext, readNotices, readPublicSiteBrand, readViewer, renderHtml } from '../pages/layout.js';
import { EmptyState, Pagination, PostGrid } from '../pages/post-list.js';
import { ReactFragment } from '../pages/search.js';

export function registerHomeRoutes(app: FastifyInstance, db: PrismaClient, siteUrl: URL, options: PublicPageOptions = {}) {
  app.get('/', async (request, reply) => {
    if (await options.requiresSetup?.()) return reply.redirect('/setup', 302);
    const url = new URL(request.url, siteUrl);
    const query = url.searchParams;
    const page = pageFrom(query);
    if (page === null) return sendNotFound(reply);

    const brand = await readPublicSiteBrand(db);
    const siteName = brand.siteName;
    const count = await readPublicPostCount(db);
    const checkedPage = validPublicPage(reply, page, count, PAGE_SIZE);
    if (checkedPage === null) return reply;
    const posts = await readPublicPosts(db, { limit: PAGE_SIZE, offset: (checkedPage - 1) * PAGE_SIZE });
    const pages = totalPages(count, PAGE_SIZE);
    const path = '/';
    const noindex = hasUnexpected(query, ['page']);
    const canonical = noindex ? makeAbsolute(siteUrl, path) : canonicalPageUrl(siteUrl, path, checkedPage);
    const viewer = await readViewer(request, reply, options);
    reply.header('Vary', 'Cookie');
    const [globalNotices, likes] = await Promise.all([readNotices(db, 'global'), readCardLikes(db, request, viewer, posts)]);
    const meta: PageMeta = {
      title: `${siteName} - 최신 포스트`,
      description: `${siteName}에 공개된 최신 글을 둘러보세요.`,
      canonical,
      siteName,
      brand,
      viewer,
      robots: noindex ? 'noindex,follow' : undefined,
      ...makePaginationMeta(siteUrl, path, query, [], checkedPage, pages),
    };
    return renderHtml(reply, PageLayout({
      meta,
      children: h(ReactFragment, null,
        h('div', { className: 'mx-auto mt-6 max-w-7xl px-4 md:px-6' },
          h('h1', { className: 'sr-only' }, '최신 포스트'),
          viewer ? h('div', { className: 'mb-6 flex justify-end' },
            h('a', { href: '/interests', className: 'inline-flex items-center gap-2 rounded-full bg-surface px-4 py-2 text-sm font-semibold text-content-secondary ring-1 ring-line/60 transition-colors duration-150 hover:bg-surface-subtle hover:text-content' },
              h(SiteIcon, { name: 'heart', className: 'text-xs text-content-hint' }),
              h('span', null, '관심 포스트'),
            ),
          ) : null,
          NoticeSection({ notices: globalNotices, scope: 'global' }),
          posts.length
            ? h(ReactFragment, null,
              PostGrid({ posts, className: 'mb-16 gap-6', likes, relativeDate: true }),
              h('div', { className: 'mt-16 mb-12' }, Pagination({ path, search: query, preserve: [], page: checkedPage, pages })),
            )
            : EmptyState({
              title: '아직 포스트가 없어요',
              message: '공개된 포스트가 발행되면 이곳에 표시됩니다.',
              icon: 'writing',
              actionUrl: viewer?.hasEditorRole ? '/write' : undefined,
              actionLabel: viewer?.hasEditorRole ? '포스트 작성하기' : undefined,
              actionIcon: viewer?.hasEditorRole ? 'edit' : undefined,
            }),
        ),
      ),
    }));
  });

  app.get('/interests', async (request, reply) => {
    const viewer = await options.currentUser?.(request);
    if (!viewer) return reply.redirect(`/login?${new URLSearchParams({ next: request.url })}`, 302);
    const path = '/interests';
    const query = new URL(request.url, siteUrl).searchParams;
    const page = pageFrom(query);
    if (page === null) return sendNotFound(reply);
    const conditions = ['EXISTS(SELECT 1 FROM board_post_likes AS likes WHERE likes.post_id = post.id AND likes.user_id = ?)'];
    const parameters = [viewer.id];
    const count = await readPublicPostCount(db, conditions, parameters);
    const checkedPage = validPublicPage(reply, page, count, PAGE_SIZE);
    if (checkedPage === null) return reply;
    const brand = await readPublicSiteBrand(db);
    const siteName = brand.siteName;
    const posts = await readPublicPosts(db, { conditions, parameters, orderParameters: parameters, limit: PAGE_SIZE,
      orderBy: '(SELECT MAX(created_date) FROM board_post_likes WHERE post_id = post.id AND user_id = ?) DESC, post.published_date DESC',
      offset: (checkedPage - 1) * PAGE_SIZE });
    const pages = totalPages(count, PAGE_SIZE);
    reply.header('Cache-Control', 'private, no-store');
    return renderHtml(reply, PageLayout({
      meta: { title: `${siteName} - 관심 포스트`, description: '', canonical: makeAbsolute(siteUrl, path), siteName, brand, robots: 'noindex,nofollow', viewer },
      children: h('div', { className: 'mx-auto mt-6 max-w-7xl px-4 md:px-6' },
        h('div', { className: 'mb-6 flex justify-end' },
          h('a', { href: '/', className: 'inline-flex items-center gap-2 rounded-full bg-surface px-4 py-2 text-sm font-semibold text-content-secondary ring-1 ring-line/60 transition-colors hover:bg-surface-subtle hover:text-content' },
            h(SiteIcon, { name: 'arrow-left', className: 'text-xs text-content-hint' }), '전체 포스트'),
        ),
        h('header', { className: 'mb-8' },
          h('p', { className: 'mb-2 text-sm font-semibold text-action' }, '내가 다시 보고 싶은 포스트'),
          h('h1', { className: 'text-3xl font-bold tracking-tight text-content md:text-4xl' }, '관심 포스트'),
          h('p', { className: 'mt-3 max-w-2xl leading-relaxed text-content-secondary' }, '추천으로 관심 표시한 포스트를 최신 관심순으로 모아볼 수 있어요.'),
        ),
        posts.length ? h(ReactFragment, null,
          PostGrid({ posts, className: 'mb-16 gap-6', relativeDate: true, likes: {
            csrfToken: csrfCookie(request), returnTo: path, likedIds: new Set(posts.map((post) => post.id)),
          } }),
          h('div', { className: 'mt-16 mb-12' }, Pagination({ path, search: query, preserve: [], page: checkedPage, pages })),
        ) : EmptyState({ title: '아직 관심 포스트가 없어요', message: '추천 버튼을 눌러둔 포스트가 여기에 모입니다.', icon: 'heart', actionUrl: '/', actionLabel: '포스트 둘러보기', actionIcon: 'compass' }),
      ),
    }));
  });

  app.get<{ Params: { slug: string } }>('/static/:slug', async (request, reply) => {
    const slug = request.params.slug;
    if (slug.endsWith('.md')) return sendNotFound(reply);
    const [page] = await db.$queryRaw<StaticPageRow[]>`
      SELECT page.title AS title,
             page.content AS content,
             page.meta_description AS metaDescription,
             CAST(page.created_date AS TEXT) AS createdDate,
             CAST(page.updated_date AS TEXT) AS updatedDate,
             author.username AS authorUsername
        FROM board_staticpage AS page
        LEFT JOIN auth_user AS author ON author.id = page.author_id
       WHERE page.slug = ${slug} AND COALESCE(page.is_published, 0) = 1
       LIMIT 1
    `;
    if (!page) return sendNotFound(reply);
    const { brand, siteName, viewer } = await getLayoutContext(request, reply, db, options);
    const path = `/static/${encodeURIComponent(slug)}`;
    const canonical = makeAbsolute(siteUrl, path);
    const metaDescription = description(page.metaDescription || page.content, page.title);
    const structuredData = safeStructuredPageData(
      siteName,
      canonical,
      page.title,
      metaDescription,
      page.createdDate,
      page.updatedDate,
      page.authorUsername,
      siteUrl,
    );
    const pageMarkdown = await advertiseMarkdown(reply, db, siteUrl, path);
    return renderHtml(reply, PageLayout({
      meta: {
        markdownUrl: pageMarkdown,
        title: `${page.title} - ${siteName}`,
        description: metaDescription,
        canonical,
        siteName,
        brand,
        viewer,
        structuredData,
      },
      children: h('article', { className: 'rich-content' },
        h('div', { dangerouslySetInnerHTML: { __html: `${staticPageStyles(page.content)}${sanitizePostHtml(page.content)}` } }),
      ),
    }));
  });
}
