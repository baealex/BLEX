import type { PrismaClient } from '@prisma/client';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { isIP } from 'node:net';
import {
  ContentUploadError,
  contentUploadLimit,
  registerContentMultipart,
  saveContentUpload,
} from '../media/content-media.js';
import { developerLanguageHeaders, localizeDeveloperError, readDeveloperLocale } from './localization.js';
import { developerRouteOptions, developerSchemas, developerRequestError, type PostMutationInput } from './schemas.js';
import { DeveloperMutationInputError, developerPostInput } from './mutation-input.js';
import {
  type PaginationQuery,
  type SearchQuery,
  listPosts,
  postDetail,
  postWriteReceipt,
  postNotFound,
  postVersionIssue,
  readOwnedPost,
  summarizePost,
} from './services/posts.js';
import { createDeveloperRateLimiter, developerRequestKind } from './services/rate-limit.js';
import { type AuthenticatedToken, authenticate, requireScope } from './services/token-auth.js';
import {
  API_PREFIX,
  type DeveloperApiOptions,
  type Editor,
  type QueryValue,
  errorReply,
  formatError,
  parseDryRun,
  parsePostId,
  parseValidationError,
  sameVersion,
  toIsoDateTime,
} from './shared.js';
import { registerWireFormat } from './wire-format.js';

export { toIsoDateTime } from './shared.js';
export { parseScopes } from './services/token-auth.js';

export function registerDeveloperApi(app: FastifyInstance, db: PrismaClient, options: DeveloperApiOptions = {}): void {
  app.register(async (routes) => {
    registerWireFormat(routes);
    registerDeveloperRoutes(routes, db, options);
  });
}

