import { Prisma, type PrismaClient } from '@prisma/client';
import type { FastifyRequest } from 'fastify';
import { type WorkLogEntryView, type WorkLogView } from '../pages.js';
import { PAGE_SIZE, bodyRecord, djangoTimestamp } from '../shared.js';

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

export async function readOwnedLog(db: PrismaClient, logId: number, userId: number): Promise<WorkLogRow | null> {
  const [row] = await db.$queryRaw<WorkLogRow[]>`
    SELECT log.id, log.title, CAST(log.created_at AS TEXT) AS createdAt,
           log.owner_id AS ownerId, owner.username AS ownerUsername
      FROM board_worklog AS log
      JOIN auth_user AS owner ON owner.id = log.owner_id
     WHERE log.id = ${logId} AND log.owner_id = ${userId} AND owner.is_active = 1
     LIMIT 1
  `;
  return row ?? null;
}

export async function countEntries(db: PrismaClient, logId: number): Promise<number> {
  const [row] = await db.$queryRaw<Array<{ total: number | bigint }>>`
    SELECT COUNT(*) AS total FROM board_worklogentry WHERE log_id = ${logId}
  `;
  return Number(row?.total ?? 0);
}

export async function readEntries(
  db: PrismaClient,
  logId: number,
  page: number,
  order: 'newest' | 'oldest' = 'newest',
): Promise<EntryRow[]> {
  const orderBy = order === 'oldest' ? Prisma.sql`entry.created_at ASC, entry.id ASC` : Prisma.sql`entry.created_at DESC, entry.id DESC`;
  return db.$queryRaw<EntryRow[]>`
    SELECT entry.id, entry.log_id AS logId, entry.title, entry.text,
           entry.media_type AS mediaType, entry.attachment,
           CAST(entry.created_at AS TEXT) AS createdAt
      FROM board_worklogentry AS entry
     WHERE entry.log_id = ${logId}
     ORDER BY ${orderBy}
     LIMIT ${PAGE_SIZE} OFFSET ${(page - 1) * PAGE_SIZE}
  `;
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
  return db.$transaction(async (transaction) => {
    await transaction.$executeRaw`
      INSERT INTO board_worklog (title, created_at, owner_id)
      VALUES (${title}, ${djangoTimestamp()}, ${userId})
    `;
    const [row] = await transaction.$queryRaw<Array<{ id: number }>>`SELECT last_insert_rowid() AS id`;
    return row.id;
  });
}

export async function insertEntry(
  db: PrismaClient,
  logId: number,
  title: string,
  text: string,
  mediaType: string,
  attachment: string,
): Promise<void> {
  await db.$executeRaw`
    INSERT INTO board_worklogentry (title, text, media_type, attachment, created_at, log_id)
    VALUES (${title}, ${text}, ${mediaType}, ${attachment}, ${djangoTimestamp()}, ${logId})
  `;
}
