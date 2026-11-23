import { createHash } from 'node:crypto';
import { Prisma, type PrismaClient } from '@prisma/client';
import { publicPostWhere } from '../posts/data/visibility.js';
import { publicPostPath } from '../posts/public-post.js';
import { queuePostWebhooks } from '../integrations/webhooks/delivery.js';

export const notificationPreferences = [
  'NOTIFY_POSTS_LIKE',
  'NOTIFY_POSTS_COMMENT',
  'NOTIFY_COMMENT_LIKE',
  'NOTIFY_MENTION',
] as const;
export type NotificationPreference = (typeof notificationPreferences)[number];
export const notificationPreferenceColumns = {
  NOTIFY_POSTS_LIKE: 'notifyPostLike',
  NOTIFY_POSTS_COMMENT: 'notifyPostComment',
  NOTIFY_COMMENT_LIKE: 'notifyCommentLike',
  NOTIFY_MENTION: 'notifyMention',
} as const satisfies Record<NotificationPreference, keyof Prisma.UserPreferenceSelect>;
export const notificationPreferenceSelect = {
  notifyPostLike: true,
  notifyPostComment: true,
  notifyCommentLike: true,
  notifyMention: true,
} satisfies Prisma.UserPreferenceSelect;
export type NotificationKey =
  | 'post.commented'
  | 'comment.mentioned'
  | 'comment.liked'
  | 'comment.replied'
  | 'post.liked'
  | 'post.published';

interface NotificationInput {
  recipientId: number;
  actor: string;
  url: string;
  title: string;
  key: NotificationKey;
  commentId?: number;
  preference?: NotificationPreference;
  hiddenKey?: string;
}

export function notificationText(key: string, data: Record<string, unknown>, fallback = '', language = 'ko') {
  const { actor, post_title: title, comment_id: comment = '' } = data;
  if (
    typeof actor !== 'string' ||
    typeof title !== 'string' ||
    (typeof comment !== 'number' && typeof comment !== 'string')
  )
    return fallback;
  if (language === 'en')
    return (
      (
        {
          'post.commented': `@${actor} commented on "${title}". #${comment}`,
          'comment.mentioned': `@${actor} mentioned you in "${title}". #${comment}`,
          'comment.liked': `@${actor} liked your comment #${comment} on "${title}".`,
          'comment.replied': `@${actor} replied to your comment on "${title}". #${comment}`,
          'post.liked': `@${actor} liked "${title}".`,
          'post.published': `@${actor} published a new post: "${title}".`,
        } as Record<string, string>
      )[key] ?? fallback
    );
  return (
    (
      {
        'post.commented': `"${title}" 글에 @${actor}님이 댓글을 남겼습니다. #${comment}`,
        'comment.mentioned': `"${title}" 글에서 @${actor}님이 회원님을 태그했습니다. #${comment}`,
        'comment.liked': `"${title}" 글에 작성한 회원님의 #${comment} 댓글을 @${actor}님이 추천했습니다.`,
        'comment.replied': `"${title}" 글에 작성한 회원님의 댓글에 @${actor}님이 답글을 남겼습니다. #${comment}`,
        'post.liked': `"${title}" 글을 @${actor}님이 추천했습니다.`,
        'post.published': `@${actor}님이 새 글을 발행했습니다: "${title}"`,
      } as Record<string, string>
    )[key] ?? fallback
  );
}

export function notificationParams(value: Prisma.JsonValue): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

async function telegramDeliveryEnabled(tx: Prisma.TransactionClient) {
  const settings = await tx.integrationSetting.findUnique({
    where: { id: 1 },
    select: { telegramEnabled: true, telegramBotToken: true },
  });
  return Boolean(settings?.telegramEnabled && settings.telegramBotToken);
}

export async function queueNotification(
  tx: Prisma.TransactionClient,
  notificationId: number,
  userId: number,
  telegramEnabled?: boolean,
) {
  if (!(telegramEnabled ?? (await telegramDeliveryEnabled(tx)))) return;
  const connection = await tx.telegramConnection.findFirst({
    where: { userId, telegramId: { not: '' } },
    select: { userId: true },
  });
  if (!connection) return;
  await tx.notificationDelivery.upsert({
    where: { notificationId },
    create: { notificationId, availableAt: new Date() },
    update: {},
  });
}

