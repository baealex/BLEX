import type { Prisma, PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import type { WorkLogShareView } from '../../../../../client/src/contracts/work-logs.js';
import { type EntryRow, entrySelect, newestFirst, oldestFirst, toEntryRow } from './logs.js';
import { PAGE_SIZE, arrayValue, pageFields } from '../shared.js';

interface ShareRow extends WorkLogShareView {
  logId: number;
  ownerId: number;
  ownerUsername: string;
  logTitle: string;
  logCreatedAt: string;
}

const inShare = (shareId: number) => ({ shares: { some: { id: shareId } } }) satisfies Prisma.WorkLogEntryWhereInput;

export async function readShare(db: PrismaClient, token: string): Promise<ShareRow | null> {
  const share = await db.workLogShare.findFirst({
    where: { token, log: { owner: { isActive: true } } },
    select: {
      id: true,
      token: true,
      headline: true,
      createdAt: true,
      logId: true,
      log: { select: { ownerId: true, title: true, createdAt: true, owner: { select: { username: true } } } },
    },
  });
  if (!share) return null;
  return {
    id: share.id,
    token: publicShareToken(share.token),
    headline: share.headline,
    createdAt: share.createdAt.toISOString(),
    logId: share.logId,
    ownerId: share.log.ownerId,
    ownerUsername: share.log.owner.username,
    logTitle: share.log.title,
    logCreatedAt: share.log.createdAt.toISOString(),
  };
}

export function countShares(db: PrismaClient, logId: number): Promise<number> {
  return db.workLogShare.count({ where: { logId } });
}

export async function readShares(db: PrismaClient, logId: number, page: number): Promise<WorkLogShareView[]> {
  const rows = await db.workLogShare.findMany({
    where: { logId },
    select: { id: true, token: true, headline: true, createdAt: true },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: PAGE_SIZE,
    skip: (page - 1) * PAGE_SIZE,
  });
  return rows.map((row) => ({ ...row, token: publicShareToken(row.token), createdAt: row.createdAt.toISOString() }));
}

export async function readSnapshotEntries(db: PrismaClient, shareId: number, page: number): Promise<EntryRow[]> {
  const entries = await db.workLogEntry.findMany({
    where: inShare(shareId),
    select: entrySelect,
    orderBy: oldestFirst,
    take: PAGE_SIZE,
    skip: (page - 1) * PAGE_SIZE,
  });
  return entries.map(toEntryRow);
}

export function entryCountForShare(db: PrismaClient, shareId: number): Promise<number> {
  return db.workLogEntry.count({ where: inShare(shareId) });
}

export async function latestSharedEntry(
  db: PrismaClient,
  shareId: number,
  imagesOnly = false,
): Promise<EntryRow | null> {
  const entry = await db.workLogEntry.findFirst({
    where: {
      ...inShare(shareId),
      attachment: { not: '' },
      ...(imagesOnly ? { mediaType: { startsWith: 'image/' } } : {}),
    },
    select: entrySelect,
    orderBy: newestFirst,
  });
  return entry ? toEntryRow(entry) : null;
}

export async function pageEntryForShareMedia(
  db: PrismaClient,
  shareId: number,
  logId: number,
  entryId: number,
): Promise<EntryRow | null> {
  const entry = await db.workLogEntry.findFirst({
    where: { ...inShare(shareId), id: entryId, logId, attachment: { not: '' } },
    select: entrySelect,
  });
  return entry ? toEntryRow(entry) : null;
}

export function selectedEntryIds(
  fields: Record<string, unknown>,
  allowEmpty = false,
): { ids: number[]; error?: string } {
  const values = [
    ...arrayValue(fields[pageFields.selectedEntries]).flatMap((value) => value.split(',')),
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

/** Share tokens are stored as 32 hex characters and published as hyphenated UUIDs. */
export function storedShareToken(value: string): string | null {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value)) return null;
  return value.replaceAll('-', '').toLowerCase();
}

function publicShareToken(stored: string): string {
  return stored.replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, '$1-$2-$3-$4-$5');
}

export async function selectedEntries(db: PrismaClient, logId: number, ids: number[]): Promise<EntryRow[]> {
  if (ids.length === 0) return [];
  const entries = await db.workLogEntry.findMany({
    where: { logId, id: { in: ids } },
    select: entrySelect,
    orderBy: oldestFirst,
  });
  return entries.map(toEntryRow);
}

export function sharePath(token: string): string {
  return `/work-logs/share/${publicShareToken(token)}/`;
}

export async function createShare(
  db: PrismaClient,
  logId: number,
  headline: string,
  entries: EntryRow[],
): Promise<string> {
  const token = randomUUID().replaceAll('-', '');
  await db.workLogShare.create({
    data: { token, headline, logId, entries: { connect: entries.map(({ id }) => ({ id })) } },
  });
  return token;
}
