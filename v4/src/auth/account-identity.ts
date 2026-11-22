import type { Prisma, PrismaClient } from '@prisma/client';
import { accountUsernamePattern } from './account-validation.js';

export type IdentityMode = 'account' | 'signup';

export async function prepareUsernameChange(tx: Prisma.TransactionClient, userId: number, previous: string, username: string, mode: IdentityMode) {
  if (username === previous) return null;
  if (!accountUsernamePattern.test(username)) return '사용자 이름은 4~15자 사이의 소문자 영어, 숫자만 가능합니다.';
  if (await tx.user.findUnique({ where: { username }, select: { id: true } })) return '이미 사용중인 아이디입니다.';
  const [post] = await tx.$queryRaw<unknown[]>`SELECT 1 FROM board_post WHERE author_id = ${userId} LIMIT 1`;
  if (post || mode === 'signup') {
    const since = new Date(Date.now() - 180 * 86_400_000).toISOString().slice(0, -1).replace('T', ' ');
    const [history] = await tx.$queryRaw<unknown[]>`
      SELECT 1 FROM board_usernamechangelog WHERE user_id = ${userId} AND created_date >= ${since} LIMIT 1
    `;
    if (history) return '아이디는 6개월에 한 번 바꿀 수 있습니다.';
  }
  if (post || mode === 'account') {
    const timestamp = new Date().toISOString().slice(0, -1).replace('T', ' ');
    await tx.$executeRaw`
      INSERT INTO board_usernamechangelog (user_id, username, created_date) VALUES (${userId}, ${previous}, ${timestamp})
    `;
  }
  return null;
}

export async function updateAccountIdentity(db: PrismaClient, userId: number, input: Record<string, unknown>, mode: IdentityMode) {
  const { username = '', name = '' } = input;
  if (typeof username !== 'string' || typeof name !== 'string' || name.length > 150) return '아이디와 이름을 확인해 주세요.';
  return db.$transaction(async (tx) => {
    const [account] = await tx.$queryRaw<Array<{ username: string }>>`
      UPDATE auth_user SET username = username WHERE id = ${userId} AND is_active = 1 RETURNING username
    `;
    if (!account) return '계정을 찾을 수 없습니다.';
    if (username) {
      const invalid = await prepareUsernameChange(tx, userId, account.username, username, mode);
      if (invalid) return invalid;
    }
    await tx.$executeRaw`
      UPDATE auth_user SET username = COALESCE(NULLIF(${username}, ''), username),
        first_name = COALESCE(NULLIF(${name}, ''), first_name) WHERE id = ${userId}
    `;
    return null;
  });
}
