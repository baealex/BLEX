import { type PrismaClient } from '@prisma/client';
import { ActiveUserRow, AuthorRow, DEFAULT_AVATAR, absoluteMediaUrl, localDateOnly } from '../shared.js';

export function canSubscribe(author: AuthorRow): boolean {
  return author.isActive && author.profileRole === 'EDITOR';
}

export async function subscriptionState(
  db: PrismaClient,
  viewer: ActiveUserRow | null,
  author: AuthorRow,
): Promise<{ canSubscribe: boolean; isSubscribed: boolean }> {
  const allowed = canSubscribe(author) && viewer?.id !== author.id;
  if (!allowed || !viewer) return { canSubscribe: allowed, isSubscribed: false };
  const subscription = await db.authorSubscription.findUnique({
    where: { subscriberId_authorId: { subscriberId: viewer.id, authorId: author.id } },
    select: { id: true },
  });
  return { canSubscribe: true, isSubscribed: subscription !== null };
}

export async function mySubscriptions(db: PrismaClient, viewerId: number) {
  const rows = await db.authorSubscription.findMany({
    where: { subscriberId: viewerId },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    select: {
      createdAt: true,
      author: { select: { username: true, name: true, isActive: true, profile: { select: { bio: true, avatar: true, role: true } } } },
    },
  });
  const telegram = await db.telegramConnection.findUnique({ where: { userId: viewerId }, select: { telegramId: true } });
  return {
    subscriptions: rows.map(({ author, createdAt }) => ({
      username: author.username,
      name: author.name,
      avatar: absoluteMediaUrl(author.profile?.avatar ?? null) ?? DEFAULT_AVATAR,
      bio: author.profile?.bio ?? '',
      isPublishing: author.isActive && author.profile?.role === 'EDITOR',
      subscribedDate: localDateOnly(createdAt),
    })),
    isTelegramConnected: Boolean(telegram?.telegramId.trim()),
  };
}
