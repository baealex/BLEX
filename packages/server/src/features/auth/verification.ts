import type { Prisma, PrismaClient } from '@prisma/client';
import type { FastifyRequest } from 'fastify';
import { sessionCookie } from '../../platform/cookies.js';
import { credentialTag, createToken, readSession, tokenHash } from './session.js';

const verificationLifetime = 300_000;

export interface VerificationAccount {
  id: number;
  username: string;
  name: string;
  email: string;
  passwordHash: string;
  sessionHash: string;
  tag: string;
  factorId: number | null;
  totpSecret: string | null;
  recoveryKey: string | null;
  factorCreated: Date | null;
  verifiedUntil: Date | null;
  verifiedFactor: number | null;
  requiresFactor: boolean;
}

export async function readVerificationAccount(db: PrismaClient, request: FastifyRequest, secretKey: string): Promise<VerificationAccount | null> {
  const token = request.cookies[sessionCookie];
  const hash = tokenHash(token);
  if (!hash || !await readSession(db, token, secretKey)) return null;
  const session = await db.session.findFirst({
    where: { tokenHash: hash, expiresAt: { gt: new Date() }, user: { isActive: true } },
    select: {
      tokenHash: true, credentialTag: true, verifiedUntil: true, verifiedFactorId: true, requiresFactor: true,
      user: {
        select: {
          id: true, username: true, email: true, passwordHash: true, name: true,
          twoFactor: { select: { id: true, totpSecret: true, recoveryKey: true, createdAt: true } },
        },
      },
    },
  });
  if (!session || session.credentialTag !== credentialTag(session.user.passwordHash, secretKey)) return null;
  const { user } = session;
  return {
    id: user.id, username: user.username, name: user.name, email: user.email, passwordHash: user.passwordHash,
    sessionHash: session.tokenHash, tag: session.credentialTag,
    factorId: user.twoFactor?.id ?? null, totpSecret: user.twoFactor?.totpSecret ?? null,
    recoveryKey: user.twoFactor?.recoveryKey ?? null, factorCreated: user.twoFactor?.createdAt ?? null,
    verifiedUntil: session.verifiedUntil, verifiedFactor: session.verifiedFactorId, requiresFactor: session.requiresFactor,
  };
}

export function hasVerification(account: VerificationAccount, pendingFactor = false): boolean {
  return account.verifiedUntil !== null && account.verifiedUntil.getTime() > Date.now() &&
    account.verifiedFactor === account.factorId && account.requiresFactor === pendingFactor;
}

/** The account as this proof saw it. Any change to its password, status, or factor voids the proof. */
function unchangedAccount(account: VerificationAccount): Prisma.UserWhereInput {
  return {
    id: account.id, isActive: true, passwordHash: account.passwordHash,
    twoFactor: account.factorId === null ? { is: null } : { is: { id: account.factorId } },
  };
}

export async function recordVerification(db: PrismaClient, account: VerificationAccount, requireFactor = false) {
  const token = createToken();
  const now = new Date();
  const { count } = await db.session.updateMany({
    where: { tokenHash: account.sessionHash, expiresAt: { gt: now }, user: unchangedAccount(account) },
    data: {
      tokenHash: tokenHash(token)!, verifiedUntil: new Date(now.getTime() + verificationLifetime),
      verifiedFactorId: account.factorId, requiresFactor: requireFactor,
    },
  });
  return count === 1 ? token : null;
}

export async function acquireVerification(tx: Prisma.TransactionClient, account: VerificationAccount) {
  const now = new Date();
  // A write, so the transaction holds SQLite's write lock from this check until it commits.
  const { count } = await tx.session.updateMany({
    where: {
      tokenHash: account.sessionHash, expiresAt: { gt: now }, verifiedUntil: { gt: now },
      requiresFactor: false, verifiedFactorId: account.factorId, user: unchangedAccount(account),
    },
    data: { requiresFactor: false },
  });
  return count === 1;
}
