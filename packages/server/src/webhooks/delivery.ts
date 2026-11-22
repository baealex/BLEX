import type { Prisma, PrismaClient } from '@prisma/client';
import { publicPostPath } from '../posts.js';
import { parseWebhookUrl, sendWebhook, type SendWebhook } from './transport.js';

export async function queuePostWebhooks(tx: Prisma.TransactionClient, postId: number) {
  await tx.$executeRaw`
    INSERT INTO blex_webhook_delivery (post_id, channel_id, available_at)
    SELECT post.id, channel.id, ${BigInt(Date.now() + 2_000)}
      FROM board_post AS post
      LEFT JOIN board_profile AS profile ON profile.user_id = post.author_id
      JOIN board_webhooksubscription AS channel ON channel.is_active = 1 AND (
        channel.scope = 'global' OR (channel.scope = 'user' AND channel.author_id = profile.id)
      ) WHERE post.id = ${postId}
    ON CONFLICT(post_id, channel_id) DO NOTHING
  `;
}

export async function deliverPostWebhook(db: PrismaClient, siteUrl: URL, signal: AbortSignal, send: SendWebhook = sendWebhook) {
  const now = BigInt(Date.now());
  const [job] = await db.$queryRaw<Array<{ postId: number; channelId: number }>>`
    UPDATE blex_webhook_delivery SET available_at = ${now + 120_000n}
     WHERE (post_id, channel_id) = (
       SELECT post_id, channel_id FROM blex_webhook_delivery WHERE done = 0 AND available_at <= ${now}
       ORDER BY available_at, post_id, channel_id LIMIT 1
     ) RETURNING post_id AS postId, channel_id AS channelId
  `;
  if (!job) return false;
  const timestamp = new Date().toISOString().slice(0, -1).replace('T', ' ');
  const [row] = await db.$queryRaw<Array<{ channelUrl: string; title: string; slug: string; username: string; name: string }>>`
    SELECT channel.webhook_url AS channelUrl, post.title, post.url AS slug, author.username, author.first_name AS name
      FROM board_webhooksubscription AS channel JOIN board_post AS post ON post.id = ${job.postId}
      JOIN board_postconfig AS config ON config.post_id = post.id AND config.hide = 0
      JOIN auth_user AS author ON author.id = post.author_id
      LEFT JOIN board_profile AS profile ON profile.user_id = post.author_id
     WHERE channel.id = ${job.channelId} AND channel.is_active = 1 AND (
       channel.scope = 'global' OR (channel.scope = 'user' AND channel.author_id = profile.id AND profile.role = 'EDITOR')
     ) AND post.deleted_date IS NULL AND post.published_date <= ${timestamp}
  `;
  if (signal.aborted) return true;
  const target = row ? parseWebhookUrl(row.channelUrl) : null;
  let sent = false;
  if (row && target) {
    const postUrl = new URL(publicPostPath(row.username, row.slug), siteUrl).href;
    const escape = (value: string) => value.replace(/[\[\]<>\\]/g, '\\$&');
    sent = await send(target, `[${escape(row.name || row.username)}] 새 글을 발행했습니다. [${escape(row.title)}](${postUrl})`, postUrl, signal);
  }
  if (signal.aborted) return true;
  await db.$transaction(async (tx) => {
    await tx.$executeRaw`UPDATE blex_webhook_delivery SET done = 1 WHERE post_id = ${job.postId} AND channel_id = ${job.channelId}`;
    if (row && sent) await tx.$executeRaw`
      UPDATE board_webhooksubscription SET failure_count = 0, last_success_date = ${timestamp} WHERE id = ${job.channelId}
    `;
    else if (row) await tx.$executeRaw`
      UPDATE board_webhooksubscription SET failure_count = failure_count + 1,
        is_active = CASE WHEN failure_count >= 2 THEN 0 ELSE is_active END WHERE id = ${job.channelId}
    `;
  });
  return true;
}
