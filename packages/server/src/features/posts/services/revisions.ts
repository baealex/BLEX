import { type PrismaClient } from '@prisma/client';
import { sanitizePostHtml } from '../post-html.js';
import { readingTime } from './post-content.js';
import { EditorialSnapshot, PostValidationError, assertExpectedUpdatedAt, captureEditorialSnapshot, insertRevision, sameEditorialSnapshot } from './post-store.js';
import { DbDate, StoredPost, UserRow, dateAsIso, nowString, numberValue } from '../shared.js';

export interface StoredRevision {
  id: number;
  title: string;
  subtitle: string;
  content: string;
  contentExcerpt: string | null;
  description: string;
  tags: string;
  changeType: string;
  actor: string | null;
  restoredFromId: number | null;
  sourceUpdatedDate: DbDate;
  createdDate: DbDate;
}

function revisionTags(raw: string): string[] {
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) ? value.filter((tag): tag is string => typeof tag === 'string') : [];
  } catch {
    return [];
  }
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
  const rows = await db.$queryRaw<StoredRevision[]>`
    SELECT history.id AS id, history.title AS title, history.subtitle AS subtitle,
           history.content AS content, history.content_excerpt AS contentExcerpt,
           history.description AS description, history.tags AS tags,
           history.change_type AS changeType, actor.username AS actor,
           history.restored_from_id AS restoredFromId,
           CAST(history.source_updated_date AS TEXT) AS sourceUpdatedDate,
           CAST(history.created_date AS TEXT) AS createdDate
      FROM board_edithistory AS history
      LEFT JOIN auth_user AS actor ON actor.id = history.actor_id
     WHERE history.post_id = ${postId} AND history.id = ${revisionId}
       AND history.change_type <> 'draft'
     LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function deleteRevision(db: PrismaClient, postId: number, revisionId: number): Promise<boolean> {
  return db.$transaction(async (tx) => {
    const [target] = await tx.$queryRaw<unknown[]>`
      SELECT 1 FROM board_edithistory WHERE post_id = ${postId} AND id = ${revisionId} AND change_type <> 'draft'
    `;
    if (!target) return false;
    await tx.$executeRaw`UPDATE board_edithistory SET restored_from_id = NULL WHERE restored_from_id = ${revisionId}`;
    await tx.$executeRaw`DELETE FROM board_edithistory WHERE id = ${revisionId}`;
    return true;
  });
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
  const now = nowString();
  const restoredDate = await db.$transaction(async (tx) => {
    const current = await captureEditorialSnapshot(tx, post.id);
    if (sameEditorialSnapshot(current, target)) return current.updatedDate;
    await insertRevision(tx, post.id, current, author.id, 'restore', current.updatedDate, revision.id);
    const changed = await tx.$executeRaw`
      UPDATE board_post
         SET title = ${target.title}, subtitle = ${target.subtitle}, meta_description = ${target.description},
             read_time = ${readingTime(target.content)}, updated_date = ${now}
       WHERE id = ${post.id} AND author_id = ${author.id} AND deleted_date IS NULL
         AND updated_date = ${post.updatedDate}
    `;
    if (numberValue(changed) === 0) throw new PostValidationError('CF', 'Another request changed this post. Refresh and try again.');
    const contentRows = await tx.$queryRaw<Array<{ id: number }>>`
      SELECT id FROM board_postcontent WHERE post_id = ${post.id} LIMIT 1
    `;
    if (contentRows[0]) {
      await tx.$executeRaw`UPDATE board_postcontent SET content_html = ${target.content} WHERE post_id = ${post.id}`;
    } else {
      await tx.$executeRaw`INSERT INTO board_postcontent (post_id, content_html) VALUES (${post.id}, ${target.content})`;
    }
    await tx.$executeRaw`DELETE FROM board_post_tags WHERE post_id = ${post.id}`;
    for (const value of target.tags) {
      await tx.$executeRaw`INSERT INTO board_tag (value) VALUES (${value}) ON CONFLICT(value) DO NOTHING`;
      const tags = await tx.$queryRaw<Array<{ id: number }>>`SELECT id FROM board_tag WHERE value = ${value} LIMIT 1`;
      if (tags[0]) await tx.$executeRaw`
        INSERT INTO board_post_tags (post_id, tag_id) VALUES (${post.id}, ${tags[0].id})
        ON CONFLICT(post_id, tag_id) DO NOTHING
      `;
    }
    return now;
  });
  return { updatedDate: dateAsIso(restoredDate) ?? now.replace(' ', 'T') + 'Z', restored: restoredDate === now };
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
  const histories = await db.$queryRaw<Array<{
    title: string; content: string; changeType: string; sourceUpdatedDate: DbDate; createdDate: DbDate;
  }>>`
    SELECT title, content, change_type AS changeType,
           CAST(source_updated_date AS TEXT) AS sourceUpdatedDate,
           CAST(created_date AS TEXT) AS createdDate
      FROM board_edithistory WHERE post_id = ${post.id}
     ORDER BY created_date DESC, id DESC
  `;
  const newestFirst: Array<Omit<TimelapseFrame, 'savedAt'> & { savedDate: string }> = [{
    title: post.title,
    contentHtml: post.contentHtml,
    savedDate: dateAsIso(post.updatedDate) ?? nowString().replace(' ', 'T') + 'Z',
    stage: post.publishedDate ? 'published' : 'draft',
  }];
  for (const history of histories) {
    const later = newestFirst.at(-1)!;
    newestFirst.push({
      title: history.title === '_NO_CHANGED_' ? later.title : history.title,
      contentHtml: history.content === '_NO_CHANGED_' ? later.contentHtml : history.content,
      savedDate: dateAsIso(history.sourceUpdatedDate ?? history.createdDate) ?? '',
      stage: history.changeType === 'draft' ? 'draft' : 'published',
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
