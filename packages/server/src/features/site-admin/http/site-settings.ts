import { type PrismaClient } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import { type AdminSiteSettings } from '../pages.js';
import { done as success, failure } from '../../../platform/response.js';
import { deleteBrandAsset, uploadBrandAsset, validateBrandTarget } from '../services/brand-assets.js';
import { integrationSettingsApi, pageIntegrationPayload, pageIntegrationSettings, serializeIntegrationSettings, updateIntegrationSettings } from '../services/integrations.js';
import { pageLoginPayload, pageLoginSettings, serializeLoginSettings, updateLoginSettings } from '../services/login-settings.js';
import { apiSitePayload, pageSeoSettings, pageSitePayload, pageSiteSettings, readSiteRow, serializeSiteSettings, updateSiteSettings } from '../services/site-settings.js';
import { userListQuery } from '../services/users.js';
import { AdminSettingsOptions, ApiResult, Body, apiAccess, apiJsonBody, csrfValid, csrfValidWithBody, formBoolean, isRecord, pageAccess, readMultipartFields, sendApiResult, stringValue, unauthorizedPage } from '../shared.js';

export function registerSiteSettingsRoutes(routes: FastifyInstance, db: PrismaClient, options: AdminSettingsOptions) {
    routes.get('/admin-settings/', async (request, reply) => {
      const result = await pageAccess(request, reply, db, options);
      if (!result) return reply;
      if (!result.access.staff) return unauthorizedPage(reply);
      const destination = result.access.canManageSiteSettings ? 'site-settings' : result.access.superuser ? 'login' : 'global-notices';
      return reply.redirect(`/admin-settings/${destination}`, 302);
    });

    routes.get('/admin-settings', async (_request, reply) => reply.redirect('/admin-settings/', 302));

    routes.get('/admin-settings/site-settings', async (request, reply) => {
      const result = await pageAccess(request, reply, db, options);
      if (!result) return reply;
      if (!result.access.canManageSiteSettings) return unauthorizedPage(reply);
      return pageSiteSettings(request, reply, db, options, result.user, result.access);
    });

    routes.post<{ Body: unknown }>('/admin-settings/site-settings', { bodyLimit: 1024 * 1024 }, async (request, reply) => {
      if (!csrfValid(request, options)) return reply.code(403).type('text/plain; charset=utf-8').send('요청을 확인할 수 없습니다. 페이지를 새로고침해 주세요.');
      const result = await pageAccess(request, reply, db, options);
      if (!result) return reply;
      if (!result.access.canManageSiteSettings) return unauthorizedPage(reply);
      const body = isRecord(request.body) ? request.body : {};
      const payload = pageSitePayload(body, !('seo_enabled' in body || 'aeo_enabled' in body || 'robots_txt_extra_rules' in body));
      const updated = await updateSiteSettings(db, result.user.id, result.access.superuser, payload, options);
      if (!updated.ok) return pageSiteSettings(request, reply, db, options, result.user, result.access, updated.message);
      return reply.redirect('/admin-settings/site-settings?saved=1', 303);
    });

    routes.post<{ Body: unknown }>('/admin-settings/brand-assets', { bodyLimit: 12 * 1024 * 1024 }, async (request, reply) => {
      const isMultipart = request.headers['content-type']?.toLowerCase().startsWith('multipart/form-data') === true;
      let fields: Body = {};
      let files = new Map<string, Buffer>();
      try {
        if (isMultipart) {
          const parsed = await readMultipartFields(request);
          fields = parsed.fields;
          files = parsed.files;
        } else if (isRecord(request.body)) {
          fields = request.body;
        }
      } catch {
        return reply.code(400).type('text/plain; charset=utf-8').send('업로드한 파일을 읽을 수 없습니다.');
      }
      if (!csrfValidWithBody(request, options, fields)) return reply.code(403).type('text/plain; charset=utf-8').send('요청을 확인할 수 없습니다. 페이지를 새로고침해 주세요.');
      const permission = await pageAccess(request, reply, db, options);
      if (!permission) return reply;
      if (!permission.access.canManageSiteSettings) return unauthorizedPage(reply);
      let saved: ApiResult<AdminSiteSettings>;
      if (isMultipart) {
        let target: ReturnType<typeof validateBrandTarget>;
        try {
          target = validateBrandTarget(fields);
        } catch (error) {
          return pageSiteSettings(request, reply, db, options, permission.user, permission.access, error instanceof Error ? error.message : 'Check the brand asset type.');
        }
        saved = await uploadBrandAsset(db, permission.user.id, permission.access.superuser, {
          ...target,
          svg: files.get('svg'),
          files,
          manifest: stringValue(fields.manifest),
          generateDerivatives: !fields.manifest && files.size === 1 && files.has('svg'),
        }, options);
      } else if (formBoolean(fields._delete)) {
        try {
          const target = validateBrandTarget(fields);
          saved = await deleteBrandAsset(db, permission.user.id, permission.access.superuser, target, options);
        } catch (error) {
          return pageSiteSettings(request, reply, db, options, permission.user, permission.access, error instanceof Error ? error.message : 'Check the brand asset type.');
        }
      } else {
        return pageSiteSettings(request, reply, db, options, permission.user, permission.access, 'Choose a brand asset action.');
      }
      if (!saved.ok) return pageSiteSettings(request, reply, db, options, permission.user, permission.access, saved.message);
      return reply.redirect('/admin-settings/site-settings?saved=1', 303);
    });

    routes.get('/admin-settings/seo-aeo', async (request, reply) => {
      const result = await pageAccess(request, reply, db, options);
      if (!result) return reply;
      if (!result.access.canManageSiteSettings) return unauthorizedPage(reply);
      return pageSeoSettings(request, reply, db, options, result.user, result.access);
    });

    routes.post<{ Body: unknown }>('/admin-settings/seo-aeo', { bodyLimit: 1024 * 1024 }, async (request, reply) => {
      if (!csrfValid(request, options)) return reply.code(403).type('text/plain; charset=utf-8').send('요청을 확인할 수 없습니다. 페이지를 새로고침해 주세요.');
      const result = await pageAccess(request, reply, db, options);
      if (!result) return reply;
      if (!result.access.canManageSiteSettings) return unauthorizedPage(reply);
      const payload = pageSitePayload(isRecord(request.body) ? request.body : {}, false);
      const updated = await updateSiteSettings(db, result.user.id, result.access.superuser, payload, options);
      if (!updated.ok) return pageSeoSettings(request, reply, db, options, result.user, result.access, updated.message);
      return reply.redirect('/admin-settings/seo-aeo?saved=1', 303);
    });

    routes.get('/admin-settings/login', async (request, reply) => {
      const result = await pageAccess(request, reply, db, options);
      if (!result) return reply;
      if (!result.access.superuser) return unauthorizedPage(reply);
      return pageLoginSettings(request, reply, db, options, result.user, result.access);
    });

    routes.post<{ Body: unknown }>('/admin-settings/login', { bodyLimit: 1024 * 1024 }, async (request, reply) => {
      if (!csrfValid(request, options)) return reply.code(403).type('text/plain; charset=utf-8').send('요청을 확인할 수 없습니다. 페이지를 새로고침해 주세요.');
      const result = await pageAccess(request, reply, db, options);
      if (!result) return reply;
      if (!result.access.superuser) return unauthorizedPage(reply);
      const payload = pageLoginPayload(isRecord(request.body) ? request.body : {});
      const updated = await updateLoginSettings(db, result.user.id, options.cipherKey, payload);
      if (!updated.ok) return pageLoginSettings(request, reply, db, options, result.user, result.access, updated.message);
      return reply.redirect('/admin-settings/login?saved=1', 303);
    });

    routes.get('/admin-settings/integrations', async (request, reply) => {
      const result = await pageAccess(request, reply, db, options);
      if (!result) return reply;
      if (!result.access.superuser) return unauthorizedPage(reply);
      return pageIntegrationSettings(request, reply, db, options, result.user, result.access);
    });

    routes.post<{ Body: unknown }>('/admin-settings/integrations', { bodyLimit: 64 * 1024 }, async (request, reply) => {
      if (!csrfValid(request, options)) return reply.code(403).type('text/plain; charset=utf-8').send('요청을 확인할 수 없습니다. 페이지를 새로고침해 주세요.');
      const result = await pageAccess(request, reply, db, options);
      if (!result) return reply;
      if (!result.access.superuser) return unauthorizedPage(reply);
      const updated = await updateIntegrationSettings(
        db,
        result.user.id,
        pageIntegrationPayload(isRecord(request.body) ? request.body : {}),
        options,
      );
      if (!updated.ok) return pageIntegrationSettings(request, reply, db, options, result.user, result.access, updated.message);
      return reply.redirect('/admin-settings/integrations?saved=1', 303);
    });

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
