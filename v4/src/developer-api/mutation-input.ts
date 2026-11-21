import type { PrismaClient } from '@prisma/client';

export class DeveloperMutationInputError extends Error {
  constructor(readonly code: string, message: string, readonly status = 400, readonly fields: object | null = null) {
    super(message);
  }
}

const bodyFields = ['markdown', 'content_html', 'content', 'text_html', 'text_md'] as const;
const stringFields = [...bodyFields, 'title', 'subtitle', 'description', 'slug', 'url', 'series_url', 'published_at', 'expected_updated_at'] as const;
const enums: Record<string, readonly string[]> = {
  content_type: ['markdown', 'html'], cover_layout: ['default', 'split', 'overlay', 'none'],
  cover_image_position: ['left', 'right'], cover_image_ratio: ['auto', '16:9', '4:3', '1:1', '3:4'],
  status: ['draft', 'published', 'scheduled'],
};

function invalid(field: string, type: string): never {
  throw new DeveloperMutationInputError('request.invalid_payload', 'The request payload could not be validated.', 422,
    { errors: [{ loc: ['body', 'payload', field], msg: type }] });
}

function boolean(value: unknown, key: string) {
  if (typeof value === 'boolean') return value;
  if (value === 1 || typeof value === 'string' && /^(true|on|yes|1|y|t)$/i.test(value)) return true;
  if (value === 0 || typeof value === 'string' && /^(false|off|no|0|n|f)$/i.test(value)) return false;
  return invalid(key, 'Input should be a valid boolean');
}

export async function developerPostInput(db: PrismaClient, authorId: number, input: unknown, operation: 'create' | 'update' | 'publish') {
  if (input === undefined && operation === 'publish') input = {};
  if (!input || typeof input !== 'object' || Array.isArray(input)) invalid('payload', 'Input should be a valid object');
  const values = input as Record<string, unknown>;
  for (const key of stringFields) {
    if (values[key] != null && typeof values[key] !== 'string') invalid(key, 'Input should be a valid string');
  }
  for (const [key, allowed] of Object.entries(enums)) {
    const value = values[key];
    if (value != null && (typeof value !== 'string' || !allowed.includes(value))) invalid(key, `Input should be one of ${allowed.join(', ')}`);
  }
  const status = values.status === undefined ? 'draft' : values.status;
  if (operation === 'create' && values.status === null) throw new DeveloperMutationInputError('post.invalid_status', 'status must be one of draft, published, or scheduled.');
  if (operation === 'create' && status === 'scheduled' && !values.published_at) {
    throw new DeveloperMutationInputError('post.missing_published_at', 'published_at is required when status is scheduled.');
  }

  const body: Record<string, unknown> = {};
  for (const field of ['title', 'subtitle', 'description', 'cover_layout', 'cover_image_position', 'cover_image_ratio']) {
    if (values[field] != null) body[field] = values[field];
  }
  const slug = values.slug ?? values.url;
  if (slug != null) body.url = slug;
  if (values.published_at != null && operation !== 'update') body.reserved_date = values.published_at;

  const format = bodyFields.find((field) => Object.hasOwn(values, field));
  if (format) {
    if (values.content_type === null && format !== 'markdown') {
      throw new DeveloperMutationInputError('post.invalid_content_type', 'content_type must be either html or markdown.');
    }
    body.content = values[format] ?? '';
    body.content_type = format === 'markdown' ? 'markdown' : values.content_type ?? 'html';
  } else if (operation === 'create') {
    body.content_type = values.content_type ?? 'html';
  }

  const tags = Object.hasOwn(values, 'tags') ? values.tags : values.tag;
  if (tags != null && typeof tags !== 'string' && (!Array.isArray(tags) || tags.some((tag) => typeof tag !== 'string'))) {
    invalid('tags', 'Input should be a string or list of strings');
  }
  if (tags !== undefined) body.tag = Array.isArray(tags) ? tags.map((tag) => tag.trim()).filter(Boolean).join(',') : tags ?? '';

  const hidden = Object.hasOwn(values, 'is_hidden') ? values.is_hidden : values.is_hide;
  if (hidden != null) body.is_hide = boolean(hidden, 'is_hidden');
  if (values.is_advertise != null) body.is_advertise = boolean(values.is_advertise, 'is_advertise');

  if (values.series_url != null) {
    body.series_url = values.series_url;
  } else if (values.series_id != null && values.series_id !== '') {
    const id = typeof values.series_id === 'string' && /^\d+$/.test(values.series_id) ? Number(values.series_id) : values.series_id;
    if (!Number.isSafeInteger(id)) invalid('series_id', 'Input should be a valid integer');
    const [series] = await db.$queryRaw<Array<{ url: string }>>`
      SELECT url FROM board_series WHERE id = ${id as number} AND owner_id = ${authorId}
    `;
    if (!series) throw new DeveloperMutationInputError('post.series_not_found', 'No series matches series_id.', 404);
    body.series_url = series.url;
  }

  return { body, asDraft: status === 'draft', expectedUpdatedAt: typeof values.expected_updated_at === 'string' ? values.expected_updated_at : undefined };
}
