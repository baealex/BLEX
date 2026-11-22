import { Prisma, type PrismaClient } from '@prisma/client';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { createHash, timingSafeEqual } from 'node:crypto';
import { isIP } from 'node:net';
import { ContentUploadError, contentUploadLimit, registerContentMultipart, saveContentUpload } from '../content-media.js';
import { DeveloperMutationInputError, developerPostInput } from './mutation-input.js';

const API_PREFIX = '/api/developer/v1';
const TOKEN_PREFIX = 'blex_pat_';

interface QueryValue {
  [key: string]: string | string[] | undefined;
}

interface UserRow {
  id: number;
  username: string;
  firstName: string;
  email: string;
  isActive: number | bigint | boolean;
  role: string | null;
}

interface TokenRow extends UserRow {
  tokenId: number;
  name: string;
  tokenPrefix: string;
  tokenHash: string;
  scopes: string;
  expiresAt: string | Date | null;
  revokedAt: string | Date | null;
}

interface AuthenticatedToken {
  id: number;
  name: string;
  tokenPrefix: string;
  scopes: string[];
  user: UserRow;
}

interface PostRow {
  id: number;
  title: string;
  subtitle: string;
  url: string;
  username: string;
  seriesId: number | null;
  seriesName: string | null;
  seriesUrl: string | null;
  isHidden: number | bigint | boolean | null;
  isAdvertise: number | bigint | boolean | null;
  coverLayout: string | null;
  coverImagePosition: string | null;
  coverImageRatio: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
  publishedAt: string | Date | null;
  total?: number | bigint;
}

interface PostDetailRow extends PostRow {
  description: string;
  readTime: number;
  contentHtml: string | null;
}

interface PostTagRow {
  postId: number;
  value: string;
}

interface SeriesRow {
  id: number;
  name: string;
  url: string;
  description: string;
  isHidden: number | bigint | boolean;
  postCount: number | bigint;
  createdAt: string | Date;
  updatedAt: string | Date;
}

interface TagRow {
  name: string;
  postCount: number | bigint;
}

interface PaginationQuery extends QueryValue {
  page?: string | string[];
  limit?: string | string[];
  status?: string | string[];
}

interface SearchQuery extends PaginationQuery {
  q?: string | string[];
  tag?: string | string[];
  series_id?: string | string[];
}

interface DeveloperApiError {
  code: string;
  message: string;
  statusCode: number;
  fields?: object | null;
}

function errorReply(reply: FastifyReply, error: DeveloperApiError) {
  return reply.code(error.statusCode).send({
    error: { code: error.code, message: error.message, fields: error.fields ?? null },
  });
}

function readScalar(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value.at(-1);
  return value;
}

function asBoolean(value: number | bigint | boolean | null): boolean {
  return value === true || value === 1 || value === 1n;
}

export function toIsoDateTime(value: string | Date | null): string | null {
  if (value === null) return null;
  const raw = value instanceof Date ? value.toISOString() : value;
  const match = raw.replace('T', ' ').match(/^(.+\d{2}:\d{2}:\d{2})(?:\.(\d+))?(Z|[+-]\d{2}:\d{2})?$/);
  if (!match) return raw;

  const fraction = match[2];
  const hasMicroseconds = fraction !== undefined && /[1-9]/.test(fraction);
  const normalizedFraction = hasMicroseconds
    ? `.${fraction.slice(0, 6).padEnd(6, '0')}`
    : '';
  const offset = match[3] === 'Z' ? '+00:00' : (match[3] ?? '+00:00');
  return `${match[1].replace(' ', 'T')}${normalizedFraction}${offset}`;
}

function toSqlDateTime(date: Date): string {
  return date.toISOString()
    .replace('T', ' ')
    .replace(/\.(\d{3})Z$/, (_match, milliseconds: string) => `.${milliseconds}000`);
}

