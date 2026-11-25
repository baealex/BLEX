import { systemMessage } from '../../../platform/messages.js';
import { renderPage } from '../../../platform/views.js';
import type { FastifyInstance } from 'fastify';
import type { Prisma, PrismaClient } from '@prisma/client';
import { storedDateText } from '../../../platform/date-format.js';
import { sanitizeAboutHtml, sanitizePostHtml } from '../../posts/post-html.js';
import { readAuthorActivity } from '../public-activity.js';
import {
  authorPath,
  isEditor,
  publicSeriesWhere,
  readAuthor,
  readAuthorSocialLinks,
  readSeriesPreview,
  subscriptionState,
} from '../services/profile.js';
import { publicPostWhere } from '../../posts/data/visibility.js';
import {
  readCardLikes,
  readFeaturedPosts,
  readPublicPostCount,
  readPublicPosts,
} from '../../discovery/services/public-posts.js';
import {
  PAGE_SIZE,
  type PageMeta,
  type PublicPageOptions,
  type SeriesDetailRow,
  type SeriesListRow,
  type SubscriptionState,
  canonicalPageUrl,
  dateValue,
  description,
  hasUnexpected,
  makeAbsolute,
  makePaginationMeta,
  pageFrom,
  sendNotFound,
  sendRedirect,
  totalPages,
  validPublicPage,
} from '../../discovery/shared.js';
import {
  advertiseMarkdown,
  authorFeed,
  csrfCookie,
  getLayoutContext,
  readNotices,
  readPublicSiteBrand,
  readViewer,
  renderHtml,
} from '../../discovery/page-context.js';
import { publicPostPath } from '../../posts/public-post.js';
import { searchTerm } from '../../../platform/search-term.js';

