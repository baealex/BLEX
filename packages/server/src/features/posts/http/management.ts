import { type PrismaClient } from '@prisma/client';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { syncPostPublication } from '../../notifications/model.js';
import { done, failure as failed } from '../../../platform/response.js';
import { ManagementTab, renderManagementPage } from '../pages/management-page.js';
import { ManagementQueryError, getManagedPosts, getTrashRows, loadTrashedPost, managementPage, permanentlyDeleteTrashedPost, restoreTrashedPost } from '../services/management.js';
import { PostValidationError, loadPost, trashPost } from '../services/post-store.js';
import { AuthoringOptions, StoredDraftSummary, bodyObject, cookieValue, currentAccount, dateAsIso, editorAccount, editorRedirect, field, forbidden, isTrue, managementForbidden, managementNotFound, notFound, nowString, numberValue, queryObject } from '../shared.js';

export function registerManagementRoutes(routes: FastifyInstance, db: PrismaClient, options: AuthoringOptions) {
    const renderManagement = async (
      request: FastifyRequest,
      reply: FastifyReply,
      forcedTab?: ManagementTab,
    ) => {
      const account = await currentAccount(request, db, options);
      if (!account) return editorRedirect(reply, false);
      if (account.role !== 'EDITOR') return managementNotFound(reply);
      const query = queryObject(request);
      let tab = forcedTab ?? field(query.tab) as ManagementTab;
      if (!['published', 'scheduled', 'drafts', 'trash'].includes(tab)) tab = 'published';
      const filters = {
        search: field(query.search),
        tag: field(query.tag),
        series: field(query.series),
        visibility: field(query.visibility),
        order: field(query.order) || '-published_date',
      };
      let page = 1;
      let lastPage = 1;
      let totalCount = 0;
      let posts: Array<Record<string, unknown>> = [];
      let drafts: StoredDraftSummary[] = [];
      let trash: Array<Record<string, unknown>> = [];
      try {
        if (tab === 'published' || tab === 'scheduled') {
          const result = await getManagedPosts(db, account, query, tab === 'scheduled');
          ({ posts, page, lastPage, totalCount } = result);
        } else if (tab === 'drafts') {
          drafts = await db.$queryRaw<StoredDraftSummary[]>`
            SELECT url, title, image, CAST(created_date AS TEXT) AS createdDate,
                   CAST(updated_date AS TEXT) AS updatedDate
              FROM board_post
             WHERE author_id = ${account.id} AND deleted_date IS NULL AND published_date IS NULL
             ORDER BY updated_date DESC, id DESC
          `;
          totalCount = drafts.length;
        } else {
          page = managementPage(query.page);
          const result = await getTrashRows(db, account, page);
          trash = result.posts;
          lastPage = result.pagination.lastPage;
          totalCount = result.pagination.totalCount;
        }
      } catch (error) {
        if (error instanceof ManagementQueryError) return managementNotFound(reply, '포스트 목록 조건을 확인해 주세요.');
        throw error;
      }
      reply.code(200).type('text/html; charset=utf-8')
        .header('Cache-Control', 'private, no-store')
        .header('X-Robots-Tag', 'noindex, nofollow')
        .header('X-Frame-Options', 'DENY')
        .send(renderManagementPage({
          username: account.username,
          isStaff: account.isStaff,
          notifyCount: account.notifyCount,
          hasConnectedTelegram: account.hasConnectedTelegram,
          csrfToken: cookieValue(request, 'csrftoken'),
          tab,
          page,
          lastPage,
          totalCount,
          posts,
          drafts,
          trash,
          filters,
        }));
      return reply;
    };

    routes.get('/settings/posts', (request, reply) => renderManagement(request, reply));

    routes.get('/settings/posts/trash', (request, reply) => renderManagement(request, reply, 'trash'));

    routes.get('/settings/posts/scheduled', (request, reply) => renderManagement(request, reply, 'scheduled'));

    routes.get('/settings/drafts', (request, reply) => renderManagement(request, reply, 'drafts'));

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
      const tags = await db.$queryRaw<Array<{ name: string | null; count: number | bigint }>>`
        SELECT tag.value AS name, COUNT(tag.value) AS count
          FROM board_post AS post
          LEFT JOIN board_post_tags AS link ON link.post_id = post.id
          LEFT JOIN board_tag AS tag ON tag.id = link.tag_id
         WHERE post.author_id = ${account.id} AND post.deleted_date IS NULL
         GROUP BY tag.value
         ORDER BY count DESC
      `;
      return done({
        username: account.username,
        tags: tags.map((tag) => ({ name: tag.name, count: numberValue(tag.count) })),
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
        const expected = field(queryObject(request).expectedDeletedDate ?? queryObject(request).expected_deleted_date);
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
      const expected = field(body.expected_deleted_date ?? body.expectedDeletedDate);
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

    routes.post<{ Params: { slug: string } }>('/settings/posts/:slug/visibility', async (request, reply) => {
      const account = await currentAccount(request, db, options);
      if (!account) return editorRedirect(reply, false);
      if (account.role !== 'EDITOR') return managementNotFound(reply);
      if (!options.validateCsrf(request)) return managementForbidden(reply);
      const post = await loadPost(db, { userId: account.id, slug: request.params.slug });
      if (!post) return managementNotFound(reply, '포스트를 찾을 수 없습니다.');
      await db.$transaction(async (tx) => {
        await tx.$executeRaw`UPDATE board_postconfig SET hide = ${isTrue(post.hide) ? 0 : 1} WHERE post_id = ${post.id}`;
        await syncPostPublication(tx, post.id);
      });
      return reply.redirect('/settings/posts', 303);
    });

    routes.post<{ Params: { slug: string } }>('/settings/posts/:slug/trash', async (request, reply) => {
      const account = await currentAccount(request, db, options);
      if (!account) return editorRedirect(reply, false);
      if (account.role !== 'EDITOR') return managementNotFound(reply);
      if (!options.validateCsrf(request)) return managementForbidden(reply);
      const post = await loadPost(db, { userId: account.id, slug: request.params.slug });
      if (!post) return managementNotFound(reply, '포스트를 찾을 수 없습니다.');
      await trashPost(db, account, post);
      return reply.redirect('/settings/posts?tab=trash', 303);
    });

    routes.post<{ Params: { slug: string } }>('/settings/drafts/:slug/trash', async (request, reply) => {
      const account = await currentAccount(request, db, options);
      if (!account) return editorRedirect(reply, false);
      if (account.role !== 'EDITOR') return managementNotFound(reply);
      if (!options.validateCsrf(request)) return managementForbidden(reply);
      const post = await loadPost(db, { userId: account.id, slug: request.params.slug });
      if (!post || post.publishedDate !== null) return managementNotFound(reply, '임시 포스트를 찾을 수 없습니다.');
      await trashPost(db, account, post);
      return reply.redirect('/settings/drafts', 303);
    });

    routes.post<{ Params: { slug: string; action: string } }>('/settings/posts/:slug/schedule/:action', async (request, reply) => {
      const account = await currentAccount(request, db, options);
      if (!account) return editorRedirect(reply, false);
      if (account.role !== 'EDITOR') return managementNotFound(reply);
      if (!options.validateCsrf(request)) return managementForbidden(reply);
      if (request.params.action !== 'cancel' && request.params.action !== 'publish-now') return managementNotFound(reply, '예약 포스트를 찾을 수 없습니다.');
      const post = await loadPost(db, { userId: account.id, slug: request.params.slug });
      const published = post ? dateAsIso(post.publishedDate) : null;
      if (!post || !published || new Date(published).valueOf() <= Date.now()) return managementNotFound(reply, '예약 포스트를 찾을 수 없습니다.');
      const date = request.params.action === 'cancel' ? null : nowString();
      const updated = nowString();
      await db.$transaction(async (tx) => {
        await tx.$executeRaw`UPDATE board_post SET published_date = ${date}, updated_date = ${updated} WHERE id = ${post.id} AND author_id = ${account.id}`;
        await syncPostPublication(tx, post.id, { announce: true });
      });
      return reply.redirect(request.params.action === 'cancel' ? '/settings/posts?tab=drafts' : '/settings/posts', 303);
    });

    routes.post<{ Params: { url: string; action: 'restore' | 'purge' } }>('/settings/posts/trash/:url/:action', async (request, reply) => {
      const account = await currentAccount(request, db, options);
      if (!account) return editorRedirect(reply, false);
      if (account.role !== 'EDITOR') return managementNotFound(reply);
      if (!options.validateCsrf(request)) return managementForbidden(reply);
      if (request.params.action !== 'restore' && request.params.action !== 'purge') return managementNotFound(reply, '휴지통 포스트를 찾을 수 없습니다.');
      const body = bodyObject(request.body);
      if (request.params.action === 'purge' && field(body.confirm_permanent) !== 'yes') return managementForbidden(reply);
      const expected = field(body.expected_deleted_date);
      if (!expected) return managementForbidden(reply);
      const post = await loadTrashedPost(db, account, request.params.url);
      if (!post) return managementNotFound(reply, '휴지통 포스트를 찾을 수 없습니다.');
      try {
        if (request.params.action === 'restore') await restoreTrashedPost(db, account, post, expected);
        else await permanentlyDeleteTrashedPost(db, account, post, expected);
      } catch (error) {
        if (error instanceof PostValidationError) return reply.code(409).type('text/plain; charset=utf-8').send('휴지통 상태가 변경되었습니다. 목록을 새로고침한 뒤 다시 시도해 주세요.');
        throw error;
      }
      return reply.redirect('/settings/posts?tab=trash', 303);
    });
}
