import { type PrismaClient } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import { done as success, failure } from '../../../platform/response.js';
import { UtilityAction, readUtilityStats, runUtilityAction } from '../services/utilities.js';
import { AdminSettingsOptions, apiAccess, csrfValid, isRecord, sendApiResult } from '../shared.js';

export function registerUtilitiesRoutes(routes: FastifyInstance, db: PrismaClient, options: AdminSettingsOptions) {
    routes.get('/v1/utilities/stats', async (request, reply) => {
      const permission = await apiAccess(request, db, options);
      if ('response' in permission) return reply.send(permission.response);
      if (!permission.access.superuser) return reply.send(failure('RJ', 'Superuser access is required.'));
      return reply.send(success(await readUtilityStats(db)));
    });

    const utilityActions: Array<{ path: string; action: UtilityAction }> = [
      { path: '/v1/utilities/clean-tags', action: 'clean_tags' },
      { path: '/v1/utilities/clean-sessions', action: 'clean_sessions' },
      { path: '/v1/utilities/clean-logs', action: 'clean_logs' },
        { path: '/v1/utilities/clean-images', action: 'clean_images' },
    ];

    for (const route of utilityActions) {
      routes.post<{ Body: unknown }>(route.path, { bodyLimit: 64 * 1024 }, async (request, reply) => {
        if (!csrfValid(request, options)) return reply.code(403).type('text/plain; charset=utf-8').send('Forbidden');
        const permission = await apiAccess(request, db, options);
        if ('response' in permission) return reply.send(permission.response);
        if (!permission.access.superuser) return reply.send(failure('RJ', 'Superuser access is required.'));
        if (!isRecord(request.body)) return reply.send(failure('VA', 'Invalid request body.'));
        const result = await runUtilityAction(db, request, permission.user.id, route.action, request.body, options);
        return sendApiResult(reply, result);
      });
    }
}
