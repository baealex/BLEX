import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import type { PublicPageOptions } from '../shared.js';
import { registerSearchRoutes } from './search.js';
import { registerHomeRoutes } from './home.js';
import { registerTagsRoutes } from './tags.js';
import { registerProfileRoutes } from '../../authors/http/profile.js';

export { SiteBrand, PublicPageViewer } from '../shared.js';
export { readPublicSiteBrand } from '../page-context.js';

export function registerPublicPages(
  app: FastifyInstance,
  db: PrismaClient,
  siteUrl: URL,
  options: PublicPageOptions = {},
): void {
  registerSearchRoutes(app, db, siteUrl, options);
  registerHomeRoutes(app, db, siteUrl, options);
  registerTagsRoutes(app, db, siteUrl, options);
  registerProfileRoutes(app, db, siteUrl, options);
}
