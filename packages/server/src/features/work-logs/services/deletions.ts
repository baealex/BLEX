import type { Prisma, PrismaClient } from '@prisma/client';

export async function deleteWorkLogEntry(
  db: PrismaClient,
  logId: number,
  entryId: number,
  ownerId: number,
): Promise<string | null> {
  return db.$transaction(async (tx) => {
    const log = { id: logId, ownerId };
    const where = { id: entryId, log };
    const entry = await tx.workLogEntry.findFirst({ where, select: { attachment: true } });
    if (!entry) return null;

    await tx.workLogEntry.deleteMany({ where });
    await tx.workLogShare.deleteMany({ where: { log, entries: { none: {} } } });
    return entry.attachment;
  });
}

/** Entries and share links cascade from the log. Attachment paths are returned for removal after commit. */
export async function deleteWorkLogs(tx: Prisma.TransactionClient, where: Prisma.WorkLogWhereInput) {
  const attachments = await tx.workLogEntry.findMany({
    where: { log: where, attachment: { not: '' } },
    select: { attachment: true },
  });
  await tx.workLog.deleteMany({ where });
  return attachments;
}

export async function deleteWorkLog(db: PrismaClient, logId: number, ownerId: number): Promise<string[]> {
  const attachments = await db.$transaction((tx) => deleteWorkLogs(tx, { id: logId, ownerId }));
  return attachments.map(({ attachment }) => attachment);
}

export async function revokeWorkLogShare(db: PrismaClient, logId: number, token: string, ownerId: number): Promise<number> {
  const { count } = await db.workLogShare.deleteMany({ where: { token, log: { id: logId, ownerId } } });
  return count;
}
