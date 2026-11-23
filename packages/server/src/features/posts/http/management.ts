import type { PrismaClient } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import { done, failure as failed } from '../../../platform/response.js';
import {
  ManagementQueryError,
  getManagedPosts,
  getTrashRows,
  loadTrashedPost,
  managementPage,
  permanentlyDeleteTrashedPost,
  restoreTrashedPost,
} from '../services/management.js';
import { PostValidationError } from '../services/post-store.js';
import {
  type AuthoringOptions,
  bodyObject,
  editorAccount,
  field,
  forbidden,
  notFound,
  queryObject,
} from '../shared.js';

export function registerManagementRoutes(routes: FastifyInstance, db: PrismaClient, options: AuthoringOptions) {
  routes.get('/v1/setting/posts', async (request, reply) => {
    const account = await editorAccount(request, reply, db, options, true);
    if (!account) return reply;
    try {
      const { page: _page, ...body } = await getManagedPosts(db, account, queryObject(request), false, true);
      return done(body);
    } catch (error) {
      if (error instanceof ManagementQueryError) return notFound(reply);
      throw error;
    }
  });

  routes.get('/v1/setting/tag', async (request, reply) => {
    const account = await editorAccount(request, reply, db, options, true);
    if (!account) return reply;
    const active = { authorId: account.id, deletedAt: null };
    const [tags, untagged] = await Promise.all([
      db.tag.findMany({
        where: { posts: { some: active } },
        orderBy: { name: 'asc' },
        select: { name: true, _count: { select: { posts: { where: active } } } },
      }),
      db.post.count({ where: { ...active, tags: { none: {} } } }),
    ]);
    // A post without tags has always added one row with no name and a count of zero.
    const rows: Array<{ name: string | null; count: number }> = tags.map((tag) => ({
      name: tag.name,
      count: tag._count.posts,
    }));
    if (untagged) rows.unshift({ name: null, count: 0 });
    return done({
      username: account.username,
      // Equal counts have always come back in reverse name order.
      tags: rows.sort(
        (left, right) =>
          right.count - left.count || Buffer.compare(Buffer.from(right.name ?? ''), Buffer.from(left.name ?? '')),
      ),
    });
  });

  routes.get('/v1/setting/reserved-posts', async (request, reply) => {
    const account = await editorAccount(request, reply, db, options, true);
    if (!account) return reply;
    try {
      const { page: _page, ...body } = await getManagedPosts(db, account, queryObject(request), true, true);
      return done(body);
    } catch (error) {
      if (error instanceof ManagementQueryError) return notFound(reply);
      throw error;
    }
  });

  routes.route<{ Params: { url?: string } }>({
    method: ['GET', 'DELETE'],
    url: '/v1/setting/trash-posts/:url?',
    handler: async (request, reply) => {
      const account = await editorAccount(request, reply, db, options, true);
      if (!account) return reply;
      if (request.method === 'GET') {
        let page: number;
        try {
          page = managementPage(queryObject(request).page);
          return done(await getTrashRows(db, account, page));
        } catch (error) {
          if (error instanceof ManagementQueryError) return failed('VA', error.message);
          throw error;
        }
      }
      if (!options.validateCsrf(request)) return forbidden(reply);
      const slug = request.params.url;
      const expected = field(queryObject(request).expectedDeletedDate);
      if (!slug || !expected) return failed('VA', 'Check the current trash state.');
      const post = await loadTrashedPost(db, account, slug);
      if (!post) return notFound(reply);
      try {
        const id = await permanentlyDeleteTrashedPost(db, account, post, expected);
        return done({ deleted: true, id });
      } catch (error) {
        if (error instanceof PostValidationError) return failed(error.code, error.message);
        throw error;
      }
    },
  });

  routes.post<{ Params: { url: string } }>('/v1/setting/trash-posts/:url/restore', async (request, reply) => {
    const account = await editorAccount(request, reply, db, options, true);
    if (!account) return reply;
    if (!options.validateCsrf(request)) return forbidden(reply);
    const body = bodyObject(request.body);
    const expected = field(body.expectedDeletedDate);
    if (!expected) return failed('VA', 'Check the current trash state.');
    const post = await loadTrashedPost(db, account, request.params.url);
    if (!post) return notFound(reply);
    try {
      const status = await restoreTrashedPost(db, account, post, expected);
      return done({ url: post.url, status, restored: true });
    } catch (error) {
      if (error instanceof PostValidationError) return failed(error.code, error.message);
      throw error;
    }
  });
}
