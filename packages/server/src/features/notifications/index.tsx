import formBody from '@fastify/formbody';
import type { PrismaClient } from '@prisma/client';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { formInput } from '../../platform/csrf.js';
import { notificationParams, notificationPreferences, notificationText } from './model.js';
import { done, failure } from '../../platform/response.js';

interface NotificationUser {
  id: number;
  username: string;
  hasEditorRole: boolean;
  isStaff?: boolean;
  hasConnectedTelegram: boolean;
  notifyCount?: number;
}
interface NotificationOptions {
  currentUser: (request: FastifyRequest) => Promise<NotificationUser | null>;
  validateCsrf: (request: FastifyRequest) => boolean;
  siteUrl: URL;
}

function relativeTime(date: Date, language: string) {
  const seconds = Math.max(0, (Date.now() - date.getTime()) / 1_000);
  if (seconds >= 31_536_000) return new Intl.DateTimeFormat(language, {
    dateStyle: 'long', timeZone: process.env.TZ || 'Asia/Seoul',
  }).format(date);
  const format = new Intl.RelativeTimeFormat(language, { numeric: 'always' });
  if (seconds >= 2_592_000) return format.format(-Math.floor(seconds / 2_592_000), 'month');
  if (seconds >= 604_800) return format.format(-Math.floor(seconds / 604_800), 'week');
  if (seconds >= 86_400) return format.format(-Math.floor(seconds / 86_400), 'day');
  if (seconds >= 3_600) return format.format(-Math.floor(seconds / 3_600), 'hour');
  return format.format(-Math.floor(seconds / 60), 'minute');
}

async function notificationList(db: PrismaClient, userId: number) {
  const since = new Date(Date.now() - 180 * 86_400_000);
  const [config] = await db.$queryRaw<Array<{ language: string | null }>>`SELECT language FROM board_config WHERE user_id = ${userId}`;
  const language = config?.language === 'en' && process.env.ENABLE_ENGLISH_UI === 'TRUE' ? 'en' : 'ko';
  const rows = await db.notification.findMany({
    where: { userId, OR: [{ createdAt: { gt: since } }, { isRead: false }] },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    select: { id: true, url: true, content: true, messageKey: true, messageParams: true, isRead: true, createdAt: true },
  });
  return rows.map((row) => ({
    id: row.id, url: row.url, isRead: row.isRead,
    content: notificationText(row.messageKey, notificationParams(row.messageParams), row.content, language),
    createdDate: relativeTime(row.createdAt, language),
  }));
}

function visiblePreferences(user: NotificationUser) {
  return user.hasEditorRole ? notificationPreferences : notificationPreferences.slice(2);
}

async function readPreferences(db: PrismaClient, user: NotificationUser) {
  const existing = await db.$queryRaw<Array<{ name: string; value: string }>>`
    SELECT name, value FROM board_userconfigmeta WHERE user_id = ${user.id} ORDER BY id
  `;
  return visiblePreferences(user).map((name) => {
    const item = existing.find((preference) => preference.name === name);
    return { name, value: item ? item.value === 'true' : null };
  });
}

async function savePreferences(db: PrismaClient, user: NotificationUser, input: Record<string, unknown>) {
  const timestamp = new Date().toISOString().slice(0, -1).replace('T', ' ');
  await db.$transaction(async (tx) => {
    for (const name of visiblePreferences(user)) {
      const value = input[name];
      if (value === null || value === undefined || value === '') continue;
      const normalized = value === true || value === 'true' ? 'true' : 'false';
      const updated = await tx.$executeRaw`
        UPDATE board_userconfigmeta SET value = ${normalized} WHERE user_id = ${user.id} AND name = ${name}
      `;
      if (!updated) await tx.$executeRaw`
        INSERT INTO board_userconfigmeta (user_id, name, value, created_date, updated_date)
        VALUES (${user.id}, ${name}, ${normalized}, ${timestamp}, ${timestamp})
      `;
    }
  });
}

async function markRead(db: PrismaClient, userId: number, input: unknown) {
  const id = typeof input === 'string' && /^\d+$/.test(input) ? Number(input) : input;
  if (typeof id !== 'number' || !Number.isSafeInteger(id) || id < 1) return 0;
  const { count } = await db.notification.updateMany({ where: { id, userId }, data: { isRead: true } });
  return count;
}

export function registerNotifications(app: FastifyInstance, db: PrismaClient, options: NotificationOptions) {
  app.register(async (routes) => {
    await routes.register(formBody);
    routes.addHook('onRequest', async (_request, reply) => { reply.header('Cache-Control', 'private, no-store'); });
    routes.get('/v1/setting/notify', async (request) => {
      const user = await options.currentUser(request);
      return user ? done({ notify: await notificationList(db, user.id), isTelegramSync: user.hasConnectedTelegram }) : failure('NL');
    });
    routes.get('/v1/setting/unread-notify', async (request) => {
      const user = await options.currentUser(request);
      if (!user) return failure('NL');
      return done({ count: await db.notification.count({ where: { userId: user.id, isRead: false } }) });
    });
    routes.get('/v1/setting/notify-config', async (request) => {
      const user = await options.currentUser(request);
      return user ? done({ config: await readPreferences(db, user) }) : failure('NL');
    });
    routes.put('/v1/setting/notify-config', async (request, reply) => {
      const user = await options.currentUser(request);
      if (!user) return failure('NL');
      if (!options.validateCsrf(request)) return reply.code(403).send(failure('RJ'));
      await savePreferences(db, user, formInput(request));
      return done();
    });
    routes.put('/v1/setting/notify', async (request, reply) => {
      const user = await options.currentUser(request);
      if (!user) return failure('NL');
      if (!options.validateCsrf(request)) return reply.code(403).send(failure('RJ'));
      return (await markRead(db, user.id, formInput(request).id)) ? done() : failure('NF', '알림을 찾을 수 없습니다.');
    });
  });
}
