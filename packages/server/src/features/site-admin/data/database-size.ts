import type { Prisma, PrismaClient } from '@prisma/client';

/** The file size is only available through SQLite pragmas, which Prisma has no API for. */
export async function readDatabaseBytes(db: Prisma.TransactionClient | PrismaClient) {
  const [pageCount] = await db.$queryRaw<Array<{ page_count: number | bigint }>>`PRAGMA page_count`;
  const [pageSize] = await db.$queryRaw<Array<{ page_size: number | bigint }>>`PRAGMA page_size`;
  return pageCount && pageSize ? Number(pageCount.page_count) * Number(pageSize.page_size) : null;
}
