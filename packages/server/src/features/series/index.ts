import formBody from '@fastify/formbody';
import { type PrismaClient } from '@prisma/client';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { done as apiDone, messageFailure as apiError } from '../../platform/response.js';
import { MAX_PINNED_POSTS, PinnedServiceError, addPinnedPost, parsePinnedUrls, pinnedError, pinnedPostUrl, readPinnablePosts, readPinnedPosts, removePinnedPost, reorderPinnedPosts, reservedPinnedCount } from './services/pinned-posts.js';
import { deleteSeries, parsePostIds, readAvailableSeriesPosts, readSeriesById, readSeriesPostIds, readSeriesRows, saveSeries, updateSeriesOrder } from './services/series.js';
import { AuthorCollectionsOptions, bodyRecord, errorMessage, isActiveEditor, localDate, positiveInt, queryValue, readDatabaseUser, requireActiveEditor, stringValue, unauthorizedLogin } from './shared.js';

export { AuthorCollectionsOptions } from './shared.js';

export function registerAuthorCollections(app: FastifyInstance, db: PrismaClient, options: AuthorCollectionsOptions): void {
  app.register(async (routes) => {
    await routes.register(formBody);
    routes.addHook('onRequest', async (_request, reply) => {
      reply.header('Cache-Control', 'private, no-store');
    });

    const apiEditor = async (request: FastifyRequest) => {
      const user = await requireActiveEditor(db, request, options);
      if (!user || !user.active) return { user: null, error: unauthorizedLogin() };
      if (!isActiveEditor(user)) return { user: null, error: apiError('RJ', 'Author access is required.') };
      return { user, error: null };
    };

    const pinnedOwnerEditor = async (request: FastifyRequest, ownerId: number) => {
      const sessionUser = await options.currentUser(request);
      if (!sessionUser || !Number.isSafeInteger(sessionUser.id) || sessionUser.id <= 0 || !sessionUser.username) {
        return { user: null, error: unauthorizedLogin() };
      }
      const user = await readDatabaseUser(db, sessionUser.id, sessionUser.username);
      if (!user || !user.active) return { user: null, error: unauthorizedLogin() };
      if (user.id !== ownerId) return { user: null, error: apiError('AT', 'Permission denied.') };
      if (!isActiveEditor(user)) return { user: null, error: apiError('RJ', 'Author access is required.') };
      return { user, error: null };
    };

    routes.get('/v1/setting/series', async (request, reply) => {
      const { user, error } = await apiEditor(request);
      if (!user) return error;
      const rows = await readSeriesRows(db, user.id, 'active');
      return apiDone({
        username: user.username,
        series: rows.map((row) => ({ id: Number(row.id), url: row.url, title: row.name, totalPosts: Number(row.totalPosts) })),
      });
    });

    routes.get('/v1/series', async (request, reply) => {
      const { user, error } = await apiEditor(request);
      if (!user) return error;
      const rows = await readSeriesRows(db, user.id, 'public');
      return apiDone({ series: rows.map((row) => ({
        id: String(row.id), name: row.name, url: row.url, totalPosts: Number(row.totalPosts), createdDate: localDate(row.createdDate),
      })) });
    });

    routes.post('/v1/series', async (request, reply) => {
      const { user, error } = await apiEditor(request);
      if (!user) return error;
      if (!options.validateCsrf(request)) return reply.code(403).send(apiError('RJ'));
      const body = bodyRecord(request.body);
      const postIds = Object.hasOwn(body, 'post_ids') ? parsePostIds(body.post_ids) : undefined;
      if (postIds === null) return apiError('IP', 'Invalid request data.');
      try {
        const series = await saveSeries(db, user.id, {
          name: stringValue(body.name), url: stringValue(body.url), description: stringValue(body.description), postIds,
        });
        return apiDone({ ...series, thumbnail: stringValue(body.thumbnail) });
      } catch (failure) {
        return apiError((failure as { code?: string })?.code ?? 'VA', errorMessage(failure, 'Could not create the series.'));
      }
    });

    routes.get('/v1/series/valid-posts', async (request, reply) => {
      const { user, error } = await apiEditor(request);
      if (!user) return error;
      const rawId = queryValue(request, 'series_id');
      let seriesId: number | undefined;
      if (rawId !== undefined) {
        seriesId = positiveInt(rawId) ?? undefined;
        if (seriesId === undefined) return apiError('IP', 'Enter a valid series ID.');
        const series = await readSeriesById(db, user.id, seriesId);
        if (!series) return apiError('NF', 'Series not found.');
      }
      return apiDone(await readAvailableSeriesPosts(db, user.id, seriesId));
    });

    routes.put('/v1/series/order', async (request, reply) => {
      const { user, error } = await apiEditor(request);
      if (!user) return error;
      if (!options.validateCsrf(request)) return reply.code(403).send(apiError('RJ'));
      const raw = bodyRecord(request.body).order;
      if (!Array.isArray(raw) || !raw.length || !raw.every((item) => Array.isArray(item) && item.length >= 2 && Number.isSafeInteger(Number(item[0])) && Number.isSafeInteger(Number(item[1])))) {
        return apiError('IP', 'Order information is required.');
      }
      await updateSeriesOrder(db, user.id, raw.map((item) => [Number(item[0]), Number(item[1])] as [number, number]));
      return apiDone({ message: 'Series order updated.' });
    });

    routes.get<{ Params: { id: string } }>('/v1/series/:id', async (request, reply) => {
      const { user, error } = await apiEditor(request);
      if (!user) return error;
      const id = positiveInt(request.params.id);
      if (!id) return reply.code(404).send('Not found');
      const series = await readSeriesById(db, user.id, id);
      if (!series) return apiError('NF', 'Series not found.');
      const postIds = await readSeriesPostIds(db, user.id, id);
      return apiDone({ id, name: series.name, url: series.url, description: series.description, postIds, postCount: postIds.length });
    });

    routes.put<{ Params: { id: string } }>('/v1/series/:id', async (request, reply) => {
      const { user, error } = await apiEditor(request);
      if (!user) return error;
      if (!options.validateCsrf(request)) return reply.code(403).send(apiError('RJ'));
      const id = positiveInt(request.params.id);
      if (!id || !(await readSeriesById(db, user.id, id))) return apiError('NF', 'Series not found.');
      const body = bodyRecord(request.body);
      const postIds = Object.hasOwn(body, 'post_ids') ? parsePostIds(body.post_ids) : undefined;
      if (postIds === null) return apiError('IP', 'Invalid request data.');
      try {
        const series = await saveSeries(db, user.id, {
          name: body.name === undefined ? undefined : stringValue(body.name),
          url: body.url === undefined ? undefined : stringValue(body.url),
          description: body.description === undefined ? undefined : stringValue(body.description),
          postIds,
        }, id);
        return apiDone({ ...series, thumbnail: stringValue(body.thumbnail) });
      } catch (failure) {
        return apiError((failure as { code?: string })?.code ?? 'VA', errorMessage(failure, 'Could not update the series.'));
      }
    });

    routes.delete<{ Params: { id: string } }>('/v1/series/:id', async (request, reply) => {
      const { user, error } = await apiEditor(request);
      if (!user) return error;
      if (!options.validateCsrf(request)) return reply.code(403).send(apiError('RJ'));
      const id = positiveInt(request.params.id);
      if (!id || !(await deleteSeries(db, user.id, id))) return apiError('NF', 'Series not found.');
      return apiDone({ message: 'Series deleted.' });
    });

    routes.delete<{ Params: { username: string; url: string } }>('/v1/users/@:username/series/:url', async (request, reply) => {
      const [owner] = await db.$queryRaw<Array<{ id: number; username: string; active: number | bigint | boolean }>>`
        SELECT id, username, CAST(is_active AS INTEGER) AS active FROM auth_user WHERE username = ${request.params.username} LIMIT 1
      `;
      if (!owner) return reply.code(404).send('Not found');
      const { user, error } = await apiEditor(request);
      if (!user) return error;
      if (user.id !== owner.id) return apiError('AT', 'Permission denied.');
      if (!options.validateCsrf(request)) return reply.code(403).send(apiError('RJ'));
      const [series] = await db.$queryRaw<Array<{ id: number }>>`
        SELECT id FROM board_series WHERE owner_id = ${owner.id} AND url = ${request.params.url} LIMIT 1
      `;
      if (!series || !(await deleteSeries(db, user.id, Number(series.id)))) return reply.code(404).send('Not found');
      return apiDone({});
    });

    routes.get('/v1/setting/pinned-posts', async (request, reply) => {
      const { user, error } = await apiEditor(request);
      if (!user) return error;
      const [pinnedPosts, reservedCount] = await Promise.all([readPinnedPosts(db, user.id), reservedPinnedCount(db, user.id)]);
      return apiDone({ pinnedPosts: pinnedPosts.map(({ publishedDate: _publishedDate, ...pin }) => pin), username: user.username, maxCount: MAX_PINNED_POSTS, reservedCount });
    });

    routes.get('/v1/setting/pinnable-posts', async (request, reply) => {
      const { user, error } = await apiEditor(request);
      if (!user) return error;
      const result = await readPinnablePosts(db, user.id, queryValue(request, 'q'), queryValue(request, 'limit'), queryValue(request, 'page'));
      return 'code' in result ? pinnedError(result) : apiDone({ posts: result.posts, ...result.pagination });
    });

    const settingPinnedMutation = async (request: FastifyRequest, reply: FastifyReply, mode: 'add' | 'remove' | 'order') => {
      const { user, error } = await apiEditor(request);
      if (!user) return error;
      if (!options.validateCsrf(request)) return reply.code(403).send(apiError('RJ'));
      let failure: PinnedServiceError | null = null;
      if (mode === 'order') {
        const urls = parsePinnedUrls(bodyRecord(request.body).post_urls);
        if (!urls) return pinnedError({ code: 'IP', key: 'pinned_posts.invalid_format' });
        failure = await reorderPinnedPosts(db, user.id, urls);
      } else {
        const url = pinnedPostUrl(request);
        if (!url) return pinnedError({ code: 'IP', key: 'pinned_posts.post_url_required' });
        failure = mode === 'add' ? await addPinnedPost(db, user.id, url) : await removePinnedPost(db, user.id, url);
      }
      return failure ? pinnedError(failure) : apiDone();
    };

    routes.post('/v1/setting/pinned-posts', (request, reply) => settingPinnedMutation(request, reply, 'add'));
    routes.delete('/v1/setting/pinned-posts', (request, reply) => settingPinnedMutation(request, reply, 'remove'));
    routes.put('/v1/setting/pinned-posts/order', (request, reply) => settingPinnedMutation(request, reply, 'order'));

    routes.get<{ Params: { username: string } }>('/v1/users/@:username/pinned-posts', async (request, reply) => {
      const [owner] = await db.$queryRaw<Array<{ id: number }>>`
        SELECT id FROM auth_user WHERE username = ${request.params.username} LIMIT 1
      `;
      if (!owner) return reply.code(404).send('Not found');
      const pinnedPosts = await readPinnedPosts(db, Number(owner.id));
      return apiDone({ pinnedPosts, maxCount: MAX_PINNED_POSTS });
    });

    const authorPinnedMutation = async (request: FastifyRequest, reply: FastifyReply, username: string, mode: 'add' | 'remove' | 'order' | 'available') => {
      const [owner] = await db.$queryRaw<Array<{ id: number; username: string }>>`
        SELECT id, username FROM auth_user WHERE username = ${username} LIMIT 1
      `;
      if (!owner) return reply.code(404).send('Not found');
      const { user, error } = await pinnedOwnerEditor(request, Number(owner.id));
      if (!user) return error;
      if (!options.validateCsrf(request)) return reply.code(403).send(apiError('RJ'));
      if (mode === 'available') {
        const result = await readPinnablePosts(db, owner.id, queryValue(request, 'q'), queryValue(request, 'limit'), queryValue(request, 'page'));
        return 'code' in result ? pinnedError(result) : apiDone({ posts: result.posts, ...result.pagination });
      }
      if (mode === 'order') {
        const urls = parsePinnedUrls(bodyRecord(request.body).post_urls);
        if (!urls) return pinnedError({ code: 'IP', key: 'pinned_posts.invalid_format' });
        const failure = await reorderPinnedPosts(db, owner.id, urls);
        return failure ? pinnedError(failure) : apiDone();
      }
      const url = pinnedPostUrl(request);
      if (!url) return pinnedError({ code: 'IP', key: 'pinned_posts.post_url_required' });
      const failure = mode === 'add' ? await addPinnedPost(db, owner.id, url) : await removePinnedPost(db, owner.id, url);
      return failure ? pinnedError(failure) : apiDone();
    };

    routes.post<{ Params: { username: string } }>('/v1/users/@:username/pinned-posts', (request, reply) => authorPinnedMutation(request, reply, request.params.username, 'add'));
    routes.delete<{ Params: { username: string } }>('/v1/users/@:username/pinned-posts', (request, reply) => authorPinnedMutation(request, reply, request.params.username, 'remove'));
    routes.put<{ Params: { username: string } }>('/v1/users/@:username/pinned-posts/order', (request, reply) => authorPinnedMutation(request, reply, request.params.username, 'order'));
    routes.get<{ Params: { username: string } }>('/v1/users/@:username/pinnable-posts', (request, reply) => authorPinnedMutation(request, reply, request.params.username, 'available'));
  });
}
