import multipart, { type MultipartFile } from '@fastify/multipart';
import type { PrismaClient } from '@prisma/client';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { spawn } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { mkdir, mkdtemp, realpath, rename, rm, stat, unlink, writeFile } from 'node:fs/promises';
import { extname, isAbsolute, relative, resolve, sep } from 'node:path';
import sharp from 'sharp';
import { failure } from '../../platform/response.js';

export class ContentUploadError extends Error {
  constructor(readonly code: string, message: string, readonly status: number) { super(message); }
}

const supported = new Set(['jpg', 'jpeg', 'png', 'gif', 'mp4', 'webm']);
const configuredLimit = Number(process.env.DEVELOPER_API_MAX_UPLOAD_MB ?? 20);
export const contentUploadLimit = (Number.isSafeInteger(configuredLimit) && configuredLimit >= 1 ? configuredLimit : 20) * 1024 * 1024;
let uploading = 0;

export const contentUploadTooLargeMessage = `Image files must be ${contentUploadLimit / 1_048_576} MiB or smaller.`;

function limitError() {
  return new ContentUploadError('image.too_large', contentUploadTooLargeMessage, 400);
}

function failed() { return new ContentUploadError('image.upload_failed', 'Image upload failed.', 422); }

async function parseContentUpload(request: FastifyRequest): Promise<{ buffer: Buffer; filename: string }> {
  if (!request.isMultipart()) throw new ContentUploadError('image.missing', 'No image was provided.', 400);
  let selected: { buffer: Buffer; filename: string } | undefined;
  try {
    for await (const part of request.parts()) {
      if (part.type !== 'file') continue;
      const file = part as MultipartFile;
      if (file.fieldname === 'image' && !selected) {
        const buffer = await file.toBuffer();
        if (file.file.truncated || buffer.length > contentUploadLimit) throw limitError();
        selected = { buffer, filename: file.filename };
      } else {
        for await (const _chunk of file.file) { /* Drain discarded file parts. */ }
      }
    }
  } catch (error) {
    if (error instanceof ContentUploadError) throw error;
    if (error instanceof Error && 'code' in error && error.code === 'FST_REQ_FILE_TOO_LARGE') throw limitError();
    throw failed();
  }
  if (!selected) throw new ContentUploadError('image.missing', 'No image was provided.', 400);
  return selected;
}

function contentUploadUrl(path: string) {
  return `/resources/media/${path.split('/').map(encodeURIComponent).join('/')}`;
}

function contained(parent: string, child: string) {
  const path = relative(parent, child);
  return path !== '' && path !== '..' && !path.startsWith(`..${sep}`) && !isAbsolute(path);
}

async function pathExists(root: string, path: string) {
  if (!path || path.includes('\\') || path.split('/').some((part) => !part || part.startsWith('.'))) return false;
  try {
    const actual = await realpath(resolve(root, path));
    return contained(root, actual) && (await stat(actual)).isFile();
  } catch {
    return false;
  }
}

async function makeUploadDirectory(root: string, parts: string[]) {
  let parent = root;
  for (const part of parts) {
    const child = resolve(parent, part);
    await mkdir(child).catch((error: NodeJS.ErrnoException) => { if (error.code !== 'EEXIST') throw error; });
    const actual = await realpath(child);
    if (!contained(root, actual) || actual !== child || !(await stat(actual)).isDirectory()) throw failed();
    parent = actual;
  }
  return parent;
}

function ffmpeg(args: string[]) {
  return new Promise<void>((accept, reject) => {
    const child = spawn('ffmpeg', ['-nostdin', '-hide_banner', '-loglevel', 'error', '-max_alloc', '134217728',
      '-protocol_whitelist', 'file,pipe', '-threads', '1', '-filter_threads', '1', ...args],
    { stdio: 'ignore', signal: AbortSignal.timeout(30_000) });
    child.once('error', reject);
    child.once('close', (code) => code === 0 ? accept() : reject(failed()));
  });
}

async function prepFiles(input: Buffer, extension: string, working: string) {
  const video = extension === 'mp4' || extension === 'webm';
  const animated = extension === 'gif';
  const parser = sharp(input, { failOn: 'error', limitInputPixels: 30_000_000 });
  if (!video) {
    const { format } = await parser.metadata();
    if (format !== (extension === 'jpg' ? 'jpeg' : extension === 'jpeg' ? 'jpeg' : extension)) throw failed();
  }
  if (!video && !animated) {
    const outputFormat = extension === 'png' && input.length > 2 * 1024 * 1024 ? 'jpg' : extension;
    const output = resolve(working, `asset.${outputFormat}`);
    const base = parser.rotate().resize({ width: 1920, height: 1920, fit: 'inside', withoutEnlargement: true });
    const bound = await (outputFormat === 'png' ? base.png() : base.flatten({ background: '#ffffff' }).jpeg({ quality: 82 })).toBuffer();
    await writeFile(output, bound);
    await sharp(bound, { limitInputPixels: 4_000_000 }).resize({ width: 480, withoutEnlargement: true })
      .flatten({ background: '#ffffff' }).blur(8).jpeg({ quality: 50 }).toFile(resolve(working, 'preview.jpg'));
    return { output, extension: outputFormat };
  }

  if (extension === 'mp4' && input.subarray(4, 8).toString('ascii') !== 'ftyp') throw failed();
  if (extension === 'webm' && !input.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))) throw failed();
  const source = resolve(working, `original.${extension}`);
  await writeFile(source, input, { flag: 'wx' });
  const output = video ? source : resolve(working, 'asset.mp4');
  const demuxer = extension === 'mp4' ? 'mov' : 'matroska';
  if (animated) await ffmpeg(['-f', 'gif', '-i', source, '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-threads', '1', '-movflags', '+faststart', output]);
  const still = resolve(working, 'still.jpg');
  await ffmpeg(['-f', animated ? 'mov' : demuxer, '-i', output, '-frames:v', '1', '-vf', 'scale=480:-1', '-q:v', '8', still]);
  await sharp(still, { limitInputPixels: 4_000_000 }).blur(8).jpeg({ quality: 50 }).toFile(resolve(working, 'preview.jpg'));
  return { output, extension: animated ? 'mp4' : extension };
}

