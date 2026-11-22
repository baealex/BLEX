import { type PrismaClient } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import { done as success, failure } from '../../../platform/response.js';
import { UtilityAction, pageUtilities, readUtilityStats, runUtilityAction } from '../services/utilities.js';
import { AdminSettingsOptions, Body, apiAccess, camelizeValue, csrfValid, formBoolean, isRecord, pageAccess, stringValue, unauthorizedPage } from '../shared.js';

export function registerUtilitiesRoutes(routes: FastifyInstance, db: PrismaClient, options: AdminSettingsOptions) {
    routes.get('/admin-settings/utilities', async (request, reply) => {
      const result = await pageAccess(request, reply, db, options);
      if (!result) return reply;
      if (!result.access.superuser) return unauthorizedPage(reply);
      return pageUtilities(request, reply, db, options, result.user, result.access);
    });

    routes.post<{ Body: unknown }>('/admin-settings/utilities', { bodyLimit: 64 * 1024 }, async (request, reply) => {
      if (!csrfValid(request, options)) return reply.code(403).type('text/plain; charset=utf-8').send('요청을 확인할 수 없습니다. 페이지를 새로고침해 주세요.');
      const result = await pageAccess(request, reply, db, options);
      if (!result) return reply;
      if (!result.access.superuser) return unauthorizedPage(reply);
      const form = isRecord(request.body) ? request.body : {};
      const actionValue = stringValue(form.action);
      if (actionValue !== 'clean_tags' && actionValue !== 'clean_sessions' && actionValue !== 'clean_logs' && actionValue !== 'clean_images') {
        return pageUtilities(request, reply, db, options, result.user, result.access, undefined, 'Choose a valid maintenance task.');
      }
      const cleanAll = formBoolean(form.clean_all);
      const payload: Body = {
        dry_run: formBoolean(form.dry_run),
        clean_all: cleanAll,
        confirmation_token: stringValue(form.confirmation_token),
        target: stringValue(form.target) || 'all',
        remove_duplicates: formBoolean(form.remove_duplicates),
        preview_hash: stringValue(form.preview_hash),
      };
      const utility = await runUtilityAction(db, request, result.user.id, actionValue, payload, options);
      if (!utility.ok) return pageUtilities(request, reply, db, options, result.user, result.access, undefined, utility.message);
      const data = camelizeValue(utility.body) as Record<string, unknown>;
      const confirmationToken = typeof data.confirmationToken === 'string' ? data.confirmationToken : undefined;
      delete data.confirmationToken;
      return pageUtilities(request, reply, db, options, result.user, result.access, {
        action: actionValue,
        data,
        confirmationToken,
        cleanAll,
      });
    });

    routes.get('/v1/utilities/stats', async (request, reply) => {
      const permission = await apiAccess(request, db, options);
      if ('response' in permission) return reply.send(permission.response);
      if (!permission.access.superuser) return reply.send(failure('RJ', 'Superuser access is required.'));
      return reply.send(success(camelizeValue(await readUtilityStats(db))));
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
        return result.ok
          ? reply.send(success(camelizeValue(result.body)))
          : reply.send(failure(result.code, result.message));
      });
    }
}
