import { type PrismaClient } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import { done as success, failure } from '../../../platform/response.js';
import { noticePayload, readNotice, readNotices, saveNotice } from '../services/notices.js';
import { AdminSettingsOptions, apiAccess, apiJsonBody, csrfValid, editorApiAccess, validRouteId } from '../shared.js';

export function registerNoticesRoutes(routes: FastifyInstance, db: PrismaClient, options: AdminSettingsOptions) {
  routes.get('/v1/notices', async (request, reply) => {
    const permission = await editorApiAccess(request, db, options);
    if ('response' in permission) return reply.send(permission.response);
    return reply.send(success({ notices: await readNotices(db, 'user', permission.user.id) }));
  });

  routes.get<{ Params: { noticeId: string } }>('/v1/notices/:noticeId', async (request, reply) => {
    const permission = await editorApiAccess(request, db, options);
    if ('response' in permission) return reply.send(permission.response);
    const noticeId = validRouteId(request.params.noticeId);
    const notice = noticeId ? await readNotice(db, noticeId, 'user', permission.user.id) : null;
    if (!notice) return reply.code(404).type('text/plain; charset=utf-8').send('Not found');
    return reply.send(success(notice));
  });

  routes.post<{ Body: unknown }>('/v1/notices', { bodyLimit: 64 * 1024 }, async (request, reply) => {
    if (!csrfValid(request, options)) return reply.code(403).type('text/plain; charset=utf-8').send('Forbidden');
    const permission = await editorApiAccess(request, db, options);
    if ('response' in permission) return reply.send(permission.response);
    const saved = await saveNotice(db, noticePayload(apiJsonBody(request)), undefined, 'user', permission.user.id);
    return saved.ok ? reply.send(success(saved.body)) : reply.send(failure(saved.code, saved.message));
  });

  routes.put<{ Params: { noticeId: string }; Body: unknown }>(
    '/v1/notices/:noticeId',
    { bodyLimit: 64 * 1024 },
    async (request, reply) => {
      if (!csrfValid(request, options)) return reply.code(403).type('text/plain; charset=utf-8').send('Forbidden');
      const permission = await editorApiAccess(request, db, options);
      if ('response' in permission) return reply.send(permission.response);
      const noticeId = validRouteId(request.params.noticeId);
      if (!noticeId || !(await readNotice(db, noticeId, 'user', permission.user.id))) {
        return reply.code(404).type('text/plain; charset=utf-8').send('Not found');
      }
      const saved = await saveNotice(db, noticePayload(apiJsonBody(request)), noticeId, 'user', permission.user.id);
      return saved.ok ? reply.send(success(saved.body)) : reply.send(failure(saved.code, saved.message));
    },
  );

  routes.delete<{ Params: { noticeId: string } }>('/v1/notices/:noticeId', async (request, reply) => {
    if (!csrfValid(request, options)) return reply.code(403).type('text/plain; charset=utf-8').send('Forbidden');
    const permission = await editorApiAccess(request, db, options);
    if ('response' in permission) return reply.send(permission.response);
    const noticeId = validRouteId(request.params.noticeId);
    if (!noticeId) return reply.code(404).type('text/plain; charset=utf-8').send('Not found');
    const { count } = await db.siteNotice.deleteMany({
      where: { scope: 'user', userId: permission.user.id, id: noticeId },
    });
    if (!count) return reply.code(404).type('text/plain; charset=utf-8').send('Not found');
    return reply.send(success({ message: 'Notice deleted.' }));
  });

  routes.get('/v1/global-notices', async (request, reply) => {
    const permission = await apiAccess(request, db, options);
    if ('response' in permission) return reply.send(permission.response);
    return reply.send(success({ notices: await readNotices(db) }));
  });

  routes.get<{ Params: { noticeId: string } }>('/v1/global-notices/:noticeId', async (request, reply) => {
    const permission = await apiAccess(request, db, options);
    if ('response' in permission) return reply.send(permission.response);
    const noticeId = validRouteId(request.params.noticeId);
    const notice = noticeId ? await readNotice(db, noticeId) : null;
    if (!notice) return reply.code(404).type('text/plain; charset=utf-8').send('Not found');
    return reply.send(success(notice));
  });

  routes.post<{ Body: unknown }>('/v1/global-notices', { bodyLimit: 64 * 1024 }, async (request, reply) => {
    if (!csrfValid(request, options)) return reply.code(403).type('text/plain; charset=utf-8').send('Forbidden');
    const permission = await apiAccess(request, db, options);
    if ('response' in permission) return reply.send(permission.response);
    const saved = await saveNotice(db, noticePayload(apiJsonBody(request)));
    return saved.ok ? reply.send(success(saved.body)) : reply.send(failure(saved.code, saved.message));
  });

  routes.put<{ Params: { noticeId: string }; Body: unknown }>(
    '/v1/global-notices/:noticeId',
    { bodyLimit: 64 * 1024 },
    async (request, reply) => {
      if (!csrfValid(request, options)) return reply.code(403).type('text/plain; charset=utf-8').send('Forbidden');
      const permission = await apiAccess(request, db, options);
      if ('response' in permission) return reply.send(permission.response);
      const noticeId = validRouteId(request.params.noticeId);
      if (!noticeId) return reply.code(404).type('text/plain; charset=utf-8').send('Not found');
      const saved = await saveNotice(db, noticePayload(apiJsonBody(request)), noticeId);
      return saved.ok ? reply.send(success(saved.body)) : reply.send(failure(saved.code, saved.message));
    },
  );

  routes.delete<{ Params: { noticeId: string } }>('/v1/global-notices/:noticeId', async (request, reply) => {
    if (!csrfValid(request, options)) return reply.code(403).type('text/plain; charset=utf-8').send('Forbidden');
    const permission = await apiAccess(request, db, options);
    if ('response' in permission) return reply.send(permission.response);
    const noticeId = validRouteId(request.params.noticeId);
    if (!noticeId) return reply.code(404).type('text/plain; charset=utf-8').send('Not found');
    const { count } = await db.siteNotice.deleteMany({ where: { scope: 'global', id: noticeId } });
    if (!count) return reply.code(404).type('text/plain; charset=utf-8').send('Not found');
    return reply.send(success({ message: 'Notice deleted.' }));
  });
}
