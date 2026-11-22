import type { Prisma, PrismaClient } from '@prisma/client';
import { sanitizePostHtml } from '../post-html.js';
import { readingTime } from './post-content.js';
import { EditorialSnapshot, PostValidationError, assertExpectedUpdatedAt, captureEditorialSnapshot, insertRevision, sameEditorialSnapshot, setPostTags } from './post-store.js';
import { StoredPost, UserRow, dateAsIso } from '../shared.js';

export interface StoredRevision {
  id: number;
  title: string;
  subtitle: string;
  content: string;
  contentExcerpt: string | null;
  description: string;
  tags: Prisma.JsonValue;
  changeType: string;
  actor: string | null;
  restoredFromId: number | null;
  sourceUpdatedDate: Date | null;
  createdDate: Date;
}

const revisionSelect = {
  id: true, title: true, subtitle: true, content: true, contentExcerpt: true, description: true, tags: true,
  type: true, restoredFromId: true, sourceUpdatedAt: true, createdAt: true,
  actor: { select: { username: true } },
} satisfies Prisma.PostRevisionSelect;

function storedRevision(row: Prisma.PostRevisionGetPayload<{ select: typeof revisionSelect }>): StoredRevision {
  return {
    id: row.id, title: row.title, subtitle: row.subtitle, content: row.content, contentExcerpt: row.contentExcerpt,
    description: row.description, tags: row.tags, changeType: row.type, actor: row.actor?.username ?? null,
    restoredFromId: row.restoredFromId, sourceUpdatedDate: row.sourceUpdatedAt, createdDate: row.createdAt,
  };
}

/** Draft autosaves stay out of the history screens and are only used by the timelapse. */
const visibleRevision = (postId: number) => ({ postId, type: { not: 'draft' } }) satisfies Prisma.PostRevisionWhereInput;

export async function listRevisions(db: PrismaClient, postId: number, page: number, limit: number) {
  const totalCount = await db.postRevision.count({ where: visibleRevision(postId) });
  const lastPage = Math.max(1, Math.ceil(totalCount / limit));
  if (page > lastPage) return { totalCount, lastPage, revisions: null };
  const rows = await db.postRevision.findMany({
    where: visibleRevision(postId),
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    skip: (page - 1) * limit,
    take: limit,
    select: revisionSelect,
  });
  return { totalCount, lastPage, revisions: rows.map(storedRevision) };
}

function revisionTags(value: Prisma.JsonValue): string[] {
  return Array.isArray(value) ? value.filter((tag): tag is string => typeof tag === 'string') : [];
}

export function revisionSummary(revision: StoredRevision): Record<string, unknown> {
  return {
    id: revision.id,
    title: revision.title,
    subtitle: revision.subtitle,
    contentExcerpt: revision.contentExcerpt ?? '',
    tags: revisionTags(revision.tags),
    changeType: revision.changeType,
    canRestore: revision.changeType !== 'legacy',
    actor: revision.actor,
    restoredFromId: revision.restoredFromId,
    sourceUpdatedDate: dateAsIso(revision.sourceUpdatedDate),
    createdDate: dateAsIso(revision.createdDate),
  };
}

export async function loadRevision(
  db: PrismaClient,
  postId: number,
  revisionId: number,
): Promise<StoredRevision | null> {
  const row = await db.postRevision.findFirst({ where: { ...visibleRevision(postId), id: revisionId }, select: revisionSelect });
  return row ? storedRevision(row) : null;
}

export async function deleteRevision(db: PrismaClient, postId: number, revisionId: number): Promise<boolean> {
  const { count } = await db.postRevision.deleteMany({ where: { ...visibleRevision(postId), id: revisionId } });
  return count === 1;
}

export async function restoreRevision(
  db: PrismaClient,
  author: UserRow,
  post: StoredPost,
  revision: StoredRevision,
  expectedUpdatedAt: string,
): Promise<{ updatedDate: string; restored: boolean }> {
  if (revision.changeType === 'legacy') throw new PostValidationError('RJ', 'Legacy revisions cannot be restored safely.');
  assertExpectedUpdatedAt(post.updatedDate, expectedUpdatedAt);
  const target: EditorialSnapshot = {
    title: revision.title,
    subtitle: revision.subtitle,
    content: sanitizePostHtml(revision.content),
    description: revision.description,
    tags: revisionTags(revision.tags).sort(),
    updatedDate: null,
    publishedDate: null,
  };
  const now = new Date();
  const restoredDate = await db.$transaction(async (tx) => {
    const current = await captureEditorialSnapshot(tx, post.id);
    if (sameEditorialSnapshot(current, target)) return current.updatedDate;
    await insertRevision(tx, post.id, current, author.id, 'restore', current.updatedDate, revision.id);
    const { count } = await tx.post.updateMany({
      where: { id: post.id, authorId: author.id, deletedAt: null, updatedAt: post.updatedDate },
      data: {
        title: target.title, subtitle: target.subtitle, description: target.description,
        readTime: readingTime(target.content), updatedAt: now,
      },
    });
    if (count === 0) throw new PostValidationError('CF', 'Another request changed this post. Refresh and try again.');
    await tx.postContent.upsert({
      where: { postId: post.id },
      create: { postId: post.id, html: target.content },
      update: { html: target.content },
    });
    await setPostTags(tx, post.id, target.tags);
    return now;
  });
  return { updatedDate: dateAsIso(restoredDate) ?? now.toISOString(), restored: restoredDate === now };
}

interface TimelapseFrame {
  title: string;
  contentHtml: string;
  savedAt: string;
  stage: 'draft' | 'published';
}

export interface TimelapseResult {
  frames: TimelapseFrame[];
  totalCount: number;
  publishedAt: string | null;
}

export async function buildTimelapse(db: PrismaClient, post: StoredPost): Promise<TimelapseResult> {
  const histories = await db.postRevision.findMany({
    where: { postId: post.id },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    select: { title: true, content: true, type: true, sourceUpdatedAt: true, createdAt: true },
  });
  const newestFirst: Array<Omit<TimelapseFrame, 'savedAt'> & { savedDate: string }> = [{
    title: post.title,
    contentHtml: post.contentHtml,
    savedDate: dateAsIso(post.updatedDate) ?? new Date().toISOString(),
    stage: post.publishedDate ? 'published' : 'draft',
  }];
  for (const history of histories) {
    const later = newestFirst.at(-1)!;
    newestFirst.push({
      title: history.title === '_NO_CHANGED_' ? later.title : history.title,
      contentHtml: history.content === '_NO_CHANGED_' ? later.contentHtml : history.content,
      savedDate: dateAsIso(history.sourceUpdatedAt ?? history.createdAt) ?? '',
      stage: history.type === 'draft' ? 'draft' : 'published',
    });
  }
  const chronological = newestFirst.reverse();
  const collapsed: typeof chronological = [];
  for (const frame of chronological) {
    const previous = collapsed.at(-1);
    if (previous && previous.title === frame.title && previous.contentHtml === frame.contentHtml) continue;
    collapsed.push(frame);
  }
  const frames = collapsed.length <= 80
    ? collapsed
    : [...new Set(Array.from({ length: 80 }, (_value, index) => Math.round(index * (collapsed.length - 1) / 79)))].map((index) => collapsed[index]!);
  return {
    frames: frames.map((frame) => ({
      title: frame.title,
      contentHtml: sanitizePostHtml(frame.contentHtml),
      savedAt: frame.savedDate,
      stage: frame.stage,
    })),
    totalCount: collapsed.length,
    publishedAt: dateAsIso(post.publishedDate),
  };
}