export function registerProfileRoutes(
  app: FastifyInstance,
  db: PrismaClient,
  siteUrl: URL,
  options: PublicPageOptions = {},
) {
  app.get<{ Params: { username: string } }>('/@:username', async (request, reply) => {
    const requestedUsername = request.params.username;
    const author = await readAuthor(db, requestedUsername);
    if (!author) return sendNotFound(reply);
    if (author.username !== requestedUsername)
      return sendRedirect(reply, `${authorPath(author.username)}${new URL(request.url, siteUrl).search}`);
    const query = new URL(request.url, siteUrl).searchParams;
    const [brand, viewer] = await Promise.all([readPublicSiteBrand(db), readViewer(request, reply, options)]);
    const siteName = brand.siteName;
    const [featured, socialLinks] = await Promise.all([
      readFeaturedPosts(db, author),
      readAuthorSocialLinks(db, author.id),
    ]);
    const isAuthorEditor = isEditor(author);
    const [userNotices, subscription, seriesPreview] = isAuthorEditor
      ? await Promise.all([
          readNotices(db, 'user', author.id),
          subscriptionState(db, author, viewer),
          readSeriesPreview(db, author.id, 4),
        ])
      : [[], { canSubscribe: false, isSubscribed: false } as SubscriptionState, []];
    const noindex = hasUnexpected(query, []);
    const path = authorPath(author.username);
    const canonical = makeAbsolute(siteUrl, path);
    const aboutHtml = sanitizeAboutHtml(author.aboutHtml);
    const isOwner = viewer?.id === author.id;
    const activity = await readAuthorActivity(db, author.id);
    const csrfToken = csrfCookie(request);
    return renderHtml(
      reply,
      renderPage('@{$username}/index', {
        meta: {
          authorFeed: isEditor(author) ? authorFeed(siteUrl, author.username) : undefined,
          title: `${author.username} - ${siteName}`,
          description: description(
            author.bio || aboutHtml,
            systemMessage("Explore {value0}'s public posts and introduction.", { value0: author.username }),
          ),
          canonical,
          siteName,
          brand,
          viewer,
          robots: noindex ? 'noindex,follow' : undefined,
        },
        author,
        subscription,
        viewer,
        csrfToken,
        socialLinks,
        isAuthorEditor,
        userNotices,
        aboutHtml,
        isOwner,
        featured,
        seriesPreview,
        activity,
      }),
    );
  });

  app.get<{ Params: { username: string } }>('/@:username/partials/featured-posts', async (request, reply) => {
    const author = await readAuthor(db, request.params.username);
    if (!author || author.username !== request.params.username) return sendNotFound(reply);
    const headers = reply.header('Cache-Control', 'no-store').header('X-Robots-Tag', 'noindex');
    if (!isEditor(author)) return headers.code(204).send();
    const viewer = await readViewer(request, headers, options);
    const featured = await readFeaturedPosts(db, author);
    const content = renderPage('@{$username}/partials/featured-posts', {
      author,
      featured,
      isOwner: viewer?.id === author.id,
    });
    return headers.type('text/html; charset=utf-8').send(content);
  });

  app.get<{ Params: { username: string } }>('/@:username/about/edit', async (request, reply) => {
    if (!options.currentUser) return sendNotFound(reply);
    const viewer = await readViewer(request, reply, options);
    if (!viewer)
      return reply.redirect(`/login?${new URLSearchParams({ next: new URL(request.url, siteUrl).pathname })}`, 302);
    const author = await readAuthor(db, request.params.username);
    if (!author) return sendNotFound(reply);
    if (author.id !== viewer.id)
      return reply.code(403).type('text/plain; charset=utf-8').send(systemMessage('Access denied.'));
    const [brand, socialLinks, subscription] = await Promise.all([
      readPublicSiteBrand(db),
      readAuthorSocialLinks(db, author.id),
      subscriptionState(db, author, viewer),
    ]);
    const path = `${authorPath(author.username)}/about/edit`;
    const csrfToken = csrfCookie(request);
    return renderHtml(
      reply,
      renderPage('@{$username}/about.edit', {
        meta: {
          title: systemMessage("Edit {value0}'s introduction - {value1}", {
            value0: author.username,
            value1: brand.siteName,
          }),
          description: systemMessage('Write an introduction about yourself.'),
          canonical: makeAbsolute(siteUrl, path),
          siteName: brand.siteName,
          brand,
          viewer,
          robots: 'noindex,nofollow',
        },
        author,
        subscription,
        viewer,
        csrfToken,
        socialLinks,
        path,
      }),
    );
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
    if (author.username !== requestedUsername)
      return sendRedirect(reply, `${authorPath(author.username, '/posts')}${new URL(request.url, siteUrl).search}`);
    if (!isEditor(author)) return sendRedirect(reply, authorPath(author.username, '/about'));

    const url = new URL(request.url, siteUrl);
    const query = url.searchParams;
    const page = pageFrom(query);
    if (page === null) return sendNotFound(reply);
    const searchText = searchTerm(query.get('q'));
    const tagFilter = (query.get('tag') ?? '').trim();
    const where: Prisma.PostWhereInput = {
      authorId: author.id,
      ...(searchText
        ? { OR: [{ title: { contains: searchText } }, { content: { html: { contains: searchText } } }] }
        : {}),
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
    const [socialLinks, subscription] = await Promise.all([
      readAuthorSocialLinks(db, author.id),
      subscriptionState(db, author, viewer),
    ]);
    const pages = totalPages(count, PAGE_SIZE);
    const path = authorPath(author.username, '/posts');
    const likes = await readCardLikes(db, request, viewer, posts);
    const noindex = hasUnexpected(query, ['page', 'q', 'tag']) || Boolean(searchText || tagFilter);
    const meta: PageMeta = {
      authorFeed: authorFeed(siteUrl, author.username),
      title: systemMessage('Posts - {value0} | {value1}', { value0: author.username, value1: siteName }),
      description: systemMessage('Browse public posts by {value0}.', { value0: author.username }),
      canonical: noindex ? makeAbsolute(siteUrl, path) : canonicalPageUrl(siteUrl, path, checkedPage),
      siteName,
      brand,
      viewer,
      robots: noindex ? 'noindex,follow' : undefined,
      ...makePaginationMeta(siteUrl, path, query, ['q', 'tag'], checkedPage, pages),
    };
    const csrfToken = csrfCookie(request);
    return renderHtml(
      reply,
      renderPage('@{$username}/posts', {
        meta: meta,
        author,
        subscription,
        viewer,
        csrfToken,
        socialLinks,
        path,
        query,
        tagFilter,
        tagOptions,
        posts,
        likes,
        searchText,
        checkedPage,
        pages,
      }),
    );
  });

  app.get<{ Params: { username: string } }>('/@:username/series', async (request, reply) => {
    const requestedUsername = request.params.username;
    const author = await readAuthor(db, requestedUsername);
    if (!author) return sendNotFound(reply);
    if (author.username !== requestedUsername)
      return sendRedirect(reply, `${authorPath(author.username, '/series')}${new URL(request.url, siteUrl).search}`);
    if (!isEditor(author)) return sendRedirect(reply, authorPath(author.username, '/about'));

    const url = new URL(request.url, siteUrl);
    const query = url.searchParams;
    const page = pageFrom(query);
    if (page === null) return sendNotFound(reply);
    const searchText = searchTerm(query.get('q'));
    const requestedSort = query.get('sort') ?? 'custom';
    const sort = ['custom', 'newest', 'oldest', 'posts'].includes(requestedSort) ? requestedSort : 'custom';
    const publicPost = publicPostWhere();
    const seriesWhere: Prisma.SeriesWhereInput = {
      ...publicSeriesWhere(author.id, publicPost),
      ...(searchText
        ? { OR: [{ name: { contains: searchText } }, { descriptionMarkdown: { contains: searchText } }] }
        : {}),
    };
    const count = await db.series.count({ where: seriesWhere });
    const checkedPage = validPublicPage(reply, page, count, 12);
    if (checkedPage === null) return reply;
    // One author's series are few, and "most posts" counts only public posts, which Prisma cannot sort by.
    const authorSeries = await db.series.findMany({
      where: seriesWhere,
      select: {
        id: true,
        slug: true,
        name: true,
        descriptionMarkdown: true,
        descriptionHtml: true,
        order: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { posts: { where: publicPost } } },
      },
    });
    const seriesOrder: Record<
      string,
      (left: (typeof authorSeries)[number], right: (typeof authorSeries)[number]) => number
    > = {
      newest: (left, right) => right.createdAt.valueOf() - left.createdAt.valueOf() || right.id - left.id,
      oldest: (left, right) => left.createdAt.valueOf() - right.createdAt.valueOf() || left.id - right.id,
      posts: (left, right) => right._count.posts - left._count.posts || left.order - right.order || left.id - right.id,
      custom: (left, right) => left.order - right.order || left.id - right.id,
    };
    const pageSeries = authorSeries.sort(seriesOrder[sort]).slice((checkedPage - 1) * 12, checkedPage * 12);
    // Each series shows the image of its first public post that has one, like a book's cover.
    const covers = await db.post.findMany({
      where: { AND: [publicPost, { seriesId: { in: pageSeries.map((row) => row.id) }, image: { not: '' } }] },
      orderBy: [{ publishedAt: 'asc' }, { id: 'asc' }],
      distinct: ['seriesId'],
      select: { seriesId: true, image: true },
    });
    const coverImage = new Map(covers.map((post) => [post.seriesId, post.image]));
    const seriesRows: SeriesListRow[] = pageSeries.map((row) => ({
      id: row.id,
      url: row.slug,
      name: row.name,
      textMarkdown: row.descriptionMarkdown,
      textHtml: row.descriptionHtml,
      createdDate: storedDateText(row.createdAt),
      updatedDate: storedDateText(row.updatedAt),
      postCount: row._count.posts,
      image: coverImage.get(row.id) ?? '',
    }));
    const { brand, siteName, viewer } = await getLayoutContext(request, reply, db, options);
    const [socialLinks, subscription] = await Promise.all([
      readAuthorSocialLinks(db, author.id),
      subscriptionState(db, author, viewer),
    ]);
    const pages = totalPages(count, 12);
    const path = authorPath(author.username, '/series');
    const noindex = hasUnexpected(query, ['page', 'q', 'sort']) || Boolean(searchText) || requestedSort !== 'custom';
    const csrfToken = csrfCookie(request);
    return renderHtml(
      reply,
      renderPage('@{$username}/series/index', {
        meta: {
          authorFeed: authorFeed(siteUrl, author.username),
          title: systemMessage("{value0}'s series - {value1}", { value0: author.username, value1: siteName }),
          description: systemMessage('Explore public series by {value0}.', { value0: author.username }),
          canonical: noindex ? makeAbsolute(siteUrl, path) : canonicalPageUrl(siteUrl, path, checkedPage),
          siteName,
          brand,
          viewer,
          robots: noindex ? 'noindex,follow' : undefined,
          ...makePaginationMeta(siteUrl, path, query, ['q', 'sort'], checkedPage, pages),
        },
        author,
        subscription,
        viewer,
        csrfToken,
        socialLinks,
        path,
        query,
        sort,
        seriesRows,
        searchText,
        checkedPage,
        pages,
      }),
    );
  });

  app.get<{ Params: { username: string; seriesUrl: string } }>(
    '/@:username/series/:seriesUrl',
    async (request, reply) => {
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
          id: true,
          slug: true,
          name: true,
          descriptionMarkdown: true,
          descriptionHtml: true,
          createdAt: true,
          updatedAt: true,
          ownerId: true,
          owner: { select: { username: true, profile: { select: { avatar: true } } } },
          _count: { select: { posts: { where: publicPost } } },
        },
      });
      if (!storedSeries) return sendNotFound(reply);
      const series: SeriesDetailRow = {
        id: storedSeries.id,
        url: storedSeries.slug,
        name: storedSeries.name,
        textMarkdown: storedSeries.descriptionMarkdown,
        textHtml: storedSeries.descriptionHtml,
        createdDate: storedDateText(storedSeries.createdAt),
        updatedDate: storedDateText(storedSeries.updatedAt),
        authorId: storedSeries.ownerId,
        authorUsername: storedSeries.owner.username,
        authorAvatar: storedSeries.owner.profile?.avatar ?? null,
        postCount: storedSeries._count.posts,
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
      const metaDescription = description(
        series.textHtml || series.textMarkdown,
        systemMessage("{value0}'s series on {value1}: {value2}", {
          value0: author.username,
          value1: siteName,
          value2: series.name,
        }),
      );
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
          itemListOrder:
            sortOrder === 'desc'
              ? 'https://schema.org/ItemListOrderDescending'
              : 'https://schema.org/ItemListOrderAscending',
          numberOfItems: count,
          itemListElement: posts.map((post, index) => ({
            '@type': 'ListItem',
            position:
              sortOrder === 'desc' ? count - (checkedPage - 1) * 10 - index : (checkedPage - 1) * 10 + index + 1,
            item: {
              '@type': 'BlogPosting',
              headline: post.title,
              description: post.description || post.title,
              url: makeAbsolute(siteUrl, publicPostPath(post.authorUsername, post.slug)),
              datePublished: dateValue(post.publishedDate),
              author: { '@type': 'Person', name: author.username, url: authorUrl },
            },
          })),
        },
        dateModified: dateValue(series.updatedDate),
      };
      const previous =
        checkedPage > 1
          ? new URLSearchParams({
              ...(sortOrder === 'asc' ? { sort: 'asc' } : {}),
              ...(checkedPage > 2 ? { page: String(checkedPage - 1) } : {}),
            }).toString()
          : '';
      const next =
        checkedPage < pages
          ? new URLSearchParams({
              ...(sortOrder === 'asc' ? { sort: 'asc' } : {}),
              page: String(checkedPage + 1),
            }).toString()
          : '';
      const seriesMarkdown = await advertiseMarkdown(reply, db, siteUrl, seriesPath);
      const seriesHtml = series.textHtml ? sanitizePostHtml(series.textHtml) : '';
      return renderHtml(
        reply,
        renderPage('@{$username}/series/$seriesSlug', {
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
          series,
          seriesHtml,
          author,
          count,
          viewer,
          posts,
          seriesPath,
          sortOrder,
          checkedPage,
          pages,
        }),
      );
    },
  );
}
