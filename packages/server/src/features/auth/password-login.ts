import type { PrismaClient } from '@prisma/client';
import { verifyPassword } from './password-hash.js';
import { isRecoveryCode, verifySecondFactor } from './two-factor.js';

type PasswordLoginResult =
  | { status: 'invalid-credentials' }
  | { status: 'second-factor-required'; username: string }
  | { status: 'invalid-second-factor' }
  | { status: 'recovery-key-spent' }
  | { status: 'authenticated'; userId: number; username: string; passwordHash: string; spentRecoveryKey?: string };

export async function authenticatePassword(
  db: PrismaClient,
  username: string,
  password: string,
  code: string,
  cipherKey: string,
): Promise<PasswordLoginResult> {
  const account = await db.user.findFirst({
    where: { username, isActive: true },
    select: {
      id: true,
      username: true,
      passwordHash: true,
      twoFactor: { select: { totpSecret: true, recoveryKey: true } },
    },
  });
  const verified = await verifyPassword(password, account?.passwordHash ?? '');
  if (!account || !verified) return { status: 'invalid-credentials' };

  const authenticated = {
    status: 'authenticated',
    userId: account.id,
    username: account.username,
    passwordHash: account.passwordHash,
  } as const;
  // The factor is gone once its key is spent, so a resubmitted key must not read as a fresh success.
  if (!account.twoFactor) return code && isRecoveryCode(code) ? { status: 'recovery-key-spent' } : authenticated;
  if (!code) return { status: 'second-factor-required', username: account.username };
  if (!verifySecondFactor(account.twoFactor, code, cipherKey)) return { status: 'invalid-second-factor' };
  return isRecoveryCode(code) ? { ...authenticated, spentRecoveryKey: account.twoFactor.recoveryKey } : authenticated;
}
