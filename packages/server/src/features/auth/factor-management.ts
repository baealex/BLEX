import { createHash, randomInt } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import { Secret, TOTP } from 'otpauth';
import QRCode from 'qrcode';
import { decryptDjangoSecret, encryptDjangoSecret } from './django-secret.js';
import { verifyDjangoSecondFactor } from './two-factor.js';
import { acquireVerification, hasVerification, type VerificationAccount } from './verification.js';

const recoveryCharacters = '0123456789abcdefghijklnmopqrstuvwxyzABCDEFGHIJKLNMOPQRSTUVWXYZ';
const setupTimeout = 300_000;
const clearedVerification = { verifiedUntil: null, verifiedFactorId: null, requiresFactor: false };

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
    const setup = { secret: encrypted, recoveryHash, expiresAt: new Date(Date.now() + setupTimeout) };
    await tx.factorSetup.upsert({
      where: { sessionHash: account.sessionHash },
      create: { sessionHash: account.sessionHash, ...setup },
      update: setup,
      select: { sessionHash: true },
    });
    return true;
  });
  return stored ? { image, recovery } as const : { error: 'RE' } as const;
}

export async function activateFactor(db: PrismaClient, account: VerificationAccount, cipherKey: string, code: unknown) {
  if (!hasVerification(account)) return 'RE';
  if (account.factorId !== null) return 'AC';
  return db.$transaction(async (tx) => {
    if (!await acquireVerification(tx, account)) return 'RE';
    const unexpired = { sessionHash: account.sessionHash, expiresAt: { gt: new Date() } };
    const pending = await tx.factorSetup.findFirst({ where: unexpired, select: { secret: true, recoveryHash: true } });
    if (!pending) return 'EP';
    const entered = typeof code === 'string' ? code.trim() : '';
    if (!entered) return 'IP';
    if (!/^\d{6}$/.test(entered)) return 'RJ';
    if (!decryptDjangoSecret(pending.secret, cipherKey) ||
        !verifyDjangoSecondFactor({ totpSecret: pending.secret, recoveryKey: '' }, entered, cipherKey)) return 'RJ';
    const { count: claimed } = await tx.factorSetup.deleteMany({ where: unexpired });
    if (claimed !== 1) return 'EP';
    await tx.twoFactorAuth.create({
      data: { userId: account.id, totpSecret: pending.secret, recoveryKey: pending.recoveryHash },
      select: { id: true },
    });
    await tx.session.deleteMany({ where: { userId: account.id, tokenHash: { not: account.sessionHash } } });
    await tx.session.updateMany({ where: { tokenHash: account.sessionHash }, data: clearedVerification });
    return null;
  });
}

export async function disableFactor(db: PrismaClient, account: VerificationAccount) {
  if (!hasVerification(account)) return 'RE';
  const { factorId, factorCreated } = account;
  if (factorId === null || factorCreated === null) return 'AU';
  if (Date.now() - factorCreated.getTime() <= 86_400_000) return 'RJ';
  return db.$transaction(async (tx) => {
    if (!await acquireVerification(tx, account)) return 'RE';
    await tx.twoFactorAuth.deleteMany({ where: { userId: account.id, id: factorId } });
    await tx.session.updateMany({ where: { userId: account.id }, data: clearedVerification });
    return null;
  });
}
