import { Prisma, type PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { type WorkLogShareView } from '../pages.js';
import { EntryRow } from './logs.js';
import { PAGE_SIZE, arrayValue, djangoTimestamp } from '../shared.js';

interface ShareRow extends WorkLogShareView {
  logId: number;
  ownerId: number;
  ownerUsername: string;
  logTitle: string;
  logCreatedAt: string;
}

export async function readShare(db: PrismaClient, token: string): Promise<ShareRow | null> {
  const [row] = await db.$queryRaw<ShareRow[]>`
    SELECT share.id, share.token, share.headline,
           CAST(share.created_at AS TEXT) AS createdAt,
           share.log_id AS logId, log.owner_id AS ownerId,
           owner.username AS ownerUsername,
           log.title AS logTitle, CAST(log.created_at AS TEXT) AS logCreatedAt
      FROM board_worklogshare AS share
      JOIN board_worklog AS log ON log.id = share.log_id
      JOIN auth_user AS owner ON owner.id = log.owner_id
     WHERE share.token = ${token} AND owner.is_active = 1
     LIMIT 1
  `;
  return row ? { ...row, token: publicShareToken(row.token) } : null;
}

export async function readShares(db: PrismaClient, logId: number, page: number): Promise<WorkLogShareView[]> {
  const rows = await db.$queryRaw<WorkLogShareView[]>`
    SELECT share.id, share.token, share.headline, CAST(share.created_at AS TEXT) AS createdAt
      FROM board_worklogshare AS share
     WHERE share.log_id = ${logId}
     ORDER BY share.created_at DESC, share.id DESC
     LIMIT ${PAGE_SIZE} OFFSET ${(page - 1) * PAGE_SIZE}
  `;
  return rows.map((row) => ({ ...row, token: publicShareToken(row.token) }));
}

export async function readSnapshotEntries(db: PrismaClient, shareId: number, page: number): Promise<EntryRow[]> {
  return db.$queryRaw<EntryRow[]>`
    SELECT entry.id, entry.log_id AS logId, entry.title, entry.text,
           entry.media_type AS mediaType, entry.attachment,
           CAST(entry.created_at AS TEXT) AS createdAt
      FROM board_worklogshare_entries AS selection
      JOIN board_worklogentry AS entry ON entry.id = selection.worklogentry_id
     WHERE selection.worklogshare_id = ${shareId}
     ORDER BY entry.created_at ASC, entry.id ASC
     LIMIT ${PAGE_SIZE} OFFSET ${(page - 1) * PAGE_SIZE}
  `;
}

export async function entryCountForShare(db: PrismaClient, shareId: number): Promise<number> {
  const [row] = await db.$queryRaw<Array<{ total: number | bigint }>>`
    SELECT COUNT(*) AS total FROM board_worklogshare_entries WHERE worklogshare_id = ${shareId}
  `;
  return Number(row?.total ?? 0);
}

export async function pageEntryForShareMedia(
  db: PrismaClient,
  shareId: number,
  logId: number,
  entryId: number,
): Promise<EntryRow | null> {
  const [row] = await db.$queryRaw<EntryRow[]>`
    SELECT entry.id, entry.log_id AS logId, entry.title, entry.text,
           entry.media_type AS mediaType, entry.attachment,
           CAST(entry.created_at AS TEXT) AS createdAt
      FROM board_worklogshare_entries AS selection
      JOIN board_worklogentry AS entry ON entry.id = selection.worklogentry_id
     WHERE selection.worklogshare_id = ${shareId}
       AND entry.log_id = ${logId} AND entry.id = ${entryId}
       AND entry.attachment <> ''
     LIMIT 1
  `;
  return row ?? null;
}

export function selectedEntryIds(fields: Record<string, unknown>, allowEmpty = false): { ids: number[]; error?: string } {
  const values = [
    ...arrayValue(fields.selected_entries).flatMap((value) => value.split(',')),
    ...arrayValue(fields.entries),
  ];
  if (values.length > 997) return { ids: [], error: '링크 하나에 기록을 최대 997개까지 담을 수 있어요.' };
  if (values.some((value) => !/^\d{1,18}$/.test(value))) {
    return { ids: [], error: '이 작업 일지의 기록을 선택해 주세요.' };
  }
  const ids = [...new Set(values.map(Number))];
  if (ids.some((id) => !Number.isSafeInteger(id) || id <= 0)) {
    return { ids: [], error: '이 작업 일지의 기록을 선택해 주세요.' };
  }
  if (ids.length === 0 && !allowEmpty) return { ids, error: '공유할 기록을 하나 이상 선택해 주세요.' };
  return { ids };
}

/** Django stores UUIDs as 32 hex characters in SQLite and publishes them with hyphens. */
export function storedShareToken(value: string): string | null {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value)) return null;
  return value.replaceAll('-', '').toLowerCase();
}

function publicShareToken(stored: string): string {
  return stored.replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, '$1-$2-$3-$4-$5');
}

export async function selectedEntries(db: PrismaClient, logId: number, ids: number[]): Promise<EntryRow[]> {
  if (ids.length === 0) return [];
  return db.$queryRaw<EntryRow[]>`
    SELECT entry.id, entry.log_id AS logId, entry.title, entry.text,
           entry.media_type AS mediaType, entry.attachment,
           CAST(entry.created_at AS TEXT) AS createdAt
      FROM board_worklogentry AS entry
     WHERE entry.log_id = ${logId} AND entry.id IN (${Prisma.join(ids)})
     ORDER BY entry.created_at ASC, entry.id ASC
  `;
}

export function sharePath(token: string): string {
  return `/work-logs/share/${publicShareToken(token)}/`;
}

export async function createShare(db: PrismaClient, logId: number, headline: string, entries: EntryRow[]): Promise<string> {
  const token = randomUUID().replaceAll('-', '');
  const createdAt = djangoTimestamp();
  await db.$transaction(async (transaction) => {
    await transaction.$executeRaw`
      INSERT INTO board_worklogshare (token, headline, created_at, log_id)
      VALUES (${token}, ${headline}, ${createdAt}, ${logId})
    `;
    const [share] = await transaction.$queryRaw<Array<{ id: number }>>`SELECT last_insert_rowid() AS id`;
    for (const entry of entries) {
      await transaction.$executeRaw`
        INSERT INTO board_worklogshare_entries (worklogshare_id, worklogentry_id)
        VALUES (${share.id}, ${entry.id})
      `;
    }
  });
  return token;
}
