import { type PrismaClient } from '@prisma/client';
import { Parser } from 'htmlparser2';
import { sanitizePostHtml } from '../post-html.js';
import { markdownToHtml } from '../authoring/markdown.js';
import { PostValidationError } from './post-store.js';
import { AuthoringPostInput, COVER_LAYOUTS, COVER_POSITIONS, COVER_RATIOS, POST_DESCRIPTION_MAX, POST_SUBTITLE_MAX, POST_TITLE_MAX, POST_URL_MAX, TAG_MAX, booleanField, field, inputField } from '../shared.js';

export function mediaUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  return `/resources/media/${value.replace(/^\/+/, '')}`;
}

function storedCoverPath(value: string): string {
  if (!value.startsWith('/resources/media/') || /[\\\u0000-\u001f\u007f?#]/.test(value)) {
    throw new PostValidationError('VA', 'Choose an image URL from the upload page.');
  }
  let path: string;
  try {
    path = value.slice('/resources/media/'.length).split('/').map(decodeURIComponent).join('/');
  } catch {
    throw new PostValidationError('VA', 'Choose an image URL from the upload page.');
  }
  const segments = path.split('/');
  if (segments.length < 2 || segments.some((part) => !part || part === '.' || part === '..' || !/^[A-Za-z0-9._-]+$/.test(part)) ||
      !/\.(?:jpe?g|png|gif)$/i.test(segments.at(-1) ?? '')) {
    throw new PostValidationError('VA', 'Choose an image URL from the upload page.');
  }
  return path;
}

export async function resolveCoverImage(
  db: PrismaClient,
  userId: number,
  requested: string | undefined,
  current: string,
  remove: boolean,
): Promise<string> {
  if (remove) return '';
  if (!requested?.trim()) return current;
  const path = storedCoverPath(requested.trim());
  if (path === current) return current;
  const owned = await db.uploadedImage.findFirst({ where: { path, userId }, select: { id: true } });
  if (!owned) throw new PostValidationError('VA', 'Choose an image you uploaded.');
  return path;
}

export function plainText(html: string): string {
  return sanitizePostHtml(html)
    .replace(/<br\s*\/?\s*>/gi, ' ')
    .replace(/<\/(?:p|h[1-6]|li|blockquote|div)>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/** Strips tags and keeps the first 50 words. */
export function descriptionFromHtml(html: string): string {
  let text = '';
  const parser = new Parser({ ontext: (chunk) => { text += chunk; } }, { decodeEntities: false });
  parser.write(html);
  parser.end();
  const words = text.split(/\s+/u).filter(Boolean);
  return words.length > 50 ? `${words.slice(0, 50).join(' ')}…` : words.join(' ');
}

export function readingTime(html: string): number {
  const words = plainText(html).trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

export function slugify(value: string): string {
  return value.normalize('NFKC').toLocaleLowerCase('ko-KR')
    .replace(/[^\p{L}\p{N}_\s-]/gu, '')
    .trim()
    .replace(/[\s-]+/g, '-');
}

export function normalizedTags(value: string): string[] {
  const prepared = slugify(value.replace(/[,_]/g, '-'));
  return [...new Set(prepared.split('-').filter(Boolean))];
}

export function validatePostInput(input: AuthoringPostInput, allowEmptyBody: boolean): string | null {
  const length = (value: string) => Array.from(value).length;
  if (!allowEmptyBody && !input.title.trim()) return 'Enter a title.';
  if (length(input.title) > POST_TITLE_MAX) return `Titles can be up to ${POST_TITLE_MAX} characters.`;
  if (length(input.subtitle) > POST_SUBTITLE_MAX) return `Subtitles can be up to ${POST_SUBTITLE_MAX} characters.`;
  if (length(input.description) > POST_DESCRIPTION_MAX) return `Descriptions can be up to ${POST_DESCRIPTION_MAX} characters.`;
  if (length(slugify(input.url)) > POST_URL_MAX) return `Post URLs can be up to ${POST_URL_MAX} characters.`;
  if (normalizedTags(input.tags).some((tag) => Array.from(tag).length > TAG_MAX)) {
    return `Each tag can be up to ${TAG_MAX} characters.`;
  }
  if (!allowEmptyBody && !input.text.trim()) return 'Enter some content.';
  if (!COVER_LAYOUTS.has(input.coverLayout)) return 'This cover style is not supported.';
  if (!COVER_POSITIONS.has(input.coverImagePosition)) return 'This cover image position is not supported.';
  if (!COVER_RATIOS.has(input.coverImageRatio)) return 'This cover image ratio is not supported.';
  return null;
}

export function parseAuthoringPostInput(body: Record<string, unknown>): AuthoringPostInput {
  const text = inputField(body, 'contentHtml', 'content', 'textHtml', 'textMd', 'contentMarkdown', 'markdown');
  const contentType = field(body.contentType) || (body.contentMarkdown !== undefined || body.markdown !== undefined ? 'markdown' : 'html');
  const tagsValue = Array.isArray(body.tag) ? body.tag : Array.isArray(body.tags) ? body.tags : undefined;
  return {
    title: field(body.title),
    subtitle: field(body.subtitle),
    text,
    contentType,
    description: inputField(body, 'description', 'metaDescription'),
    url: field(body.url) || field(body.customUrl),
    tags: tagsValue ? tagsValue.map(field).join(',') : inputField(body, 'tag', 'tags'),
    series: field(body.series) || field(body.seriesUrl),
    hide: booleanField(body.isHide ?? body.hide),
    advertise: booleanField(body.isAdvertise ?? body.advertise),
    blockComment: booleanField(body.blockComment),
    coverLayout: field(body.coverLayout) || 'default',
    coverImagePosition: field(body.coverImagePosition) || 'right',
    coverImageRatio: field(body.coverImageRatio) || 'auto',
    coverImage: Object.hasOwn(body, 'coverImageUrl') ? field(body.coverImageUrl) : undefined,
    removeCoverImage: booleanField(body.removeCoverImage),
    reservedDate: field(body.reservedDate),
  };
}

export function resolveContent(input: AuthoringPostInput): string {
  return input.contentType === 'markdown'
    ? markdownToHtml(input.text)
    : sanitizePostHtml(input.text);
}