function dateTimeValue(value: string | Date | null): number | null {
  if (value === null) return null;
  if (value instanceof Date) return value.getTime();
  const normalized = value.includes('T') ? value : value.replace(' ', 'T');
  const hasOffset = /(?:Z|[+-]\d{2}:\d{2})$/i.test(normalized);
  return Date.parse(hasOffset ? normalized : `${normalized}Z`);
}

function formatError(code: string, message: string, statusCode: number): DeveloperApiError {
  return { code, message, statusCode };
}

export function parseScopes(scopes: string): string[] {
  try {
    const value: unknown = JSON.parse(scopes);
    return Array.isArray(value) ? value.filter((scope): scope is string => typeof scope === 'string') : [];
  } catch {
    return [];
  }
}

async function authenticate(
  db: PrismaClient,
  authorization: string | undefined,
): Promise<{ token?: AuthenticatedToken; error?: DeveloperApiError }> {
  const separator = authorization?.indexOf(' ') ?? -1;
  const scheme = separator >= 0 ? authorization?.slice(0, separator) : '';
  const rawToken = separator >= 0 ? authorization?.slice(separator + 1).trim() : '';
  if (scheme?.toLowerCase() !== 'bearer' || !rawToken) {
    return { error: formatError('auth.missing_token', 'A Bearer token is required.', 401) };
  }

  if (!rawToken.startsWith(TOKEN_PREFIX)) {
    return { error: formatError('auth.invalid_token', 'Invalid token.', 401) };
  }
  const [tokenPrefix, secret] = rawToken.slice(TOKEN_PREFIX.length).split(/_(.*)/s, 2);
  if (!tokenPrefix || !secret) {
    return { error: formatError('auth.invalid_token', 'Invalid token.', 401) };
  }

  const [row] = await db.$queryRaw<TokenRow[]>`
    SELECT token.id AS tokenId, token.name, token.token_prefix AS tokenPrefix,
           token.token_hash AS tokenHash, token.scopes,
           CAST(token.expires_at AS TEXT) AS expiresAt,
           CAST(token.revoked_at AS TEXT) AS revokedAt, user.id, user.username,
           user.first_name AS firstName, user.email, user.is_active AS isActive,
           profile.role
      FROM board_developertoken AS token
      JOIN auth_user AS user ON user.id = token.user_id
      LEFT JOIN board_profile AS profile ON profile.user_id = user.id
     WHERE token.token_prefix = ${tokenPrefix}
     LIMIT 1
  `;

  const suppliedHash = createHash('sha256').update(rawToken, 'utf8').digest('hex');
  const expectedHash = row ? Buffer.from(row.tokenHash) : Buffer.alloc(0);
  const providedHash = Buffer.from(suppliedHash);
  if (!row || expectedHash.length !== providedHash.length || !timingSafeEqual(expectedHash, providedHash)) {
    return { error: formatError('auth.invalid_token', 'Invalid token.', 401) };
  }

  if (row.revokedAt !== null || (
    row.expiresAt !== null && (dateTimeValue(row.expiresAt) ?? Number.POSITIVE_INFINITY) <= Date.now()
  )) {
    return {
      error: formatError('auth.invalid_token', 'This token has expired or been revoked.', 401),
    };
  }
  if (!asBoolean(row.isActive)) {
    return { error: formatError('auth.inactive_user', 'This user is inactive.', 401) };
  }
  if (row.role !== 'EDITOR') {
    return {
      error: formatError('auth.editor_required', 'The Developer API requires author access.', 403),
    };
  }

  return {
    token: {
      id: row.tokenId,
      name: row.name,
      tokenPrefix: row.tokenPrefix,
      scopes: parseScopes(row.scopes),
      user: {
        id: row.id,
        username: row.username,
        firstName: row.firstName,
        email: row.email,
        isActive: row.isActive,
        role: row.role,
      },
    },
  };
}

function requireScope(token: AuthenticatedToken, scope = 'posts:read'): DeveloperApiError | undefined {
  if (token.scopes.includes(scope)) return undefined;
  return formatError(
    'auth.insufficient_scope',
    `${scope} scope is required.`,
    403,
  );
}

