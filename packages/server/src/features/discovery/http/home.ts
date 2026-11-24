import { systemMessage } from '../../../platform/messages.js';
import { renderPage } from '../../../platform/views.js';
import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import { isoUtcMillis } from '../../../platform/date-format.js';
import { readCardLikes, readLikedPosts, readPublicPostCount, readPublicPosts } from '../services/public-posts.js';
import {
  PAGE_SIZE,
  type PageMeta,
  type PublicPageOptions,
  canonicalPageUrl,
  description,
  hasUnexpected,
  makeAbsolute,
  makePaginationMeta,
  pageFrom,
  safeStructuredPageData,
  sendNotFound,
  staticPageHtml,
  totalPages,
  validPublicPage,
} from '../shared.js';
import {
  advertiseMarkdown,
  csrfCookie,
  getLayoutContext,
  readNotices,
  readPublicSiteBrand,
  readViewer,
  renderHtml,
} from '../page-context.js';
export function registerHomeRoutes(
  app: FastifyInstance,
  db: PrismaClient,
  siteUrl: URL,
  options: PublicPageOptions = {},
) {
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
    const [globalNotices, likes] = await Promise.all([
      readNotices(db, 'global'),
      readCardLikes(db, request, viewer, posts),
    ]);
    const meta: PageMeta = {
      title: systemMessage('{value0} - Latest posts', { value0: siteName }),
      description: systemMessage('Browse the latest public posts on {value0}.', { value0: siteName }),
      canonical,
      siteName,
      brand,
      viewer,
      robots: noindex ? 'noindex,follow' : undefined,
      ...makePaginationMeta(siteUrl, path, query, [], checkedPage, pages),
    };
    return renderHtml(
      reply,
      renderPage('index', { meta: meta, viewer, globalNotices, posts, likes, path, query, checkedPage, pages }),
    );
  });

  app.get('/interests', async (request, reply) => {
    const viewer = await options.currentUser?.(request);
    if (!viewer) return reply.redirect(`/login?${new URLSearchParams({ next: request.url })}`, 302);
    const path = '/interests';
    const query = new URL(request.url, siteUrl).searchParams;
    const page = pageFrom(query);
    if (page === null) return sendNotFound(reply);
    const count = await readPublicPostCount(db, { likes: { some: { userId: viewer.id } } });
    const checkedPage = validPublicPage(reply, page, count, PAGE_SIZE);
    if (checkedPage === null) return reply;
    const brand = await readPublicSiteBrand(db);
    const siteName = brand.siteName;
    const posts = await readLikedPosts(db, viewer.id, PAGE_SIZE, (checkedPage - 1) * PAGE_SIZE);
    const pages = totalPages(count, PAGE_SIZE);
    reply.header('Cache-Control', 'private, no-store');
    const csrfToken = csrfCookie(request);
    return renderHtml(
      reply,
      renderPage('interests', {
        meta: {
          title: systemMessage('{value0} - Liked posts', { value0: siteName }),
          description: '',
          canonical: makeAbsolute(siteUrl, path),
          siteName,
          brand,
          robots: 'noindex,nofollow',
          viewer,
        },
        posts,
        csrfToken,
        path,
        query,
        checkedPage,
        pages,
      }),
    );
  });

  app.get<{ Params: { slug: string } }>('/static/:slug', async (request, reply) => {
    const slug = request.params.slug;
    if (slug.endsWith('.md')) return sendNotFound(reply);
    const page = await db.staticPage.findFirst({
      where: { slug, isPublished: true },
      select: {
        title: true,
        content: true,
        description: true,
        createdAt: true,
        updatedAt: true,
        author: { select: { username: true } },
      },
    });
    if (!page) return sendNotFound(reply);
    const { brand, siteName, viewer } = await getLayoutContext(request, reply, db, options);
    const path = `/static/${encodeURIComponent(slug)}`;
    const canonical = makeAbsolute(siteUrl, path);
    const metaDescription = description(page.description || page.content, page.title);
    const structuredData = safeStructuredPageData(
      siteName,
      canonical,
      page.title,
      metaDescription,
      isoUtcMillis(page.createdAt),
      isoUtcMillis(page.updatedAt),
      page.author?.username ?? null,
      siteUrl,
    );
    const pageMarkdown = await advertiseMarkdown(reply, db, siteUrl, path);
    const pageHtml = staticPageHtml(page.content);
    return renderHtml(
      reply,
      renderPage('static/$slug', {
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
        pageHtml,
      }),
    );
  });
}
