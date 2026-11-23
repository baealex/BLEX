import type { PrismaClient } from '@prisma/client';
import { camelToSnake } from './wire-format.js';

export class DeveloperMutationInputError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status = 400,
    readonly fields: object | null = null,
  ) {
    super(message);
  }
}

const bodyFields = ['markdown', 'contentHtml', 'content', 'textHtml', 'textMd'] as const;
const stringFields = [
  ...bodyFields,
  'title',
  'subtitle',
  'description',
  'slug',
  'url',
  'seriesUrl',
  'publishedAt',
  'expectedUpdatedAt',
] as const;
const enums: Record<string, readonly string[]> = {
  contentType: ['markdown', 'html'],
  coverLayout: ['default', 'split', 'overlay', 'none'],
  coverImagePosition: ['left', 'right'],
  coverImageRatio: ['auto', '16:9', '4:3', '1:1', '3:4'],
  status: ['draft', 'published', 'scheduled'],
};

const authoringFields = [
  'title',
  'subtitle',
  'description',
  'coverLayout',
  'coverImagePosition',
  'coverImageRatio',
] as const;

/** `loc` is a response value, so it names the field the way the caller wrote it. */
function invalid(field: string, type: string): never {
  throw new DeveloperMutationInputError('request.invalid_payload', 'The request payload could not be validated.', 422, {
    errors: [{ loc: ['body', 'payload', camelToSnake(field)], msg: type }],
  });
}

function boolean(value: unknown, key: string) {
  if (typeof value === 'boolean') return value;
  if (value === 1 || (typeof value === 'string' && /^(true|on|yes|1|y|t)$/i.test(value))) return true;
  if (value === 0 || (typeof value === 'string' && /^(false|off|no|0|n|f)$/i.test(value))) return false;
  return invalid(key, 'Input should be a valid boolean');
}

export async function developerPostInput(
  db: PrismaClient,
  authorId: number,
  input: unknown,
  operation: 'create' | 'update' | 'publish',
) {
  if (input === undefined && operation === 'publish') input = {};
  if (!input || typeof input !== 'object' || Array.isArray(input)) invalid('payload', 'Input should be a valid object');
  const values = input as Record<string, unknown>;
  for (const key of stringFields) {
    if (values[key] != null && typeof values[key] !== 'string') invalid(key, 'Input should be a valid string');
  }
  for (const [key, allowed] of Object.entries(enums)) {
    const value = values[key];
    if (value != null && (typeof value !== 'string' || !allowed.includes(value)))
      invalid(key, `Input should be one of ${allowed.join(', ')}`);
  }
  const status = values.status === undefined ? 'draft' : values.status;
  if (operation === 'create' && values.status === null)
    throw new DeveloperMutationInputError(
      'post.invalid_status',
      'status must be one of draft, published, or scheduled.',
    );
  if (operation === 'create' && status === 'scheduled' && !values.publishedAt) {
    throw new DeveloperMutationInputError(
      'post.missing_published_at',
      'published_at is required when status is scheduled.',
    );
  }

  const body: Record<string, unknown> = {};
  for (const field of authoringFields) {
    if (values[field] != null) body[field] = values[field];
  }
  const slug = values.slug ?? values.url;
  if (slug != null) body.url = slug;
  // Creating a draft ignores publication time.
  if (values.publishedAt != null && operation !== 'update' && !(operation === 'create' && status === 'draft')) {
    body.reservedDate = values.publishedAt;
  }

  const format = bodyFields.find((field) => Object.hasOwn(values, field));
  if (format) {
    if (values.contentType === null && format !== 'markdown') {
      throw new DeveloperMutationInputError(
        'post.invalid_content_type',
        'content_type must be either html or markdown.',
      );
    }
    body.content = values[format] ?? '';
    body.contentType = format === 'markdown' ? 'markdown' : (values.contentType ?? 'html');
  } else if (operation === 'create') {
    body.contentType = values.contentType ?? 'html';
  }

  const tags = Object.hasOwn(values, 'tags') ? values.tags : values.tag;
  if (
    tags != null &&
    typeof tags !== 'string' &&
    (!Array.isArray(tags) || tags.some((tag) => typeof tag !== 'string'))
  ) {
    invalid('tags', 'Input should be a string or list of strings');
  }
  if (tags !== undefined)
    body.tag = Array.isArray(tags)
      ? tags
          .map((tag) => tag.trim())
          .filter(Boolean)
          .join(',')
      : (tags ?? '');

  const hidden = Object.hasOwn(values, 'isHidden') ? values.isHidden : values.isHide;
  if (hidden != null) body.isHide = boolean(hidden, 'isHidden');
  if (values.isAdvertise != null) body.isAdvertise = boolean(values.isAdvertise, 'isAdvertise');

  if (values.seriesUrl != null) {
    body.seriesUrl = values.seriesUrl;
  } else if (values.seriesId != null && values.seriesId !== '') {
    const id =
      typeof values.seriesId === 'string' && /^\d+$/.test(values.seriesId) ? Number(values.seriesId) : values.seriesId;
    if (!Number.isSafeInteger(id)) invalid('seriesId', 'Input should be a valid integer');
    const series = await db.series.findFirst({
      where: { id: id as number, ownerId: authorId },
      select: { slug: true },
    });
    if (!series) throw new DeveloperMutationInputError('post.series_not_found', 'No series matches series_id.', 404);
    body.seriesUrl = series.slug;
  }

  return {
    body,
    asDraft: status === 'draft',
    expectedUpdatedAt: typeof values.expectedUpdatedAt === 'string' ? values.expectedUpdatedAt : undefined,
  };
}
