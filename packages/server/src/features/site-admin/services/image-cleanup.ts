import { Prisma, type PrismaClient } from '@prisma/client';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { lstat, readdir, realpath, rmdir, unlink } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { mediaRootRealPath } from './brand-assets.js';
import { UtilityParameters } from './utilities.js';

type ImageCleanupTarget = 'all' | 'content' | 'title' | 'avatar';

interface ImageCleanupFile {
  category: 'content' | 'title' | 'avatar';
  path: string;
  relativePath: string;
  filename: string;
  size: number;
  sizeKb: number;
  mtimeMs: number;
  inode: number;
  contentHash: string;
  isUsed: boolean;
}

interface ImageCleanupPlan {
  target: ImageCleanupTarget;
  removeDuplicates: boolean;
  unusedFiles: ImageCleanupFile[];
  duplicateFiles: Array<{ duplicate: ImageCleanupFile; original: ImageCleanupFile }>;
  cacheRows: Array<{ id: number; path: string }>;
  previewHash: string;
  totalSize: number;
  duplicateSize: number;
}

function cleanLegacyImageName(filename: string): string {
  let cleaned = filename;
  if (cleaned.includes('.preview')) cleaned = cleaned.split('.preview')[0] ?? cleaned;
  if (cleaned.includes('.minify')) cleaned = cleaned.split('.minify')[0] ?? cleaned;
  return cleaned;
}

function filenameFromStoredPath(value: string): string {
  const part = value.replaceAll('\\', '/').split('/').at(-1) ?? '';
  try {
    return decodeURIComponent(part);
  } catch {
    return part;
  }
}

