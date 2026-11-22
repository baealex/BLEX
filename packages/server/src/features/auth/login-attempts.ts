import { createHash, createHmac } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';

class LoginLimitReached extends Error {}

export async function reserveLoginAttempt(db: PrismaClient, secretKey: string, ip: string, username: string) {
  const window = Math.floor(Date.now() / 300_000);
  const key = createHash('sha256').update('blex.login-attempt').update(secretKey).digest();
  const limits = [
    { hash: createHmac('sha256', key).update(`${window}:ip:${ip}`).digest('hex'), limit: 5 },
    { hash: createHmac('sha256', key).update(`${window}:account:${username.normalize('NFKC').toLowerCase()}`).digest('hex'), limit: 10 },
  ];
  try {
    await db.$transaction(async (transaction) => {
      await transaction.$executeRaw`DELETE FROM board_loginattempt WHERE "window" < ${window - 1}`;
      for (const { hash, limit } of limits) {
        const affected = await transaction.$executeRaw`
          INSERT INTO board_loginattempt (key, "window", count) VALUES (${hash}, ${window}, 1)
          ON CONFLICT(key) DO UPDATE SET count = count + 1 WHERE count < ${limit}
        `;
        if (!affected) throw new LoginLimitReached();
      }
    });
  } catch (error) {
    if (error instanceof LoginLimitReached) return null;
    throw error;
  }

  return async () => {
    await db.$executeRaw`
      UPDATE board_loginattempt SET count = count - 1 WHERE key IN (${limits[0].hash}, ${limits[1].hash}) AND count > 0
    `;
  };
}
