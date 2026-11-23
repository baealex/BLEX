import { createHash, timingSafeEqual } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { Secret, TOTP } from 'otpauth';
import { decryptSecret } from './encrypted-secret.js';

export interface StoredSecondFactor {
  totpSecret: string;
  recoveryKey: string;
}

/** Thrown inside a transaction so the login or proof that lost the key is rolled back with it. */
export class RecoveryKeySpent extends Error {}

/** Authenticator codes are six digits, so anything longer is read as the recovery key. */
export function isRecoveryCode(code: string): boolean {
  return code.length > 6;
}

/**
 * An account holds a single recovery key, so spending it also turns the factor off. Someone who lost
 * their device would otherwise have nothing left to sign in with. Deleting only the row that still
 * holds this key lets exactly one concurrent use win.
 */
export async function spendRecoveryKey(
  tx: Prisma.TransactionClient,
  userId: number,
  storedKey: string,
  keptSessionHash?: string,
) {
  const { count } = storedKey.trim()
    ? await tx.twoFactorAuth.deleteMany({ where: { userId, recoveryKey: storedKey } })
    : { count: 0 };
  if (count !== 1) throw new RecoveryKeySpent();
  await tx.session.updateMany({
    where: { userId, ...(keptSessionHash ? { tokenHash: { not: keptSessionHash } } : {}) },
    data: { verifiedUntil: null, verifiedFactorId: null, requiresFactor: false },
  });
}

export function verifySecondFactor(
  stored: StoredSecondFactor,
  code: string,
  cipherKey: string,
  timestamp = Date.now(),
): boolean {
  if (isRecoveryCode(code)) {
    const recoveryKey = stored.recoveryKey.trim();
    const token = code.trim();
    if (!recoveryKey || !token) return false;
    const validHash = /^[a-f0-9]{64}$/.test(recoveryKey);
    const expected = Buffer.from(recoveryKey, validHash ? 'hex' : 'utf8');
    const supplied = validHash ? createHash('sha256').update(token).digest() : Buffer.from(token);
    return expected.length === supplied.length && timingSafeEqual(expected, supplied);
  }

  if (!/^\d{6}$/.test(code)) return false;
  const encoded = stored.totpSecret.trim();
  const secret = decryptSecret(encoded, cipherKey) ?? encoded;
  if (!/^[A-Z2-7]{16,64}=*$/i.test(secret)) return false;
  try {
    const totp = new TOTP({
      secret: Secret.fromBase32(secret.toUpperCase()),
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
    });
    return totp.validate({ token: code, window: 1, timestamp }) !== null;
  } catch {
    return false;
  }
}
