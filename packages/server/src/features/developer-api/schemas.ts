import { Ajv } from 'ajv';
import type { FastifyError, FastifyReply, FastifyRequest, FastifySchema } from 'fastify';
import { Type, type Static, type TSchema } from 'typebox';
import { keysToWire } from './wire-format.js';

export const developerApiRoot = '/api/developer/v1';
export const paginationDefaults = { page: 1, limit: 20, maxLimit: 100 } as const;

const nullable = <T extends TSchema>(schema: T) => Type.Union([schema, Type.Null()]);
const optional = <T extends TSchema>(schema: T) => Type.Optional(nullable(schema));
const choices = <const T extends string[]>(...values: T) => Type.Enum(values);
const coverLayout = choices('default', 'split', 'overlay', 'none');
const coverPosition = choices('left', 'right');
const coverRatio = choices('auto', '16:9', '4:3', '1:1', '3:4');
const postStatus = choices('draft', 'published', 'scheduled', 'hidden');
const booleanInput = Type.Union([
  Type.Boolean(),
  Type.Literal(0),
  Type.Literal(1),
  Type.String({
    pattern: '^(?:[Tt][Rr][Uu][Ee]|[Ff][Aa][Ll][Ss][Ee]|[Oo][Nn]|[Oo][Ff][Ff]|[Yy][Ee][Ss]|[Nn][Oo]|[01YyTtNnFf])$',
  }),
]);

const mutationFields = {
  title: optional(Type.String({ description: 'The post title.' })),
  markdown: optional(
    Type.String({ description: 'The Markdown body. Start with this field when creating an integration.' }),
  ),
  content_html: optional(
    Type.String({ description: 'The HTML body. If markdown is also present, markdown takes priority.' }),
  ),
  content: optional(Type.String({ description: 'The post body. New integrations should use markdown.' })),
  text_html: optional(Type.String({ description: 'A body field for existing integrations.', deprecated: true })),
  text_md: optional(
    Type.String({
      description: 'A body field for existing integrations. Its format follows content_type.',
      deprecated: true,
    }),
  ),
  content_type: optional(
    Type.Enum(['markdown', 'html'], {
      description: 'The body format. The markdown field always uses Markdown. Other body fields default to html.',
    }),
  ),
  subtitle: optional(Type.String({ description: 'The subtitle displayed below the title.' })),
  description: optional(Type.String({ description: 'A short description for search results and shared links.' })),
  tags: optional(
    Type.Union([Type.Array(Type.String()), Type.String()], {
      description: 'An array of tags. A comma-separated string is also accepted.',
    }),
  ),
  tag: optional(
    Type.Union([Type.Array(Type.String()), Type.String()], {
      description: 'A compatibility alias for tags.',
      deprecated: true,
    }),
  ),
  series_id: optional(
    Type.Union([Type.Integer(), Type.String({ pattern: '^\\d*$' })], {
      description: 'The ID of one of your series. Omit it if no series is needed.',
    }),
  ),
  series_url: optional(
    Type.String({
      description: 'The URL name of one of your series. Takes priority over series_id when both are sent.',
    }),
  ),
  slug: optional(
    Type.String({
      description:
        'The final part of the post URL. Generated automatically if omitted. Cannot be changed after publishing.',
    }),
  ),
  url: optional(Type.String({ description: 'A compatibility alias for slug.', deprecated: true })),
  is_hidden: optional(
    Type.Union(booleanInput.anyOf, { description: 'Set true to make the post private to its author.' }),
  ),
  is_hide: optional(Type.Union(booleanInput.anyOf, { deprecated: true })),
  is_advertise: optional(booleanInput),
  cover_layout: optional(coverLayout),
  cover_image_position: optional(coverPosition),
  cover_image_ratio: optional(coverRatio),
  published_at: optional(
    Type.String({
      description:
        'The scheduled publication time, for example 2099-01-01T09:00:00+09:00. Ignored when creating a draft or updating with PATCH.',
    }),
  ),
  expected_updated_at: optional(
    Type.String({
      description:
        'Send updated_at from the last response to prevent overwriting another request’s changes. Applies to PATCH updates.',
    }),
  ),
  status: optional(
    Type.Enum(['draft', 'published', 'scheduled'], {
      description: 'The initial post status. Defaults to draft. Ignored in update and publish requests.',
    }),
  ),
};

