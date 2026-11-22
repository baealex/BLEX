import { renderToStaticMarkup } from 'react-dom/server';
import type { FastifyInstance } from 'fastify';
import type { Prisma, PrismaClient } from '@prisma/client';
import { SiteIcon } from '../../../appearance/icons.js';
import { storedDateText } from '../../../platform/date-format.js';
import { sanitizePostHtml } from '../../posts/post-html.js';
import { AuthorActivitySection, readAuthorActivity } from '../public-activity.js';
import { AboutSection, authorTabs, featuredPostsSection, profileHeader } from '../pages/profile.js';
import { authorPath, isEditor, readAuthor, readAuthorSocialLinks, subscriptionState } from '../services/profile.js';
import { publicPostWhere } from '../../posts/data/visibility.js';
import { readCardLikes, readFeaturedPosts, readPublicPostCount, readPublicPosts } from '../../discovery/services/public-posts.js';
import { PAGE_SIZE, PageMeta, PublicPageOptions, SeriesDetailRow, SeriesRow, SubscriptionState, avatarUrl, canonicalPageUrl, dateLabel, dateValue, description, formatPostDate, h, hasUnexpected, makeAbsolute, makePaginationMeta, pageFrom, sendNotFound, sendRedirect, totalPages, validPublicPage } from '../../discovery/shared.js';
import { NoticeSection, PageLayout, advertiseMarkdown, authorFeed, csrfCookie, getLayoutContext, readNotices, readPublicSiteBrand, readViewer, renderHtml } from '../../discovery/pages/layout.js';
import { EmptyState, Pagination, PostGrid, postPath } from '../../discovery/pages/post-list.js';
import { DropdownFilter, QueryFilter, ReactFragment } from '../../discovery/pages/search.js';

