import type { FastifyReply, FastifyRequest } from 'fastify';
import sharp from 'sharp';
import { createReadStream } from 'node:fs';
import { mkdir, realpath, stat, unlink, writeFile } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { randomUUID } from 'node:crypto';
import { EntryRow } from './logs.js';
import { notFound } from '../shared.js';

export const MAX_ATTACHMENT_SIZE = 12 * 1024 * 1024;

const MAX_IMAGE_PIXELS = 20_000_000;

const PRIVATE_MEDIA_DIRECTORY = '_work_logs';

interface MediaFile {
  path: string;
  size: number;
}

export async function validateAttachment(data: Buffer): Promise<{ mediaType: string; extension: string }> {
  if (data.length === 0 || data.length > MAX_ATTACHMENT_SIZE) {
    throw new Error('12MB 이하의 파일을 첨부해 주세요.');
  }
  if (data.length >= 12 && data.toString('ascii', 4, 8) === 'ftyp') {
    return { mediaType: 'video/mp4', extension: '.mp4' };
  }
  if (data.length >= 4 && data.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))) {
    return { mediaType: 'video/webm', extension: '.webm' };
  }

  let metadata: import('sharp').Metadata;
  try {
    metadata = await sharp(data, { failOn: 'error', limitInputPixels: MAX_IMAGE_PIXELS }).metadata();
  } catch {
    throw new Error('PNG, JPEG, WebP, MP4, WebM 파일을 선택해 주세요.');
  }
  const formats: Record<string, { mediaType: string; extension: string }> = {
    png: { mediaType: 'image/png', extension: '.png' },
    jpeg: { mediaType: 'image/jpeg', extension: '.jpg' },
    webp: { mediaType: 'image/webp', extension: '.webp' },
  };
  const validated = metadata.format ? formats[metadata.format] : undefined;
  if (!validated || !metadata.width || !metadata.height) {
    throw new Error('PNG, JPEG, WebP, MP4, WebM 파일을 선택해 주세요.');
  }
  if (metadata.width * metadata.height > MAX_IMAGE_PIXELS) {
    throw new Error('2,000만 화소 이하의 이미지를 선택해 주세요.');
  }
  try {
    await sharp(data, { failOn: 'error', limitInputPixels: MAX_IMAGE_PIXELS }).stats();
  } catch {
    throw new Error('PNG, JPEG, WebP, MP4, WebM 파일을 선택해 주세요.');
  }
  return validated;
}

export async function saveAttachment(data: Buffer, extension: string, mediaRoot: string): Promise<string> {
  const key = randomUUID().replaceAll('-', '').toLowerCase();
  const relativeName = `${key.slice(0, 2)}/${key}${extension}`;
  const directory = resolve(mediaRoot, PRIVATE_MEDIA_DIRECTORY, key.slice(0, 2));
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const path = resolve(directory, `${key}${extension}`);
  try {
    await writeFile(path, data, { flag: 'wx', mode: 0o600 });
  } catch (error) {
    await unlink(path).catch(() => undefined);
    throw error;
  }
  return relativeName;
}

async function safeMediaFile(mediaRoot: string | undefined, attachment: string): Promise<MediaFile | null> {
  if (!mediaRoot || !attachment || attachment.includes('\\') || attachment.includes('\0')) return null;
  const root = resolve(mediaRoot, PRIVATE_MEDIA_DIRECTORY);
  const candidate = resolve(root, ...attachment.split('/'));
  const unresolved = relative(root, candidate);
  if (unresolved === '' || unresolved === '..' || unresolved.startsWith(`..${sep}`) || isAbsolute(unresolved))
    return null;
  try {
    const realRoot = await realpath(root);
    const path = await realpath(candidate);
    const pathRelativeToRoot = relative(realRoot, path);
    if (pathRelativeToRoot === '..' || pathRelativeToRoot.startsWith(`..${sep}`) || isAbsolute(pathRelativeToRoot))
      return null;
    const details = await stat(path);
    return details.isFile() ? { path, size: details.size } : null;
  } catch {
    return null;
  }
}

export async function removeAttachment(mediaRoot: string | undefined, attachment: string): Promise<void> {
  const file = await safeMediaFile(mediaRoot, attachment);
  if (file) await unlink(file.path).catch(() => undefined);
}

export async function mediaResponse(
  request: FastifyRequest,
  reply: FastifyReply,
  mediaRoot: string | undefined,
  entry: EntryRow,
) {
  const headReply = (statusCode: number, mediaType: string, responseHeaders: Record<string, string>) => {
    reply.hijack();
    reply.raw.writeHead(statusCode, { ...responseHeaders, 'Content-Type': mediaType });
    reply.raw.end();
    return reply;
  };
  const file = await safeMediaFile(mediaRoot, entry.attachment);
  if (!file) return notFound(reply);
  const rangeHeader = request.headers.range;
  const range = typeof rangeHeader === 'string' ? rangeHeader.match(/^bytes=(\d{0,18})-(\d{0,18})$/) : null;
  const headers = {
    'Accept-Ranges': 'bytes',
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'private, no-store',
  };

  if (range && (range[1] !== '' || range[2] !== '')) {
    const first = range[1];
    const last = range[2];
    const start = first ? Number(first) : Math.max(0, file.size - Number(last));
    const end = first && last ? Math.min(file.size - 1, Number(last)) : file.size - 1;
    if (start > end || start >= file.size || !Number.isSafeInteger(start) || !Number.isSafeInteger(end)) {
      return reply.code(416).headers(headers).header('Content-Range', `bytes */${file.size}`).send();
    }
    const length = end - start + 1;
    reply
      .code(206)
      .headers(headers)
      .type(entry.mediaType)
      .header('Content-Range', `bytes ${start}-${end}/${file.size}`)
      .header('Content-Length', String(length));
    if (request.method === 'HEAD') {
      return headReply(206, entry.mediaType, {
        ...headers,
        'Content-Range': `bytes ${start}-${end}/${file.size}`,
        'Content-Length': String(length),
      });
    }
    return reply.send(createReadStream(file.path, { start, end }));
  }

  reply.code(200).headers(headers).type(entry.mediaType).header('Content-Length', String(file.size));
  if (request.method === 'HEAD') {
    return headReply(200, entry.mediaType, { ...headers, 'Content-Length': String(file.size) });
  }
  return reply.send(createReadStream(file.path));
}
