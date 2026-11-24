import { systemMessage } from '../../platform/messages.js';
import formBody from '@fastify/formbody';
import multipart from '@fastify/multipart';
import type { PrismaClient } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import { renderPage } from '../../platform/views.js';
import { displayPage, pageChrome, pageLinks, renderDetailPage } from './detail-page.js';
import {
  MAX_ATTACHMENT_SIZE,
  mediaResponse,
  removeAttachment,
  saveAttachment,
  validateAttachment,
} from './services/attachments.js';
import { deleteWorkLog, deleteWorkLogEntry, revokeWorkLogShare } from './services/deletions.js';
import {
  countEntriesByLog,
  countOwnedLogs,
  insertEntry,
  insertWorkLog,
  readAttachmentPart,
  readEntry,
  readEntryInput,
  readOwnedLog,
  readOwnedLogs,
} from './services/logs.js';
import {
  createShare,
  entryCountForShare,
  latestSharedEntry,
  pageEntryForShareMedia,
  readShare,
  readSnapshotEntries,
  selectedEntries,
  selectedEntryIds,
  sharePath,
  storedShareToken,
} from './services/shares.js';
import {
  MAX_REQUEST_SIZE,
  PAGE_SIZE,
  type WorkLogOptions,
  bodyRecord,
  csrfCookieValue,
  csrfValid,
  currentUser,
  html,
  isActiveEditor,
  pageFields,
  notAllowed,
  notFound,
  parseId,
  scalar,
  toIsoDateTime,
} from './shared.js';

export { removeAttachment } from './services/attachments.js';
export { WorkLogUser, WorkLogOptions } from './shared.js';

