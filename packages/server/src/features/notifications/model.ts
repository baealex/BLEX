import { createHash } from 'node:crypto';
import { Prisma, type PrismaClient } from '@prisma/client';
import { publicPostPath } from '../posts/public-post.js';
import { queuePostWebhooks } from '../integrations/webhooks/delivery.js';

export const notificationPreferences = ['NOTIFY_POSTS_LIKE', 'NOTIFY_POSTS_COMMENT', 'NOTIFY_COMMENT_LIKE', 'NOTIFY_MENTION'] as const;
export type NotificationPreference = typeof notificationPreferences[number];
export type NotificationKey = 'post.commented' | 'comment.mentioned' | 'comment.liked' | 'comment.replied' | 'post.liked' | 'post.published';

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
  if (typeof actor !== 'string' || typeof title !== 'string' || (typeof comment !== 'number' && typeof comment !== 'string')) return fallback;
  if (language === 'en') return ({
    'post.commented': `@${actor} commented on "${title}". #${comment}`,
    'comment.mentioned': `@${actor} mentioned you in "${title}". #${comment}`,
    'comment.liked': `@${actor} liked your comment #${comment} on "${title}".`,
    'comment.replied': `@${actor} replied to your comment on "${title}". #${comment}`,
    'post.liked': `@${actor} liked "${title}".`,
    'post.published': `@${actor} published a new post: "${title}".`,
  } as Record<string, string>)[key] ?? fallback;
  return ({
    'post.commented': `"${title}" 글에 @${actor}님이 댓글을 남겼습니다. #${comment}`,
    'comment.mentioned': `"${title}" 글에서 @${actor}님이 회원님을 태그했습니다. #${comment}`,
    'comment.liked': `"${title}" 글에 작성한 회원님의 #${comment} 댓글을 @${actor}님이 추천했습니다.`,
    'comment.replied': `"${title}" 글에 작성한 회원님의 댓글에 @${actor}님이 답글을 남겼습니다. #${comment}`,
    'post.liked': `"${title}" 글을 @${actor}님이 추천했습니다.`,
    'post.published': `@${actor}님이 새 글을 발행했습니다: "${title}"`,
  } as Record<string, string>)[key] ?? fallback;
}

