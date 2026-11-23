import type { FastifyReply } from 'fastify';
import { renderPage } from '../../platform/views.js';
import { sanitizePostHtml } from './post-html.js';
import { managementDate } from './services/management.js';
import type { StoredRevision, TimelapseResult } from './services/revisions.js';
import { dateAsIso, type StoredPost } from './shared.js';

interface RevisionHistoryPageModel {
  username: string;
  slug: string;
  title: string;
  updatedDate: string;
  csrfToken: string;
  page: number;
  lastPage: number;
  totalCount: number;
  revisions: StoredRevision[];
  notice: string;
}

export function renderRevisionHistoryPage({ revisions, ...model }: RevisionHistoryPageModel): string {
  return renderPage('@{$username}/{$slug}/revisions', {
    ...model,
    revisions: revisions.map((revision) => ({
      id: revision.id,
      title: revision.title,
      changeType: revision.changeType,
      actor: revision.actor,
      contentExcerpt: revision.contentExcerpt,
      contentHtml: revision.content === '_NO_CHANGED_' ? '' : sanitizePostHtml(revision.content),
      date: dateAsIso(revision.sourceUpdatedDate ?? revision.createdDate),
      savedLabel: managementDate(revision.sourceUpdatedDate ?? revision.createdDate),
    })),
  });
}

export function renderTimelapsePage(username: string, post: StoredPost, timelapse: TimelapseResult): string {
  return renderPage('@{$username}/{$slug}/timelapse', {
    username,
    slug: post.url,
    title: post.title,
    totalCount: timelapse.totalCount,
    frames: timelapse.frames.map((frame) => ({
      savedAt: String(frame.savedAt),
      title: frame.title,
      stage: frame.stage,
      savedLabel: managementDate(frame.savedAt),
      contentHtml: sanitizePostHtml(frame.contentHtml),
    })),
  });
}

export function sendPrivateHistoryPage(reply: FastifyReply, html: string, statusCode = 200): FastifyReply {
  return reply.code(statusCode).type('text/html; charset=utf-8')
    .header('Cache-Control', 'private, no-store')
    .header('X-Robots-Tag', 'noindex, nofollow')
    .header('X-Frame-Options', 'DENY')
    .send(html);
}