export function registerProfileRoutes(app: FastifyInstance, db: PrismaClient, siteUrl: URL, options: PublicPageOptions = {}) {
  app.get<{ Params: { username: string } }>('/@:username', async (request, reply) => {
    const requestedUsername = request.params.username;
    const author = await readAuthor(db, requestedUsername);
    if (!author) return sendNotFound(reply);
    if (author.username !== requestedUsername) return sendRedirect(reply, `${authorPath(author.username)}${new URL(request.url, siteUrl).search}`);
    const query = new URL(request.url, siteUrl).searchParams;
    const [brand, viewer] = await Promise.all([
      readPublicSiteBrand(db),
      readViewer(request, reply, options),
    ]);
    const siteName = brand.siteName;
    const [featured, socialLinks] = await Promise.all([
      readFeaturedPosts(db, author),
      readAuthorSocialLinks(db, author.id),
    ]);
    const isAuthorEditor = isEditor(author);
    const [userNotices, subscription] = isAuthorEditor
      ? await Promise.all([
        readNotices(db, 'user', author.id),
        subscriptionState(db, author, viewer),
      ])
      : [[], { canSubscribe: false, isSubscribed: false } as SubscriptionState];
    const noindex = hasUnexpected(query, []);
    const path = authorPath(author.username);
    const canonical = makeAbsolute(siteUrl, path);
    const aboutHtml = sanitizePostHtml(author.aboutHtml);
    const isOwner = viewer?.id === author.id;
    const activity = await readAuthorActivity(db, author.id);
    return renderHtml(reply, PageLayout({
      meta: {
        authorFeed: isEditor(author) ? authorFeed(siteUrl, author.username) : undefined,
        title: `${author.username} - ${siteName}`,
        description: description(author.bio || aboutHtml, `${author.username}의 공개 글과 소개를 확인해 보세요.`),
        canonical,
        siteName,
        brand,
        viewer,
        robots: noindex ? 'noindex,follow' : undefined,
      },
      children: h(ReactFragment, null,
        profileHeader(author, true, subscription, viewer, csrfCookie(request), socialLinks),
        authorTabs(author, 'overview'),
        h('div', { className: `${isAuthorEditor ? 'max-w-4xl' : 'max-w-7xl'} mx-auto mb-20 w-full px-4 sm:px-6` },
          h('div', { className: 'space-y-14' },
          isAuthorEditor ? NoticeSection({ notices: userNotices, scope: 'user' }) : null,
          AboutSection({ author, aboutHtml, isOwner }),
          isAuthorEditor ? featuredPostsSection(author, featured, viewer?.id === author.id) : null,
          h(AuthorActivitySection, activity),
          ),
        ),
      ),
    }));
  });

  app.get<{ Params: { username: string } }>('/@:username/partials/featured-posts', async (request, reply) => {
    const author = await readAuthor(db, request.params.username);
    if (!author || author.username !== request.params.username) return sendNotFound(reply);
    const headers = reply.header('Cache-Control', 'no-store').header('X-Robots-Tag', 'noindex');
    if (!isEditor(author)) return headers.code(204).send();
    const viewer = await readViewer(request, headers, options);
    const featured = await readFeaturedPosts(db, author);
    const content = renderToStaticMarkup(featuredPostsSection(author, featured, viewer?.id === author.id));
    return headers.type('text/html; charset=utf-8').send(content);
  });

  app.get<{ Params: { username: string } }>('/@:username/about/edit', async (request, reply) => {
    if (!options.currentUser) return sendNotFound(reply);
    const viewer = await readViewer(request, reply, options);
    if (!viewer) return reply.redirect(`/login?${new URLSearchParams({ next: new URL(request.url, siteUrl).pathname })}`, 302);
    const author = await readAuthor(db, request.params.username);
    if (!author) return sendNotFound(reply);
    if (author.id !== viewer.id) return reply.code(403).type('text/plain; charset=utf-8').send('접근 권한이 없습니다.');
    const [brand, socialLinks, subscription] = await Promise.all([
      readPublicSiteBrand(db), readAuthorSocialLinks(db, author.id), subscriptionState(db, author, viewer),
    ]);
    const path = `${authorPath(author.username)}/about/edit`;
    return renderHtml(reply, PageLayout({
      meta: {
        title: `${author.username}님의 소개글 수정 - ${brand.siteName}`,
        description: '자신을 소개하는 글을 작성해 보세요.',
        canonical: makeAbsolute(siteUrl, path),
        siteName: brand.siteName,
        brand,
        viewer,
        robots: 'noindex,nofollow',
      },
      children: h(ReactFragment, null,
        profileHeader(author, false, subscription, viewer, csrfCookie(request), socialLinks, path),
        h('div', { className: 'mx-auto w-full max-w-5xl px-4 sm:px-6' },
          authorTabs(author, 'about'),
          h('div', { className: 'mb-8' },
            h('div', { className: 'mb-6' },
              h('h1', { className: 'mb-3 text-lg font-bold text-content' }, '자신을 소개해 보세요.'),
              h('p', { className: 'text-md text-content-secondary' }, '자신을 소개하는 글을 작성해 보세요.'),
            ),
            h('div', { className: 'mb-6', 'data-about-page': '', 'data-about-url': path, 'data-about-return': authorPath(author.username) },
              h('textarea', { 'data-about-input': '', defaultValue: author.aboutMarkdown ?? '', placeholder: '마크다운으로 작성해 보세요.', 'aria-label': '소개',
                className: 'h-64 w-full rounded-lg border border-line p-4 focus:outline-none focus:ring-2 focus:ring-line-strong/70' }),
              h('button', { type: 'button', 'data-about-save': '', className: 'mt-4 rounded-lg bg-action px-6 py-3 text-content-inverted hover:bg-action-hover focus:outline-none focus:ring-2 focus:ring-line-strong/70 focus:ring-offset-2 disabled:opacity-50' }, '저장'),
              h('div', { 'data-about-message': '', hidden: true, className: 'mt-4 text-sm' }),
            ),
          ),
        ),
      ),
    }));
  });

  app.get<{ Params: { username: string } }>('/@:username/about', async (request, reply) => {
    const author = await readAuthor(db, request.params.username);
    if (!author) return sendNotFound(reply);
    return sendRedirect(reply, authorPath(author.username));
  });

  app.get<{ Params: { username: string } }>('/@:username/posts', async (request, reply) => {
    const requestedUsername = request.params.username;
    const author = await readAuthor(db, requestedUsername);
    if (!author) return sendNotFound(reply);
    if (author.username !== requestedUsername) return sendRedirect(reply, `${authorPath(author.username, '/posts')}${new URL(request.url, siteUrl).search}`);
    if (!isEditor(author)) return sendRedirect(reply, authorPath(author.username, '/about'));

    const url = new URL(request.url, siteUrl);
    const query = url.searchParams;
    const page = pageFrom(query);
    if (page === null) return sendNotFound(reply);
    const searchText = (query.get('q') ?? '').trim();
    const tagFilter = (query.get('tag') ?? '').trim();
    const where: Prisma.PostWhereInput = {
      authorId: author.id,
      ...(searchText ? { OR: [{ title: { contains: searchText } }, { content: { html: { contains: searchText } } }] } : {}),
      ...(tagFilter ? { tags: { some: { name: tagFilter } } } : {}),
    };
    const count = await readPublicPostCount(db, where);
    const checkedPage = validPublicPage(reply, page, count, PAGE_SIZE);
    if (checkedPage === null) return reply;
    const posts = await readPublicPosts(db, {
      where,
      limit: PAGE_SIZE,
      offset: (checkedPage - 1) * PAGE_SIZE,
    });
    const tagOptions = await db.tag.findMany({
      where: { posts: { some: { authorId: author.id, ...publicPostWhere() } } },
      orderBy: { name: 'asc' },
      select: { name: true },
    });
    const { brand, siteName, viewer } = await getLayoutContext(request, reply, db, options);
    const [socialLinks, subscription] = await Promise.all([readAuthorSocialLinks(db, author.id), subscriptionState(db, author, viewer)]);
    const pages = totalPages(count, PAGE_SIZE);
    const path = authorPath(author.username, '/posts');
    const likes = await readCardLikes(db, request, viewer, posts);
    const noindex = hasUnexpected(query, ['page', 'q', 'tag']) || Boolean(searchText || tagFilter);
    const meta: PageMeta = {
      authorFeed: authorFeed(siteUrl, author.username),
      title: `포스트 - ${author.username} | ${siteName}`,
      description: `${author.username}님이 공개한 글을 모아봅니다.`,
      canonical: noindex ? makeAbsolute(siteUrl, path) : canonicalPageUrl(siteUrl, path, checkedPage),
      siteName,
      brand,
      viewer,
      robots: noindex ? 'noindex,follow' : undefined,
      ...makePaginationMeta(siteUrl, path, query, ['q', 'tag'], checkedPage, pages),
    };
    return renderHtml(reply, PageLayout({
      meta,
      children: h(ReactFragment, null,
        profileHeader(author, false, subscription, viewer, csrfCookie(request), socialLinks, path),
        authorTabs(author, 'posts'),
        h('section', { className: 'mx-auto w-full max-w-6xl px-4 sm:px-6' },
          h('div', { className: 'mb-8' }, h('h1', { className: 'text-3xl font-bold tracking-tight text-content' }, '포스트')),
          h('div', { className: 'mb-12 rounded-2xl bg-surface p-4 ring-1 ring-line/60' },
            h('div', { className: 'flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between' },
              h('div', { className: 'w-full lg:max-w-md' },
                h('label', { htmlFor: 'author-post-query', className: 'mb-2 ml-1 block text-xs font-semibold text-content-secondary' }, '검색'),
                QueryFilter({ path, search: query, placeholder: '포스트 검색', id: 'author-post-query' }),
              ),
              h('div', { className: 'w-full lg:w-44' },
                h('p', { className: 'mb-2 ml-1 block text-xs font-semibold text-content-secondary' }, '태그'),
                DropdownFilter({ path, search: query, param: 'tag', current: tagFilter,
                  options: [{ value: '', label: '전체 태그' }, ...tagOptions.map((tag) => ({ value: tag.name, label: tag.name }))] }),
              ),
            ),
          ),
          h('div', { className: 'grid grid-cols-1 gap-8 md:grid-cols-3' },
            h('div', { className: 'md:col-span-3' },
              posts.length ? PostGrid({ posts, showAuthor: false, likes, relativeDate: true }) : EmptyState({
                title: searchText || tagFilter ? '조건에 맞는 포스트가 없습니다' : '아직 공개된 포스트가 없습니다.',
                message: searchText || tagFilter ? '검색어나 태그를 다시 확인해주세요.' : '새 포스트가 발행되면 이곳에 표시됩니다.',
                icon: 'file-text',
              }),
              h('div', { className: 'mt-12 mb-12' }, Pagination({ path, search: query, preserve: ['q', 'tag'], page: checkedPage, pages })),
            ),
          ),
        ),
      ),
    }));
  });

  app.get<{ Params: { username: string } }>('/@:username/series', async (request, reply) => {
    const requestedUsername = request.params.username;
    const author = await readAuthor(db, requestedUsername);
    if (!author) return sendNotFound(reply);
    if (author.username !== requestedUsername) return sendRedirect(reply, `${authorPath(author.username, '/series')}${new URL(request.url, siteUrl).search}`);
    if (!isEditor(author)) return sendRedirect(reply, authorPath(author.username, '/about'));

    const url = new URL(request.url, siteUrl);
    const query = url.searchParams;
    const page = pageFrom(query);
    if (page === null) return sendNotFound(reply);
    const searchText = (query.get('q') ?? '').trim();
    const requestedSort = query.get('sort') ?? 'custom';
    const sort = ['custom', 'newest', 'oldest', 'posts'].includes(requestedSort) ? requestedSort : 'custom';
    const publicPost = publicPostWhere();
    const seriesWhere: Prisma.SeriesWhereInput = {
      ownerId: author.id,
      isHidden: false,
      posts: { some: publicPost },
      ...(searchText ? { OR: [{ name: { contains: searchText } }, { descriptionMarkdown: { contains: searchText } }] } : {}),
    };
    const count = await db.series.count({ where: seriesWhere });
    const checkedPage = validPublicPage(reply, page, count, 12);
    if (checkedPage === null) return reply;
    // One author's series are few, and "most posts" counts only public posts, which Prisma cannot sort by.
    const authorSeries = await db.series.findMany({
      where: seriesWhere,
      select: {
        id: true, slug: true, name: true, descriptionMarkdown: true, descriptionHtml: true, order: true, createdAt: true, updatedAt: true,
        _count: { select: { posts: { where: publicPost } } },
      },
    });
    const seriesOrder: Record<string, (left: typeof authorSeries[number], right: typeof authorSeries[number]) => number> = {
      newest: (left, right) => right.createdAt.valueOf() - left.createdAt.valueOf() || right.id - left.id,
      oldest: (left, right) => left.createdAt.valueOf() - right.createdAt.valueOf() || left.id - right.id,
      posts: (left, right) => right._count.posts - left._count.posts || left.order - right.order || left.id - right.id,
      custom: (left, right) => left.order - right.order || left.id - right.id,
    };
    const seriesRows: SeriesRow[] = authorSeries.sort(seriesOrder[sort]).slice((checkedPage - 1) * 12, checkedPage * 12).map((row) => ({
      id: row.id, url: row.slug, name: row.name, textMarkdown: row.descriptionMarkdown, textHtml: row.descriptionHtml,
      createdDate: storedDateText(row.createdAt), updatedDate: storedDateText(row.updatedAt), postCount: row._count.posts,
    }));
    const { brand, siteName, viewer } = await getLayoutContext(request, reply, db, options);
    const [socialLinks, subscription] = await Promise.all([readAuthorSocialLinks(db, author.id), subscriptionState(db, author, viewer)]);
    const pages = totalPages(count, 12);
    const path = authorPath(author.username, '/series');
    const noindex = hasUnexpected(query, ['page', 'q', 'sort']) || Boolean(searchText) || requestedSort !== 'custom';
    return renderHtml(reply, PageLayout({
      meta: {
        authorFeed: authorFeed(siteUrl, author.username),
        title: `${author.username}님의 시리즈 - ${siteName}`,
        description: `${author.username}님이 공개한 시리즈를 둘러보세요.`,
        canonical: noindex ? makeAbsolute(siteUrl, path) : canonicalPageUrl(siteUrl, path, checkedPage),
        siteName,
        brand,
        viewer,
        robots: noindex ? 'noindex,follow' : undefined,
        ...makePaginationMeta(siteUrl, path, query, ['q', 'sort'], checkedPage, pages),
      },
      children: h(ReactFragment, null,
        profileHeader(author, false, subscription, viewer, csrfCookie(request), socialLinks, path),
        authorTabs(author, 'series'),
        h('section', { className: 'mx-auto w-full max-w-6xl px-4 sm:px-6' },
          h('div', { className: 'mb-8' }, h('h1', { className: 'text-3xl font-bold tracking-tight text-content' }, '시리즈')),
          h('div', { className: 'mb-12 rounded-2xl bg-surface p-4 ring-1 ring-line/60' },
            h('div', { className: 'flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between' },
              h('div', { className: 'w-full lg:max-w-md' },
                h('label', { htmlFor: 'author-series-query', className: 'mb-2 ml-1 block text-xs font-semibold text-content-secondary' }, '검색'),
                QueryFilter({ path, search: query, placeholder: '시리즈 검색', id: 'author-series-query' }),
              ),
              h('div', { className: 'w-full lg:w-44' },
                h('p', { className: 'mb-2 ml-1 block text-xs font-semibold text-content-secondary' }, '정렬'),
                DropdownFilter({ path, search: query, param: 'sort', current: sort, options: [
                  { value: 'custom', label: '작가 지정 순' },
                  { value: 'newest', label: '최신순' },
                  { value: 'oldest', label: '오래된순' },
                  { value: 'posts', label: '포스트 많은 순' },
                ] }),
              ),
            ),
          ),
          h('div', { className: 'grid grid-cols-1 gap-8 md:grid-cols-3' },
            h('div', { className: 'md:col-span-3' },
              seriesRows.length ? h('div', { className: 'grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3' }, ...seriesRows.map((series) =>
                h('a', { className: 'group block overflow-hidden rounded-2xl bg-surface ring-1 ring-line/60 transition-all duration-150 hover:ring-line-strong/70 active:scale-[0.98]', key: series.id, href: `${authorPath(author.username, '/series')}/${encodeURIComponent(series.url)}` },
                  h('div', { className: 'flex h-full flex-col p-5' },
                    h('h2', { className: 'mb-2.5 line-clamp-2 text-lg font-bold leading-snug text-content transition-colors group-hover:text-content-secondary' }, series.name),
                    h('p', { className: 'mb-4 line-clamp-3 text-sm leading-relaxed text-content-secondary' }, series.textMarkdown),
                    h('div', { className: 'mt-auto flex items-center justify-between border-t border-line-light pt-4 text-xs font-medium text-content-secondary' },
                      h('span', { className: 'flex items-center gap-1.5' }, h(SiteIcon, { name: 'file-text', className: 'text-content-hint' }), `${series.postCount}개 포스트`),
                      h('span', { className: 'flex items-center gap-1.5' }, h(SiteIcon, { name: 'clock', className: 'text-content-hint' }), h('time', { dateTime: dateValue(series.updatedDate) ?? undefined }, dateLabel(series.updatedDate))),
                    ),
                  ),
                ),
              )) : EmptyState({
                title: searchText ? '조건에 맞는 시리즈가 없습니다' : '아직 공개된 시리즈가 없습니다',
                message: searchText ? '검색어를 다시 확인해주세요.' : '시리즈가 공개되면 이곳에 표시됩니다.',
                icon: 'stack-2',
              }),
              seriesRows.length ? h('div', { className: 'mt-12 mb-12' }, Pagination({ path, search: query, preserve: ['q', 'sort'], page: checkedPage, pages })) : null,
            ),
          ),
        ),
      ),
    }));
  });

  app.get<{ Params: { username: string; seriesUrl: string } }>('/@:username/series/:seriesUrl', async (request, reply) => {
    const requestedUsername = request.params.username;
    const author = await readAuthor(db, requestedUsername);
    if (!author) return sendNotFound(reply);
    const query = new URL(request.url, siteUrl).searchParams;
    const page = pageFrom(query);
    if (page === null) return sendNotFound(reply);
    const sortOrder = query.get('sort') === 'asc' ? 'asc' : 'desc';
    const publicPost = publicPostWhere();
    const storedSeries = await db.series.findFirst({
      where: { ownerId: author.id, slug: request.params.seriesUrl, isHidden: false, posts: { some: publicPost } },
      select: {
        id: true, slug: true, name: true, descriptionMarkdown: true, descriptionHtml: true, createdAt: true, updatedAt: true, ownerId: true,
        owner: { select: { username: true, profile: { select: { avatar: true } } } },
        _count: { select: { posts: { where: publicPost } } },
      },
    });
    if (!storedSeries) return sendNotFound(reply);
    const series: SeriesDetailRow = {
      id: storedSeries.id, url: storedSeries.slug, name: storedSeries.name, textMarkdown: storedSeries.descriptionMarkdown,
      textHtml: storedSeries.descriptionHtml, createdDate: storedDateText(storedSeries.createdAt), updatedDate: storedDateText(storedSeries.updatedAt),
      authorId: storedSeries.ownerId, authorUsername: storedSeries.owner.username,
      authorAvatar: storedSeries.owner.profile?.avatar ?? null, postCount: storedSeries._count.posts,
    };
    const seriesPath = `${authorPath(author.username, '/series')}/${encodeURIComponent(series.url)}`;
    if (author.username !== requestedUsername) return sendRedirect(reply, seriesPath);
    const count = series.postCount;
    const checkedPage = validPublicPage(reply, page, count, 10);
    if (checkedPage === null) return reply;
    const posts = await readPublicPosts(db, {
      where: { seriesId: series.id },
      orderBy: [{ publishedAt: sortOrder }, { id: sortOrder }],
      limit: 10,
      offset: (checkedPage - 1) * 10,
    });
    const { brand, siteName, viewer } = await getLayoutContext(request, reply, db, options);
    const pages = totalPages(count, 10);
    const metaDescription = description(series.textHtml || series.textMarkdown, `${author.username}님의 ${siteName} 시리즈: ${series.name}`);
    const canonicalQuery = new URLSearchParams();
    if (sortOrder === 'asc' && checkedPage > 1) canonicalQuery.set('sort', 'asc');
    if (checkedPage > 1) canonicalQuery.set('page', String(checkedPage));
    const canonical = makeAbsolute(siteUrl, canonicalQuery.size ? `${seriesPath}?${canonicalQuery}` : seriesPath);
    const authorUrl = makeAbsolute(siteUrl, authorPath(author.username));
    const structuredData: Record<string, unknown> = {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: series.name,
      headline: series.name,
      description: metaDescription,
      url: canonical,
      author: { '@type': 'Person', name: author.username, url: authorUrl },
      isPartOf: { '@type': 'WebSite', name: siteName, url: makeAbsolute(siteUrl, '/') },
      mainEntity: {
        '@type': 'ItemList',
        itemListOrder: sortOrder === 'desc' ? 'https://schema.org/ItemListOrderDescending' : 'https://schema.org/ItemListOrderAscending',
        numberOfItems: count,
        itemListElement: posts.map((post, index) => ({
          '@type': 'ListItem',
          position: sortOrder === 'desc' ? count - (checkedPage - 1) * 10 - index : (checkedPage - 1) * 10 + index + 1,
          item: {
            '@type': 'BlogPosting',
            headline: post.title,
            description: post.description || post.title,
            url: makeAbsolute(siteUrl, postPath(post)),
            datePublished: dateValue(post.publishedDate),
            author: { '@type': 'Person', name: author.username, url: authorUrl },
          },
        })),
      },
      dateModified: dateValue(series.updatedDate),
    };
    const previous = checkedPage > 1 ? new URLSearchParams({ ...(sortOrder === 'asc' ? { sort: 'asc' } : {}), ...(checkedPage > 2 ? { page: String(checkedPage - 1) } : {}) }).toString() : '';
    const next = checkedPage < pages ? new URLSearchParams({ ...(sortOrder === 'asc' ? { sort: 'asc' } : {}), page: String(checkedPage + 1) }).toString() : '';
    const seriesMarkdown = await advertiseMarkdown(reply, db, siteUrl, seriesPath);
    return renderHtml(reply, PageLayout({
      meta: {
        authorFeed: authorFeed(siteUrl, author.username),
        markdownUrl: seriesMarkdown,
        title: `${series.name} - ${author.username} | ${siteName}`,
        description: metaDescription,
        canonical,
        siteName,
        brand,
        viewer,
        structuredData,
        previous: previous ? makeAbsolute(siteUrl, `${seriesPath}?${previous}`) : undefined,
        next: next ? makeAbsolute(siteUrl, `${seriesPath}?${next}`) : undefined,
      },
      children: h('div', { className: 'mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-12' },
        h('header', { className: 'mb-12 text-center' },
          h('span', { className: 'mb-4 inline-block rounded-full bg-surface-subtle px-3 py-1 text-xs font-bold uppercase tracking-wider text-content-secondary' }, '시리즈'),
          h('h1', { className: 'mb-4 text-3xl font-bold leading-tight tracking-tight text-content sm:text-4xl' }, series.name),
          series.textHtml ? h('div', { className: 'mx-auto mb-8 max-w-2xl text-lg leading-relaxed text-content-secondary', dangerouslySetInnerHTML: { __html: sanitizePostHtml(series.textHtml) } }) : null,
          h('div', { className: 'flex flex-wrap items-center justify-center gap-6 text-sm text-content-secondary' },
            h('a', { href: authorPath(author.username), className: 'flex items-center gap-2 transition-colors hover:text-content' },
              h('img', { className: 'size-6 rounded-full object-cover ring-2 ring-line-light', src: avatarUrl(series.authorAvatar), alt: author.username }),
              h('span', { className: 'font-semibold text-content' }, author.username),
            ),
            h('span', { className: 'size-1 rounded-full bg-content-hint/70', 'aria-hidden': true }),
            h('span', { className: 'flex items-center gap-1.5' }, h(SiteIcon, { name: 'file-text', className: 'text-xs' }), `${count}개 포스트`),
            h('span', { className: 'size-1 rounded-full bg-content-hint/70', 'aria-hidden': true }),
            h('span', { className: 'flex items-center gap-1.5' }, h(SiteIcon, { name: 'clock', className: 'text-xs' }), `${dateLabel(series.updatedDate)} 수정됨`),
          ),
          viewer?.id === author.id ? h('div', { className: 'mt-8' },
            h('a', { href: `/settings/series/edit/${series.id}`, className: 'inline-flex items-center gap-2 rounded-full bg-action px-5 py-2.5 text-sm font-medium text-content-inverted transition-all duration-150 hover:bg-action-hover active:scale-[0.98]' },
              h(SiteIcon, { name: 'edit', className: 'text-xs' }), h('span', null, '시리즈 편집'),
            ),
          ) : null,
        ),
        posts.length ? h('div', { className: 'mb-6 flex justify-end' },
          h('nav', { className: 'inline-flex rounded-xl bg-surface-subtle/80 p-1 backdrop-blur-sm ring-1 ring-line/60', 'aria-label': '포스트 정렬' },
            h('a', { href: `${seriesPath}?sort=asc`, 'aria-current': sortOrder === 'asc' ? 'page' : undefined,
              className: `rounded-lg px-4 py-1.5 text-xs font-bold transition-all duration-150 ${sortOrder === 'asc' ? 'bg-surface-elevated text-content shadow-sm' : 'text-content-secondary hover:text-content'}` }, '오래된순'),
            h('a', { href: seriesPath, 'aria-current': sortOrder === 'desc' ? 'page' : undefined,
              className: `rounded-lg px-4 py-1.5 text-xs font-bold transition-all duration-150 ${sortOrder === 'desc' ? 'bg-surface-elevated text-content shadow-sm' : 'text-content-secondary hover:text-content'}` }, '최신순'),
          ),
        ) : null,
        posts.length ? h('div', { className: 'space-y-4' }, ...posts.map((post, index) => {
          const number = sortOrder === 'desc' ? count - (checkedPage - 1) * 10 - index : (checkedPage - 1) * 10 + index + 1;
          return h('article', { className: 'group relative rounded-2xl border border-line-light bg-surface-elevated p-6 transition-all duration-150 hover:ring-1 hover:ring-line/60 active:scale-[0.98]', key: post.id },
            h('a', { className: 'flex items-start gap-5', href: postPath(post) },
              h('span', { className: 'flex size-10 shrink-0 items-center justify-center rounded-xl bg-surface-subtle font-mono text-sm font-bold text-content-hint transition-colors duration-150 group-hover:bg-action group-hover:text-content-inverted' }, String(number)),
              h('div', { className: 'min-w-0 flex-1 pt-1' },
                h('h2', { className: 'mb-2 block text-lg font-bold leading-snug text-content transition-colors group-hover:text-content' }, post.title),
                h('span', { className: 'flex flex-wrap items-center gap-4 text-xs font-medium text-content-hint' },
                  h('span', { className: 'flex items-center gap-1.5' }, h(SiteIcon, { name: 'calendar' }), formatPostDate(post)),
                  h('span', { className: 'flex items-center gap-1.5' }, h(SiteIcon, { name: 'clock' }), `${post.readTime}분`),
                  h('span', { className: 'ml-auto flex items-center gap-3' },
                    h('span', { className: 'flex items-center gap-1.5 transition-colors hover:text-danger' }, h(SiteIcon, { name: 'heart' }), String(post.likeCount ?? 0)),
                    h('span', { className: 'flex items-center gap-1.5 transition-colors hover:text-content' }, h(SiteIcon, { name: 'message-circle' }), String(post.commentCount ?? 0)),
                  ),
                ),
              ),
            ),
          );
        })) : EmptyState({ title: '아직 포스트가 없어요', message: '이 시리즈에는 아직 포스트가 추가되지 않았습니다.', icon: 'stack-2', framed: true }),
        posts.length ? h('div', { className: 'mt-12' }, Pagination({
          path: seriesPath,
          search: new URLSearchParams(sortOrder === 'asc' ? 'sort=asc' : ''),
          preserve: ['sort'],
          page: checkedPage,
          pages,
        })) : null,
      ),
    }));
  });
}
