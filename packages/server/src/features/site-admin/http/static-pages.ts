import { type PrismaClient } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import { done as success, failure } from '../../../platform/response.js';
import { pageStaticPageEditor, pageStaticPages, readStaticPage, readStaticPages, saveStaticPage, staticPageApi, staticPagePayload } from '../services/static-pages.js';
import { AdminSettingsOptions, apiAccess, apiJsonBody, csrfValid, isRecord, pageAccess, validRouteId } from '../shared.js';

export function registerStaticPagesRoutes(routes: FastifyInstance, db: PrismaClient, options: AdminSettingsOptions) {
    routes.get('/admin-settings/static-pages', async (request, reply) => {
      const result = await pageAccess(request, reply, db, options);
      if (!result) return reply;
      return pageStaticPages(request, reply, db, result.user, result.access);
    });

    routes.get('/admin-settings/static-pages/create', async (request, reply) => {
      const result = await pageAccess(request, reply, db, options);
      if (!result) return reply;
      return pageStaticPageEditor(request, reply, result.user, result.access, null);
    });

    routes.post<{ Body: unknown }>('/admin-settings/static-pages/create', { bodyLimit: 1024 * 1024 }, async (request, reply) => {
      if (!csrfValid(request, options)) return reply.code(403).type('text/plain; charset=utf-8').send('요청을 확인할 수 없습니다. 페이지를 새로고침해 주세요.');
      const result = await pageAccess(request, reply, db, options);
      if (!result) return reply;
      const saved = await saveStaticPage(db, result.user.id, staticPagePayload(isRecord(request.body) ? request.body : {}, true));
      if (!saved.ok) return pageStaticPageEditor(request, reply, result.user, result.access, null, saved.message);
      return reply.redirect('/admin-settings/static-pages?saved=1', 303);
    });

    routes.get<{ Params: { pageId: string } }>('/admin-settings/static-pages/:pageId/edit', async (request, reply) => {
      const result = await pageAccess(request, reply, db, options);
      if (!result) return reply;
      const pageId = validRouteId(request.params.pageId);
      const page = pageId ? await readStaticPage(db, pageId) : null;
      if (!page) return reply.code(404).type('text/plain; charset=utf-8').send('페이지를 찾을 수 없습니다.');
      return pageStaticPageEditor(request, reply, result.user, result.access, page);
    });

    routes.post<{ Params: { pageId: string }; Body: unknown }>('/admin-settings/static-pages/:pageId/edit', { bodyLimit: 1024 * 1024 }, async (request, reply) => {
      if (!csrfValid(request, options)) return reply.code(403).type('text/plain; charset=utf-8').send('요청을 확인할 수 없습니다. 페이지를 새로고침해 주세요.');
      const result = await pageAccess(request, reply, db, options);
      if (!result) return reply;
      const pageId = validRouteId(request.params.pageId);
      const current = pageId ? await readStaticPage(db, pageId) : null;
      if (!pageId || !current) return reply.code(404).type('text/plain; charset=utf-8').send('페이지를 찾을 수 없습니다.');
      const saved = await saveStaticPage(db, result.user.id, staticPagePayload(isRecord(request.body) ? request.body : {}, true), pageId);
      if (!saved.ok) return pageStaticPageEditor(request, reply, result.user, result.access, current, saved.message);
      return reply.redirect('/admin-settings/static-pages?saved=1', 303);
    });

    routes.post<{ Params: { pageId: string }; Body: unknown }>('/admin-settings/static-pages/:pageId/delete', { bodyLimit: 8 * 1024 }, async (request, reply) => {
      if (!csrfValid(request, options)) return reply.code(403).type('text/plain; charset=utf-8').send('요청을 확인할 수 없습니다. 페이지를 새로고침해 주세요.');
      const result = await pageAccess(request, reply, db, options);
      if (!result) return reply;
      const pageId = validRouteId(request.params.pageId);
      if (!pageId) return pageStaticPages(request, reply, db, result.user, result.access, 'Static page not found.');
      const deleted = await db.$executeRaw`DELETE FROM board_staticpage WHERE id = ${pageId}`;
      if (deleted === 0) return pageStaticPages(request, reply, db, result.user, result.access, 'Static page not found.');
      return reply.redirect('/admin-settings/static-pages?saved=1', 303);
    });

    routes.get('/v1/static-pages', async (request, reply) => {
      const permission = await apiAccess(request, db, options);
      if ('response' in permission) return reply.send(permission.response);
      return reply.send(success({ pages: (await readStaticPages(db)).map(staticPageApi) }));
    });

    routes.get<{ Params: { pageId: string } }>('/v1/static-pages/:pageId', async (request, reply) => {
      const permission = await apiAccess(request, db, options);
      if ('response' in permission) return reply.send(permission.response);
      const pageId = validRouteId(request.params.pageId);
      const page = pageId ? await readStaticPage(db, pageId) : null;
      if (!page) return reply.code(404).type('text/plain; charset=utf-8').send('Not found');
      return reply.send(success(staticPageApi(page)));
    });

    routes.post<{ Body: unknown }>('/v1/static-pages', { bodyLimit: 1024 * 1024 }, async (request, reply) => {
      if (!csrfValid(request, options)) return reply.code(403).type('text/plain; charset=utf-8').send('Forbidden');
      const permission = await apiAccess(request, db, options);
      if ('response' in permission) return reply.send(permission.response);
      const saved = await saveStaticPage(db, permission.user.id, staticPagePayload(apiJsonBody(request)));
      return saved.ok ? reply.send(success(staticPageApi(saved.body))) : reply.send(failure(saved.code, saved.message));
    });

    routes.put<{ Params: { pageId: string }; Body: unknown }>('/v1/static-pages/:pageId', { bodyLimit: 1024 * 1024 }, async (request, reply) => {
      if (!csrfValid(request, options)) return reply.code(403).type('text/plain; charset=utf-8').send('Forbidden');
      const permission = await apiAccess(request, db, options);
      if ('response' in permission) return reply.send(permission.response);
      const pageId = validRouteId(request.params.pageId);
      if (!pageId || !(await readStaticPage(db, pageId))) return reply.code(404).type('text/plain; charset=utf-8').send('Not found');
      const saved = await saveStaticPage(db, permission.user.id, staticPagePayload(apiJsonBody(request)), pageId);
      return saved.ok ? reply.send(success(staticPageApi(saved.body))) : reply.send(failure(saved.code, saved.message));
    });

    routes.delete<{ Params: { pageId: string } }>('/v1/static-pages/:pageId', async (request, reply) => {
      if (!csrfValid(request, options)) return reply.code(403).type('text/plain; charset=utf-8').send('Forbidden');
      const permission = await apiAccess(request, db, options);
      if ('response' in permission) return reply.send(permission.response);
      const pageId = validRouteId(request.params.pageId);
      if (!pageId) return reply.code(404).type('text/plain; charset=utf-8').send('Not found');
      const deleted = await db.$executeRaw`DELETE FROM board_staticpage WHERE id = ${pageId}`;
      if (!deleted) return reply.code(404).type('text/plain; charset=utf-8').send('Not found');
      return reply.send(success({ message: 'Static page deleted.' }));
    });
}
