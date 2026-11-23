import { type PrismaClient } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import { done as success, failure } from '../../../platform/response.js';
import {
  createInvite,
  deleteInvite,
  deleteMember,
  issueMemberPasswordLink,
  readInvites,
  readManagedUsers,
  resetMemberTwoFactor,
  setMemberActive,
  updateManagedUserRole,
} from '../services/users.js';
import { AdminSettingsOptions, apiAccess, apiJsonBody, csrfValid, sendApiResult, validRouteId } from '../shared.js';

export function registerUsersRoutes(routes: FastifyInstance, db: PrismaClient, options: AdminSettingsOptions) {
  routes.get('/v1/admin/users', async (request, reply) => {
    const permission = await apiAccess(request, db, options);
    if ('response' in permission) return reply.send(permission.response);
    return reply.send(
      success(await readManagedUsers(db, request, { id: permission.user.id, superuser: permission.access.superuser })),
    );
  });

  routes.patch<{ Params: { userId: string }; Body: unknown }>(
    '/v1/admin/users/:userId/role',
    { bodyLimit: 64 * 1024 },
    async (request, reply) => {
      if (!csrfValid(request, options)) return reply.code(403).type('text/plain; charset=utf-8').send('Forbidden');
      const permission = await apiAccess(request, db, options);
      if ('response' in permission) return reply.send(permission.response);
      const targetId = validRouteId(request.params.userId);
      if (!targetId) return reply.send(failure('NF', 'User not found.'));
      const body = apiJsonBody(request);
      const updated = await updateManagedUserRole(
        db,
        { id: permission.user.id, superuser: permission.access.superuser },
        targetId,
        body.role,
      );
      return updated.ok
        ? reply.send(success({ user: updated.body }))
        : reply.send(failure(updated.code, updated.message));
    },
  );

  routes.patch<{ Params: { userId: string }; Body: unknown }>(
    '/v1/admin/users/:userId/status',
    { bodyLimit: 1024 },
    async (request, reply) => {
      if (!csrfValid(request, options)) return reply.code(403).type('text/plain; charset=utf-8').send('Forbidden');
      const permission = await apiAccess(request, db, options);
      if ('response' in permission) return reply.send(permission.response);
      const targetId = validRouteId(request.params.userId);
      if (!targetId) return reply.send(failure('NF', 'User not found.'));
      const actor = { id: permission.user.id, superuser: permission.access.superuser };
      const updated = await setMemberActive(db, actor, targetId, apiJsonBody(request).isActive);
      return updated.ok
        ? reply.send(success({ user: updated.body }))
        : reply.send(failure(updated.code, updated.message));
    },
  );

  routes.delete<{ Params: { userId: string }; Body: unknown }>(
    '/v1/admin/users/:userId',
    { bodyLimit: 1024 },
    async (request, reply) => {
      if (!csrfValid(request, options)) return reply.code(403).type('text/plain; charset=utf-8').send('Forbidden');
      const permission = await apiAccess(request, db, options);
      if ('response' in permission) return reply.send(permission.response);
      const targetId = validRouteId(request.params.userId);
      if (!targetId) return reply.send(failure('NF', 'User not found.'));
      const actor = { id: permission.user.id, superuser: permission.access.superuser };
      return sendApiResult(
        reply,
        await deleteMember(db, actor, targetId, apiJsonBody(request).username, options.mediaRoot),
      );
    },
  );

  routes.delete<{ Params: { userId: string } }>('/v1/admin/users/:userId/two-factor', async (request, reply) => {
    if (!csrfValid(request, options)) return reply.code(403).type('text/plain; charset=utf-8').send('Forbidden');
    const permission = await apiAccess(request, db, options);
    if ('response' in permission) return reply.send(permission.response);
    const targetId = validRouteId(request.params.userId);
    if (!targetId) return reply.send(failure('NF', 'User not found.'));
    const actor = { id: permission.user.id, superuser: permission.access.superuser };
    const updated = await resetMemberTwoFactor(db, actor, targetId);
    return updated.ok
      ? reply.send(success({ user: updated.body }))
      : reply.send(failure(updated.code, updated.message));
  });

  routes.post<{ Params: { userId: string } }>('/v1/admin/users/:userId/password-link', async (request, reply) => {
    if (!csrfValid(request, options)) return reply.code(403).type('text/plain; charset=utf-8').send('Forbidden');
    const permission = await apiAccess(request, db, options);
    if ('response' in permission) return reply.send(permission.response);
    const targetId = validRouteId(request.params.userId);
    if (!targetId) return reply.send(failure('NF', 'User not found.'));
    const actor = { id: permission.user.id, superuser: permission.access.superuser };
    return sendApiResult(reply, await issueMemberPasswordLink(db, actor, targetId, options.secretKey, options.siteUrl));
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
