import { type PrismaClient } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import { done as success, failure } from '../../../platform/response.js';
import { deleteBrandAsset, uploadBrandAsset, validateBrandTarget } from '../services/brand-assets.js';
import { integrationSettingsApi, serializeIntegrationSettings, updateIntegrationSettings } from '../services/integrations.js';
import { serializeLoginSettings, updateLoginSettings } from '../services/login-settings.js';
import { apiSitePayload, readSiteRow, serializeSiteSettings, updateSiteSettings } from '../services/site-settings.js';
import { userListQuery } from '../services/users.js';
import { AdminSettingsOptions, Body, apiAccess, apiJsonBody, csrfValid, csrfValidWithBody, isRecord, readMultipartFields, sendApiResult, stringValue } from '../shared.js';

export function registerSiteSettingsRoutes(routes: FastifyInstance, db: PrismaClient, options: AdminSettingsOptions) {
    routes.post<{ Body: unknown }>('/v1/site-settings/brand-assets', { bodyLimit: 12 * 1024 * 1024 }, async (request, reply) => {
      const permission = await apiAccess(request, db, options);
      if ('response' in permission) return reply.send(permission.response);
      if (!permission.access.canManageSiteSettings) return reply.send(failure('RJ', 'Permission to change site settings is required.'));
      let parsed: { fields: Body; files: Map<string, Buffer> };
      try {
        parsed = await readMultipartFields(request);
      } catch {
        return reply.send(failure('VA', 'Could not read the uploaded brand files.'));
      }
      if (!csrfValidWithBody(request, options, parsed.fields)) return reply.code(403).type('text/plain; charset=utf-8').send('Forbidden');
      let target: ReturnType<typeof validateBrandTarget>;
      try {
        target = validateBrandTarget(parsed.fields);
      } catch (error) {
        return reply.send(failure('VA', error instanceof Error ? error.message : 'Check the brand asset type.'));
      }
      const saved = await uploadBrandAsset(db, permission.user.id, permission.access.superuser, {
        ...target,
        svg: parsed.files.get('svg'),
        files: parsed.files,
        manifest: stringValue(parsed.fields.manifest),
      }, options);
      return saved.ok ? reply.send(success(saved.body)) : reply.send(failure(saved.code, saved.message));
    });

    routes.delete<{ Body: unknown }>('/v1/site-settings/brand-assets', async (request, reply) => {
      if (!csrfValid(request, options)) return reply.code(403).type('text/plain; charset=utf-8').send('Forbidden');
      const permission = await apiAccess(request, db, options);
      if ('response' in permission) return reply.send(permission.response);
      if (!permission.access.canManageSiteSettings) return reply.send(failure('RJ', 'Permission to change site settings is required.'));
      const input = apiJsonBody(request);
      const query = userListQuery(request);
      let target: ReturnType<typeof validateBrandTarget>;
      try {
        target = validateBrandTarget({
          asset_type: input.asset_type ?? query.get('asset_type'),
          theme: input.theme ?? query.get('theme'),
        });
      } catch (error) {
        return reply.send(failure('VA', error instanceof Error ? error.message : 'Check the brand asset type.'));
      }
      const saved = await deleteBrandAsset(db, permission.user.id, permission.access.superuser, target, options);
      return saved.ok ? reply.send(success(saved.body)) : reply.send(failure(saved.code, saved.message));
    });

    routes.get('/v1/site-settings', async (request, reply) => {
      const permission = await apiAccess(request, db, options);
      if ('response' in permission) return reply.send(permission.response);
      if (!permission.access.canManageSiteSettings) return reply.send(failure('RJ', 'Permission to change site settings is required.'));
      return reply.send(success(await serializeSiteSettings(await readSiteRow(db), permission.access.superuser, options)));
    });

    routes.put<{ Body: unknown }>('/v1/site-settings', { bodyLimit: 1024 * 1024 }, async (request, reply) => {
      if (!csrfValid(request, options)) return reply.code(403).type('text/plain; charset=utf-8').send('Forbidden');
      const permission = await apiAccess(request, db, options);
      if ('response' in permission) return reply.send(permission.response);
      if (!permission.access.canManageSiteSettings) return reply.send(failure('RJ', 'Permission to change site settings is required.'));
      const updated = await updateSiteSettings(db, permission.user.id, permission.access.superuser, apiSitePayload(apiJsonBody(request)), options);
      return sendApiResult(reply, updated);
    });

    routes.get('/v1/login-settings', async (request, reply) => {
      const permission = await apiAccess(request, db, options);
      if ('response' in permission) return reply.send(permission.response);
      if (!permission.access.superuser) return reply.send(failure('RJ', 'Superuser access is required.'));
      return reply.send(success(await serializeLoginSettings(db, options.cipherKey)));
    });

    routes.put<{ Body: unknown }>('/v1/login-settings', { bodyLimit: 1024 * 1024 }, async (request, reply) => {
      if (!csrfValid(request, options)) return reply.code(403).type('text/plain; charset=utf-8').send('Forbidden');
      const permission = await apiAccess(request, db, options);
      if ('response' in permission) return reply.send(permission.response);
      if (!permission.access.superuser) return reply.send(failure('RJ', 'Superuser access is required.'));
      const updated = await updateLoginSettings(db, permission.user.id, options.cipherKey, apiJsonBody(request));
      return sendApiResult(reply, updated);
    });

    routes.get('/v1/integration-settings', async (request, reply) => {
      const permission = await apiAccess(request, db, options);
      if ('response' in permission) return reply.send(permission.response);
      if (!permission.access.superuser) return reply.send(failure('RJ', 'Superuser access is required.'));
      return reply.send(success(integrationSettingsApi(await serializeIntegrationSettings(db, options))));
    });

    routes.put<{ Body: unknown }>('/v1/integration-settings', { bodyLimit: 64 * 1024 }, async (request, reply) => {
      if (!csrfValid(request, options)) return reply.code(403).type('text/plain; charset=utf-8').send('Forbidden');
      const permission = await apiAccess(request, db, options);
      if ('response' in permission) return reply.send(permission.response);
      if (!permission.access.superuser) return reply.send(failure('RJ', 'Superuser access is required.'));
      if (!isRecord(request.body)) return reply.send(failure('VA', 'Invalid request body.'));
      const updated = await updateIntegrationSettings(db, permission.user.id, request.body, options);
      return updated.ok
        ? reply.send(success(integrationSettingsApi(updated.body)))
        : reply.send(failure(updated.code, updated.message));
    });
}