function relativeImagePathFromStoredPath(value: string): string {
  let path = value.replaceAll('\\', '/').trim();
  path = path.replace(/^https?:\/\/[^/]+/i, '');
  path = path.replace(/^\/?resources\/media\//i, '');
  return path.replace(/^\/+/, '').split(/[?#]/, 1)[0] ?? '';
}

function collectImageReferences(values: Array<string | null>, category: ImageCleanupFile['category']): Set<string> {
  const used = new Set<string>();
  const expression = new RegExp(`(?:https?:\\/\\/[^/\\s"'<>]+)?\\/?(?:resources\\/media\\/)?images\\/${category}\\/([^?#\\s"'<>)]*)`, 'gi');
  for (const value of values) {
    if (!value) continue;
    for (const match of value.matchAll(expression)) {
      const path = match[1] ?? '';
      const filename = filenameFromStoredPath(path);
      if (filename) used.add(cleanLegacyImageName(filename));
    }
  }
  return used;
}

async function readImageReferences(db: PrismaClient | Prisma.TransactionClient): Promise<Record<ImageCleanupFile['category'], Set<string>>> {
  const [posts, content, history, comments, profiles, series, pages, forms, notices, banners, workLogEntries] = await Promise.all([
    db.post.findMany({ select: { image: true } }),
    db.postContent.findMany({ select: { html: true } }),
    db.postRevision.findMany({ select: { content: true } }),
    db.comment.findMany({ select: { markdown: true, html: true } }),
    db.$queryRaw<Array<{ aboutMd: string | null; aboutHtml: string | null }>>`SELECT about_md AS aboutMd, about_html AS aboutHtml FROM board_profile`,
    db.series.findMany({ select: { descriptionMarkdown: true, descriptionHtml: true } }),
    db.staticPage.findMany({ select: { content: true } }),
    db.formTemplate.findMany({ select: { content: true } }),
    db.siteNotice.findMany({ select: { url: true } }),
    db.siteBanner.findMany({ select: { contentHtml: true } }),
    db.workLogEntry.findMany({ select: { text: true } }),
  ]);
  const values = [
    ...posts.map((row) => row.image),
    ...content.map((row) => row.html),
    ...history.map((row) => row.content),
    ...comments.flatMap((row) => [row.markdown, row.html]),
    ...profiles.flatMap((row) => [row.aboutMd, row.aboutHtml]),
    ...series.flatMap((row) => [row.descriptionMarkdown, row.descriptionHtml]),
    ...pages.map((row) => row.content),
    ...forms.map((row) => row.content),
    ...notices.map((row) => row.url),
    ...banners.map((row) => row.contentHtml),
    ...workLogEntries.map((row) => row.text),
  ];
  return {
    content: collectImageReferences(values, 'content'),
    title: collectImageReferences(values, 'title'),
    avatar: collectImageReferences(values, 'avatar'),
  };
}

async function streamFileHash(path: string): Promise<string> {
  const digest = createHash('sha256');
  for await (const chunk of createReadStream(path)) digest.update(chunk as Buffer);
  return digest.digest('hex');
}

async function safeImageCategoryDirectory(root: string, category: string): Promise<string | null> {
  const base = resolve(root, 'images');
  const directory = resolve(base, category);
  const relativePath = relative(root, directory);
  if (relativePath === '..' || relativePath.startsWith(`..${sep}`) || isAbsolute(relativePath)) return null;
  try {
    const baseInfo = await lstat(base);
    const directoryInfo = await lstat(directory);
    if (!baseInfo.isDirectory() || baseInfo.isSymbolicLink() || !directoryInfo.isDirectory() || directoryInfo.isSymbolicLink()) return null;
    return directory;
  } catch (error) {
    if (error instanceof Error && 'code' in error && ['ENOENT', 'ENOTDIR'].includes(String(error.code))) return null;
    throw error;
  }
}

async function scanImageCategory(
  root: string,
  category: ImageCleanupFile['category'],
  usedNames: Set<string>,
): Promise<ImageCleanupFile[]> {
  const baseDirectory = await safeImageCategoryDirectory(root, category);
  if (!baseDirectory) return [];
  const found: ImageCleanupFile[] = [];
  const queue = [baseDirectory];
  while (queue.length) {
    const current = queue.pop();
    if (!current) continue;
    const entries = await readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.name || entry.name === '.' || entry.name === '..' || entry.isSymbolicLink()) continue;
      const absolutePath = resolve(current, entry.name);
      if (entry.isDirectory()) {
        queue.push(absolutePath);
        continue;
      }
      if (!entry.isFile()) continue;
      try {
        const info = await lstat(absolutePath);
        const real = await realpath(absolutePath);
        const fromRoot = relative(root, real);
        if (!info.isFile() || info.isSymbolicLink() || fromRoot === '..' || fromRoot.startsWith(`..${sep}`) || isAbsolute(fromRoot)) continue;
        const contentHash = await streamFileHash(real);
        const relativePath = fromRoot.split(sep).join('/');
        const filename = entry.name;
        found.push({
          category,
          path: real,
          relativePath,
          filename,
          size: info.size,
          sizeKb: Math.round(info.size / 1024 * 100) / 100,
          mtimeMs: info.mtimeMs,
          inode: Number(info.ino),
          contentHash,
          isUsed: usedNames.has(cleanLegacyImageName(filename)),
        });
      } catch (error) {
        if (error instanceof Error && 'code' in error && ['ENOENT', 'ELOOP', 'ENOTDIR'].includes(String(error.code))) continue;
        throw error;
      }
    }
  }
  return found.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
}

function imageMediaUrl(relativePath: string): string {
  return `/resources/media/${relativePath.split('/').map(encodeURIComponent).join('/')}`;
}

export async function buildImageCleanupPlan(
  db: PrismaClient | Prisma.TransactionClient,
  mediaRoot: string | undefined,
  parameters: UtilityParameters,
): Promise<ImageCleanupPlan> {
  if (!mediaRoot) throw new Error('Image cleanup storage is unavailable.');
  const targetValue = parameters.target;
  const target: ImageCleanupTarget = targetValue === 'content' || targetValue === 'title' || targetValue === 'avatar' ? targetValue : 'all';
  const removeDuplicates = parameters.removeDuplicates === true;
  const root = await mediaRootRealPath(mediaRoot);
  const imageReferences = await readImageReferences(db);
  const [posts, profiles, cacheRows] = await Promise.all([
    db.post.findMany({ select: { image: true } }),
    db.$queryRaw<Array<{ avatar: string | null; cover: string | null }>>`SELECT avatar, cover FROM board_profile`,
    target === 'all' || target === 'content'
      ? db.uploadedImage.findMany({
          where: { path: { startsWith: 'images/content/' } },
          orderBy: { id: 'asc' },
          select: { id: true, path: true },
        })
      : Promise.resolve([] as Array<{ id: number; path: string }>),
  ]);
  const usedTitle = new Set([
    ...imageReferences.title,
    ...posts.map((row) => filenameFromStoredPath(row.image ?? '')).filter(Boolean),
  ]);
  const usedAvatar = new Set([
    ...imageReferences.avatar,
    ...profiles.flatMap((row) => [row.avatar, row.cover])
    .filter((path): path is string => Boolean(path))
    .map(filenameFromStoredPath),
  ]);
  const categories: ImageCleanupFile['category'][] = target === 'all'
    ? ['content', 'title', 'avatar']
    : [target];
  const allFiles = (await Promise.all(categories.map((category) => scanImageCategory(
    root,
    category,
    category === 'content' ? imageReferences.content : category === 'title' ? usedTitle : usedAvatar,
  )))).flat();
  const unusedFiles = allFiles.filter((file) => !file.isUsed);
  const duplicateFiles: ImageCleanupPlan['duplicateFiles'] = [];
  if (removeDuplicates && (target === 'all' || target === 'title')) {
    const seen = new Map<string, ImageCleanupFile>();
    for (const file of unusedFiles.filter((candidate) => candidate.category === 'title')) {
      const original = seen.get(file.contentHash);
      if (original) duplicateFiles.push({ duplicate: file, original });
      else seen.set(file.contentHash, file);
    }
  }
  const referencedContentNames = imageReferences.content;
  const unusedCacheRows = cacheRows.filter((row) => !referencedContentNames.has(cleanLegacyImageName(filenameFromStoredPath(row.path))));
  const planDigest = createHash('sha256');
  for (const file of unusedFiles) planDigest.update(`${file.relativePath}\0${file.size}\0${file.mtimeMs}\0${file.inode}\0${file.contentHash}\n`);
  for (const row of unusedCacheRows) planDigest.update(`cache\0${row.id}\0${row.path}\n`);
  const totalSize = unusedFiles.reduce((total, file) => total + file.size, 0);
  const duplicateSize = duplicateFiles.reduce((total, entry) => total + entry.duplicate.size, 0);
  return {
    target,
    removeDuplicates,
    unusedFiles,
    duplicateFiles,
    cacheRows: unusedCacheRows,
    previewHash: planDigest.digest('hex'),
    totalSize,
    duplicateSize,
  };
}

export function imageCleanupPlanApi(plan: ImageCleanupPlan, dryRun: boolean): Record<string, unknown> {
  const messages: string[] = [];
  if (plan.cacheRows.length) messages.push(`이미지 캐시 ${plan.cacheRows.length}개가 삭제 대상입니다.`);
  if (plan.duplicateFiles.length) {
    messages.push(dryRun
      ? `중복 타이틀 이미지 ${plan.duplicateFiles.length}개(${Math.round(plan.duplicateSize / 1024 / 1024 * 100) / 100}MB)가 삭제 대상입니다.`
      : `중복 타이틀 이미지 ${plan.duplicateFiles.length}개(${Math.round(plan.duplicateSize / 1024 / 1024 * 100) / 100}MB)를 삭제했습니다.`);
  }
  return {
    target: plan.target,
    removeDuplicates: plan.removeDuplicates,
    totalUnused: plan.unusedFiles.length,
    totalSizeMb: Math.round(plan.totalSize / 1024 / 1024 * 100) / 100,
    totalDuplicates: plan.duplicateFiles.length,
    totalDuplicateSizeMb: Math.round(plan.duplicateSize / 1024 / 1024 * 100) / 100,
    totalSavedMb: Math.round((plan.totalSize + plan.duplicateSize) / 1024 / 1024 * 100) / 100,
    messages,
    hasErrors: false,
    dryRun,
    ...(dryRun ? {
      previewHash: plan.previewHash,
      unusedFiles: plan.unusedFiles.slice(0, 100).map((file) => ({
        path: file.relativePath.split('/').slice(2).join('/'),
        url: imageMediaUrl(file.relativePath),
        sizeKb: file.sizeKb,
      })),
      ...(plan.duplicateFiles.length ? { duplicateFiles: plan.duplicateFiles.slice(0, 100).map(({ duplicate, original }) => ({
        duplicateUrl: imageMediaUrl(duplicate.relativePath),
        duplicateSizeKb: duplicate.sizeKb,
        originalUrl: imageMediaUrl(original.relativePath),
        originalSizeKb: original.sizeKb,
        hash: duplicate.contentHash.slice(0, 8),
      })) } : {}),
    } : {}),
  };
}

async function verifyImageCandidate(root: string, file: ImageCleanupFile): Promise<boolean> {
  const parts = file.relativePath.split('/');
  if (parts.length < 3 || parts[0] !== 'images' || parts[1] !== file.category || parts.some((part) => !part || part === '.' || part === '..')) return false;
  let current = root;
  try {
    for (const part of parts.slice(0, -1)) {
      current = resolve(current, part);
      const info = await lstat(current);
      if (!info.isDirectory() || info.isSymbolicLink()) return false;
    }
    const path = resolve(current, parts.at(-1) ?? '');
    const info = await lstat(path);
    const real = await realpath(path);
    const fromRoot = relative(root, real);
    if (!info.isFile() || info.isSymbolicLink() || fromRoot !== file.relativePath.split('/').join(sep)) return false;
    if (info.size !== file.size || info.mtimeMs !== file.mtimeMs || Number(info.ino) !== file.inode) return false;
    return await streamFileHash(real) === file.contentHash;
  } catch {
    return false;
  }
}

async function removeEmptyDirectories(directory: string): Promise<number> {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch {
    return 0;
  }
  let removed = 0;
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const child = resolve(directory, entry.name);
    removed += await removeEmptyDirectories(child);
    try {
      await rmdir(child);
      removed += 1;
    } catch { /* It still holds files. */ }
  }
  return removed;
}