export async function createNotification(
  tx: Prisma.TransactionClient,
  input: NotificationInput,
  telegramEnabled?: boolean,
) {
  const user = await tx.user.findFirst({
    where: { id: input.recipientId, isActive: true },
    select: { username: true },
  });
  if (!user || user.username === input.actor) return false;
  if (input.preference) {
    // An unset preference stays off until the recipient turns it on.
    const stored = await tx.userPreference.findUnique({
      where: { userId: input.recipientId },
      select: notificationPreferenceSelect,
    });
    if (stored?.[notificationPreferenceColumns[input.preference]] !== true) return false;
  }
  const data = {
    actor: input.actor,
    ...(input.commentId ? { comment_id: input.commentId } : {}),
    post_title: input.title,
  };
  const payload = JSON.stringify(data);
  const key = createHash('sha256')
    .update(user.username + input.url + `${input.key}:${payload}` + (input.hiddenKey ?? ''))
    .digest('base64');
  const timestamp = new Date();
  let notificationId: number;
  try {
    ({ id: notificationId } = await tx.notification.create({
      data: {
        key,
        userId: input.recipientId,
        url: input.url,
        content: notificationText(input.key, data),
        messageKey: input.key,
        messageParams: data,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
      select: { id: true },
    }));
  } catch (error) {
    // The unique key is the deduplication rule, and SQLite keeps the transaction open after this conflict.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return false;
    throw error;
  }
  await queueNotification(tx, notificationId, input.recipientId, telegramEnabled);
  return true;
}

export async function notifyPostSubscribers(tx: Prisma.TransactionClient, postId: number) {
  const post = await tx.post.findFirst({
    where: { id: postId, ...publicPostWhere(), author: { isActive: true, profile: { role: 'EDITOR' } } },
    select: { authorId: true, title: true, slug: true, author: { select: { username: true } } },
  });
  if (!post) return 0;
  const announcement = { authorId: post.authorId, username: post.author.username, title: post.title, slug: post.slug };
  const { authorId, username, title, slug } = announcement;
  const subscribers = await tx.authorSubscription.findMany({ where: { authorId }, select: { subscriberId: true } });
  if (!subscribers.length) return 0;
  const aliases = await tx.usernameChange.findMany({ where: { userId: authorId }, select: { username: true } });
  const url = publicPostPath(username, slug);
  const priorUrls = [url, ...aliases.map((entry) => publicPostPath(entry.username, slug))];
  const telegramEnabled = await telegramDeliveryEnabled(tx);
  const announced = await tx.notification.findMany({
    where: {
      userId: { in: subscribers.map(({ subscriberId }) => subscriberId) },
      messageKey: 'post.published',
      url: { in: priorUrls },
    },
    select: { userId: true },
  });
  const alreadyNotified = new Set(announced.map(({ userId }) => userId));
  let delivered = 0;
  for (const { subscriberId: subscriber } of subscribers) {
    if (alreadyNotified.has(subscriber)) continue;
    if (
      await createNotification(
        tx,
        {
          recipientId: subscriber,
          actor: username,
          title,
          url,
          key: 'post.published',
          hiddenKey: `post-published:${postId}`,
        },
        telegramEnabled,
      )
    )
      delivered += 1;
  }
  return delivered;
}

/** Keeps the publication queue current. Only a first publication may notify readers and webhooks. */
export async function syncPostPublication(tx: Prisma.TransactionClient, postId: number, { announce = false } = {}) {
  const post = await tx.post.findFirst({
    where: { id: postId, deletedAt: null, isHidden: false },
    select: { publishedAt: true },
  });
  if (post?.publishedAt && post.publishedAt > new Date()) {
    await tx.scheduledPublication.upsert({
      where: { postId },
      create: { postId, publishAt: post.publishedAt },
      update: { publishAt: post.publishedAt },
    });
  } else {
    await tx.scheduledPublication.deleteMany({ where: { postId } });
    if (announce && post?.publishedAt) {
      await notifyPostSubscribers(tx, postId);
      await queuePostWebhooks(tx, postId);
    }
  }
}

export async function processScheduledPublications(db: PrismaClient) {
  const now = new Date();
  await db.$transaction(
    async (tx) => {
      const ready = await tx.scheduledPublication.findMany({
        where: { publishAt: { lte: now } },
        orderBy: { publishAt: 'asc' },
        take: 20,
        select: { postId: true },
      });
      for (const { postId } of ready) await syncPostPublication(tx, postId, { announce: true });
    },
    { timeout: 15_000 },
  );
}
