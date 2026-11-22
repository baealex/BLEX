import { type PrismaClient } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import { done as success, failure } from '../../../platform/response.js';
import { createInvite, deleteInvite, managedUserApi, managedUserListApi, pageInvites, readInvites, readManagedUsers, updateManagedUserRole } from '../services/users.js';
import { AdminSettingsOptions, apiAccess, apiJsonBody, csrfValid, isRecord, pageAccess, stringValue, validRouteId } from '../shared.js';

export function registerUsersRoutes(routes: FastifyInstance, db: PrismaClient, options: AdminSettingsOptions) {
    routes.get('/admin-settings/users', async (request, reply) => {
      const result = await pageAccess(request, reply, db, options);
      if (!result) return reply;
      return pageInvites(request, reply, db, result.user, result.access);
    });

    routes.post<{ Body: unknown }>('/admin-settings/users', { bodyLimit: 64 * 1024 }, async (request, reply) => {
      if (!csrfValid(request, options)) return reply.code(403).type('text/plain; charset=utf-8').send('요청을 확인할 수 없습니다. 페이지를 새로고침해 주세요.');
      const result = await pageAccess(request, reply, db, options);
      if (!result) return reply;
      const input = isRecord(request.body) ? request.body : {};
      await createInvite(db, result.user.id, input.note);
      return reply.redirect('/admin-settings/users?saved=1', 303);
    });

    routes.post<{ Params: { inviteId: string }; Body: unknown }>('/admin-settings/users/:inviteId/delete', { bodyLimit: 8 * 1024 }, async (request, reply) => {
      if (!csrfValid(request, options)) return reply.code(403).type('text/plain; charset=utf-8').send('요청을 확인할 수 없습니다. 페이지를 새로고침해 주세요.');
      const result = await pageAccess(request, reply, db, options);
      if (!result) return reply;
      if (!/^\d+$/.test(request.params.inviteId) || !Number.isSafeInteger(Number(request.params.inviteId))) {
        return pageInvites(request, reply, db, result.user, result.access, 'Invitation link not found.');
      }
      const deleted = await deleteInvite(db, Number(request.params.inviteId));
      if (deleted === 'claimed') return pageInvites(request, reply, db, result.user, result.access, 'A used invitation link cannot be deleted.');
      if (deleted === 'missing') return pageInvites(request, reply, db, result.user, result.access, 'Invitation link not found.');
      return reply.redirect('/admin-settings/users?saved=1', 303);
    });

    routes.post<{ Params: { userId: string }; Body: unknown }>('/admin-settings/users/:userId/role', { bodyLimit: 8 * 1024 }, async (request, reply) => {
      if (!csrfValid(request, options)) return reply.code(403).type('text/plain; charset=utf-8').send('요청을 확인할 수 없습니다. 페이지를 새로고침해 주세요.');
      const result = await pageAccess(request, reply, db, options);
      if (!result) return reply;
      const userId = validRouteId(request.params.userId);
      if (!userId) return pageInvites(request, reply, db, result.user, result.access, 'User not found.');
      const body = isRecord(request.body) ? request.body : {};
      const update = await updateManagedUserRole(db, result.user.id, userId, stringValue(body.role));
      if (!update.ok) return pageInvites(request, reply, db, result.user, result.access, update.message);
      return reply.redirect('/admin-settings/users?saved=1', 303);
    });

    routes.get('/v1/admin/users', async (request, reply) => {
      const permission = await apiAccess(request, db, options);
      if ('response' in permission) return reply.send(permission.response);
      return reply.send(success(managedUserListApi(await readManagedUsers(db, request))));
    });

    routes.patch<{ Params: { userId: string }; Body: unknown }>('/v1/admin/users/:userId/role', { bodyLimit: 64 * 1024 }, async (request, reply) => {
      if (!csrfValid(request, options)) return reply.code(403).type('text/plain; charset=utf-8').send('Forbidden');
      const permission = await apiAccess(request, db, options);
      if ('response' in permission) return reply.send(permission.response);
      const targetId = validRouteId(request.params.userId);
      if (!targetId) return reply.send(failure('NF', 'User not found.'));
      const body = apiJsonBody(request);
      const updated = await updateManagedUserRole(db, permission.user.id, targetId, body.role);
      return updated.ok
        ? reply.send(success({ user: managedUserApi(updated.body) }))
        : reply.send(failure(updated.code, updated.message));
    });

    routes.get('/v1/admin/author-invites', async (request, reply) => {
      const permission = await apiAccess(request, db, options);
      if ('response' in permission) return reply.send(permission.response);
      return reply.send(success({ invites: await readInvites(db) }));
    });

    routes.post<{ Body: unknown }>('/v1/admin/author-invites', { bodyLimit: 64 * 1024 }, async (request, reply) => {
      if (!csrfValid(request, options)) return reply.code(403).type('text/plain; charset=utf-8').send('Forbidden');
      const permission = await apiAccess(request, db, options);
      if ('response' in permission) return reply.send(permission.response);
      const body = apiJsonBody(request);
      const invite = await createInvite(db, permission.user.id, body.note);
      return reply.send(success({ invite }));
    });

    routes.delete<{ Params: { inviteId: string } }>('/v1/admin/author-invites/:inviteId', async (request, reply) => {
      if (!csrfValid(request, options)) return reply.code(403).type('text/plain; charset=utf-8').send('Forbidden');
      const permission = await apiAccess(request, db, options);
      if ('response' in permission) return reply.send(permission.response);
      if (!/^\d+$/.test(request.params.inviteId) || !Number.isSafeInteger(Number(request.params.inviteId))) {
        return reply.send(failure('NF', 'Invitation link not found.'));
      }
      const id = Number(request.params.inviteId);
      const deleted = await deleteInvite(db, id);
      if (deleted === 'claimed') return reply.send(failure('RJ', 'A used invitation link cannot be deleted.'));
      if (deleted === 'missing') return reply.send(failure('NF', 'Invitation link not found.'));
      return reply.send(success());
    });
}
