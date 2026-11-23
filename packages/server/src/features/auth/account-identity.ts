import { systemMessage } from '../../platform/messages.js';
import type { Prisma, PrismaClient } from '@prisma/client';
import { accountUsernamePattern } from './account-validation.js';

export type IdentityMode = 'account' | 'signup';

export async function prepareUsernameChange(
  tx: Prisma.TransactionClient,
  userId: number,
  previous: string,
  username: string,
  mode: IdentityMode,
) {
  if (username === previous) return null;
  if (!accountUsernamePattern.test(username))
    return systemMessage('Usernames must contain 4–15 lowercase English letters or numbers.');
  if (await tx.user.findUnique({ where: { username }, select: { id: true } }))
    return systemMessage('This username is already in use.');
  const post = await tx.post.findFirst({ where: { authorId: userId }, select: { id: true } });
  if (post || mode === 'signup') {
    const since = new Date(Date.now() - 180 * 86_400_000);
    const history = await tx.usernameChange.findFirst({
      where: { userId, createdAt: { gte: since } },
      select: { id: true },
    });
    if (history) return systemMessage('You can change your username once every six months.');
  }
  if (post || mode === 'account') {
    await tx.usernameChange.create({ data: { userId, username: previous }, select: { id: true } });
  }
  return null;
}

export async function updateAccountIdentity(
  db: PrismaClient,
  userId: number,
  input: Record<string, unknown>,
  mode: IdentityMode,
) {
  const { username = '', name = '' } = input;
  if (typeof username !== 'string' || typeof name !== 'string' || name.length > 150)
    return systemMessage('Check your username and name.');
  return db.$transaction(async (tx) => {
    // A write, so the availability checks below run under SQLite's write lock.
    const { count } = await tx.user.updateMany({ where: { id: userId, isActive: true }, data: { isActive: true } });
    if (count !== 1) return systemMessage('Account not found.');
    const account = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { username: true } });
    if (username) {
      const invalid = await prepareUsernameChange(tx, userId, account.username, username, mode);
      if (invalid) return invalid;
    }
    await tx.user.update({
      where: { id: userId },
      data: { username: username || undefined, name: name || undefined },
      select: { id: true },
    });
    return null;
  });
}