export const postMutationBody = Type.Object(mutationFields);
type Camel<Key extends string> = Key extends `${infer Head}_${infer Tail}` ? `${Head}${Capitalize<Camel<Tail>>}` : Key;
export type PostMutationWireInput = Static<typeof postMutationBody>;
export type PostMutationInput = { [Key in keyof PostMutationWireInput as Camel<Key>]: PostMutationWireInput[Key] };

export const postExamples = {
  create: {
    title: 'My first API post',
    markdown: '# Hello BLEX\n\nMy first draft, saved with the API.',
    status: 'draft',
  },
  update: { title: 'An updated title' },
  publish: {},
} satisfies Record<string, PostMutationWireInput>;

const queryValue = <T extends TSchema>(schema: T) => Type.Optional(Type.Union([schema, Type.Array(schema)]));
const integerQuery = Type.String({ pattern: '^[+-]?\\d+$' });
const listQueryFields = {
  status: queryValue(
    Type.Union([Type.Literal(''), postStatus], {
      description:
        'draft: draft, published: public, scheduled: scheduled, hidden: private. Omit to fetch all statuses.',
    }),
  ),
  page: queryValue(
    Type.String({
      ...integerQuery,
      description: 'Page number. Defaults to {page}; values below 1 are treated as 1.',
      'x-message-values': { page: paginationDefaults.page },
    }),
  ),
  limit: queryValue(
    Type.String({
      ...integerQuery,
      description: 'Posts per page. Defaults to {limit}; values are adjusted to 1–{max}.',
      'x-message-values': { limit: paginationDefaults.limit, max: paginationDefaults.maxLimit },
    }),
  ),
};
export const postListQuery = Type.Object(listQueryFields);
export const postSearchQuery = Type.Object({
  ...listQueryFields,
  q: queryValue(Type.String({ description: 'Search the title, body, description, and tags.' })),
  tag: queryValue(Type.String({ description: 'Tag names. Separate multiple tags with commas to match any of them.' })),
  series_id: queryValue(
    Type.Union([Type.Literal(''), integerQuery], { description: 'Only fetch posts in this series.' }),
  ),
});
export type PostListQuery = Static<typeof postListQuery>;
export type PostSearchQuery = Static<typeof postSearchQuery>;
export const postParams = Type.Object({
  post_id: Type.String({ pattern: '^\\d+$', description: 'data.id from a create or read response.' }),
});

export const postSummary = Type.Object(
  {
    id: Type.Integer(),
    title: Type.String(),
    subtitle: Type.String(),
    url: Type.String(),
    public_url: Type.String({
      description:
        'Add this path to the site’s address to open the post. Drafts and private posts are only visible to their author.',
    }),
    status: postStatus,
    tags: Type.Array(Type.String()),
    series: nullable(Type.Object({ id: Type.Integer(), name: Type.String(), url: Type.String() })),
    is_hidden: Type.Boolean(),
    is_advertise: Type.Boolean(),
    cover_layout: coverLayout,
    cover_image_position: coverPosition,
    cover_image_ratio: coverRatio,
    created_at: Type.String(),
    updated_at: Type.String(),
    published_at: nullable(Type.String()),
  },
  { title: 'PostSummary' },
);
export const postDetail = Type.Object(
  {
    ...postSummary.properties,
    description: Type.String(),
    content: Type.String({ description: 'The converted HTML body.' }),
    content_html: Type.String(),
    rendered_html: Type.String(),
    read_time: Type.Integer(),
  },
  { title: 'PostDetail' },
);

