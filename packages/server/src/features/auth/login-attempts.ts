import { createHash, createHmac } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';

class LoginLimitReached extends Error {}

export async function reserveLoginAttempt(db: PrismaClient, secretKey: string, ip: string, username: string) {
  const window = Math.floor(Date.now() / 300_000);
  const key = createHash('sha256').update('blex.login-attempt').update(secretKey).digest();
  const limits = [
    { hash: createHmac('sha256', key).update(`${window}:ip:${ip}`).digest('hex'), limit: 5 },
    {
      hash: createHmac('sha256', key)
        .update(`${window}:account:${username.normalize('NFKC').toLowerCase()}`)
        .digest('hex'),
      limit: 10,
    },
  ];
  try {
    // The opening delete takes SQLite's write lock, so each count check and increment below is atomic.
    await db.$transaction(async (transaction) => {
      await transaction.loginAttempt.deleteMany({ where: { window: { lt: BigInt(window - 1) } } });
      for (const { hash, limit } of limits) {
        const { count } = await transaction.loginAttempt.updateMany({
          where: { key: hash, count: { lt: limit } },
          data: { count: { increment: 1 } },
        });
        if (count) continue;
        if (await transaction.loginAttempt.findUnique({ where: { key: hash }, select: { key: true } }))
          throw new LoginLimitReached();
        await transaction.loginAttempt.create({
          data: { key: hash, window: BigInt(window), count: 1 },
          select: { key: true },
        });
      }
    });
  } catch (error) {
    if (error instanceof LoginLimitReached) return null;
    throw error;
  }

  return async () => {
    await db.loginAttempt.updateMany({
      where: { key: { in: [limits[0].hash, limits[1].hash] }, count: { gt: 0 } },
      data: { count: { decrement: 1 } },
    });
  };
}
