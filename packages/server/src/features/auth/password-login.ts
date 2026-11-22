import type { PrismaClient } from '@prisma/client';
import { verifyDjangoPassword } from './django-password.js';
import { verifyDjangoSecondFactor } from './two-factor.js';

type PasswordLoginResult =
  | { status: 'invalid-credentials' }
  | { status: 'second-factor-required'; username: string }
  | { status: 'invalid-second-factor' }
  | { status: 'authenticated'; userId: number; username: string; passwordHash: string };

export async function authenticatePassword(
  db: PrismaClient,
  username: string,
  password: string,
  code: string,
  cipherKey: string,
): Promise<PasswordLoginResult> {
  const account = await db.user.findFirst({
    where: { username, isActive: true },
    select: { id: true, username: true, passwordHash: true, twoFactor: { select: { totpSecret: true, recoveryKey: true } } },
  });
  const verified = await verifyDjangoPassword(password, account?.passwordHash ?? '');
  if (!account || !verified) return { status: 'invalid-credentials' };

  if (account.twoFactor) {
    if (!code) return { status: 'second-factor-required', username: account.username };
    if (!verifyDjangoSecondFactor(account.twoFactor, code, cipherKey)) return { status: 'invalid-second-factor' };
  }
  return { status: 'authenticated', userId: account.id, username: account.username, passwordHash: account.passwordHash };
}