const envelope = <T extends TSchema>(schema: T) => Type.Object({ data: schema });
export const developerError = Type.Object({
  error: Type.Object({
    code: Type.String(),
    message: Type.String(),
    fields: Type.Optional(nullable(Type.Object({}, { additionalProperties: true }))),
  }),
});
const errors = {
  400: developerError,
  401: developerError,
  403: developerError,
  404: developerError,
  409: developerError,
  413: developerError,
  415: developerError,
  422: developerError,
  429: developerError,
  500: developerError,
};
const pagination = Type.Object({ page: Type.Integer(), limit: Type.Integer(), total: Type.Integer() });
const postListResponse = envelope(Type.Object({ posts: Type.Array(postSummary), pagination }));
const postReceipt = Type.Object({
  id: Type.Integer(),
  status: postStatus,
  url: Type.Optional(Type.String()),
  public_url: Type.Optional(Type.String()),
  updated_at: Type.String(),
  published_at: nullable(Type.String()),
});
const postResponse = envelope(Type.Union([postDetail, postReceipt]));
const metadata = (operationId: string, summary: string, tag: string, description: string) => ({
  operationId,
  summary,
  tags: [tag],
  description,
  security: [{ DeveloperBearerAuth: [] }],
});

export const developerSchemas = {
  me: {
    ...metadata(
      'getMe',
      'Check your token and account',
      'Account',
      'Call this first to check your connection. No read or write scope is required.',
    ),
    response: {
      ...errors,
      200: envelope(
        Type.Object({
          user: Type.Object({
            id: Type.Integer(),
            username: Type.String(),
            name: Type.String(),
            email: Type.String(),
            is_editor: Type.Boolean(),
          }),
          token: Type.Object({
            id: Type.Integer(),
            name: Type.String(),
            token_prefix: Type.String(),
            scopes: Type.Array(Type.String()),
          }),
        }),
      ),
    },
  },
  listPosts: {
    ...metadata(
      'listPosts',
      'List your posts',
      'Posts',
      'Requires posts:read. Returns your posts ordered by most recently updated. Other authors’ posts are excluded.',
    ),
    querystring: postListQuery,
    response: { ...errors, 200: postListResponse },
  },
  searchPosts: {
    ...metadata(
      'searchPosts',
      'Search your posts',
      'Posts',
      'Requires posts:read. Combine a search term, tags, a series, and a status.',
    ),
    querystring: postSearchQuery,
    response: { ...errors, 200: postListResponse },
  },
  getPost: {
    ...metadata(
      'getPost',
      'Get a post',
      'Posts',
      'Requires posts:read. Only your own posts are available, including draft bodies.',
    ),
    params: postParams,
    response: { ...errors, 200: postResponse },
  },
  createPost: {
    ...metadata(
      'createPost',
      'Create a post',
      'Posts',
      'Requires posts:write. Omit status to save a private draft. Send status: published to publish, or status: scheduled with published_at to schedule.',
    ),
    body: { ...postMutationBody, example: postExamples.create },
    response: { ...errors, 201: postResponse },
  },
  updatePost: {
    ...metadata(
      'updatePost',
      'Update a post',
      'Posts',
      'Requires posts:write. Send only changed fields. Send expected_updated_at to receive 409 if another request has already updated the post. status and published_at do not change publication state here.',
    ),
    params: postParams,
    body: { ...postMutationBody, example: postExamples.update },
    response: { ...errors, 200: postResponse },
  },
  publishPost: {
    ...metadata(
      'publishPost',
      'Publish a draft',
      'Posts',
      'Requires posts:write. An empty body publishes immediately. Send published_at to schedule. A published or scheduled post cannot be published again.',
    ),
    params: postParams,
    body: { ...postMutationBody, example: postExamples.publish },
    response: { ...errors, 200: postResponse },
  },
  deletePost: {
    ...metadata(
      'deletePost',
      'Move a post to trash',
      'Posts',
      'Requires posts:write. Check the target first with dry_run=true. Trashed posts can be restored on the site.',
    ),
    params: postParams,
    querystring: Type.Object({
      dry_run: queryValue(
        Type.Union([Type.Literal(''), booleanInput], {
          description: 'Set true to check the target without deleting it.',
        }),
      ),
    }),
    response: {
      ...errors,
      200: envelope(
        Type.Union([
          Type.Object({ can_delete: Type.Boolean(), post: Type.Union([postSummary, postReceipt]) }),
          Type.Object({
            deleted: Type.Boolean(),
            trashed: Type.Boolean(),
            id: Type.Integer(),
            deleted_at: Type.String(),
          }),
        ]),
      ),
    },
  },
  listTags: {
    ...metadata(
      'listTags',
      'List your tags',
      'Tags and series',
      'Requires posts:read. Returns tags and usage counts from your posts, excluding trash.',
    ),
    response: {
      ...errors,
      200: envelope(
        Type.Object({ tags: Type.Array(Type.Object({ name: Type.String(), post_count: Type.Integer() })) }),
      ),
    },
  },
  listSeries: {
    ...metadata(
      'listSeries',
      'List your series',
      'Tags and series',
      'Requires posts:read. Use a returned id as series_id when creating or updating a post.',
    ),
    response: {
      ...errors,
      200: envelope(
        Type.Object({
          series: Type.Array(
            Type.Object({
              id: Type.Integer(),
              name: Type.String(),
              url: Type.String(),
              description: Type.String(),
              is_hidden: Type.Boolean(),
              post_count: Type.Integer(),
              created_at: Type.String(),
              updated_at: Type.String(),
            }),
          ),
        }),
      ),
    },
  },
  uploadImage: {
    ...metadata(
      'uploadImage',
      'Upload a body image',
      'Images',
      'Requires posts:write. Send a file in the image field as multipart/form-data. Use data.url from the response in a Markdown image.',
    ),
    consumes: ['multipart/form-data'],
    body: Type.Object({ image: Type.String({ format: 'binary' }) }),
    response: { ...errors, 201: envelope(Type.Object({ url: Type.String() })) },
  },
} satisfies Record<string, FastifySchema>;

