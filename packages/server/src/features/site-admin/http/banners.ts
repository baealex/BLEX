import { type PrismaClient } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import { done as success, failure } from '../../../platform/response.js';
import { bannerApi, bannerPayload, readBanner, readBanners, saveBanner, saveBannerOrder } from '../services/banners.js';
import { AdminSettingsOptions, apiAccess, apiJsonBody, csrfValid, editorApiAccess, validRouteId } from '../shared.js';

export function registerBannersRoutes(routes: FastifyInstance, db: PrismaClient, options: AdminSettingsOptions) {
    routes.get('/v1/banners', async (request, reply) => {
      const permission = await editorApiAccess(request, db, options);
      if ('response' in permission) return reply.send(permission.response);
      return reply.send(success({ banners: (await readBanners(db, 'user', permission.user.id)).map((banner) => bannerApi(banner, false)) }));
    });

    routes.put<{ Body: unknown }>('/v1/banners/order', { bodyLimit: 64 * 1024 }, async (request, reply) => {
      if (!csrfValid(request, options)) return reply.code(403).type('text/plain; charset=utf-8').send('Forbidden');
      const permission = await editorApiAccess(request, db, options);
      if ('response' in permission) return reply.send(permission.response);
      await saveBannerOrder(db, apiJsonBody(request).order, 'user', permission.user.id);
      return reply.send(success({ message: 'Banner order updated.' }));
    });

    routes.get<{ Params: { bannerId: string } }>('/v1/banners/:bannerId(^\\d+$)', async (request, reply) => {
      const permission = await editorApiAccess(request, db, options);
      if ('response' in permission) return reply.send(permission.response);
      const bannerId = validRouteId(request.params.bannerId);
      const banner = bannerId ? await readBanner(db, bannerId, 'user', permission.user.id) : null;
      if (!banner) return reply.code(404).type('text/plain; charset=utf-8').send('Not found');
      return reply.send(success(bannerApi(banner, false)));
    });

    routes.post<{ Body: unknown }>('/v1/banners', { bodyLimit: 1024 * 1024 }, async (request, reply) => {
      if (!csrfValid(request, options)) return reply.code(403).type('text/plain; charset=utf-8').send('Forbidden');
      const permission = await editorApiAccess(request, db, options);
      if ('response' in permission) return reply.send(permission.response);
      const saved = await saveBanner(db, permission.user.id, bannerPayload(apiJsonBody(request)), undefined, 'user');
      return saved.ok ? reply.send(success(bannerApi(saved.body, false))) : reply.send(failure(saved.code, saved.message));
    });

    routes.put<{ Params: { bannerId: string }; Body: unknown }>('/v1/banners/:bannerId(^\\d+$)', { bodyLimit: 1024 * 1024 }, async (request, reply) => {
      if (!csrfValid(request, options)) return reply.code(403).type('text/plain; charset=utf-8').send('Forbidden');
      const permission = await editorApiAccess(request, db, options);
      if ('response' in permission) return reply.send(permission.response);
      const bannerId = validRouteId(request.params.bannerId);
      if (!bannerId || !(await readBanner(db, bannerId, 'user', permission.user.id))) {
        return reply.code(404).type('text/plain; charset=utf-8').send('Not found');
      }
      const saved = await saveBanner(db, permission.user.id, bannerPayload(apiJsonBody(request)), bannerId, 'user');
      return saved.ok ? reply.send(success(bannerApi(saved.body, false))) : reply.send(failure(saved.code, saved.message));
    });

    routes.delete<{ Params: { bannerId: string } }>('/v1/banners/:bannerId(^\\d+$)', async (request, reply) => {
      if (!csrfValid(request, options)) return reply.code(403).type('text/plain; charset=utf-8').send('Forbidden');
      const permission = await editorApiAccess(request, db, options);
      if ('response' in permission) return reply.send(permission.response);
      const bannerId = validRouteId(request.params.bannerId);
      if (!bannerId) return reply.code(404).type('text/plain; charset=utf-8').send('Not found');
      const { count } = await db.siteBanner.deleteMany({ where: { scope: 'user', userId: permission.user.id, id: bannerId } });
      if (!count) return reply.code(404).type('text/plain; charset=utf-8').send('Not found');
      return reply.send(success({ message: 'Banner deleted.' }));
    });

    routes.get('/v1/global-banners', async (request, reply) => {
      const permission = await apiAccess(request, db, options);
      if ('response' in permission) return reply.send(permission.response);
      return reply.send(success({ banners: (await readBanners(db)).map((banner) => bannerApi(banner)) }));
    });

    routes.get<{ Params: { bannerId: string } }>('/v1/global-banners/:bannerId(^\\d+$)', async (request, reply) => {
      const permission = await apiAccess(request, db, options);
      if ('response' in permission) return reply.send(permission.response);
      const bannerId = validRouteId(request.params.bannerId);
      const banner = bannerId ? await readBanner(db, bannerId) : null;
      if (!banner) return reply.code(404).type('text/plain; charset=utf-8').send('Not found');
      return reply.send(success(bannerApi(banner)));
    });

    routes.post<{ Body: unknown }>('/v1/global-banners', { bodyLimit: 1024 * 1024 }, async (request, reply) => {
      if (!csrfValid(request, options)) return reply.code(403).type('text/plain; charset=utf-8').send('Forbidden');
      const permission = await apiAccess(request, db, options);
      if ('response' in permission) return reply.send(permission.response);
      const saved = await saveBanner(db, permission.user.id, bannerPayload(apiJsonBody(request)));
      return saved.ok ? reply.send(success(bannerApi(saved.body))) : reply.send(failure(saved.code, saved.message));
    });

    routes.put<{ Params: { bannerId: string }; Body: unknown }>('/v1/global-banners/:bannerId(^\\d+$)', { bodyLimit: 1024 * 1024 }, async (request, reply) => {
      if (!csrfValid(request, options)) return reply.code(403).type('text/plain; charset=utf-8').send('Forbidden');
      const permission = await apiAccess(request, db, options);
      if ('response' in permission) return reply.send(permission.response);
      const bannerId = validRouteId(request.params.bannerId);
      if (!bannerId) return reply.code(404).type('text/plain; charset=utf-8').send('Not found');
      const saved = await saveBanner(db, permission.user.id, bannerPayload(apiJsonBody(request)), bannerId);
      return saved.ok ? reply.send(success(bannerApi(saved.body))) : reply.send(failure(saved.code, saved.message));
    });

    routes.delete<{ Params: { bannerId: string } }>('/v1/global-banners/:bannerId(^\\d+$)', async (request, reply) => {
      if (!csrfValid(request, options)) return reply.code(403).type('text/plain; charset=utf-8').send('Forbidden');
      const permission = await apiAccess(request, db, options);
      if ('response' in permission) return reply.send(permission.response);
      const bannerId = validRouteId(request.params.bannerId);
      if (!bannerId) return reply.code(404).type('text/plain; charset=utf-8').send('Not found');
      const { count } = await db.siteBanner.deleteMany({ where: { scope: 'global', id: bannerId } });
      if (!count) return reply.code(404).type('text/plain; charset=utf-8').send('Not found');
      return reply.send(success({ message: 'Global banner deleted.' }));
    });

    routes.put<{ Body: unknown }>('/v1/global-banners/order', { bodyLimit: 64 * 1024 }, async (request, reply) => {
      if (!csrfValid(request, options)) return reply.code(403).type('text/plain; charset=utf-8').send('Forbidden');
      const permission = await apiAccess(request, db, options);
      if ('response' in permission) return reply.send(permission.response);
      await saveBannerOrder(db, apiJsonBody(request).order, 'global');
      return reply.send(success({ message: 'Global banner order updated.' }));
    });
}
