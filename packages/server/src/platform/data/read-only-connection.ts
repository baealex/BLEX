import type { PrismaClient } from '@prisma/client';

/** Prisma has no API for connection pragmas, and backup inspection must not be able to write. */
export async function makeConnectionReadOnly(db: PrismaClient) {
  await db.$executeRaw`PRAGMA query_only = ON`;
}
