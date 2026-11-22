import type { Prisma, PrismaClient } from '@prisma/client';
import type { FastifyRequest } from 'fastify';
import { sessionCookie } from './cookies.js';
import { credentialTag, createToken, readSession, tokenHash } from './session.js';

const verificationLifetime = 300_000;

export interface VerificationAccount {
  id: number;
  username: string;
  name: string;
  email: string;
  password: string;
  sessionHash: string;
  tag: string;
  factorId: number | null;
  totpSecret: string | null;
  recoveryKey: string | null;
  factorCreated: string | null;
  verifiedUntil: bigint | null;
  verifiedFactor: number | null;
  requiresFactor: number;
}

export async function readVerificationAccount(db: PrismaClient, request: FastifyRequest, secretKey: string): Promise<VerificationAccount | null> {
  const token = request.cookies[sessionCookie];
  const hash = tokenHash(token);
  if (!hash || !await readSession(db, token, secretKey)) return null;
  const [account] = await db.$queryRaw<VerificationAccount[]>`
    SELECT account.id, account.username, account.email, account.password, account.first_name AS name,
           session.token_hash AS sessionHash, session.credential_tag AS tag, session.verified_until AS verifiedUntil,
           session.verified_factor_id AS verifiedFactor, session.requires_factor AS requiresFactor,
           factor.id AS factorId, factor.totp_secret AS totpSecret, factor.recovery_key AS recoveryKey,
           CAST(factor.created_date AS TEXT) AS factorCreated
      FROM blex_session AS session JOIN auth_user AS account ON account.id = session.user_id
      LEFT JOIN board_twofactorauth AS factor ON factor.user_id = account.id
     WHERE session.token_hash = ${hash} AND session.expires_at > ${BigInt(Date.now())} AND account.is_active = 1
  `;
  return account?.tag === credentialTag(account.password, secretKey) ? account : null;
}

export function hasVerification(account: VerificationAccount, pendingFactor = false): boolean {
  return account.verifiedUntil !== null && account.verifiedUntil > BigInt(Date.now()) &&
    account.verifiedFactor === account.factorId && Boolean(account.requiresFactor) === pendingFactor;
}

export async function recordVerification(db: PrismaClient, account: VerificationAccount, requireFactor = false) {
  const token = createToken();
  const now = BigInt(Date.now());
  const changed = await db.$executeRaw`
    UPDATE blex_session SET token_hash = ${tokenHash(token)!}, verified_until = ${now + BigInt(verificationLifetime)},
           verified_factor_id = ${account.factorId}, requires_factor = ${Number(requireFactor)}
     WHERE token_hash = ${account.sessionHash} AND expires_at > ${now}
       AND EXISTS(SELECT 1 FROM auth_user WHERE id = ${account.id} AND is_active = 1 AND password = ${account.password})
       AND (SELECT id FROM board_twofactorauth WHERE user_id = ${account.id}) IS ${account.factorId}
  `;
  return changed === 1 ? token : null;
}

export async function acquireVerification(tx: Prisma.TransactionClient, account: VerificationAccount) {
  const now = BigInt(Date.now());
  const available = await tx.$executeRaw`
    UPDATE blex_session SET token_hash = token_hash
     WHERE token_hash = ${account.sessionHash} AND expires_at > ${now} AND verified_until > ${now}
       AND requires_factor = 0 AND verified_factor_id IS ${account.factorId}
       AND (SELECT id FROM board_twofactorauth WHERE user_id = ${account.id}) IS ${account.factorId}
       AND EXISTS(SELECT 1 FROM auth_user WHERE id = ${account.id} AND is_active = 1 AND password = ${account.password})
  `;
  return available === 1;
}
