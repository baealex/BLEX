import { type PrismaClient } from '@prisma/client';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { done as success, failure } from '../../../platform/response.js';
import {
  deleteModeratedComment,
  moveModeratedPostToTrash,
  readModeratedComments,
  readModeratedPosts,
  restoreModeratedPost,
  setModeratedPostHidden,
} from '../services/moderation.js';
import {
  AdminSettingsOptions,
  ApiResult,
  apiAccess,
  apiJsonBody,
  csrfValid,
  sendApiResult,
  validRouteId,
} from '../shared.js';

export function registerModerationRoutes(routes: FastifyInstance, db: PrismaClient, options: AdminSettingsOptions) {
  const moderate = async <T>(
    request: FastifyRequest,
    reply: FastifyReply,
    rawId: string,
    missing: string,
    action: (actorId: number, id: number) => Promise<ApiResult<T>>,
  ) => {
    if (!csrfValid(request, options)) return reply.code(403).type('text/plain; charset=utf-8').send('Forbidden');
    const permission = await apiAccess(request, db, options);
    if ('response' in permission) return reply.send(permission.response);
    const id = validRouteId(rawId);
    if (!id) return reply.send(failure('NF', missing));
    return sendApiResult(reply, await action(permission.user.id, id));
  };

  routes.get('/v1/admin/posts', async (request, reply) => {
    const permission = await apiAccess(request, db, options);
    if ('response' in permission) return reply.send(permission.response);
    return reply.send(success(await readModeratedPosts(db, request)));
  });

  routes.patch<{ Params: { postId: string }; Body: unknown }>(
    '/v1/admin/posts/:postId',
    { bodyLimit: 1024 },
    (request, reply) =>
      moderate(request, reply, request.params.postId, 'Post not found.', (actorId, id) =>
        setModeratedPostHidden(db, actorId, id, apiJsonBody(request).isHidden),
      ),
  );

  routes.post<{ Params: { postId: string } }>('/v1/admin/posts/:postId/trash', (request, reply) =>
    moderate(request, reply, request.params.postId, 'Post not found.', (actorId, id) =>
      moveModeratedPostToTrash(db, actorId, id),
    ),
  );

  routes.post<{ Params: { postId: string } }>('/v1/admin/posts/:postId/restore', (request, reply) =>
    moderate(request, reply, request.params.postId, 'Post not found.', (actorId, id) =>
      restoreModeratedPost(db, actorId, id),
    ),
  );

  routes.get('/v1/admin/comments', async (request, reply) => {
    const permission = await apiAccess(request, db, options);
    if ('response' in permission) return reply.send(permission.response);
    return reply.send(success(await readModeratedComments(db, request)));
  });

  routes.delete<{ Params: { commentId: string } }>('/v1/admin/comments/:commentId', (request, reply) =>
    moderate(request, reply, request.params.commentId, 'Comment not found.', (actorId, id) =>
      deleteModeratedComment(db, actorId, id),
    ),
  );
}
