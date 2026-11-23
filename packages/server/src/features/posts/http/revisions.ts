import { type PrismaClient } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import { storedDateText } from '../../../platform/date-format.js';
import { sanitizePostHtml } from '../post-html.js';
import { done, failure as failed } from '../../../platform/response.js';
import { renderRevisionHistoryPage, renderTimelapsePage, sendPrivateHistoryPage } from '../history-view.js';
import { plainText } from '../services/post-content.js';
import { PostValidationError, assertExpectedUpdatedAt, loadPost } from '../services/post-store.js';
import {
  buildTimelapse,
  deleteRevision,
  listRevisions,
  loadRevision,
  restoreRevision,
  revisionSummary,
} from '../services/revisions.js';
import {
  AuthoringOptions,
  bodyObject,
  cookieValue,
  dateAsIso,
  editorAccount,
  field,
  forbidden,
  notFound,
  queryObject,
} from '../shared.js';

export function registerRevisionsRoutes(routes: FastifyInstance, db: PrismaClient, options: AuthoringOptions) {
  routes.get<{ Params: { username: string; slug: string } }>('/@:username/:slug/revisions', async (request, reply) => {
    const account = await editorAccount(request, reply, db, options, false);
    if (!account) return reply;
    const post = await loadPost(db, { username: request.params.username, slug: request.params.slug });
    if (!post || post.authorId !== account.id || post.publishedDate === null) return notFound(reply);
    const query = queryObject(request);
    const pageRaw = field(query.page) || '1';
    if (!/^\d+$/.test(pageRaw) || !Number.isSafeInteger(Number(pageRaw)) || Number(pageRaw) < 1) return notFound(reply);
    const page = Number(pageRaw);
    const limit = 20;
    const { totalCount, lastPage, revisions } = await listRevisions(db, post.id, page, limit);
    if (!revisions) return notFound(reply);
    const updatedDate = storedDateText(post.updatedDate);
    const notice =
      field(query.restored) === '1'
        ? '이 기록으로 복원했습니다.'
        : field(query.restored) === 'already'
          ? '현재 글이 이미 이 기록과 같습니다.'
          : field(query.deleted) === '1'
            ? '수정 기록을 삭제했습니다.'
            : field(query.conflict) === '1'
              ? '글이 다른 곳에서 변경됐습니다. 기록을 새로 불러왔습니다.'
              : '';
    return sendPrivateHistoryPage(
      reply,
      renderRevisionHistoryPage({
        username: account.username,
        slug: post.url,
        title: post.title,
        updatedDate,
        csrfToken: cookieValue(request, 'csrftoken'),
        page,
        lastPage,
        totalCount,
        revisions,
        notice,
      }),
    );
  });

  routes.post<{ Params: { username: string; slug: string; revisionId: string } }>(
    '/@:username/:slug/revisions/:revisionId/restore',
    async (request, reply) => {
      const account = await editorAccount(request, reply, db, options, false);
      if (!account) return reply;
      if (!options.validateCsrf(request)) return forbidden(reply);
      const post = await loadPost(db, { username: request.params.username, slug: request.params.slug });
      const revisionId = /^\d+$/.test(request.params.revisionId) ? Number(request.params.revisionId) : 0;
      if (
        !post ||
        post.authorId !== account.id ||
        post.publishedDate === null ||
        !Number.isSafeInteger(revisionId) ||
        revisionId < 1
      ) {
        return notFound(reply);
      }
      const revision = await loadRevision(db, post.id, revisionId);
      if (!revision) return notFound(reply);
      const expected = field(bodyObject(request.body).expectedUpdatedDate);
      if (!expected) return forbidden(reply);
      try {
        const result = await restoreRevision(db, account, post, revision, expected);
        const state = result.restored ? '1' : 'already';
        return reply.redirect(
          `/@${encodeURIComponent(account.username)}/${encodeURIComponent(post.url)}/revisions?restored=${state}`,
          303,
        );
      } catch (error) {
        if (error instanceof PostValidationError) {
          return reply.redirect(
            `/@${encodeURIComponent(account.username)}/${encodeURIComponent(post.url)}/revisions?conflict=1`,
            303,
          );
        }
        throw error;
      }
    },
  );

  routes.post<{ Params: { username: string; slug: string; revisionId: string } }>(
    '/@:username/:slug/revisions/:revisionId/delete',
    async (request, reply) => {
      const account = await editorAccount(request, reply, db, options, false);
      if (!account) return reply;
      if (!options.validateCsrf(request)) return forbidden(reply);
      const post = await loadPost(db, { username: request.params.username, slug: request.params.slug });
      const revisionId = /^\d+$/.test(request.params.revisionId) ? Number(request.params.revisionId) : 0;
      if (
        !post ||
        post.authorId !== account.id ||
        post.publishedDate === null ||
        !Number.isSafeInteger(revisionId) ||
        revisionId < 1
      ) {
        return notFound(reply);
      }
      const body = bodyObject(request.body);
      if (field(body.confirmDelete) !== 'yes') return forbidden(reply);
      const expected = field(body.expectedUpdatedDate);
      if (!expected) return forbidden(reply);
      try {
        assertExpectedUpdatedAt(post.updatedDate, expected);
      } catch {
        return reply.redirect(
          `/@${encodeURIComponent(account.username)}/${encodeURIComponent(post.url)}/revisions?conflict=1`,
          303,
        );
      }
      if (!(await deleteRevision(db, post.id, revisionId))) return notFound(reply);
      return reply.redirect(
        `/@${encodeURIComponent(account.username)}/${encodeURIComponent(post.url)}/revisions?deleted=1`,
        303,
      );
    },
  );

  routes.get<{ Params: { username: string; slug: string } }>('/@:username/:slug/timelapse', async (request, reply) => {
    const account = await editorAccount(request, reply, db, options, false);
    if (!account) return reply;
    const post = await loadPost(db, { username: request.params.username, slug: request.params.slug });
    if (!post || post.authorId !== account.id || post.publishedDate === null) return notFound(reply);
    return sendPrivateHistoryPage(reply, renderTimelapsePage(account.username, post, await buildTimelapse(db, post)));
  });

  routes.get<{ Params: { username: string; url: string } }>(
    '/v1/users/@:username/posts/:url/revisions',
    async (request, reply) => {
      const account = await editorAccount(request, reply, db, options, true);
      if (!account) return reply;
      const post = await loadPost(db, { username: request.params.username, slug: request.params.url });
      if (!post || post.authorId !== account.id || post.publishedDate === null) return notFound(reply);
      const query = queryObject(request);
      const pageRaw = field(query.page) || '1';
      const limitRaw = field(query.limit) || '20';
      if (!/^\d+$/.test(pageRaw) || !/^\d+$/.test(limitRaw))
        return failed('VA', 'Check the revision history pagination values.');
      const page = Number(pageRaw);
      const limit = Number(limitRaw);
      if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(limit) || limit < 1 || limit > 50) {
        return failed('VA', 'Check the revision history pagination values.');
      }
      const { totalCount, lastPage, revisions } = await listRevisions(db, post.id, page, limit);
      if (!revisions) return failed('VA', 'Check the revision history pagination values.');
      return done({
        revisions: revisions.map(revisionSummary),
        pagination: { page, limit, totalCount, lastPage },
        currentUpdatedDate: dateAsIso(post.updatedDate),
        retention: { mode: 'unlimited' },
      });
    },
  );

  routes.route<{ Params: { username: string; url: string; revisionId: string } }>({
    method: ['GET', 'DELETE'],
    url: '/v1/users/@:username/posts/:url/revisions/:revisionId',
    handler: async (request, reply) => {
      const account = await editorAccount(request, reply, db, options, true);
      if (!account) return reply;
      const post = await loadPost(db, { username: request.params.username, slug: request.params.url });
      const revisionId = /^\d+$/.test(request.params.revisionId) ? Number(request.params.revisionId) : 0;
      if (
        !post ||
        post.authorId !== account.id ||
        post.publishedDate === null ||
        !Number.isSafeInteger(revisionId) ||
        revisionId < 1
      )
        return notFound(reply);
      if (request.method === 'DELETE') {
        if (!options.validateCsrf(request)) return forbidden(reply);
        if (!(await deleteRevision(db, post.id, revisionId))) return notFound(reply);
        return done({ revisionId, deleted: true });
      }
      const revision = await loadRevision(db, post.id, revisionId);
      if (!revision) return notFound(reply);
      return done({
        revision: {
          ...revisionSummary(revision),
          contentHtml: sanitizePostHtml(revision.content),
          contentText: plainText(revision.content),
          description: revision.description,
        },
      });
    },
  });

  routes.post<{ Params: { username: string; url: string; revisionId: string } }>(
    '/v1/users/@:username/posts/:url/revisions/:revisionId/restore',
    async (request, reply) => {
      const account = await editorAccount(request, reply, db, options, true);
      if (!account) return reply;
      if (!options.validateCsrf(request)) return forbidden(reply);
      const post = await loadPost(db, { username: request.params.username, slug: request.params.url });
      const revisionId = /^\d+$/.test(request.params.revisionId) ? Number(request.params.revisionId) : 0;
      if (!post || post.authorId !== account.id || post.publishedDate === null || revisionId < 1)
        return notFound(reply);
      const revision = await loadRevision(db, post.id, revisionId);
      if (!revision) return notFound(reply);
      const body = bodyObject(request.body);
      const expected = field(body.expectedUpdatedDate);
      if (!expected) return failed('VA', 'Check the current post version.');
      try {
        const result = await restoreRevision(db, account, post, revision, expected);
        return done({ url: post.url, updatedDate: result.updatedDate, restored: result.restored });
      } catch (error) {
        if (error instanceof PostValidationError) return failed(error.code, error.message);
        throw error;
      }
    },
  );

  routes.get<{ Params: { username: string; url: string } }>(
    '/v1/users/@:username/posts/:url/timelapse',
    async (request, reply) => {
      const account = await editorAccount(request, reply, db, options, true);
      if (!account) return reply;
      const post = await loadPost(db, { username: request.params.username, slug: request.params.url });
      if (!post || post.authorId !== account.id || post.publishedDate === null) return notFound(reply);
      return done(await buildTimelapse(db, post));
    },
  );
}
