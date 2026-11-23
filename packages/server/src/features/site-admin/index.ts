import formBody from '@fastify/formbody';
import multipart from '@fastify/multipart';
import { type PrismaClient } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import { BRAND_ICO_MAX_BYTES } from './services/brand-assets.js';
import { AdminSettingsOptions } from './shared.js';
import { registerSiteSettingsRoutes } from './http/site-settings.js';
import { registerUsersRoutes } from './http/users.js';
import { registerModerationRoutes } from './http/moderation.js';
import { registerStaticPagesRoutes } from './http/static-pages.js';
import { registerNoticesRoutes } from './http/notices.js';
import { registerBannersRoutes } from './http/banners.js';
import { registerUtilitiesRoutes } from './http/utilities.js';

export { AdminSettingsOptions } from './shared.js';

export function registerAdminSettings(app: FastifyInstance, db: PrismaClient, options: AdminSettingsOptions): void {
  app.register(async (routes) => {
    await routes.register(formBody);
    await routes.register(multipart, {
      limits: { files: 16, fields: 4, parts: 20, fileSize: BRAND_ICO_MAX_BYTES, fieldSize: 16 * 1024 },
    });
    routes.addHook('onRequest', async (_request, reply) => {
      reply.header('Cache-Control', 'private, no-store')
        .header('X-Robots-Tag', 'noindex, nofollow, noarchive')
        .header('Referrer-Policy', 'same-origin');
    });
    registerSiteSettingsRoutes(routes, db, options);
    registerUsersRoutes(routes, db, options);
    registerModerationRoutes(routes, db, options);
    registerStaticPagesRoutes(routes, db, options);
    registerNoticesRoutes(routes, db, options);
    registerBannersRoutes(routes, db, options);
    registerUtilitiesRoutes(routes, db, options);
  });
}