export function registerWorkLogs(app: FastifyInstance, db: PrismaClient, options: WorkLogOptions): void {
  app.register(async (routes) => {
    await routes.register(formBody);
    await routes.register(multipart, {
      attachFieldsToBody: 'keyValues',
      onFile: readAttachmentPart,
      limits: { files: 1, fields: 12, parts: 16, fileSize: MAX_ATTACHMENT_SIZE },
    });

    routes.addHook('onRequest', async (_request, reply) => {
      reply
        .header('Cache-Control', 'private, no-store')
        .header('X-Robots-Tag', 'noindex, nofollow, noarchive')
        .header('Referrer-Policy', 'strict-origin');
    });

    routes.get('/work-logs/', async (request, reply) => {
      const user = await currentUser(request, reply, options);
      if (!user) return reply;
      const [total, canWrite] = await Promise.all([countOwnedLogs(db, user.id), isActiveEditor(db, user.id)]);
      const query = request.query as Record<string, string | string[] | undefined>;
      const page = displayPage(typeof query.page === 'string' ? query.page : undefined, total);
      const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
      const logs = await readOwnedLogs(db, user.id, page);
      const entryCounts = await countEntriesByLog(
        db,
        logs.map((log) => log.id),
      );
      const path = '/work-logs/';
      const content = renderPage('work-logs/index', {
        logs: logs.map((log) => ({
          ...log,
          createdAt: toIsoDateTime(log.createdAt),
          entryCount: entryCounts.get(log.id) ?? 0,
        })),
        canWrite,
        csrfToken: csrfCookieValue(request),
        ...(await pageChrome(db, request, user)),
        links: pageLinks(path, page, pages),
      });
      return html(reply, content);
    });

    routes.post<{ Body: unknown }>('/work-logs/', { bodyLimit: 8 * 1024 }, async (request, reply) => {
      if (!csrfValid(request, options)) return notAllowed(reply);
      const user = await currentUser(request, reply, options);
      if (!user) return reply;
      if (!(await isActiveEditor(db, user.id))) return notAllowed(reply);
      const title = scalar(bodyRecord(request.body).title).trim();
      if (!title || title.length > 100) {
        const logs = await readOwnedLogs(db, user.id, 1);
        return html(
          reply,
          renderPage('work-logs/index', {
            logs: logs.map((log) => ({ ...log, createdAt: toIsoDateTime(log.createdAt) })),
            canWrite: true,
            csrfToken: csrfCookieValue(request),
            ...(await pageChrome(db, request, user)),
            error: systemMessage('Work log titles must be 100 characters or fewer.'),
            title,
            links: {},
          }),
        );
      }
      const id = await insertWorkLog(db, user.id, title);
      return reply.redirect(`/work-logs/${id}/`, 302);
    });

    routes.get<{ Params: { pk: string } }>('/work-logs/:pk/', async (request, reply) => {
      const user = await currentUser(request, reply, options);
      if (!user) return reply;
      const logId = parseId(request.params.pk);
      if (logId === null) return notFound(reply);
      const log = await readOwnedLog(db, logId, user.id);
      if (!log) return notFound(reply);
      return renderDetailPage(request, reply, db, user, log);
    });

    routes.post<{ Params: { pk: string }; Body: unknown }>(
      '/work-logs/:pk/entry/',
      { bodyLimit: MAX_REQUEST_SIZE, config: { bodyAccess: 'author' } },
      async (request, reply) => {
        if (!csrfValid(request, options)) return notAllowed(reply);
        const user = await currentUser(request, reply, options);
        if (!user) return reply;
        const logId = parseId(request.params.pk);
        if (logId === null) return notFound(reply);
        const log = await readOwnedLog(db, logId, user.id);
        if (!log) return notFound(reply);
        if (!(await isActiveEditor(db, user.id))) return notAllowed(reply);

        const input = await readEntryInput(request);
        const title = scalar(input.fields.title).trim();
        const text = scalar(input.fields.text).trim();
        if (title.length > 100 || text.length > 5000 || (!title && !text && !input.attachment)) {
          return renderDetailPage(request, reply, db, user, log, {
            error: systemMessage('Write a note or add an attachment.'),
            entryTitle: title,
            entryText: text,
          });
        }

        let mediaType = '';
        let attachment = '';
        if (input.attachment) {
          if (!options.mediaRoot)
            return renderDetailPage(request, reply, db, user, log, {
              error: systemMessage('This attachment is unavailable.'),
              entryTitle: title,
              entryText: text,
            });
          try {
            const kind = await validateAttachment(input.attachment);
            mediaType = kind.mediaType;
            attachment = await saveAttachment(input.attachment, kind.extension, options.mediaRoot);
          } catch (error) {
            const message =
              error instanceof Error ? error.message : systemMessage('Choose a PNG, JPEG, WebP, MP4, or WebM file.');
            return renderDetailPage(request, reply, db, user, log, {
              error: message,
              entryTitle: title,
              entryText: text,
            });
          }
        }

        try {
          await insertEntry(db, logId, title, text, mediaType, attachment);
        } catch (error) {
          await removeAttachment(options.mediaRoot, attachment);
          throw error;
        }
        return reply.redirect(`/work-logs/${logId}/`, 302);
      },
    );

    routes.post<{ Params: { pk: string }; Body: unknown }>(
      '/work-logs/:pk/share/',
      { bodyLimit: 64 * 1024 },
      async (request, reply) => {
        if (!csrfValid(request, options)) return notAllowed(reply);
        const user = await currentUser(request, reply, options);
        if (!user) return reply;
        const logId = parseId(request.params.pk);
        if (logId === null) return notFound(reply);
        const log = await readOwnedLog(db, logId, user.id);
        if (!log) return notFound(reply);
        if (!(await isActiveEditor(db, user.id))) return notAllowed(reply);

        const fields = bodyRecord(request.body);
        const action = scalar(fields.action) || 'preview';
        const browsing = pageFields.selectionPage in fields || action === 'edit';
        const selection = selectedEntryIds(fields, browsing);
        const headline = scalar(fields.headline).trim();
        if (!selection.error && headline.length > 120)
          selection.error = systemMessage('Share titles must be 120 characters or fewer.');
        if (!browsing && !headline) selection.error = systemMessage('Describe what changed.');
        const selected = selection.error ? [] : await selectedEntries(db, logId, selection.ids);
        if (!selection.error && selected.length !== selection.ids.length)
          selection.error = systemMessage('Choose entries from this work log.');

        if (browsing || selection.error) {
          return renderDetailPage(request, reply, db, user, log, {
            timelinePage: scalar(fields[pageFields.timelinePage]),
            selectionPage: scalar(fields[pageFields.selectionPage]) || scalar(fields[pageFields.currentSelectionPage]),
            linksPage: scalar(fields[pageFields.linksPage]),
            selectedIds: selected.map((entry) => entry.id),
            shareError: selection.error,
            headline,
          });
        }

        if (action === 'preview') {
          const page = displayPage(scalar(fields[pageFields.previewPage]), selected.length);
          const start = (page - 1) * PAGE_SIZE;
          const entries = selected.slice(start, start + PAGE_SIZE);
          return html(
            reply,
            renderPage('work-logs/share/$token', {
              ...(await pageChrome(db, request, user)),
              log: { ...log, createdAt: toIsoDateTime(log.createdAt) },
              ownerUsername: user.username,
              headline,
              entries: entries.map((entry) => ({ ...entry, createdAt: toIsoDateTime(entry.createdAt) })),
              cover: [...selected].reverse().find((entry) => entry.attachment) ?? null,
              imageUrl: null,
              shareUrl: '',
              timelineLinks: pageLinks(
                `/work-logs/${logId}/share/`,
                page,
                Math.max(1, Math.ceil(selected.length / PAGE_SIZE)),
              ),
              newLink: false,
              preview: true,
              selectedIds: selected.map((entry) => entry.id),
              csrfToken: csrfCookieValue(request),
              timelinePage: Number(scalar(fields[pageFields.timelinePage])) || 1,
              selectionPage: Number(scalar(fields[pageFields.currentSelectionPage])) || 1,
              linksPage: Number(scalar(fields[pageFields.linksPage])) || 1,
              mediaUrl: (entry) => `/work-logs/${logId}/media/${entry.id}/`,
            }),
          );
        }

        if (action !== 'publish')
          return renderDetailPage(request, reply, db, user, log, {
            shareError: systemMessage('Preview the shared page before creating a link.'),
            headline,
          });
        const token = await createShare(db, logId, headline, selected);
        return reply.redirect(`${sharePath(token)}?new=1`, 302);
      },
    );

    routes.post<{ Params: { pk: string; token: string } }>(
      '/work-logs/:pk/share/:token/revoke/',
      { bodyLimit: 8 * 1024 },
      async (request, reply) => {
        if (!csrfValid(request, options)) return notAllowed(reply);
        const user = await currentUser(request, reply, options);
        if (!user) return reply;
        const logId = parseId(request.params.pk);
        const shareToken = storedShareToken(request.params.token);
        if (logId === null || !shareToken) return notFound(reply);
        const log = await readOwnedLog(db, logId, user.id);
        if (!log) return notFound(reply);
        const deleted = await revokeWorkLogShare(db, logId, shareToken, user.id);
        if (deleted !== 1) return notFound(reply);
        return reply.redirect(`/work-logs/${logId}/`, 302);
      },
    );

    routes.get<{ Params: { pk: string } }>('/work-logs/:pk/delete/', async (request, reply) => {
      const user = await currentUser(request, reply, options);
      if (!user) return reply;
      const logId = parseId(request.params.pk);
      if (logId === null) return notFound(reply);
      const log = await readOwnedLog(db, logId, user.id);
      if (!log) return notFound(reply);
      return html(
        reply,
        renderPage('work-logs/$id/delete', {
          ...(await pageChrome(db, request, user)),
          log: { ...log, createdAt: toIsoDateTime(log.createdAt) },
          csrfToken: csrfCookieValue(request),
        }),
      );
    });

    routes.post<{ Params: { pk: string } }>(
      '/work-logs/:pk/delete/',
      { bodyLimit: 8 * 1024 },
      async (request, reply) => {
        if (!csrfValid(request, options)) return notAllowed(reply);
        const user = await currentUser(request, reply, options);
        if (!user) return reply;
        const logId = parseId(request.params.pk);
        if (logId === null) return notFound(reply);
        const log = await readOwnedLog(db, logId, user.id);
        if (!log) return notFound(reply);
        const attachments = await deleteWorkLog(db, logId, user.id);
        await Promise.all(attachments.map((attachment) => removeAttachment(options.mediaRoot, attachment)));
        return reply.redirect('/work-logs/', 302);
      },
    );

    routes.get<{ Params: { pk: string; entryId: string } }>(
      '/work-logs/:pk/entry/:entryId/delete/',
      async (request, reply) => {
        const user = await currentUser(request, reply, options);
        if (!user) return reply;
        const logId = parseId(request.params.pk);
        const entryId = parseId(request.params.entryId);
        if (logId === null || entryId === null) return notFound(reply);
        const log = await readOwnedLog(db, logId, user.id);
        if (!log) return notFound(reply);
        const entry = await readEntry(db, logId, entryId);
        if (!entry) return notFound(reply);
        return html(
          reply,
          renderPage('work-logs/$id/delete', {
            ...(await pageChrome(db, request, user)),
            log: { ...log, createdAt: toIsoDateTime(log.createdAt) },
            entry: { ...entry, createdAt: toIsoDateTime(entry.createdAt) },
            csrfToken: csrfCookieValue(request),
          }),
        );
      },
    );

    routes.post<{ Params: { pk: string; entryId: string } }>(
      '/work-logs/:pk/entry/:entryId/delete/',
      { bodyLimit: 8 * 1024 },
      async (request, reply) => {
        if (!csrfValid(request, options)) return notAllowed(reply);
        const user = await currentUser(request, reply, options);
        if (!user) return reply;
        const logId = parseId(request.params.pk);
        const entryId = parseId(request.params.entryId);
        if (logId === null || entryId === null) return notFound(reply);
        const log = await readOwnedLog(db, logId, user.id);
        if (!log) return notFound(reply);
        const attachment = await deleteWorkLogEntry(db, logId, entryId, user.id);
        if (attachment === null) return notFound(reply);
        await removeAttachment(options.mediaRoot, attachment);
        return reply.redirect(`/work-logs/${logId}/`, 302);
      },
    );

    routes.get<{ Params: { pk: string; entryId: string } }>(
      '/work-logs/:pk/media/:entryId/',
      async (request, reply) => {
        const user = await currentUser(request, reply, options);
        if (!user) return reply;
        const logId = parseId(request.params.pk);
        const entryId = parseId(request.params.entryId);
        if (logId === null || entryId === null) return notFound(reply);
        if (!(await readOwnedLog(db, logId, user.id))) return notFound(reply);
        const entry = await readEntry(db, logId, entryId, true);
        if (!entry) return notFound(reply);
        return mediaResponse(request, reply, options.mediaRoot, entry);
      },
    );

    routes.get<{ Params: { token: string } }>('/work-logs/share/:token/', async (request, reply) => {
      const shareToken = storedShareToken(request.params.token);
      if (!shareToken) return notFound(reply);
      const share = await readShare(db, shareToken);
      if (!share) return notFound(reply);
      const total = await entryCountForShare(db, share.id);
      if (total === 0) return notFound(reply);
      const query = request.query as Record<string, string | string[] | undefined>;
      const page = displayPage(typeof query.page === 'string' ? query.page : undefined, total);
      const [entries, cover, image] = await Promise.all([
        readSnapshotEntries(db, share.id, page),
        latestSharedEntry(db, share.id),
        latestSharedEntry(db, share.id, true),
      ]);
      const path = sharePath(share.token);
      const shareUrl = new URL(path, options.siteUrl).href;
      const imageUrl = image
        ? new URL(`/work-logs/share/${share.token}/media/${image.id}/`, options.siteUrl).href
        : null;
      const user = await options.currentUser(request);
      return html(
        reply,
        renderPage('work-logs/share/$token', {
          ...(await pageChrome(db, request, user)),
          sharedAt: toIsoDateTime(share.createdAt),
          log: { id: share.logId, title: share.logTitle, createdAt: toIsoDateTime(share.logCreatedAt) },
          ownerUsername: share.ownerUsername,
          headline: share.headline,
          entries: entries.map((entry) => ({ ...entry, createdAt: toIsoDateTime(entry.createdAt) })),
          cover: cover ? { ...cover, createdAt: toIsoDateTime(cover.createdAt) } : null,
          imageUrl,
          shareUrl,
          timelineLinks: pageLinks(path, page, Math.max(1, Math.ceil(total / PAGE_SIZE))),
          newLink: query.new === '1' && user?.id === share.ownerId,
          csrfToken: '',
          mediaUrl: (entry) => `/work-logs/share/${share.token}/media/${entry.id}/`,
        }),
      );
    });

    routes.get<{ Params: { token: string; entryId: string } }>(
      '/work-logs/share/:token/media/:entryId/',
      async (request, reply) => {
        const shareToken = storedShareToken(request.params.token);
        if (!shareToken) return notFound(reply);
        const share = await readShare(db, shareToken);
        const entryId = parseId(request.params.entryId);
        if (!share || entryId === null) return notFound(reply);
        const entry = await pageEntryForShareMedia(db, share.id, share.logId, entryId);
        if (!entry) return notFound(reply);
        return mediaResponse(request, reply, options.mediaRoot, entry);
      },
    );
  });
}