export async function executeImageCleanupPlan(
  db: Prisma.TransactionClient,
  mediaRoot: string,
  plan: ImageCleanupPlan,
): Promise<Record<string, unknown>> {
  const root = await mediaRootRealPath(mediaRoot);
  const messages: string[] = [];
  const errors: string[] = [];
  let deletedFiles = 0;
  const deletedByCategory: Record<ImageCleanupFile['category'], number> = { content: 0, title: 0, avatar: 0 };
  const deletedRelativePaths = new Set<string>();
  for (const file of plan.unusedFiles) {
    if (!(await verifyImageCandidate(root, file))) {
      errors.push(`Skipped a changed file: ${file.relativePath}`);
      continue;
    }
    try {
      await unlink(file.path);
      deletedFiles += 1;
      deletedByCategory[file.category] += 1;
      deletedRelativePaths.add(file.relativePath);
    } catch {
      errors.push(`Could not delete: ${file.relativePath}`);
    }
  }
  let deletedCaches = 0;
  for (const cache of plan.cacheRows) {
    if (!deletedRelativePaths.has(relativeImagePathFromStoredPath(cache.path))) continue;
    deletedCaches += (await db.uploadedImage.deleteMany({ where: { id: cache.id, path: cache.path } })).count;
  }
  const categories: ImageCleanupFile['category'][] = plan.target === 'all' ? ['content', 'title', 'avatar'] : [plan.target as ImageCleanupFile['category']];
  const categoryLabels = { content: '콘텐츠 이미지', title: '타이틀 이미지', avatar: '아바타 이미지' };
  for (const category of categories) {
    messages.push(`${categoryLabels[category]} ${deletedByCategory[category]}개를 삭제했습니다.`);
    if (category === 'title' && plan.duplicateFiles.length) {
      messages.push(`중복 타이틀 이미지 ${plan.duplicateFiles.length}개(${Math.round(plan.duplicateSize / 1024 / 1024 * 100) / 100}MB)를 삭제했습니다.`);
    }
  }
  if (deletedCaches) messages.push(`이미지 캐시 ${deletedCaches}개를 삭제했습니다.`);
  let emptyDirectories = 0;
  for (const category of categories) {
    const directory = await safeImageCategoryDirectory(root, category);
    if (directory) emptyDirectories += await removeEmptyDirectories(directory);
  }
  if (emptyDirectories) messages.push(`빈 디렉터리 ${emptyDirectories}개를 삭제했습니다.`);
  if (errors.length) messages.push(...errors.slice(0, 20));
  return {
    ...imageCleanupPlanApi(plan, false),
    cleanedCount: deletedFiles,
    imageCacheCount: deletedCaches,
    messages,
    hasErrors: errors.length > 0,
  };
}
