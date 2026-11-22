import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';

export const SESSION_DURATION_SECONDS = 14 * 24 * 60 * 60;
const tokenPattern = /^[a-zA-Z0-9_-]{43}$/;

export function createToken(): string {
  return randomBytes(32).toString('base64url');
}

export function tokenHash(token: string | undefined): string | undefined {
  return token && tokenPattern.test(token) ? createHash('sha256').update(token).digest('hex') : undefined;
}

export function credentialTag(passwordHash: string, secretKey: string): string {
  return createHmac('sha256', secretKey).update('blex.session-password\0').update(passwordHash).digest('hex');
}

export async function createSession(
  db: PrismaClient,
  account: { userId: number; passwordHash: string },
  secretKey: string,
  previousToken: string | undefined,
): Promise<string | null> {
  const token = createToken();
  const storedToken = tokenHash(token)!;
  const previous = tokenHash(previousToken);
  const now = Date.now();
  const legacyTimestamp = new Date(now).toISOString().slice(0, -1).replace('T', ' ');
  const expiry = BigInt(now + SESSION_DURATION_SECONDS * 1_000);
  const tag = credentialTag(account.passwordHash, secretKey);

  return db.$transaction(async (transaction) => {
    // A concurrent password change or deactivation must invalidate the proof.
    const updated = await transaction.$executeRaw`
      UPDATE auth_user SET last_login = ${legacyTimestamp}
       WHERE id = ${account.userId} AND is_active = 1 AND password = ${account.passwordHash}
    `;
    if (updated !== 1) return null;

    await transaction.$executeRaw`DELETE FROM blex_session WHERE expires_at <= ${BigInt(now)}`;
    if (previous) await transaction.$executeRaw`DELETE FROM blex_session WHERE token_hash = ${previous}`;
    await transaction.$executeRaw`
      INSERT INTO blex_session (token_hash, user_id, credential_tag, expires_at)
      VALUES (${storedToken}, ${account.userId}, ${tag}, ${expiry})
    `;
    return token;
  });
}

interface SessionRow {
  id: number;
  username: string;
  name: string;
  email: string;
  avatarPath: string | null;
  password: string;
  tag: string;
  notifyCount: bigint | number;
  hasConnectedTelegram: bigint | number;
  hasConnected2fa: bigint | number;
  hasEditorRole: bigint | number;
  isStaff: bigint | number | boolean;
}

export async function readSession(db: PrismaClient, token: string | undefined, secretKey: string) {
  const hash = tokenHash(token);
  if (!hash) return null;

  const [row] = await db.$queryRaw<SessionRow[]>`
    SELECT account.id, account.username, account.first_name AS name, account.email,
           account.password, account.is_staff AS isStaff, session.credential_tag AS tag, profile.avatar AS avatarPath,
           (SELECT COUNT(*) FROM board_notify WHERE user_id = account.id AND has_read = 0) AS notifyCount,
           EXISTS(SELECT 1 FROM board_telegramsync WHERE user_id = account.id AND tid <> '') AS hasConnectedTelegram,
           EXISTS(SELECT 1 FROM board_twofactorauth WHERE user_id = account.id) AS hasConnected2fa,
           CASE WHEN profile.role = 'EDITOR' THEN 1 ELSE 0 END AS hasEditorRole
      FROM blex_session AS session
      JOIN auth_user AS account ON account.id = session.user_id
      LEFT JOIN board_profile AS profile ON profile.user_id = account.id
     WHERE session.token_hash = ${hash} AND session.expires_at > ${BigInt(Date.now())} AND account.is_active = 1
  `;
  if (!row || !/^[0-9a-f]{64}$/.test(row.tag)) return null;
  if (!timingSafeEqual(Buffer.from(row.tag, 'hex'), Buffer.from(credentialTag(row.password, secretKey), 'hex'))) return null;

  return {
    id: row.id,
    username: row.username,
    name: row.name,
    email: row.email,
    avatar: row.avatarPath ? `/resources/media/${row.avatarPath.split('/').map(encodeURIComponent).join('/')}` : '',
    notifyCount: Number(row.notifyCount),
    hasConnectedTelegram: Boolean(row.hasConnectedTelegram),
    hasConnected2fa: Boolean(row.hasConnected2fa),
    hasEditorRole: Boolean(row.hasEditorRole),
    isStaff: Boolean(row.isStaff),
  };
}

export function loginBody(user: NonNullable<Awaited<ReturnType<typeof readSession>>>, isFirstLogin = false) {
  const { id: _id, isStaff: _isStaff, ...body } = user;
  return { ...body, isFirstLogin };
}

export async function deleteSession(db: PrismaClient, token: string | undefined): Promise<void> {
  const hash = tokenHash(token);
  if (hash) await db.$executeRaw`DELETE FROM blex_session WHERE token_hash = ${hash}`;
}
