import { type PrismaClient } from '@prisma/client';
import type { FastifyRequest } from 'fastify';
import { ContentUploadError, contentUploadTooLargeMessage, saveContentFile } from '../../media/content-media.js';
import { postTags } from './post-store.js';
import { AuthoringOptions, StoredPost, UserRow, bodyObject, booleanField, field } from '../shared.js';

// The editor posts whole documents, accepted up to the proxy limit.
export const editorBodyLimit = 13 * 1024 * 1024;

export interface EditorForm {
  body: Record<string, unknown>;
  image?: { buffer: Buffer; filename: string };
  isMultipart: boolean;
  uploadError?: string;
}

export function isMultipartRequest(request: FastifyRequest): boolean {
  return String(request.headers['content-type'] ?? '').toLowerCase().startsWith('multipart/form-data');
}

export async function readEditorForm(request: FastifyRequest): Promise<EditorForm> {
  if (!isMultipartRequest(request)) return { body: bodyObject(request.body), isMultipart: false };
  const body: Record<string, unknown> = {};
  let image: EditorForm['image'];
  let uploadError: string | undefined;
  let fieldBytes = 0;
  try {
    for await (const part of request.parts()) {
      if (part.type === 'file') {
        const buffer = await part.toBuffer();
        if (part.fieldname === 'image' && part.filename && buffer.length) image = { buffer, filename: part.filename };
        continue;
      }
      // Multipart parsing skips the route's body limit. Over-limit fields are still read so the request can finish.
      fieldBytes += Buffer.byteLength(String(part.value));
      if (fieldBytes > editorBodyLimit) uploadError = 'The post is too large to save.';
      else body[part.fieldname] = part.value;
    }
  } catch (error) {
    if (!(error instanceof Error && 'code' in error && error.code === 'FST_REQ_FILE_TOO_LARGE')) throw error;
    uploadError = contentUploadTooLargeMessage;
  }
  request.body = body;
  return { body, image, isMultipart: true, uploadError };
}

/** Maps the editor's series id and cover file onto the fields the save path understands. */
export async function prepareEditorFields(db: PrismaClient, options: AuthoringOptions, account: UserRow, form: EditorForm): Promise<string | null> {
  if (form.uploadError) return form.uploadError;
  const { body, image } = form;
  if (Object.hasOwn(body, 'series') && Object.hasOwn(body, 'contentHtml') && !Object.hasOwn(body, 'textMd')) {
    const seriesId = field(body.series);
    if (seriesId) {
      const series = /^\d+$/.test(seriesId)
        ? await db.series.findFirst({ where: { id: Number(seriesId), ownerId: account.id }, select: { slug: true } })
        : null;
      // Only an empty value clears the series. An id that no longer resolves changes nothing.
      if (series) body.series = series.slug;
      else delete body.series;
    }
  }
  if (image) {
    try {
      body.coverImageUrl = await saveContentFile(db, options.mediaRoot, account.id, image);
    } catch (error) {
      if (error instanceof ContentUploadError) return error.message;
      throw error;
    }
  } else if (booleanField(body.imageDelete) || booleanField(body.removeImage)) body.removeCoverImage = 'true';
  return null;
}

export async function editorKeepsOriginalTags(db: PrismaClient, post: StoredPost, body: Record<string, unknown>): Promise<boolean> {
  return Object.hasOwn(body, 'tag') && field(body.tag) === (await postTags(db, post.id)).join(', ');
}
