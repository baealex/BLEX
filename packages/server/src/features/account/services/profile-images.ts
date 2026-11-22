import type { PrismaClient } from '@prisma/client';
import sharp from 'sharp';
import { createHash, randomUUID } from 'node:crypto';
import { chmod, mkdir, open, realpath, rename, rm, unlink } from 'node:fs/promises';
import { relative, resolve, sep } from 'node:path';
import { type PersonalSettingsUser } from '../pages.js';
import { mediaUrl } from './profile.js';

export const MAX_PROFILE_IMAGE_BYTES = 10 * 1024 * 1024;

const MAX_PROFILE_IMAGE_PIXELS = 16_000_000;

export type ProfileImageKind = 'avatar' | 'cover';

interface EncodedProfileImage {
  buffer: Buffer;
  extension: 'jpg' | 'png' | 'webp' | 'gif';
}

function profileMediaPrefix(username: string): string {
  return createHash('md5').update(username).digest('hex').slice(0, 2);
}

function safeUsernamePathPart(username: string): boolean {
  return /^[a-z0-9]{4,15}$/.test(username);
}

function isWithinDirectory(parent: string, child: string): boolean {
  const pathFromParent = relative(parent, child);
  return pathFromParent !== '' && pathFromParent !== '..' && !pathFromParent.startsWith(`..${sep}`);
}

function safeLegacyProfileImagePath(
  value: string | null,
  username: string,
  kind?: ProfileImageKind,
): string | null {
  if (!value || !safeUsernamePathPart(username) || value.includes('\\') || value.startsWith('/')) return null;
  const match = value.match(/^images\/avatar\/([a-f0-9]{2})\/([a-z0-9]{4,15})\/([ac][A-Za-z0-9]{4,32}\.(?:jpg|png|webp|gif))$/i);
  if (!match || match[1].toLowerCase() !== profileMediaPrefix(username) || match[2] !== username) return null;
  if (kind === 'avatar' && !/^a/i.test(match[3])) return null;
  if (kind === 'cover' && !/^c/i.test(match[3])) return null;
  return value;
}

async function encodeProfileImage(input: Buffer, kind: ProfileImageKind): Promise<EncodedProfileImage | null> {
  if (!input.length || input.length > MAX_PROFILE_IMAGE_BYTES) return null;
  const animated = kind === 'cover';
  try {
    const metadata = await sharp(input, {
      animated,
      failOn: 'warning',
      limitInputPixels: MAX_PROFILE_IMAGE_PIXELS,
      pages: animated ? -1 : 1,
    }).metadata();
    const extensions: Record<string, EncodedProfileImage['extension']> = {
      jpeg: 'jpg', png: 'png', webp: 'webp', gif: 'gif',
    };
    const extension = extensions[metadata.format];
    const frameHeight = metadata.pageHeight ?? metadata.height ?? 0;
    const width = metadata.width ?? 0;
    const pages = Math.max(1, metadata.pages ?? 1);
    if (!extension || width < 1 || frameHeight < 1 || width * frameHeight > MAX_PROFILE_IMAGE_PIXELS) return null;
    if (animated && pages > 1 && width * frameHeight * pages > MAX_PROFILE_IMAGE_PIXELS) return null;

    let pipeline = sharp(input, {
      animated,
      failOn: 'warning',
      limitInputPixels: MAX_PROFILE_IMAGE_PIXELS,
      pages: animated ? -1 : 1,
    }).rotate();
    if (kind === 'avatar') pipeline = pipeline.resize(500, 500, { fit: 'inside', withoutEnlargement: true });
    let encoded: Buffer;
    if (metadata.format === 'jpeg') encoded = await pipeline.jpeg({ quality: 90 }).toBuffer();
    else if (metadata.format === 'png') encoded = await pipeline.png().toBuffer();
    else if (metadata.format === 'webp') encoded = await pipeline.webp({
      ...(animated && pages > 1 ? { loop: metadata.loop ?? 0, delay: metadata.delay } : {}),
    }).toBuffer();
    else encoded = await pipeline.gif({
      ...(animated && pages > 1 ? { loop: metadata.loop ?? 0, delay: metadata.delay } : {}),
    }).toBuffer();
    if (!encoded.length || encoded.length > MAX_PROFILE_IMAGE_BYTES * 2) return null;
    return { buffer: encoded, extension };
  } catch {
    return null;
  }
}