function registerDeveloperRoutes(app: FastifyInstance, db: PrismaClient, options: DeveloperApiOptions): void {
  const audited = new WeakMap<FastifyRequest, AuthenticatedToken>();
  const users = new WeakMap<FastifyRequest, number>();
  app.addHook('preSerialization', async (request, reply, payload) => {
    const userId =
      reply.statusCode >= 500
        ? undefined
        : (users.get(request) ?? (await authenticate(db, request.headers.authorization)).token?.user.id);
    const locale = await readDeveloperLocale(db, request, userId);
    developerLanguageHeaders(reply, locale);
    return localizeDeveloperError(payload, locale);
  });
  if (options.writable)
    app.addHook('onSend', async (request, reply, payload) => {
      const token = audited.get(request);
      if (!token) return payload;
      try {
        const when = new Date();
        const ip = isIP(request.ip) ? request.ip : null;
        await db.$transaction(async (tx) => {
          // A token removed while this request ran leaves nothing to record.
          const { count } = await tx.developerToken.updateMany({
            where: { id: token.id },
            data: { lastUsedAt: when, lastUsedIp: ip, updatedAt: when },
          });
          if (!count) return;
          await tx.developerRequestLog.create({
            data: {
              method: request.method.slice(0, 10),
              path: request.url.split('?')[0].slice(0, 255),
              statusCode: reply.statusCode,
              ipAddress: ip,
              userAgent: (request.headers['user-agent'] ?? '').slice(0, 255),
              createdAt: when,
              tokenId: token.id,
              userId: token.user.id,
            },
          });
        });
      } catch (error) {
        request.log.error({ error }, 'Could not record Developer API request');
      }
      return payload;
    });

  const takeRequest = createDeveloperRateLimiter(options.rateLimit);
  const authenticateRequest = async (request: FastifyRequest, reply: FastifyReply) => {
    const result = await authenticate(db, request.headers.authorization);
    if (!result.token) return result;
    users.set(request, result.token.user.id);
    const retryAfter = takeRequest(result.token.id, developerRequestKind(request.method));
    if (retryAfter !== null) {
      // Refused before auditing, so a client over its limit cannot keep writing to the database.
      reply.header('Retry-After', String(retryAfter));
      return {
        error: {
          ...formatError('request.rate_limited', 'Too many requests. Try again later.', 429),
          fields: { retry_after: retryAfter },
        },
      };
    }
    if (options.writable) audited.set(request, result.token);
    return result;
  };

  async function writeToken(request: FastifyRequest, reply: FastifyReply) {
    const { token, error } = await authenticateRequest(request, reply);
    if (error || !token) {
      errorReply(reply, error ?? formatError('auth.invalid_token', 'Invalid token.', 401));
      return null;
    }
    const scope = requireScope(token, 'posts:write');
    if (!scope) {
      const invalid = developerRequestError(request);
      if (!invalid) return token;
      errorReply(reply, invalid);
      return null;
    }
    errorReply(reply, scope);
    return null;
  }

  if (options.writable && options.mediaRoot) {
    app.register(async (routes) => {
      await registerContentMultipart(routes);
      routes.post(
        `${API_PREFIX}/images`,
        {
          ...developerRouteOptions(developerSchemas.uploadImage),
          bodyLimit: contentUploadLimit + 8192,
          config: { bodyAccess: 'token' },
        },
        async (request, reply) => {
          const token = await writeToken(request, reply);
          if (!token) return reply;
          try {
            const url = await saveContentUpload(db, options.mediaRoot, token.user.id, request);
            return reply.code(201).send({ data: { url } });
          } catch (error) {
            if (!(error instanceof ContentUploadError)) throw error;
            return errorReply(reply, formatError(error.code, error.message, error.status));
          }
        },
      );
    });
  }

  const mutations = options.mutations;
  if (options.writable && mutations) {
    const mutationError = async (
      failure: unknown,
      editor: Editor,
      reply: FastifyReply,
      postId?: number,
      expected?: string,
    ) => {
      if (failure instanceof DeveloperMutationInputError) {
        return errorReply(reply, {
          ...formatError(failure.code, failure.message, failure.status),
          fields: failure.fields,
        });
      }
      const error = mutations.error(failure);
      if (!error) throw failure;
      if (error.code === 'post.version_conflict' && postId !== undefined && expected) {
        const actual = await readOwnedPost(db, editor.id, postId);
        if (actual) return errorReply(reply, postVersionIssue(expected, actual));
      }
      if (error.statusCode === 404) return postNotFound(db, reply, editor.id);
      return errorReply(reply, error);
    };
    app.post<{ Body: PostMutationInput }>(
      `${API_PREFIX}/posts`,
      {
        ...developerRouteOptions(developerSchemas.createPost),
        bodyLimit: 1024 * 1024,
        config: { bodyAccess: 'token' },
      },
      async (request, reply) => {
        const token = await writeToken(request, reply);
        if (!token) return reply;
        try {
          const parsed = await developerPostInput(db, token.user.id, request.body, 'create');
          const added = await mutations.create(token.user, parsed.body, parsed.asDraft);
          const post = await readOwnedPost(db, token.user.id, added.id);
          return post
            ? reply.code(201).send({ data: await postDetail(db, post) })
            : postNotFound(db, reply, token.user.id);
        } catch (failure) {
          return mutationError(failure, token.user, reply);
        }
      },
    );

    for (const operation of ['update', 'publish'] as const) {
      const route = `${API_PREFIX}/posts/:postId${operation === 'publish' ? '/publish' : ''}`;
      app.route<{ Params: { postId: string }; Body: PostMutationInput }>({
        ...developerRouteOptions(operation === 'publish' ? developerSchemas.publishPost : developerSchemas.updatePost),
        method: operation === 'publish' ? 'POST' : 'PATCH',
        url: route,
        bodyLimit: 1024 * 1024,
        config: { bodyAccess: 'token' },
        // The publish body is optional, so an empty JSON request must still reach the handler.
        onRequest: async (request) => {
          if (operation === 'publish' && request.headers['content-length'] === '0')
            delete request.headers['content-type'];
        },
        preValidation: async (request) => {
          if (operation === 'publish' && request.body === undefined) request.body = {};
        },
        async handler(request, reply) {
          const token = await writeToken(request, reply);
          if (!token) return reply;
          const id = parsePostId(request.params.postId);
          if (id === null) return parseValidationError(reply, 'post_id', request.params.postId);
          const original = await readOwnedPost(db, token.user.id, id);
          if (!original) return postNotFound(db, reply, token.user.id);
          if (operation === 'publish' && original.publishedAt !== null) {
            return errorReply(
              reply,
              formatError('post.not_draft', 'This post has already been published or scheduled.', 409),
            );
          }
          let expected: string | undefined;
          try {
            const parsed = await developerPostInput(db, token.user.id, request.body, operation);
            expected = parsed.expectedUpdatedAt;
            if (operation === 'update' && expected && !sameVersion(expected, original.updatedAt)) {
              return errorReply(reply, postVersionIssue(expected, original));
            }
            const result =
              operation === 'publish'
                ? await mutations.publish(token.user, id, parsed.body, original.updatedAt.toISOString())
                : await mutations.update(
                    token.user,
                    id,
                    parsed.body,
                    expected ? original.updatedAt.toISOString() : undefined,
                  );
            const post = result && (await readOwnedPost(db, token.user.id, result.id));
            if (!post) return postNotFound(db, reply, token.user.id);
            return reply.send({ data: requireScope(token) ? postWriteReceipt(post) : await postDetail(db, post) });
          } catch (failure) {
            return mutationError(failure, token.user, reply, id, expected);
          }
        },
      });
    }

    app.delete<{ Params: { postId: string }; Querystring: QueryValue }>(
      `${API_PREFIX}/posts/:postId`,
      developerRouteOptions(developerSchemas.deletePost),
      async (request, reply) => {
        const token = await writeToken(request, reply);
        if (!token) return reply;
        const id = parsePostId(request.params.postId);
        if (id === null) return parseValidationError(reply, 'post_id', request.params.postId);
        const { dryRun, invalid } = parseDryRun(request.query);
        if (invalid) return parseValidationError(reply, invalid.field, invalid.value);
        const original = await readOwnedPost(db, token.user.id, id);
        if (!original) return postNotFound(db, reply, token.user.id);
        if (dryRun) {
          const post = requireScope(token) ? postWriteReceipt(original) : await summarizePost(db, original);
          return reply.send({ data: { canDelete: true, post } });
        }
        try {
          const deleted = await mutations.trash(token.user, id);
          return deleted
            ? reply.send({ data: { deleted: true, trashed: true, id, deletedAt: toIsoDateTime(deleted) } })
            : postNotFound(db, reply, token.user.id);
        } catch (failure) {
          return mutationError(failure, token.user, reply);
        }
      },
    );
  }
  app.get(`${API_PREFIX}/me`, developerRouteOptions(developerSchemas.me), async (request, reply) => {
    const auth = await authenticateRequest(request, reply);
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
          isEditor: true,
        },
        token: {
          id: token.id,
          name: token.name,
          tokenPrefix: token.tokenPrefix,
          scopes: token.scopes,
        },
      },
    });
  });

  app.get<{ Querystring: PaginationQuery }>(
    `${API_PREFIX}/posts`,
    developerRouteOptions(developerSchemas.listPosts),
    async (request, reply) => {
      const auth = await authenticateRequest(request, reply);
      if (auth.error) return errorReply(reply, auth.error);
      const token = auth.token;
      if (!token) return reply.code(401).send({ error: { code: 'auth.invalid_token', message: 'Invalid token.' } });
      const scopeError = requireScope(token);
      if (scopeError) return errorReply(reply, scopeError);

      const result = await listPosts(db, token, request.query);
      if (result.error) return errorReply(reply, result.error);
      if (result.invalid) return parseValidationError(reply, result.invalid.field, result.invalid.value);
      return reply.send(result);
    },
  );

  app.get<{ Querystring: SearchQuery }>(
    `${API_PREFIX}/posts/search`,
    developerRouteOptions(developerSchemas.searchPosts),
    async (request, reply) => {
      const auth = await authenticateRequest(request, reply);
      if (auth.error) return errorReply(reply, auth.error);
      const token = auth.token;
      if (!token) return reply.code(401).send({ error: { code: 'auth.invalid_token', message: 'Invalid token.' } });
      const scopeError = requireScope(token);
      if (scopeError) return errorReply(reply, scopeError);

      const result = await listPosts(db, token, request.query, request.query);
      if (result.error) return errorReply(reply, result.error);
      if (result.invalid) return parseValidationError(reply, result.invalid.field, result.invalid.value);
      return reply.send(result);
    },
  );

  app.get<{ Params: { postId: string } }>(
    `${API_PREFIX}/posts/:postId`,
    developerRouteOptions(developerSchemas.getPost),
    async (request, reply) => {
      const auth = await authenticateRequest(request, reply);
      if (auth.error) return errorReply(reply, auth.error);
      const token = auth.token;
      if (!token) return reply.code(401).send({ error: { code: 'auth.invalid_token', message: 'Invalid token.' } });
      const scopeError = requireScope(token);
      if (scopeError) return errorReply(reply, scopeError);

      const postId = parsePostId(request.params.postId);
      if (postId === null) return parseValidationError(reply, 'post_id', request.params.postId);

      const post = await readOwnedPost(db, token.user.id, postId);
      if (!post) return postNotFound(db, reply, token.user.id);
      return reply.send({ data: await postDetail(db, post) });
    },
  );

  app.get(`${API_PREFIX}/tags`, developerRouteOptions(developerSchemas.listTags), async (request, reply) => {
    const auth = await authenticateRequest(request, reply);
    if (auth.error) return errorReply(reply, auth.error);
    const token = auth.token;
    if (!token) return reply.code(401).send({ error: { code: 'auth.invalid_token', message: 'Invalid token.' } });
    const scopeError = requireScope(token);
    if (scopeError) return errorReply(reply, scopeError);

    const active = { authorId: token.user.id, deletedAt: null };
    const tags = await db.tag.findMany({
      where: { posts: { some: active } },
      orderBy: { name: 'asc' },
      select: { name: true, _count: { select: { posts: { where: active } } } },
    });
    return reply.send({
      data: {
        tags: tags.map((tag) => ({
          name: tag.name,
          postCount: tag._count.posts,
        })),
      },
    });
  });

  app.get(`${API_PREFIX}/series`, developerRouteOptions(developerSchemas.listSeries), async (request, reply) => {
    const auth = await authenticateRequest(request, reply);
    if (auth.error) return errorReply(reply, auth.error);
    const token = auth.token;
    if (!token) return reply.code(401).send({ error: { code: 'auth.invalid_token', message: 'Invalid token.' } });
    const scopeError = requireScope(token);
    if (scopeError) return errorReply(reply, scopeError);

    const series = await db.series.findMany({
      where: { ownerId: token.user.id },
      orderBy: [{ order: 'asc' }, { name: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        name: true,
        slug: true,
        descriptionMarkdown: true,
        isHidden: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { posts: { where: { deletedAt: null } } } },
      },
    });
    return reply.send({
      data: {
        series: series.map((item) => ({
          id: item.id,
          name: item.name,
          url: item.slug,
          description: item.descriptionMarkdown,
          isHidden: item.isHidden,
          postCount: item._count.posts,
          createdAt: toIsoDateTime(item.createdAt),
          updatedAt: toIsoDateTime(item.updatedAt),
        })),
      },
    });
  });
}
