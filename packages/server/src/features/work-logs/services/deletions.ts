import type { Prisma, PrismaClient } from '@prisma/client';

async function deleteWorkLogShares(
  tx: Prisma.TransactionClient,
  where: Prisma.board_worklogshareWhereInput,
): Promise<number> {
  await tx.board_worklogshare_entries.deleteMany({ where: { board_worklogshare: where } });
  return (await tx.board_worklogshare.deleteMany({ where })).count;
}

export async function deleteWorkLogEntry(
  db: PrismaClient,
  logId: number,
  entryId: number,
  ownerId: number,
): Promise<string | null> {
  return db.$transaction(async (tx) => {
    const log = { id: logId, owner_id: ownerId };
    const where = { id: entryId, board_worklog: log };
    const entry = await tx.board_worklogentry.findFirst({ where, select: { attachment: true } });
    if (!entry) return null;

    await tx.board_worklogshare_entries.deleteMany({ where: { worklogentry_id: entryId } });
    await tx.board_worklogentry.deleteMany({ where });
    await deleteWorkLogShares(tx, { board_worklog: log, board_worklogshare_entries: { none: {} } });
    return entry.attachment;
  });
}

export async function deleteWorkLogs(tx: Prisma.TransactionClient, where: Prisma.board_worklogWhereInput) {
  const related = { board_worklog: where };
  const attachments = await tx.board_worklogentry.findMany({
    where: { ...related, attachment: { not: '' } },
    select: { attachment: true },
  });
  await tx.board_worklogshare_entries.deleteMany({ where: { board_worklogentry: related } });
  await deleteWorkLogShares(tx, related);
  await tx.board_worklogentry.deleteMany({ where: related });
  await tx.board_worklog.deleteMany({ where });
  return attachments;
}

export async function deleteWorkLog(db: PrismaClient, logId: number, ownerId: number): Promise<string[]> {
  const attachments = await db.$transaction((tx) => deleteWorkLogs(tx, { id: logId, owner_id: ownerId }));
  return attachments.map(({ attachment }) => attachment);
}

export function revokeWorkLogShare(db: PrismaClient, logId: number, token: string, ownerId: number): Promise<number> {
  return db.$transaction((tx) => deleteWorkLogShares(tx, {
    token, board_worklog: { id: logId, owner_id: ownerId },
  }));
}