/** Stores a cover image the editor already received with its form. */
export function saveContentFile(
  db: PrismaClient, mediaRoot: string | undefined, userId: number, file: { buffer: Buffer; filename: string },
) {
  return storeContent(db, mediaRoot, userId, async () => file);
}

export function saveContentUpload(db: PrismaClient, mediaRoot: string | undefined, userId: number, request: FastifyRequest) {
  return storeContent(db, mediaRoot, userId, () => parseContentUpload(request));
}

async function storeContent(
  db: PrismaClient, mediaRoot: string | undefined, userId: number, readFile: () => Promise<{ buffer: Buffer; filename: string }>,
) {
  if (!mediaRoot) throw failed();
  if (uploading >= 2) throw new ContentUploadError('image.upload_busy', 'Image uploads are busy. Try again in a moment.', 429);
  uploading += 1;
  try {
    const file = await readFile();
    const root = await realpath(mediaRoot);
    const key = createHash('sha256').update(file.buffer).digest('base64');
    const [cached] = await db.$queryRaw<Array<{ path: string }>>`SELECT path FROM board_imagecache WHERE key = ${key}`;
    if (cached && await pathExists(root, cached.path)) return contentUploadUrl(cached.path);
    const extension = extname(file.filename).slice(1).toLowerCase();
    if (!supported.has(extension)) throw new ContentUploadError('image.invalid_extension', 'This file extension is not allowed.', 400);
    const now = new Date();
    const parts = ['images', 'content', String(now.getFullYear()), String(now.getMonth() + 1), String(now.getDate())];
    const directory = await makeUploadDirectory(root, parts);
    const working = await mkdtemp(resolve(directory, '.upload-'));
    const committed: string[] = [];
    try {
      const prepared = await prepFiles(file.buffer, extension, working);
      const name = `${now.getFullYear()}${now.getMonth() + 1}${now.getDate()}${now.getHours()}_${randomBytes(15).toString('hex')}.${prepared.extension}`;
      const final = resolve(directory, name);
      const path = [...parts, name].join('/');
      await rename(prepared.output, final);
      committed.push(final);
      await rename(resolve(working, 'preview.jpg'), `${final}.preview.jpg`);
      committed.push(`${final}.preview.jpg`);
      const chosen = await db.$transaction(async (tx) => {
        const [saved] = await tx.$queryRaw<Array<{ path: string }>>`
          INSERT INTO board_imagecache (key, path, size, user_id) VALUES (${key}, ${path}, ${file.buffer.length}, ${userId})
          ON CONFLICT(key) DO UPDATE SET path = excluded.path WHERE board_imagecache.path = ${cached?.path ?? ''}
          RETURNING path
        `;
        if (saved) return saved.path;
        const [existing] = await tx.$queryRaw<Array<{ path: string }>>`SELECT path FROM board_imagecache WHERE key = ${key}`;
        if (!existing) throw failed();
        return existing.path;
      });
      if (chosen === path) committed.length = 0;
      return contentUploadUrl(chosen);
    } finally {
      for (const file of committed) await unlink(file).catch(() => undefined);
      await rm(working, { recursive: true, force: true });
    }
  } catch (error) {
    if (error instanceof ContentUploadError) throw error;
    throw failed();
  } finally {
    uploading -= 1;
  }
}

export function registerContentMultipart(app: FastifyInstance) {
  return app.register(multipart, { limits: { files: 1, fileSize: contentUploadLimit, fields: 3, fieldSize: 256, parts: 5 } });
}

interface ContentMediaOptions {
  currentUser: (request: FastifyRequest) => Promise<{ id: number; hasEditorRole: boolean } | null>;
  validateCsrf: (request: FastifyRequest) => boolean;
  mediaRoot?: string;
}

export function registerContentMedia(app: FastifyInstance, db: PrismaClient, options: ContentMediaOptions) {
  app.register(async (routes) => {
    await registerContentMultipart(routes);
    routes.post('/v1/image', { bodyLimit: contentUploadLimit + 8192 }, async (request, reply) => {
      const user = await options.currentUser(request);
      if (!user) return reply.code(404).send('Not found');
      const error = failure;
      if (!user.hasEditorRole) return error('AT');
      if (!options.validateCsrf(request)) return reply.code(403).send(error('RJ'));
      try {
        const url = await saveContentUpload(db, options.mediaRoot, user.id, request);
        return { status: 'DONE', body: { url } };
      } catch (failure) {
        if (!(failure instanceof ContentUploadError)) throw failure;
        const code = failure.code === 'image.too_large' ? 'OF' : ['image.missing', 'image.invalid_extension'].includes(failure.code) ? 'VA' : 'RJ';
        return error(code, failure.message);
      }
    });
  });
}
