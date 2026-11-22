import { type PrismaClient } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import { done as success, failure } from '../../../platform/response.js';
import { readStaticPage, readStaticPages, saveStaticPage, staticPageApi, staticPagePayload } from '../services/static-pages.js';
import { AdminSettingsOptions, apiAccess, apiJsonBody, csrfValid, validRouteId } from '../shared.js';

export function registerStaticPagesRoutes(routes: FastifyInstance, db: PrismaClient, options: AdminSettingsOptions) {
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
