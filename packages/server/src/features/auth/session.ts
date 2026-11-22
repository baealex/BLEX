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
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_DURATION_SECONDS * 1_000);
  const tag = credentialTag(account.passwordHash, secretKey);

  return db.$transaction(async (transaction) => {
    // A concurrent password change or deactivation must invalidate the proof.
    const { count } = await transaction.user.updateMany({
      where: { id: account.userId, isActive: true, passwordHash: account.passwordHash },
      data: { lastLoginAt: now },
    });
    if (count !== 1) return null;

    await transaction.session.deleteMany({ where: { expiresAt: { lte: now } } });
    if (previous) await transaction.session.deleteMany({ where: { tokenHash: previous } });
    await transaction.session.create({
      data: { tokenHash: storedToken, userId: account.userId, credentialTag: tag, expiresAt },
      select: { tokenHash: true },
    });
    return token;
  });
}

export async function readSession(db: PrismaClient, token: string | undefined, secretKey: string) {
  const hash = tokenHash(token);
  if (!hash) return null;

  const session = await db.session.findFirst({
    where: { tokenHash: hash, expiresAt: { gt: new Date() }, user: { isActive: true } },
    select: {
      credentialTag: true,
      user: {
        select: {
          id: true, username: true, name: true, email: true, passwordHash: true, isStaff: true,
          profile: { select: { avatar: true, role: true } },
          twoFactor: { select: { id: true } },
        },
      },
    },
  });
  if (!session || !/^[0-9a-f]{64}$/.test(session.credentialTag)) return null;
  const { user } = session;
  if (!timingSafeEqual(Buffer.from(session.credentialTag, 'hex'), Buffer.from(credentialTag(user.passwordHash, secretKey), 'hex'))) return null;
  const notifyCount = await db.notification.count({ where: { userId: user.id, isRead: false } });
  const telegramLinks = await db.telegramConnection.count({ where: { userId: user.id, telegramId: { not: '' } } });
  const avatarPath = user.profile?.avatar;

  return {
    id: user.id,
    username: user.username,
    name: user.name,
    email: user.email,
    avatar: avatarPath ? `/resources/media/${avatarPath.split('/').map(encodeURIComponent).join('/')}` : '',
    notifyCount,
    hasConnectedTelegram: telegramLinks > 0,
    hasConnected2fa: user.twoFactor !== null,
    hasEditorRole: user.profile?.role === 'EDITOR',
    isStaff: user.isStaff,
  };
}

export function loginBody(user: NonNullable<Awaited<ReturnType<typeof readSession>>>, isFirstLogin = false) {
  const { id: _id, isStaff: _isStaff, ...body } = user;
  return { ...body, isFirstLogin };
}

export async function deleteSession(db: PrismaClient, token: string | undefined): Promise<void> {
  const hash = tokenHash(token);
  if (hash) await db.session.deleteMany({ where: { tokenHash: hash } });
}
