import { type PrismaClient } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import { done as success, failure } from '../../../platform/response.js';
import { bannerApi, bannerPayload, readBanner, readBanners, saveBanner } from '../services/banners.js';
import { AdminSettingsOptions, apiAccess, apiJsonBody, csrfValid, djangoTimestamp, editorApiAccess, validRouteId } from '../shared.js';

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
      const order = apiJsonBody(request).order;
      if (Array.isArray(order)) {
        const timestamp = djangoTimestamp();
        await db.$transaction(async (transaction) => {
          for (const item of order) {
            if (!Array.isArray(item) || item.length !== 2) continue;
            const [rawId, rawOrder] = item;
            const bannerId = typeof rawId === 'number' ? rawId : /^\d+$/.test(String(rawId)) ? Number(rawId) : NaN;
            const bannerOrder = typeof rawOrder === 'number' ? rawOrder : /^-?\d+$/.test(String(rawOrder)) ? Number(rawOrder) : NaN;
            if (!Number.isSafeInteger(bannerId) || !Number.isSafeInteger(bannerOrder)) continue;
            await transaction.$executeRaw`
              UPDATE board_sitebanner SET "order" = ${bannerOrder}, updated_date = ${timestamp}
              WHERE scope = 'user' AND user_id = ${permission.user.id} AND id = ${bannerId}
            `;
          }
        });
      }
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
      const deleted = await db.$executeRaw`
        DELETE FROM board_sitebanner WHERE scope = 'user' AND user_id = ${permission.user.id} AND id = ${bannerId}
      `;
      if (!deleted) return reply.code(404).type('text/plain; charset=utf-8').send('Not found');
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
      const deleted = await db.$executeRaw`DELETE FROM board_sitebanner WHERE scope = 'global' AND id = ${bannerId}`;
      if (!deleted) return reply.code(404).type('text/plain; charset=utf-8').send('Not found');
      return reply.send(success({ message: 'Global banner deleted.' }));
    });

    routes.put<{ Body: unknown }>('/v1/global-banners/order', { bodyLimit: 64 * 1024 }, async (request, reply) => {
      if (!csrfValid(request, options)) return reply.code(403).type('text/plain; charset=utf-8').send('Forbidden');
      const permission = await apiAccess(request, db, options);
      if ('response' in permission) return reply.send(permission.response);
      const order = apiJsonBody(request).order;
      if (Array.isArray(order)) {
        const timestamp = djangoTimestamp();
        await db.$transaction(async (transaction) => {
          for (const item of order) {
            if (!Array.isArray(item) || item.length !== 2) continue;
            const [rawId, rawOrder] = item;
            const bannerId = typeof rawId === 'number' ? rawId : /^\d+$/.test(String(rawId)) ? Number(rawId) : NaN;
            const bannerOrder = typeof rawOrder === 'number' ? rawOrder : /^-?\d+$/.test(String(rawOrder)) ? Number(rawOrder) : NaN;
            if (!Number.isSafeInteger(bannerId) || !Number.isSafeInteger(bannerOrder)) continue;
            await transaction.$executeRaw`
              UPDATE board_sitebanner SET "order" = ${bannerOrder}, updated_date = ${timestamp}
              WHERE scope = 'global' AND id = ${bannerId}
            `;
          }
        });
      }
      return reply.send(success({ message: 'Global banner order updated.' }));
    });
}
