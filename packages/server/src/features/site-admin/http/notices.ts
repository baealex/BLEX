import { type PrismaClient } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import { done as success, failure } from '../../../platform/response.js';
import { noticeApi, noticePayload, pageAuthorNotices, pageNotices, readNotice, readNotices, saveNotice } from '../services/notices.js';
import { AdminSettingsOptions, apiAccess, apiJsonBody, csrfValid, editorApiAccess, editorPageAccess, isRecord, pageAccess, validRouteId } from '../shared.js';

export function registerNoticesRoutes(routes: FastifyInstance, db: PrismaClient, options: AdminSettingsOptions) {
    routes.get('/admin-settings/global-notices', async (request, reply) => {
      const result = await pageAccess(request, reply, db, options);
      if (!result) return reply;
      return pageNotices(request, reply, db, result.user, result.access);
    });

    routes.post<{ Body: unknown }>('/admin-settings/global-notices', { bodyLimit: 64 * 1024 }, async (request, reply) => {
      if (!csrfValid(request, options)) return reply.code(403).type('text/plain; charset=utf-8').send('요청을 확인할 수 없습니다. 페이지를 새로고침해 주세요.');
      const result = await pageAccess(request, reply, db, options);
      if (!result) return reply;
      const saved = await saveNotice(db, noticePayload(isRecord(request.body) ? request.body : {}, true));
      if (!saved.ok) return pageNotices(request, reply, db, result.user, result.access, saved.message);
      return reply.redirect('/admin-settings/global-notices?saved=1', 303);
    });

    routes.post<{ Params: { noticeId: string }; Body: unknown }>('/admin-settings/global-notices/:noticeId', { bodyLimit: 64 * 1024 }, async (request, reply) => {
      if (!csrfValid(request, options)) return reply.code(403).type('text/plain; charset=utf-8').send('요청을 확인할 수 없습니다. 페이지를 새로고침해 주세요.');
      const result = await pageAccess(request, reply, db, options);
      if (!result) return reply;
      const noticeId = validRouteId(request.params.noticeId);
      if (!noticeId) return pageNotices(request, reply, db, result.user, result.access, 'Notice not found.');
      const saved = await saveNotice(db, noticePayload(isRecord(request.body) ? request.body : {}, true), noticeId);
      if (!saved.ok) return pageNotices(request, reply, db, result.user, result.access, saved.message);
      return reply.redirect('/admin-settings/global-notices?saved=1', 303);
    });

    routes.post<{ Params: { noticeId: string }; Body: unknown }>('/admin-settings/global-notices/:noticeId/delete', { bodyLimit: 8 * 1024 }, async (request, reply) => {
      if (!csrfValid(request, options)) return reply.code(403).type('text/plain; charset=utf-8').send('요청을 확인할 수 없습니다. 페이지를 새로고침해 주세요.');
      const result = await pageAccess(request, reply, db, options);
      if (!result) return reply;
      const noticeId = validRouteId(request.params.noticeId);
      if (!noticeId) return pageNotices(request, reply, db, result.user, result.access, 'Notice not found.');
      const deleted = await db.$executeRaw`DELETE FROM board_sitenotice WHERE scope = 'global' AND id = ${noticeId}`;
      if (deleted === 0) return pageNotices(request, reply, db, result.user, result.access, 'Notice not found.');
      return reply.redirect('/admin-settings/global-notices?saved=1', 303);
    });

    routes.get('/settings/notices', async (request, reply) => {
      const result = await editorPageAccess(request, reply, db, options);
      if (!result) return reply;
      return pageAuthorNotices(request, reply, db, result.user);
    });

    routes.post<{ Body: unknown }>('/settings/notices', { bodyLimit: 64 * 1024 }, async (request, reply) => {
      if (!csrfValid(request, options)) return reply.code(403).type('text/plain; charset=utf-8').send('요청을 확인할 수 없습니다. 페이지를 새로고침해 주세요.');
      const result = await editorPageAccess(request, reply, db, options);
      if (!result) return reply;
      const saved = await saveNotice(db, noticePayload(isRecord(request.body) ? request.body : {}, true), undefined, 'user', result.user.id);
      if (!saved.ok) return pageAuthorNotices(request, reply, db, result.user, saved.message);
      return reply.redirect('/settings/notices?saved=1', 303);
    });

    routes.post<{ Params: { noticeId: string }; Body: unknown }>('/settings/notices/:noticeId', { bodyLimit: 64 * 1024 }, async (request, reply) => {
      if (!csrfValid(request, options)) return reply.code(403).type('text/plain; charset=utf-8').send('요청을 확인할 수 없습니다. 페이지를 새로고침해 주세요.');
      const result = await editorPageAccess(request, reply, db, options);
      if (!result) return reply;
      const noticeId = validRouteId(request.params.noticeId);
      if (!noticeId || !(await readNotice(db, noticeId, 'user', result.user.id))) {
        return pageAuthorNotices(request, reply, db, result.user, 'Notice not found.');
      }
      const saved = await saveNotice(db, noticePayload(isRecord(request.body) ? request.body : {}, true), noticeId, 'user', result.user.id);
      if (!saved.ok) return pageAuthorNotices(request, reply, db, result.user, saved.message);
      return reply.redirect('/settings/notices?saved=1', 303);
    });

    routes.post<{ Params: { noticeId: string }; Body: unknown }>('/settings/notices/:noticeId/delete', { bodyLimit: 8 * 1024 }, async (request, reply) => {
      if (!csrfValid(request, options)) return reply.code(403).type('text/plain; charset=utf-8').send('요청을 확인할 수 없습니다. 페이지를 새로고침해 주세요.');
      const result = await editorPageAccess(request, reply, db, options);
      if (!result) return reply;
      const noticeId = validRouteId(request.params.noticeId);
      const deleted = noticeId ? await db.$executeRaw`
        DELETE FROM board_sitenotice WHERE scope = 'user' AND user_id = ${result.user.id} AND id = ${noticeId}
      ` : 0;
      if (!deleted) return pageAuthorNotices(request, reply, db, result.user, 'Notice not found.');
      return reply.redirect('/settings/notices?saved=1', 303);
    });

    routes.get('/v1/notices', async (request, reply) => {
      const permission = await editorApiAccess(request, db, options);
      if ('response' in permission) return reply.send(permission.response);
      return reply.send(success({ notices: (await readNotices(db, 'user', permission.user.id)).map(noticeApi) }));
    });

    routes.get<{ Params: { noticeId: string } }>('/v1/notices/:noticeId', async (request, reply) => {
      const permission = await editorApiAccess(request, db, options);
      if ('response' in permission) return reply.send(permission.response);
      const noticeId = validRouteId(request.params.noticeId);
      const notice = noticeId ? await readNotice(db, noticeId, 'user', permission.user.id) : null;
      if (!notice) return reply.code(404).type('text/plain; charset=utf-8').send('Not found');
      return reply.send(success(noticeApi(notice)));
    });

    routes.post<{ Body: unknown }>('/v1/notices', { bodyLimit: 64 * 1024 }, async (request, reply) => {
      if (!csrfValid(request, options)) return reply.code(403).type('text/plain; charset=utf-8').send('Forbidden');
      const permission = await editorApiAccess(request, db, options);
      if ('response' in permission) return reply.send(permission.response);
      const saved = await saveNotice(db, noticePayload(apiJsonBody(request)), undefined, 'user', permission.user.id);
      return saved.ok ? reply.send(success(noticeApi(saved.body))) : reply.send(failure(saved.code, saved.message));
    });

    routes.put<{ Params: { noticeId: string }; Body: unknown }>('/v1/notices/:noticeId', { bodyLimit: 64 * 1024 }, async (request, reply) => {
      if (!csrfValid(request, options)) return reply.code(403).type('text/plain; charset=utf-8').send('Forbidden');
      const permission = await editorApiAccess(request, db, options);
      if ('response' in permission) return reply.send(permission.response);
      const noticeId = validRouteId(request.params.noticeId);
      if (!noticeId || !(await readNotice(db, noticeId, 'user', permission.user.id))) {
        return reply.code(404).type('text/plain; charset=utf-8').send('Not found');
      }
      const saved = await saveNotice(db, noticePayload(apiJsonBody(request)), noticeId, 'user', permission.user.id);
      return saved.ok ? reply.send(success(noticeApi(saved.body))) : reply.send(failure(saved.code, saved.message));
    });

    routes.delete<{ Params: { noticeId: string } }>('/v1/notices/:noticeId', async (request, reply) => {
      if (!csrfValid(request, options)) return reply.code(403).type('text/plain; charset=utf-8').send('Forbidden');
      const permission = await editorApiAccess(request, db, options);
      if ('response' in permission) return reply.send(permission.response);
      const noticeId = validRouteId(request.params.noticeId);
      if (!noticeId) return reply.code(404).type('text/plain; charset=utf-8').send('Not found');
      const deleted = await db.$executeRaw`
        DELETE FROM board_sitenotice WHERE scope = 'user' AND user_id = ${permission.user.id} AND id = ${noticeId}
      `;
      if (!deleted) return reply.code(404).type('text/plain; charset=utf-8').send('Not found');
      return reply.send(success({ message: 'Notice deleted.' }));
    });

    routes.get('/v1/global-notices', async (request, reply) => {
      const permission = await apiAccess(request, db, options);
      if ('response' in permission) return reply.send(permission.response);
      return reply.send(success({ notices: (await readNotices(db)).map(noticeApi) }));
    });

    routes.get<{ Params: { noticeId: string } }>('/v1/global-notices/:noticeId', async (request, reply) => {
      const permission = await apiAccess(request, db, options);
      if ('response' in permission) return reply.send(permission.response);
      const noticeId = validRouteId(request.params.noticeId);
      const notice = noticeId ? await readNotice(db, noticeId) : null;
      if (!notice) return reply.code(404).type('text/plain; charset=utf-8').send('Not found');
      return reply.send(success(noticeApi(notice)));
    });

    routes.post<{ Body: unknown }>('/v1/global-notices', { bodyLimit: 64 * 1024 }, async (request, reply) => {
      if (!csrfValid(request, options)) return reply.code(403).type('text/plain; charset=utf-8').send('Forbidden');
      const permission = await apiAccess(request, db, options);
      if ('response' in permission) return reply.send(permission.response);
      const saved = await saveNotice(db, noticePayload(apiJsonBody(request)));
      return saved.ok ? reply.send(success(noticeApi(saved.body))) : reply.send(failure(saved.code, saved.message));
    });

    routes.put<{ Params: { noticeId: string }; Body: unknown }>('/v1/global-notices/:noticeId', { bodyLimit: 64 * 1024 }, async (request, reply) => {
      if (!csrfValid(request, options)) return reply.code(403).type('text/plain; charset=utf-8').send('Forbidden');
      const permission = await apiAccess(request, db, options);
      if ('response' in permission) return reply.send(permission.response);
      const noticeId = validRouteId(request.params.noticeId);
      if (!noticeId) return reply.code(404).type('text/plain; charset=utf-8').send('Not found');
      const saved = await saveNotice(db, noticePayload(apiJsonBody(request)), noticeId);
      return saved.ok ? reply.send(success(noticeApi(saved.body))) : reply.send(failure(saved.code, saved.message));
    });

    routes.delete<{ Params: { noticeId: string } }>('/v1/global-notices/:noticeId', async (request, reply) => {
      if (!csrfValid(request, options)) return reply.code(403).type('text/plain; charset=utf-8').send('Forbidden');
      const permission = await apiAccess(request, db, options);
      if ('response' in permission) return reply.send(permission.response);
      const noticeId = validRouteId(request.params.noticeId);
      if (!noticeId) return reply.code(404).type('text/plain; charset=utf-8').send('Not found');
      const deleted = await db.$executeRaw`DELETE FROM board_sitenotice WHERE scope = 'global' AND id = ${noticeId}`;
      if (!deleted) return reply.code(404).type('text/plain; charset=utf-8').send('Not found');
      return reply.send(success({ message: 'Notice deleted.' }));
    });
}