function parseIntegerQuery(value: string | undefined, fallback: number): number | null {
  if (value === undefined) return fallback;
  if (!/^[+-]?\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function parsePostId(value: string): number | null {
  if (!/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function addStatusFilter(filters: Prisma.Sql[], status: string, now: string): DeveloperApiError | undefined {
  if (!status) return undefined;
  switch (status) {
    case 'draft':
      filters.push(Prisma.sql`post.published_date IS NULL`);
      return undefined;
    case 'published':
      filters.push(Prisma.sql`post.deleted_date IS NULL`);
      filters.push(Prisma.sql`post.published_date IS NOT NULL AND post.published_date <= ${now}`);
      filters.push(Prisma.sql`config.hide = 0`);
      return undefined;
    case 'scheduled':
      filters.push(Prisma.sql`post.published_date > ${now}`);
      return undefined;
    case 'hidden':
      filters.push(Prisma.sql`post.published_date IS NOT NULL AND post.published_date <= ${now}`);
      filters.push(Prisma.sql`config.hide = 1`);
      return undefined;
    default:
      return formatError('post.invalid_status', 'Unsupported status.', 400);
  }
}

function parseTags(value: string | string[] | undefined): string[] {
  const values = Array.isArray(value) ? value : value === undefined ? [] : [value];
  return values.flatMap((item) => item.split(',')).map((tag) => tag.trim()).filter(Boolean);
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, '\\$&');
}

function postSummary(row: PostRow, tags: string[], now: number) {
  const isHidden = asBoolean(row.isHidden);
  const publishedAtTime = dateTimeValue(row.publishedAt);
  let status: 'draft' | 'published' | 'scheduled' | 'hidden';
  if (publishedAtTime === null) status = 'draft';
  else if (publishedAtTime > now) status = 'scheduled';
  else if (isHidden) status = 'hidden';
  else status = 'published';

  return {
    id: row.id,
    title: row.title,
    subtitle: row.subtitle,
    url: row.url,
    public_url: `/@${row.username}/${row.url}`,
    status,
    tags,
    series: row.seriesId === null ? null : {
      id: row.seriesId,
      name: row.seriesName ?? '',
      url: row.seriesUrl ?? '',
    },
    is_hidden: isHidden,
    is_advertise: asBoolean(row.isAdvertise),
    cover_layout: row.coverLayout ?? 'default',
    cover_image_position: row.coverImagePosition ?? 'right',
    cover_image_ratio: row.coverImageRatio ?? 'auto',
    created_at: toIsoDateTime(row.createdAt),
    updated_at: toIsoDateTime(row.updatedAt),
    published_at: toIsoDateTime(row.publishedAt),
  };
}

async function tagsByPost(db: PrismaClient, postIds: number[]): Promise<Map<number, string[]>> {
  const tags = new Map<number, string[]>();
  if (postIds.length === 0) return tags;

  const rows = await db.$queryRaw<PostTagRow[]>`
    SELECT post_tags.post_id AS postId, tag.value
      FROM board_post_tags AS post_tags
      JOIN board_tag AS tag ON tag.id = post_tags.tag_id
     WHERE post_tags.post_id IN (${Prisma.join(postIds)})
     ORDER BY post_tags.post_id, tag.value
  `;
  for (const row of rows) {
    const postTags = tags.get(row.postId) ?? [];
    postTags.push(row.value);
    tags.set(row.postId, postTags);
  }
  return tags;
}

function parseValidationError(reply: FastifyReply, field: string, value: string) {
  return reply.code(422).send({
    error: {
      code: 'request.invalid_payload',
      message: 'The request payload could not be validated.',
      fields: {
        errors: [{
          type: 'int_parsing',
          loc: ['query', field],
          msg: `Input should be a valid integer, unable to parse string as an integer: '${value}'`,
          input: value,
        }],
      },
    },
  });
}

async function listPosts(
  db: PrismaClient,
  token: AuthenticatedToken,
  query: PaginationQuery,
  search?: SearchQuery,
) {
  const filters: Prisma.Sql[] = [
    Prisma.sql`post.author_id = ${token.user.id}`,
    Prisma.sql`post.deleted_date IS NULL`,
  ];
  const now = toSqlDateTime(new Date());
  const statusError = addStatusFilter(filters, readScalar(query.status) ?? '', now);
  if (statusError) return { error: statusError };

  if (search) {
    const queryText = (readScalar(search.q) ?? '').trim();
    if (queryText) {
      const pattern = `%${escapeLike(queryText)}%`;
      filters.push(Prisma.sql`(
        post.title LIKE ${pattern} ESCAPE char(92)
        OR post.subtitle LIKE ${pattern} ESCAPE char(92)
        OR post.url LIKE ${pattern} ESCAPE char(92)
        OR post.meta_description LIKE ${pattern} ESCAPE char(92)
        OR EXISTS (
          SELECT 1 FROM board_post_tags AS search_tags
          JOIN board_tag AS search_tag ON search_tag.id = search_tags.tag_id
          WHERE search_tags.post_id = post.id
            AND search_tag.value LIKE ${pattern} ESCAPE char(92)
        )
        OR EXISTS (
          SELECT 1 FROM board_postcontent AS search_content
          WHERE search_content.post_id = post.id
            AND search_content.content_html LIKE ${pattern} ESCAPE char(92)
        )
      )`);
    }

    const seriesId = readScalar(search.series_id);
    if (seriesId !== undefined && seriesId !== '') {
      if (!/^[+-]?\d+$/.test(seriesId) || !Number.isSafeInteger(Number(seriesId))) {
        return {
          error: formatError('request.invalid_series_id', 'series_id must be a number.', 400),
        };
      }
      filters.push(Prisma.sql`post.series_id = ${Number(seriesId)}`);
    }

    const tags = parseTags(search.tag);
    if (tags.length > 0) {
      filters.push(Prisma.sql`EXISTS (
        SELECT 1 FROM board_post_tags AS filter_tags
        JOIN board_tag AS filter_tag ON filter_tag.id = filter_tags.tag_id
        WHERE filter_tags.post_id = post.id
          AND filter_tag.value IN (${Prisma.join(tags)})
      )`);
    }
  }

  const pageValue = parseIntegerQuery(readScalar(query.page), 1);
  const limitValue = parseIntegerQuery(readScalar(query.limit), 20);
  if (pageValue === null) return { invalid: { field: 'page', value: readScalar(query.page) ?? '' } };
  if (limitValue === null) return { invalid: { field: 'limit', value: readScalar(query.limit) ?? '' } };
  const page = Math.max(pageValue, 1);
  const limit = Math.min(Math.max(limitValue, 1), 100);
  const offset = (page - 1) * limit;
  const where = Prisma.join(filters, ' AND ');

  const rows = await db.$queryRaw<PostRow[]>`
    SELECT post.id, post.title, post.subtitle, post.url,
           author.username, post.series_id AS seriesId,
           series.name AS seriesName, series.url AS seriesUrl,
           config.hide AS isHidden, config.advertise AS isAdvertise,
           config.cover_layout AS coverLayout,
           config.cover_image_position AS coverImagePosition,
           config.cover_image_ratio AS coverImageRatio,
           CAST(post.created_date AS TEXT) AS createdAt,
           CAST(post.updated_date AS TEXT) AS updatedAt,
           CAST(post.published_date AS TEXT) AS publishedAt,
           COUNT(*) OVER () AS total
      FROM board_post AS post
      JOIN auth_user AS author ON author.id = post.author_id
      LEFT JOIN board_postconfig AS config ON config.post_id = post.id
      LEFT JOIN board_series AS series ON series.id = post.series_id
      LEFT JOIN board_postcontent AS content ON content.post_id = post.id
     WHERE ${where}
     ORDER BY post.updated_date DESC
     LIMIT ${limit} OFFSET ${offset}
  `;

  let total = Number(rows[0]?.total ?? 0);
  if (rows.length === 0) {
    const [countRow] = await db.$queryRaw<Array<{ total: number | bigint }>>`
      SELECT COUNT(*) AS total
        FROM board_post AS post
        JOIN auth_user AS author ON author.id = post.author_id
        LEFT JOIN board_postconfig AS config ON config.post_id = post.id
        LEFT JOIN board_series AS series ON series.id = post.series_id
        LEFT JOIN board_postcontent AS content ON content.post_id = post.id
       WHERE ${where}
    `;
    total = Number(countRow?.total ?? 0);
  }

  const tags = await tagsByPost(db, rows.map((row) => row.id));
  const nowMs = Date.now();
  return {
    data: {
      posts: rows.map((row) => postSummary(row, tags.get(row.id) ?? [], nowMs)),
      pagination: { page, limit, total },
    },
  };
}

async function readOwnedPost(db: PrismaClient, userId: number, postId: number) {
  const [post] = await db.$queryRaw<PostDetailRow[]>`
    SELECT post.id, post.title, post.subtitle, post.url,
           author.username, post.series_id AS seriesId,
           series.name AS seriesName, series.url AS seriesUrl,
           config.hide AS isHidden, config.advertise AS isAdvertise,
           config.cover_layout AS coverLayout,
           config.cover_image_position AS coverImagePosition,
           config.cover_image_ratio AS coverImageRatio,
           CAST(post.created_date AS TEXT) AS createdAt,
           CAST(post.updated_date AS TEXT) AS updatedAt,
           CAST(post.published_date AS TEXT) AS publishedAt,
           post.meta_description AS description, post.read_time AS readTime,
           content.content_html AS contentHtml
      FROM board_post AS post
      JOIN auth_user AS author ON author.id = post.author_id
      LEFT JOIN board_postconfig AS config ON config.post_id = post.id
      LEFT JOIN board_series AS series ON series.id = post.series_id
      LEFT JOIN board_postcontent AS content ON content.post_id = post.id
     WHERE post.id = ${postId}
       AND post.author_id = ${userId}
       AND post.deleted_date IS NULL
     LIMIT 1
  `;
  return post ?? null;
}

async function summarizePost(db: PrismaClient, post: PostRow) {
  const tags = await tagsByPost(db, [post.id]);
  return postSummary(post, tags.get(post.id) ?? [], Date.now());
}

async function postDetail(db: PrismaClient, post: PostDetailRow) {
  const data = await summarizePost(db, post);
  const contentHtml = post.contentHtml ?? '';
  return {
    ...data,
    description: post.description,
    content: contentHtml,
    content_html: contentHtml,
    rendered_html: contentHtml,
    read_time: post.readTime,
  };
}

type Editor = { id: number; username: string };
interface DeveloperPostMutations {
  create: (editor: Editor, input: Record<string, unknown>, asDraft: boolean) => Promise<{ id: number }>;
  update: (editor: Editor, id: number, input: Record<string, unknown>, expectedStoredUpdate?: string) => Promise<{ id: number } | null>;
  publish: (editor: Editor, id: number, input: Record<string, unknown>, expectedStoredUpdate: string) => Promise<{ id: number } | null>;
  trash: (editor: Editor, id: number) => Promise<string | null>;
  error: (failure: unknown) => DeveloperApiError | null;
}

interface DeveloperApiOptions {
  writable?: boolean;
  mediaRoot?: string;
  mutations?: DeveloperPostMutations;
}

function postNotFound(reply: FastifyReply) {
  const headers = reply.request.headers;
  const language = headers['accept-language']?.split(',')[0]?.trim().split(/[;-]/)[0];
  const message = process.env.ENABLE_ENGLISH_UI === 'TRUE' && language === 'en' ? 'Post not found.' : '포스트를 찾을 수 없습니다.';
  return errorReply(reply, formatError('post.not_found', message, 404));
}

function postVersionIssue(expected: string, post: PostDetailRow) {
  return {
    ...formatError('post.version_conflict', 'The post was already updated by another request.', 409),
    fields: { expected_updated_at: expected, actual_updated_at: toIsoDateTime(post.updatedAt), post_id: post.id },
  };
}

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
