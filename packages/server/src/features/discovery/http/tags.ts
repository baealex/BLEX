import { renderPage } from '../../../platform/views.js';
import type { FastifyInstance } from 'fastify';
import type { Prisma, PrismaClient } from '@prisma/client';
import { publicPostWhere } from '../../posts/data/visibility.js';
import { readCardLikes, readPublicPostCount, readPublicPosts } from '../services/public-posts.js';
import {
  PAGE_SIZE,
  PublicPageOptions,
  TagRow,
  canonicalPageUrl,
  hasUnexpected,
  makeAbsolute,
  makePaginationMeta,
  pageFrom,
  sendNotFound,
  totalPages,
  validPublicPage,
} from '../shared.js';
import { getLayoutContext, renderHtml } from '../page-context.js';
export function registerTagsRoutes(
  app: FastifyInstance,
  db: PrismaClient,
  siteUrl: URL,
  options: PublicPageOptions = {},
) {
  app.get('/tags', async (request, reply) => {
    const url = new URL(request.url, siteUrl);
    const query = url.searchParams;
    const page = pageFrom(query);
    if (page === null) return sendNotFound(reply);
    const searchText = (query.get('q') ?? '').trim();
    const requestedSort = query.get('sort') ?? 'popular';
    const sort = ['popular', 'name', 'recent'].includes(requestedSort) ? requestedSort : 'popular';
    const { brand, siteName, viewer } = await getLayoutContext(request, reply, db, options);
    const postFilter = publicPostWhere();
    const where: Prisma.TagWhereInput = {
      posts: { some: postFilter },
      ...(searchText ? { name: { contains: searchText } } : {}),
    };
    const count = await db.tag.count({ where });
    const checkedPage = validPublicPage(reply, page, count, 50);
    if (checkedPage === null) return reply;
    const offset = (checkedPage - 1) * 50;
    // Popularity counts only public posts, which Prisma cannot sort by, so that order is built from the short tag list.
    const rows = await db.tag.findMany({
      where,
      ...(sort === 'popular'
        ? {}
        : { orderBy: sort === 'name' ? { name: 'asc' as const } : { id: 'desc' as const }, skip: offset, take: 50 }),
      select: { id: true, name: true, _count: { select: { posts: { where: postFilter } } } },
    });
    const ordered =
      sort === 'popular'
        ? rows
            .sort(
              (left, right) =>
                right._count.posts - left._count.posts ||
                Buffer.compare(Buffer.from(left.name), Buffer.from(right.name)),
            )
            .slice(offset, offset + 50)
        : rows;
    const tags: TagRow[] = ordered.map((tag) => ({ id: tag.id, name: tag.name, count: tag._count.posts }));
    const pages = totalPages(count, 50);
    const path = '/tags';
    const noindex = hasUnexpected(query, ['page', 'q', 'sort']) || searchText.length > 0 || requestedSort !== 'popular';
    const canonical = noindex ? makeAbsolute(siteUrl, path) : canonicalPageUrl(siteUrl, path, checkedPage);
    const preserve = ['q', 'sort'];
    return renderHtml(
      reply,
      renderPage('tags', {
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
        query,
        sort,
        tags,
        searchText,
        path,
        preserve,
        checkedPage,
        pages,
      }),
    );
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
    return renderHtml(
      reply,
      renderPage('tag/$name', {
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
        tagName,
        posts,
        likes,
        path,
        query,
        checkedPage,
        pages,
      }),
    );
  });
}
