import type { Prisma, PrismaClient } from '@prisma/client';
import type { FastifyRequest } from 'fastify';
import { type WorkLogEntryView, type WorkLogView } from '../../../../../client/src/contracts/work-logs.js';
import { PAGE_SIZE, bodyRecord } from '../shared.js';

export interface WorkLogRow extends WorkLogView {
  ownerId?: number;
  ownerUsername?: string;
}

export interface EntryRow extends WorkLogEntryView {
  logId: number;
}

interface EntryInput {
  fields: Record<string, unknown>;
  attachment: Buffer | null;
}

export const entrySelect = {
  id: true,
  logId: true,
  title: true,
  text: true,
  mediaType: true,
  attachment: true,
  createdAt: true,
} satisfies Prisma.WorkLogEntrySelect;

type StoredEntry = Prisma.WorkLogEntryGetPayload<{ select: typeof entrySelect }>;

export const newestFirst = [
  { createdAt: 'desc' },
  { id: 'desc' },
] satisfies Prisma.WorkLogEntryOrderByWithRelationInput[];
export const oldestFirst = [
  { createdAt: 'asc' },
  { id: 'asc' },
] satisfies Prisma.WorkLogEntryOrderByWithRelationInput[];

export function toEntryRow(entry: StoredEntry): EntryRow {
  return { ...entry, createdAt: entry.createdAt.toISOString() };
}

export async function readOwnedLog(db: PrismaClient, logId: number, userId: number): Promise<WorkLogRow | null> {
  const log = await db.workLog.findFirst({
    where: { id: logId, ownerId: userId, owner: { isActive: true } },
    select: { id: true, title: true, createdAt: true, ownerId: true, owner: { select: { username: true } } },
  });
  if (!log) return null;
  return {
    id: log.id,
    title: log.title,
    createdAt: log.createdAt.toISOString(),
    ownerId: log.ownerId,
    ownerUsername: log.owner.username,
  };
}

export function countOwnedLogs(db: PrismaClient, userId: number): Promise<number> {
  return db.workLog.count({ where: { ownerId: userId, owner: { isActive: true } } });
}

export async function readOwnedLogs(db: PrismaClient, userId: number, page: number): Promise<WorkLogRow[]> {
  const logs = await db.workLog.findMany({
    where: { ownerId: userId, owner: { isActive: true } },
    select: { id: true, title: true, createdAt: true },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: PAGE_SIZE,
    skip: (page - 1) * PAGE_SIZE,
  });
  return logs.map((log) => ({ ...log, createdAt: log.createdAt.toISOString() }));
}

export async function countEntriesByLog(db: PrismaClient, logIds: number[]): Promise<Map<number, number>> {
  if (!logIds.length) return new Map();
  const counts = await db.workLogEntry.groupBy({
    by: ['logId'],
    where: { logId: { in: logIds } },
    _count: { _all: true },
  });
  return new Map(counts.map((row) => [row.logId, row._count._all]));
}

export function countEntries(db: PrismaClient, logId: number): Promise<number> {
  return db.workLogEntry.count({ where: { logId } });
}

export async function readEntries(
  db: PrismaClient,
  logId: number,
  page: number,
  order: 'newest' | 'oldest' = 'newest',
): Promise<EntryRow[]> {
  const entries = await db.workLogEntry.findMany({
    where: { logId },
    select: entrySelect,
    orderBy: order === 'oldest' ? oldestFirst : newestFirst,
    take: PAGE_SIZE,
    skip: (page - 1) * PAGE_SIZE,
  });
  return entries.map(toEntryRow);
}

export async function readEntry(
  db: PrismaClient,
  logId: number,
  entryId: number,
  withAttachment = false,
): Promise<EntryRow | null> {
  const entry = await db.workLogEntry.findFirst({
    where: { id: entryId, logId, ...(withAttachment ? { attachment: { not: '' } } : {}) },
    select: entrySelect,
  });
  return entry ? toEntryRow(entry) : null;
}

export async function readEntryInput(request: FastifyRequest): Promise<EntryInput> {
  const fields = bodyRecord(request.body);
  const attachment = fields.attachment;
  return {
    fields,
    attachment: Buffer.isBuffer(attachment) ? attachment : null,
  };
}

export async function insertWorkLog(db: PrismaClient, userId: number, title: string): Promise<number> {
  const log = await db.workLog.create({ data: { title, ownerId: userId }, select: { id: true } });
  return log.id;
}

export async function insertEntry(
  db: PrismaClient,
  logId: number,
  title: string,
  text: string,
  mediaType: string,
  attachment: string,
): Promise<void> {
  await db.workLogEntry.create({ data: { logId, title, text, mediaType, attachment } });
}
