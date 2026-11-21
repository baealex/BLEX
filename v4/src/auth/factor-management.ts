import { createHash, randomInt } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import { Secret, TOTP } from 'otpauth';
import QRCode from 'qrcode';
import { decryptDjangoSecret, encryptDjangoSecret } from './django-secret.js';
import { verifyDjangoSecondFactor } from './two-factor.js';
import { acquireVerification, hasVerification, type VerificationAccount } from './verification.js';

const recoveryCharacters = '0123456789abcdefghijklnmopqrstuvwxyzABCDEFGHIJKLNMOPQRSTUVWXYZ';
const setupTimeout = 300_000;

export async function beginFactorSetup(db: PrismaClient, account: VerificationAccount, cipherKey: string) {
  if (account.factorId !== null) return { error: 'AC' } as const;
  if (!hasVerification(account)) return { error: 'RE' } as const;
  const recovery = Array.from({ length: 45 }, () => recoveryCharacters[randomInt(recoveryCharacters.length)]).join('');
  const secret = new Secret({ size: 20 });
  const uri = new TOTP({ issuer: 'BLEX', label: account.email || account.username, secret }).toString();
  const image = await QRCode.toDataURL(uri, { margin: 5 });
  const stored = await db.$transaction(async (tx) => {
    if (!await acquireVerification(tx, account)) return false;
    const encrypted = encryptDjangoSecret(secret.base32, cipherKey);
    const recoveryHash = createHash('sha256').update(recovery).digest('hex');
    await tx.$executeRaw`
      INSERT INTO blex_factor_setup (session_hash, secret, recovery_hash, expires_at)
      VALUES (${account.sessionHash}, ${encrypted}, ${recoveryHash}, ${BigInt(Date.now() + setupTimeout)})
      ON CONFLICT(session_hash) DO UPDATE SET secret = excluded.secret, recovery_hash = excluded.recovery_hash,
        expires_at = excluded.expires_at
    `;
    return true;
  });
  return stored ? { image, recovery } as const : { error: 'RE' } as const;
}

export async function activateFactor(db: PrismaClient, account: VerificationAccount, cipherKey: string, code: unknown) {
  if (!hasVerification(account)) return 'RE';
  if (account.factorId !== null) return 'AC';
  if (typeof code !== 'string' || !/^\d{6}$/.test(code.trim())) return 'IP';
  return db.$transaction(async (tx) => {
    if (!await acquireVerification(tx, account)) return 'RE';
    const [pending] = await tx.$queryRaw<Array<{ secret: string; recovery_hash: string }>>`
      SELECT secret, recovery_hash FROM blex_factor_setup WHERE session_hash = ${account.sessionHash} AND expires_at > ${BigInt(Date.now())}
    `;
    if (!pending) return 'EP';
    if (!decryptDjangoSecret(pending.secret, cipherKey) ||
        !verifyDjangoSecondFactor({ totpSecret: pending.secret, recoveryKey: '' }, code.trim(), cipherKey)) return 'RJ';
    const timestamp = new Date().toISOString().slice(0, -1).replace('T', ' ');
    await tx.$executeRaw`
      INSERT INTO board_twofactorauth (user_id, created_date, totp_secret, recovery_key)
      VALUES (${account.id}, ${timestamp}, ${pending.secret}, ${pending.recovery_hash})
    `;
    await tx.$executeRaw`DELETE FROM blex_session WHERE user_id = ${account.id} AND token_hash <> ${account.sessionHash}`;
    await tx.$executeRaw`DELETE FROM blex_factor_setup WHERE session_hash = ${account.sessionHash}`;
    await tx.$executeRaw`
      UPDATE blex_session SET verified_until = NULL, verified_factor_id = NULL, requires_factor = 0 WHERE token_hash = ${account.sessionHash}
    `;
    return null;
  });
}

export async function disableFactor(db: PrismaClient, account: VerificationAccount) {
  if (!hasVerification(account)) return 'RE';
  if (account.factorId === null || !account.factorCreated) return 'AU';
  const created = new Date(account.factorCreated.replace(' ', 'T') + 'Z').getTime();
  if (!Number.isFinite(created) || Date.now() - created <= 86_400_000) return 'RJ';
  return db.$transaction(async (tx) => {
    if (!await acquireVerification(tx, account)) return 'RE';
    await tx.$executeRaw`DELETE FROM board_twofactorauth WHERE user_id = ${account.id} AND id = ${account.factorId}`;
    await tx.$executeRaw`
      UPDATE blex_session SET verified_until = NULL, verified_factor_id = NULL, requires_factor = 0 WHERE user_id = ${account.id}
    `;
    return null;
  });
}
