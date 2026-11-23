import { type PrismaClient } from '@prisma/client';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { readPageChrome } from '../../platform/page-chrome.js';
import { renderPage } from '../../platform/views.js';
import { WorkLogRow, countEntries, readEntries } from './services/logs.js';
import { countShares, readShares } from './services/shares.js';
import {
  PAGE_SIZE,
  WorkLogOptions,
  WorkLogUser,
  csrfCookieValue,
  html,
  isActiveEditor,
  pageFields,
  toIsoDateTime,
} from './shared.js';

export function pageChrome(db: PrismaClient, request: FastifyRequest, user: { id: number; username: string } | null) {
  return readPageChrome(db, user, csrfCookieValue(request));
}

export function displayPage(value: string | undefined, totalCount: number): number {
  const pages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const parsed = value && /^[+-]?\d+$/.test(value) ? Number(value) : 1;
  if (!Number.isSafeInteger(parsed) || parsed < 1) return 1;
  return Math.min(parsed, pages);
}

export function pageLinks(
  path: string,
  page: number,
  pages: number,
  extra: Record<string, number> = {},
  parameter = 'page',
) {
  const build = (targetPage: number) => {
    const params = new URLSearchParams({ [parameter]: String(targetPage) });
    for (const [key, value] of Object.entries(extra)) params.set(key, String(value));
    return `${path}?${params.toString()}`;
  };
  return {
    previous: page > 1 ? build(page - 1) : undefined,
    next: page < pages ? build(page + 1) : undefined,
  };
}

export async function renderDetailPage(
  request: FastifyRequest,
  reply: FastifyReply,
  db: PrismaClient,
  options: WorkLogOptions,
  user: WorkLogUser,
  log: WorkLogRow,
  state: {
    timelinePage?: string;
    selectionPage?: string;
    linksPage?: string;
    selectedIds?: number[];
    error?: string;
    shareError?: string;
    entryTitle?: string;
    entryText?: string;
    headline?: string;
  } = {},
) {
  const [totalEntries, totalShares, canWrite] = await Promise.all([
    countEntries(db, log.id),
    countShares(db, log.id),
    isActiveEditor(db, user.id),
  ]);
  const timelinePage = displayPage(
    state.timelinePage ?? (request.query as Record<string, string | undefined>).page,
    totalEntries,
  );
  const selectionPage = displayPage(
    state.selectionPage ?? (request.query as Record<string, string | undefined>)[pageFields.selectionPage],
    totalEntries,
  );
  const linksPage = displayPage(
    state.linksPage ?? (request.query as Record<string, string | undefined>)[pageFields.linksPage],
    totalShares,
  );
  const [timeline, selector, shares] = await Promise.all([
    readEntries(db, log.id, timelinePage),
    readEntries(db, log.id, selectionPage),
    readShares(db, log.id, linksPage),
  ]);
  const url = `/work-logs/${log.id}/`;
  const entryPages = Math.max(1, Math.ceil(totalEntries / PAGE_SIZE));
  const sharePages = Math.max(1, Math.ceil(totalShares / PAGE_SIZE));
  return html(
    reply,
    renderPage('work-logs/$id/index', {
      log: { ...log, createdAt: toIsoDateTime(log.createdAt) },
      canWrite,
      csrfToken: csrfCookieValue(request),
      ...(await pageChrome(db, request, user)),
      timeline: timeline.map((entry) => ({ ...entry, createdAt: toIsoDateTime(entry.createdAt) })),
      selector: selector.map((entry) => ({ ...entry, createdAt: toIsoDateTime(entry.createdAt) })),
      selectedIds: state.selectedIds ?? [],
      shares: shares.map((share) => ({ ...share, createdAt: toIsoDateTime(share.createdAt) })),
      timelineLinks: pageLinks(url, timelinePage, entryPages, {
        [pageFields.linksPage]: linksPage,
        [pageFields.selectionPage]: selectionPage,
      }),
      selectionLinks: pageLinks(
        url,
        selectionPage,
        entryPages,
        { page: timelinePage, [pageFields.linksPage]: linksPage },
        pageFields.selectionPage,
      ),
      shareLinks: pageLinks(
        url,
        linksPage,
        sharePages,
        { page: timelinePage, [pageFields.selectionPage]: selectionPage },
        pageFields.linksPage,
      ),
      timelinePage,
      selectionPage,
      linksPage,
      mediaUrl: (entry) => `/work-logs/${log.id}/media/${entry.id}/`,
      error: state.error,
      shareError: state.shareError,
      entryTitle: state.entryTitle,
      entryText: state.entryText,
      headline: state.headline,
    }),
  );
}
