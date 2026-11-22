import { type PrismaClient } from '@prisma/client';
import { ActiveUserRow, AuthorRow, DEFAULT_AVATAR, DbDate, DbInteger, absoluteMediaUrl, isTrue, localDateOnly } from '../shared.js';

interface SubscriptionRow {
  id: number;
  username: string;
  firstName: string;
  bio: string | null;
  avatar: string | null;
  isActive: DbInteger;
  profileRole: string | null;
  createdDate: DbDate;
}

export function canSubscribe(author: AuthorRow): boolean {
  return isTrue(author.isActive) && author.profileRole === 'EDITOR';
}

export async function subscriptionState(
  db: PrismaClient,
  viewer: ActiveUserRow | null,
  author: AuthorRow,
): Promise<{ canSubscribe: boolean; isSubscribed: boolean }> {
  const allowed = canSubscribe(author) && viewer?.id !== author.id;
  if (!allowed || !viewer) return { canSubscribe: allowed, isSubscribed: false };
  const rows = await db.$queryRaw<Array<{ present: DbInteger }>>`
    SELECT EXISTS (
      SELECT 1 FROM board_authorsubscription
      WHERE subscriber_id = ${viewer.id} AND author_id = ${author.id}
    ) AS present
  `;
  return { canSubscribe: true, isSubscribed: isTrue(rows[0]?.present ?? 0) };
}

export async function mySubscriptions(db: PrismaClient, viewerId: number) {
  const rows = await db.$queryRaw<SubscriptionRow[]>`
    SELECT subscription.id AS id,
           author.username AS username,
           author.first_name AS firstName,
           profile.bio AS bio,
           profile.avatar AS avatar,
           CAST(author.is_active AS INTEGER) AS isActive,
           profile.role AS profileRole,
           CAST(subscription.created_date AS TEXT) AS createdDate
    FROM board_authorsubscription AS subscription
    JOIN auth_user AS author ON author.id = subscription.author_id
    LEFT JOIN board_profile AS profile ON profile.user_id = author.id
    WHERE subscription.subscriber_id = ${viewerId}
    ORDER BY subscription.created_date DESC, subscription.id DESC
  `;
  const telegram = await db.telegramConnection.findUnique({ where: { userId: viewerId }, select: { telegramId: true } });
  return {
    subscriptions: rows.map((row) => ({
      username: row.username,
      name: row.firstName,
      avatar: absoluteMediaUrl(row.avatar) ?? DEFAULT_AVATAR,
      bio: row.bio ?? '',
      isPublishing: isTrue(row.isActive) && row.profileRole === 'EDITOR',
      subscribedDate: localDateOnly(row.createdDate),
    })),
    isTelegramConnected: Boolean(telegram?.telegramId.trim()),
  };
}
