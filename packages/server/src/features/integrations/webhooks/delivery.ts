import type { Prisma, PrismaClient } from '@prisma/client';
import { publicPostPath } from '../../posts/public-post.js';
import { parseWebhookUrl, sendWebhook, type SendWebhook } from './transport.js';

const claimLeaseMs = 120_000;
const maxFailures = 3;

export async function queuePostWebhooks(tx: Prisma.TransactionClient, postId: number) {
  const post = await tx.post.findUnique({ where: { id: postId }, select: { authorId: true } });
  if (!post) return;
  const channels = await tx.webhookChannel.findMany({
    where: { isActive: true, OR: [{ scope: 'global' }, { scope: 'user', ownerId: post.authorId }] },
    select: { id: true },
  });
  const availableAt = new Date(Date.now() + 2_000);
  // An existing row keeps its state, so a post that is published again is never delivered twice.
  for (const { id: channelId } of channels) {
    await tx.webhookDelivery.upsert({
      where: { postId_channelId: { postId, channelId } },
      create: { postId, channelId, availableAt },
      update: {},
    });
  }
}

/** Takes the oldest due job. The guarded update lets only one worker win, and a loser moves on to the next job. */
async function claimDelivery(db: PrismaClient) {
  const now = new Date();
  for (;;) {
    const next = await db.webhookDelivery.findFirst({
      where: { isDone: false, availableAt: { lte: now } },
      orderBy: [{ availableAt: 'asc' }, { postId: 'asc' }, { channelId: 'asc' }],
      select: { postId: true, channelId: true },
    });
    if (!next) return null;
    const { count } = await db.webhookDelivery.updateMany({
      where: { ...next, isDone: false, availableAt: { lte: now } },
      data: { availableAt: new Date(now.getTime() + claimLeaseMs) },
    });
    if (count) return next;
  }
}

export async function deliverPostWebhook(db: PrismaClient, siteUrl: URL, signal: AbortSignal, send: SendWebhook = sendWebhook) {
  const job = await claimDelivery(db);
  if (!job) return false;
  const sentAt = new Date();
  const timestamp = sentAt.toISOString().slice(0, -1).replace('T', ' ');
  const channel = await db.webhookChannel.findFirst({
    where: { id: job.channelId, isActive: true },
    select: { url: true, scope: true, ownerId: true },
  });
  const [post] = channel ? await db.$queryRaw<Array<{
    authorId: number; title: string; slug: string; username: string; name: string; role: string | null;
  }>>`
    SELECT post.author_id AS authorId, post.title, post.url AS slug, author.username, author.first_name AS name, profile.role
      FROM board_post AS post
      JOIN board_postconfig AS config ON config.post_id = post.id AND config.hide = 0
      JOIN auth_user AS author ON author.id = post.author_id
      LEFT JOIN board_profile AS profile ON profile.user_id = post.author_id
     WHERE post.id = ${job.postId} AND post.deleted_date IS NULL AND post.published_date <= ${timestamp}
  ` : [];
  const row = channel && post && (channel.scope === 'global' || (channel.ownerId === post.authorId && post.role === 'EDITOR'))
    ? { ...post, channelUrl: channel.url }
    : null;
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
    await tx.webhookDelivery.updateMany({ where: job, data: { isDone: true } });
    // updateMany tolerates a channel that was removed while the request was in flight.
    if (row && sent) {
      await tx.webhookChannel.updateMany({ where: { id: job.channelId }, data: { failureCount: 0, lastSuccessAt: sentAt } });
    } else if (row) {
      await tx.webhookChannel.updateMany({ where: { id: job.channelId }, data: { failureCount: { increment: 1 } } });
      await tx.webhookChannel.updateMany({ where: { id: job.channelId, failureCount: { gte: maxFailures } }, data: { isActive: false } });
    }
  });
  return true;
}
