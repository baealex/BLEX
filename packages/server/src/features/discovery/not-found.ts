import { renderPage } from '../../platform/views.js';
import type { PrismaClient } from '@prisma/client';
import type { FastifyRequest } from 'fastify';
import { readPageChrome } from '../../platform/page-chrome.js';
/** Only page navigations get the 403 and 404 screens; APIs, feeds, and files keep their plain answers. */
export function wantsNotFoundPage(request: FastifyRequest): boolean {
  if (request.method !== 'GET' && request.method !== 'HEAD') return false;
  if (!String(request.headers.accept ?? '').includes('text/html')) return false;
  const path = request.url.split('?')[0];
  return !/^\/(?:v1|api|assets|resources|rss)(?:\/|$)/.test(path) && !/\.(?:md|xml|txt|json)$/i.test(path);
}

export async function renderNotFoundPage(
  db: PrismaClient,
  user: { id: number; username: string } | null,
  csrfToken: string,
): Promise<string> {
  const { brand, viewer } = await readPageChrome(db, user, csrfToken);
  return renderPage('errors/not-found', { brand, viewer });
}

export async function renderForbiddenPage(
  db: PrismaClient,
  user: { id: number; username: string } | null,
  csrfToken: string,
): Promise<string> {
  const { brand, viewer } = await readPageChrome(db, user, csrfToken);
  return renderPage('errors/forbidden', { brand, viewer });
}
