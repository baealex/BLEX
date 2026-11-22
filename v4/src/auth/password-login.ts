import type { PrismaClient } from '@prisma/client';
import { verifyDjangoPassword } from './django-password.js';
import { verifyDjangoSecondFactor } from './two-factor.js';

type PasswordLoginResult =
  | { status: 'invalid-credentials' }
  | { status: 'second-factor-required'; username: string }
  | { status: 'invalid-second-factor' }
  | { status: 'authenticated'; userId: number; username: string; passwordHash: string };

interface AccountCredentialRow {
  id: number;
  username: string;
  password: string;
  totpSecret: string | null;
  recoveryKey: string | null;
}

export async function authenticatePassword(
  db: PrismaClient,
  username: string,
  password: string,
  code: string,
  cipherKey: string,
): Promise<PasswordLoginResult> {
  const [account] = await db.$queryRaw<AccountCredentialRow[]>`
    SELECT account.id, account.username, account.password,
           security.totp_secret AS totpSecret, security.recovery_key AS recoveryKey
      FROM auth_user AS account
      LEFT JOIN board_twofactorauth AS security ON security.user_id = account.id
     WHERE account.username = ${username} AND account.is_active = 1
     LIMIT 1
  `;
  const verified = await verifyDjangoPassword(password, account?.password ?? '');
  if (!account || !verified) return { status: 'invalid-credentials' };

  if (account.totpSecret !== null && account.recoveryKey !== null) {
    if (!code) return { status: 'second-factor-required', username: account.username };
    const valid = verifyDjangoSecondFactor({ totpSecret: account.totpSecret, recoveryKey: account.recoveryKey }, code, cipherKey);
    if (!valid) return { status: 'invalid-second-factor' };
  }
  return { status: 'authenticated', userId: account.id, username: account.username, passwordHash: account.password };
}
