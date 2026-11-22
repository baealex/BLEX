import { type PrismaClient } from '@prisma/client';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { isIP } from 'node:net';
import { ContentUploadError, contentUploadLimit, registerContentMultipart, saveContentUpload } from '../media/content-media.js';
import { DeveloperMutationInputError, developerPostInput } from './mutation-input.js';
import { PaginationQuery, SearchQuery, listPosts, postDetail, postNotFound, postVersionIssue, readOwnedPost, summarizePost } from './services/posts.js';
import { AuthenticatedToken, authenticate, requireScope } from './services/token-auth.js';
import { API_PREFIX, DeveloperApiOptions, Editor, QueryValue, SeriesRow, TagRow, asBoolean, errorReply, formatError, parsePostId, parseValidationError, readScalar, toIsoDateTime, toSqlDateTime } from './shared.js';

export { toIsoDateTime } from './shared.js';
export { parseScopes } from './services/token-auth.js';

export function registerDeveloperApi(app: FastifyInstance, db: PrismaClient, options: DeveloperApiOptions = {}): void {
  const audited = new WeakMap<FastifyRequest, AuthenticatedToken>();
  if (options.writable) app.addHook('onSend', async (request, reply, payload) => {
    const token = audited.get(request);
    if (!token) return payload;
    try {
      const when = toSqlDateTime(new Date());
      const ip = isIP(request.ip) ? request.ip : null;
      await db.$transaction([
        db.$executeRaw`UPDATE board_developertoken SET last_used_at = ${when}, last_used_ip = ${ip}, updated_date = ${when} WHERE id = ${token.id}`,
        db.$executeRaw`INSERT INTO board_developerrequestlog (method, path, status_code, ip_address, user_agent, created_date, token_id, user_id)
                       SELECT ${request.method.slice(0, 10)}, ${request.url.split('?')[0].slice(0, 255)}, ${reply.statusCode},
                              ${ip}, ${(request.headers['user-agent'] ?? '').slice(0, 255)}, ${when}, id, user_id
                         FROM board_developertoken WHERE id = ${token.id}`,
      ]);
    } catch (error) {
      request.log.error({ error }, 'Could not record Developer API request');
    }
    return payload;
  });

  const authenticateRequest = async (request: FastifyRequest) => {
    const result = await authenticate(db, request.headers.authorization);
    if (options.writable && result.token) audited.set(request, result.token);
    return result;
  };

  async function writeToken(request: FastifyRequest, reply: FastifyReply) {
    const { token, error } = await authenticateRequest(request);
    if (error || !token) {
      errorReply(reply, error ?? formatError('auth.invalid_token', 'Invalid token.', 401));
      return null;
    }
    const scope = requireScope(token, 'posts:write');
    if (!scope) return token;
    errorReply(reply, scope);
    return null;
  }

  if (options.writable && options.mediaRoot) {
    app.register(async (routes) => {
      await registerContentMultipart(routes);
      routes.post(`${API_PREFIX}/images`, { bodyLimit: contentUploadLimit + 8192 }, async (request, reply) => {
        const token = await writeToken(request, reply);
        if (!token) return reply;
        try {
          const url = await saveContentUpload(db, options.mediaRoot, token.user.id, request);
          return reply.code(201).send({ data: { url } });
        } catch (error) {
          if (!(error instanceof ContentUploadError)) throw error;
          return errorReply(reply, formatError(error.code, error.message, error.status));
        }
      });
    });
  }

  const mutations = options.mutations;
  if (options.writable && mutations) {
    const mutationError = async (failure: unknown, editor: Editor, reply: FastifyReply, postId?: number, expected?: string) => {
      if (failure instanceof DeveloperMutationInputError) {
        return errorReply(reply, { ...formatError(failure.code, failure.message, failure.status), fields: failure.fields });
      }
      const error = mutations.error(failure);
      if (!error) throw failure;
      if (error.code === 'post.version_conflict' && postId !== undefined && expected) {
        const actual = await readOwnedPost(db, editor.id, postId);
        if (actual) return errorReply(reply, postVersionIssue(expected, actual));
      }
      if (error.statusCode === 404) return postNotFound(reply);
      return errorReply(reply, error);
    };
    app.post(`${API_PREFIX}/posts`, { bodyLimit: 1024 * 1024 }, async (request, reply) => {
      const token = await writeToken(request, reply);
      if (!token) return reply;
      try {
        const parsed = await developerPostInput(db, token.user.id, request.body, 'create');
        const added = await mutations.create(token.user, parsed.body, parsed.asDraft);
        const post = await readOwnedPost(db, token.user.id, added.id);
        return post ? reply.code(201).send({ data: await postDetail(db, post) }) : postNotFound(reply);
      } catch (failure) {
        return mutationError(failure, token.user, reply);
      }
    });

    for (const operation of ['update', 'publish'] as const) {
      const route = `${API_PREFIX}/posts/:post_id${operation === 'publish' ? '/publish' : ''}`;
      app.route<{ Params: { post_id: string } }>({ method: operation === 'publish' ? 'POST' : 'PATCH', url: route,
        bodyLimit: 1024 * 1024,
        // The publish body is optional, so an empty JSON request must still reach the handler.
        onRequest: async (request) => {
          if (operation === 'publish' && request.headers['content-length'] === '0') delete request.headers['content-type'];
        },
        async handler(request, reply) {
          const token = await writeToken(request, reply);
          if (!token) return reply;
          const id = parsePostId(request.params.post_id);
          if (id === null) return parseValidationError(reply, 'post_id', request.params.post_id);
          const original = await readOwnedPost(db, token.user.id, id);
          if (!original) return postNotFound(reply);
          if (operation === 'publish' && original.publishedAt !== null) {
            return errorReply(reply, formatError('post.not_draft', 'This post has already been published or scheduled.', 409));
          }
          let expected: string | undefined;
          try {
            const parsed = await developerPostInput(db, token.user.id, request.body, operation);
            expected = parsed.expectedUpdatedAt;
            if (operation === 'update' && expected && expected !== toIsoDateTime(original.updatedAt)) {
              return errorReply(reply, postVersionIssue(expected, original));
            }
            const result = operation === 'publish' ? await mutations.publish(token.user, id, parsed.body, String(original.updatedAt)) :
              await mutations.update(token.user, id, parsed.body, expected ? String(original.updatedAt) : undefined);
            const post = result && await readOwnedPost(db, token.user.id, result.id);
            return post ? reply.send({ data: await postDetail(db, post) }) : postNotFound(reply);
          } catch (failure) {
            return mutationError(failure, token.user, reply, id, expected);
          }
        } });
    }

    app.delete<{ Params: { post_id: string }; Querystring: QueryValue }>(`${API_PREFIX}/posts/:post_id`, async (request, reply) => {
      const token = await writeToken(request, reply);
      if (!token) return reply;
      const id = parsePostId(request.params.post_id);
      if (id === null) return parseValidationError(reply, 'post_id', request.params.post_id);
      const dryRun = readScalar(request.query.dry_run);
      if (dryRun && !/^(true|on|yes|1|y|t|false|off|no|0|n|f)$/i.test(dryRun)) return parseValidationError(reply, 'dry_run', dryRun);
      const original = await readOwnedPost(db, token.user.id, id);
      if (!original) return postNotFound(reply);
      if (dryRun && /^(true|on|yes|1|y|t)$/i.test(dryRun)) {
        return reply.send({ data: { can_delete: true, post: await summarizePost(db, original) } });
      }
      try {
        const deleted = await mutations.trash(token.user, id);
        return deleted ? reply.send({ data: { deleted: true, trashed: true, id, deleted_at: toIsoDateTime(deleted) } }) : postNotFound(reply);
      } catch (failure) {
        return mutationError(failure, token.user, reply);
      }
    });
  }
  app.get(`${API_PREFIX}/me`, async (request, reply) => {
    const auth = await authenticateRequest(request);
    if (auth.error) return errorReply(reply, auth.error);
    const token = auth.token;
    if (!token) return reply.code(401).send({ error: { code: 'auth.invalid_token', message: 'Invalid token.' } });

    return reply.send({
      data: {
        user: {
          id: token.user.id,
          username: token.user.username,
          name: token.user.firstName,
          email: token.user.email,
          is_editor: true,
        },
        token: {
          id: token.id,
          name: token.name,
          token_prefix: token.tokenPrefix,
          scopes: token.scopes,
        },
      },
    });
  });

  app.get<{ Querystring: PaginationQuery }>(`${API_PREFIX}/posts`, async (request, reply) => {
    const auth = await authenticateRequest(request);
    if (auth.error) return errorReply(reply, auth.error);
    const token = auth.token;
    if (!token) return reply.code(401).send({ error: { code: 'auth.invalid_token', message: 'Invalid token.' } });
    const scopeError = requireScope(token);
    if (scopeError) return errorReply(reply, scopeError);

    const result = await listPosts(db, token, request.query);
    if (result.error) return errorReply(reply, result.error);
    if (result.invalid) return parseValidationError(reply, result.invalid.field, result.invalid.value);
    return reply.send(result);
  });

  app.get<{ Querystring: SearchQuery }>(`${API_PREFIX}/posts/search`, async (request, reply) => {
    const auth = await authenticateRequest(request);
    if (auth.error) return errorReply(reply, auth.error);
    const token = auth.token;
    if (!token) return reply.code(401).send({ error: { code: 'auth.invalid_token', message: 'Invalid token.' } });
    const scopeError = requireScope(token);
    if (scopeError) return errorReply(reply, scopeError);

    const result = await listPosts(db, token, request.query, request.query);
    if (result.error) return errorReply(reply, result.error);
    if (result.invalid) return parseValidationError(reply, result.invalid.field, result.invalid.value);
    return reply.send(result);
  });

  app.get<{ Params: { post_id: string } }>(`${API_PREFIX}/posts/:post_id`, async (request, reply) => {
    const auth = await authenticateRequest(request);
    if (auth.error) return errorReply(reply, auth.error);
    const token = auth.token;
    if (!token) return reply.code(401).send({ error: { code: 'auth.invalid_token', message: 'Invalid token.' } });
    const scopeError = requireScope(token);
    if (scopeError) return errorReply(reply, scopeError);

    const postId = parsePostId(request.params.post_id);
    if (postId === null) return parseValidationError(reply, 'post_id', request.params.post_id);

    const post = await readOwnedPost(db, token.user.id, postId);
    if (!post) return postNotFound(reply);
    return reply.send({ data: await postDetail(db, post) });
  });

  app.get(`${API_PREFIX}/tags`, async (request, reply) => {
    const auth = await authenticateRequest(request);
    if (auth.error) return errorReply(reply, auth.error);
    const token = auth.token;
    if (!token) return reply.code(401).send({ error: { code: 'auth.invalid_token', message: 'Invalid token.' } });
    const scopeError = requireScope(token);
    if (scopeError) return errorReply(reply, scopeError);

    const tags = await db.$queryRaw<TagRow[]>`
      SELECT tag.value AS name, COUNT(DISTINCT post.id) AS postCount
        FROM board_tag AS tag
        JOIN board_post_tags AS post_tags ON post_tags.tag_id = tag.id
        JOIN board_post AS post ON post.id = post_tags.post_id
       WHERE post.author_id = ${token.user.id} AND post.deleted_date IS NULL
       GROUP BY tag.id, tag.value
       ORDER BY tag.value
    `;
    return reply.send({ data: { tags: tags.map((tag) => ({
      name: tag.name,
      post_count: Number(tag.postCount),
    })) } });
  });

  app.get(`${API_PREFIX}/series`, async (request, reply) => {
    const auth = await authenticateRequest(request);
    if (auth.error) return errorReply(reply, auth.error);
    const token = auth.token;
    if (!token) return reply.code(401).send({ error: { code: 'auth.invalid_token', message: 'Invalid token.' } });
    const scopeError = requireScope(token);
    if (scopeError) return errorReply(reply, scopeError);

    const series = await db.$queryRaw<SeriesRow[]>`
      SELECT series.id, series.name, series.url, series.text_md AS description,
             series.hide AS isHidden,
             COUNT(DISTINCT post.id) AS postCount,
             CAST(series.created_date AS TEXT) AS createdAt,
             CAST(series.updated_date AS TEXT) AS updatedAt
        FROM board_series AS series
        LEFT JOIN board_post AS post
          ON post.series_id = series.id AND post.deleted_date IS NULL
       WHERE series.owner_id = ${token.user.id}
       GROUP BY series.id
       ORDER BY series."order", series.name, series.id
    `;
    return reply.send({ data: { series: series.map((item) => ({
      id: item.id,
      name: item.name,
      url: item.url,
      description: item.description,
      is_hidden: asBoolean(item.isHidden),
      post_count: Number(item.postCount),
      created_at: toIsoDateTime(item.createdAt),
      updated_at: toIsoDateTime(item.updatedAt),
    })) } });
  });
}