export function notificationParams(value: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

async function telegramDeliveryEnabled(tx: Prisma.TransactionClient) {
  const settings = await tx.integrationSetting.findUnique({
    where: { id: 1 },
    select: { telegramEnabled: true, telegramBotToken: true },
  });
  return Boolean(settings?.telegramEnabled && settings.telegramBotToken);
}

export async function queueNotification(tx: Prisma.TransactionClient, notificationId: number, userId: number, telegramEnabled?: boolean) {
  if (!(telegramEnabled ?? await telegramDeliveryEnabled(tx))) return;
  await tx.$executeRaw`
    INSERT INTO blex_notification_delivery (notification_id, available_at)
    SELECT ${notificationId}, ${BigInt(Date.now())}
      FROM board_telegramsync AS link
     WHERE link.user_id = ${userId} AND link.tid <> ''
    ON CONFLICT(notification_id) DO NOTHING
  `;
}

export async function createNotification(tx: Prisma.TransactionClient, input: NotificationInput, telegramEnabled?: boolean) {
  const [user] = await tx.$queryRaw<Array<{ username: string; enabled: string | null }>>`
    SELECT username, (SELECT value FROM board_userconfigmeta WHERE user_id = ${input.recipientId}
      AND name = ${input.preference ?? ''} ORDER BY id LIMIT 1) AS enabled
      FROM auth_user WHERE id = ${input.recipientId} AND is_active = 1
  `;
  if (!user || user.username === input.actor || (input.preference && user.enabled !== 'true')) return false;
  const data = { actor: input.actor, ...(input.commentId ? { comment_id: input.commentId } : {}), post_title: input.title };
  const payload = JSON.stringify(data);
  const key = createHash('sha256').update(user.username + input.url + `${input.key}:${payload}` + (input.hiddenKey ?? '')).digest('base64');
  const timestamp = new Date().toISOString().slice(0, -1).replace('T', ' ');
  const [row] = await tx.$queryRaw<Array<{ id: number }>>`
    INSERT INTO board_notify (key, user_id, url, content, message_key, message_params, created_date, updated_date, has_read)
    VALUES (${key}, ${input.recipientId}, ${input.url}, ${notificationText(input.key, data)}, ${input.key}, ${payload},
            ${timestamp}, ${timestamp}, 0)
    ON CONFLICT(key) DO NOTHING RETURNING id
  `;
  if (!row) return false;
  await queueNotification(tx, row.id, input.recipientId, telegramEnabled);
  return true;
}

export async function notifyPostSubscribers(tx: Prisma.TransactionClient, postId: number) {
  const now = new Date().toISOString().slice(0, -1).replace('T', ' ');
  const subscribers = await tx.$queryRaw<Array<{ subscriber: number; authorId: number; username: string; title: string; slug: string }>>`
    SELECT relation.subscriber_id AS subscriber, author.id AS authorId, author.username, post.title, post.url AS slug
      FROM board_post AS post
      JOIN board_postconfig AS config ON config.post_id = post.id
      JOIN auth_user AS author ON author.id = post.author_id AND author.is_active = 1
      JOIN board_profile AS profile ON profile.user_id = author.id AND profile.role = 'EDITOR'
      JOIN board_authorsubscription AS relation ON relation.author_id = author.id
     WHERE post.id = ${postId} AND post.published_date <= ${now} AND post.deleted_date IS NULL AND config.hide = 0
  `;
  if (!subscribers.length) return 0;
  const { authorId, username, slug } = subscribers[0];
  const aliases = await tx.$queryRaw<Array<{ username: string }>>`
    SELECT username FROM board_usernamechangelog WHERE user_id = ${authorId}
  `;
  const url = publicPostPath(username, slug);
  const priorUrls = [url, ...aliases.map((entry) => publicPostPath(entry.username, slug))];
  const telegramEnabled = await telegramDeliveryEnabled(tx);
  let delivered = 0;
  for (const { subscriber, title } of subscribers) {
    const [earlier] = await tx.$queryRaw<unknown[]>`
      SELECT 1 FROM board_notify WHERE user_id = ${subscriber} AND message_key = 'post.published' AND url IN (${Prisma.join(priorUrls)}) LIMIT 1
    `;
    if (earlier) continue;
    if (await createNotification(tx, {
      recipientId: subscriber, actor: username, title, url, key: 'post.published', hiddenKey: `post-published:${postId}`,
    }, telegramEnabled)) delivered += 1;
  }
  return delivered;
}

/** Keeps the publication queue current. Only a first publication may notify readers and webhooks. */
export async function syncPostPublication(tx: Prisma.TransactionClient, postId: number, { announce = false } = {}) {
  const now = new Date().toISOString().slice(0, -1).replace('T', ' ');
  const [post] = await tx.$queryRaw<Array<{ published: string | null }>>`
    SELECT CAST(post.published_date AS TEXT) AS published FROM board_post AS post
      JOIN board_postconfig AS config ON config.post_id = post.id
     WHERE post.id = ${postId} AND post.deleted_date IS NULL AND config.hide = 0
  `;
  if (post?.published && post.published > now) {
    await tx.$executeRaw`
      INSERT INTO blex_scheduled_publication (post_id, publish_at) VALUES (${postId}, ${post.published})
      ON CONFLICT(post_id) DO UPDATE SET publish_at = excluded.publish_at
    `;
  } else {
    await tx.$executeRaw`DELETE FROM blex_scheduled_publication WHERE post_id = ${postId}`;
    if (announce && post?.published) {
      await notifyPostSubscribers(tx, postId);
      await queuePostWebhooks(tx, postId);
    }
  }
}

export async function processScheduledPublications(db: PrismaClient) {
  const now = new Date().toISOString().slice(0, -1).replace('T', ' ');
  await db.$transaction(async (tx) => {
    const ready = await tx.$queryRaw<Array<{ id: number }>>`
      SELECT post_id AS id FROM blex_scheduled_publication WHERE publish_at <= ${now} ORDER BY publish_at LIMIT 20
    `;
    for (const { id } of ready) await syncPostPublication(tx, id, { announce: true });
  }, { timeout: 15_000 });
}