async function prepareMediaDirectory(mediaRoot: string, relativeDirectory: string): Promise<{ root: string; directory: string }> {
  const requestedRoot = resolve(mediaRoot);
  await mkdir(requestedRoot, { recursive: true, mode: 0o755 });
  const root = await realpath(requestedRoot);
  const requestedDirectory = resolve(root, ...relativeDirectory.split('/'));
  if (!isWithinDirectory(root, requestedDirectory)) throw new Error('invalid-profile-media-directory');
  await mkdir(requestedDirectory, { recursive: true, mode: 0o755 });
  const directory = await realpath(requestedDirectory);
  if (!isWithinDirectory(root, directory)) throw new Error('invalid-profile-media-directory');
  return { root, directory };
}

export async function saveProfileImage(
  db: PrismaClient,
  user: PersonalSettingsUser,
  kind: ProfileImageKind,
  input: Buffer,
  mediaRoot: string,
  siteUrl: URL,
): Promise<string | null> {
  if (!safeUsernamePathPart(user.username)) return null;
  const encoded = await encodeProfileImage(input, kind);
  if (!encoded) return null;
  const prefix = profileMediaPrefix(user.username);
  const relativeDirectory = `images/avatar/${prefix}/${user.username}`;
  const { root, directory } = await prepareMediaDirectory(mediaRoot, relativeDirectory);
  const filename = `${kind === 'avatar' ? 'a' : 'c'}${randomUUID().replace(/-/g, '')}.${encoded.extension}`;
  const relativePath = `${relativeDirectory}/${filename}`;
  if (!safeLegacyProfileImagePath(relativePath, user.username, kind)) throw new Error('invalid-profile-media-path');
  const target = resolve(directory, filename);
  if (!isWithinDirectory(root, target)) throw new Error('invalid-profile-media-target');
  const temporary = resolve(directory, `.${filename}.${randomUUID()}.tmp`);
  let committed = false;
  try {
    const handle = await open(temporary, 'wx', 0o600);
    try {
      await handle.writeFile(encoded.buffer);
      await handle.sync();
    } finally {
      await handle.close();
    }
    await rename(temporary, target);
    await chmod(target, 0o644);
    const updated = kind === 'avatar'
      ? await db.$executeRaw`UPDATE board_profile SET avatar = ${relativePath} WHERE user_id = ${user.id}`
      : await db.$executeRaw`UPDATE board_profile SET cover = ${relativePath} WHERE user_id = ${user.id}`;
    if (Number(updated) !== 1) throw new Error('profile-row-not-found');
    committed = true;
    return mediaUrl(siteUrl, relativePath);
  } finally {
    await rm(temporary, { force: true }).catch(() => undefined);
    if (!committed) await rm(target, { force: true }).catch(() => undefined);
  }
}

async function removeScopedProfileImage(mediaRoot: string, path: string | null, username: string): Promise<void> {
  const relativePath = safeLegacyProfileImagePath(path, username, 'cover');
  if (!relativePath) return;
  const requestedRoot = resolve(mediaRoot);
  let root: string;
  try {
    root = await realpath(requestedRoot);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
    throw error;
  }
  const target = resolve(root, ...relativePath.split('/'));
  if (!isWithinDirectory(root, target)) return;
  try {
    const realTarget = await realpath(target);
    if (!isWithinDirectory(root, realTarget)) return;
    await unlink(realTarget);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
}

export async function deleteProfileCover(db: PrismaClient, user: PersonalSettingsUser, mediaRoot: string): Promise<void> {
  const [profile] = await db.$queryRaw<Array<{ cover: string | null }>>`
    SELECT cover FROM board_profile WHERE user_id = ${user.id} LIMIT 1
  `;
  if (!profile) throw new Error('profile-row-not-found');
  await removeScopedProfileImage(mediaRoot, profile.cover, user.username);
  await db.$executeRaw`UPDATE board_profile SET cover = '' WHERE user_id = ${user.id}`;
}