const validator = new Ajv({
  coerceTypes: false,
  useDefaults: false,
  removeAdditional: false,
  strict: false,
  validateFormats: false,
});

export function developerRouteOptions(schema: FastifySchema) {
  return {
    schema: schema.params ? { ...schema, params: Type.Object({ postId: postParams.properties.post_id }) } : schema,
    attachValidation: true,
    validatorCompiler: ({ schema: part, httpPart }: { schema: unknown; httpPart?: string }) => {
      // Multipart files are streamed and validated by saveContentUpload, not parsed into request.body.
      if (schema.consumes?.includes('multipart/form-data') && httpPart === 'body') return () => true;
      // Existing query/path parsing retains its clamping, repeated-value, and error contracts.
      if (httpPart !== 'body') return () => true;
      const validate = validator.compile(part as TSchema);
      const check = (data: unknown) => {
        const valid = validate(keysToWire(data));
        check.errors = validate.errors;
        return valid;
      };
      check.errors = validate.errors;
      return check;
    },
    errorHandler: (error: FastifyError, request: FastifyRequest, reply: FastifyReply) => {
      const status = error.statusCode ?? 500;
      if (status >= 500) request.log.error(error);
      return reply.code(status).send({
        error: {
          code:
            status >= 500
              ? 'request.failed'
              : status === 413
                ? 'request.too_large'
                : status === 415
                  ? 'request.unsupported_media_type'
                  : 'request.invalid_payload',
          message:
            status >= 500
              ? 'Could not complete the request.'
              : status === 413
                ? 'The request body is too large.'
                : status === 415
                  ? 'Use a supported Content-Type.'
                  : 'The request payload could not be validated.',
          fields: null,
        },
      });
    },
  };
}

export function developerRequestError(request: FastifyRequest) {
  const failure = request.validationError;
  if (!failure) return null;
  const context = failure.validationContext ?? 'body';
  const issue =
    failure.validation?.find((entry: { keyword: string }) => entry.keyword !== 'anyOf') ?? failure.validation?.[0];
  const field = issue?.instancePath?.split('/').filter(Boolean)[0] ?? '';
  if (context === 'querystring' && field === 'status')
    return { code: 'post.invalid_status', message: 'Unsupported status.', statusCode: 400 };
  if (context === 'querystring' && field === 'series_id')
    return { code: 'request.invalid_series_id', message: 'series_id must be a number.', statusCode: 400 };
  const loc =
    context === 'body'
      ? ['body', 'payload']
      : [context === 'querystring' ? 'query' : context === 'params' ? 'path' : context];
  return {
    code: 'request.invalid_payload',
    message: 'The request payload could not be validated.',
    statusCode: 422,
    fields: {
      errors: [
        {
          loc: [...loc, ...[field === 'is_hide' ? 'is_hidden' : field || 'payload']],
          msg: issue?.message ?? 'Invalid input',
        },
      ],
    },
  };
}
