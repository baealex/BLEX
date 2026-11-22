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

function relativeTime(stored: string, language: string) {
  const date = new Date(stored.replace(' ', 'T') + 'Z');
  if (!Number.isFinite(date.getTime())) return '';
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

async function notificationList(db: PrismaClient, userId: number, limit = -1, offset = 0) {
  const since = new Date(Date.now() - 180 * 86_400_000).toISOString().slice(0, -1).replace('T', ' ');
  const [config] = await db.$queryRaw<Array<{ language: string | null }>>`SELECT language FROM board_config WHERE user_id = ${userId}`;
  const language = config?.language === 'en' && process.env.ENABLE_ENGLISH_UI === 'TRUE' ? 'en' : 'ko';
  const rows = await db.$queryRaw<Array<{
    id: number; url: string; content: string; key: string; params: string; has_read: number | bigint; date: string;
  }>>`
    SELECT id, url, content, message_key AS key, message_params AS params, has_read, CAST(created_date AS TEXT) AS date
      FROM board_notify WHERE user_id = ${userId} AND (created_date > ${since} OR has_read = 0)
     ORDER BY created_date DESC, id DESC LIMIT ${limit} OFFSET ${offset}
  `;
  return rows.map((row) => ({
    id: row.id, url: row.url, isRead: Boolean(row.has_read),
    content: notificationText(row.key, notificationParams(row.params), row.content, language), createdDate: relativeTime(row.date, language),
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

function markRead(db: PrismaClient, userId: number, input: unknown) {
  const id = typeof input === 'string' && /^\d+$/.test(input) ? Number(input) : input;
  if (typeof id !== 'number' || !Number.isSafeInteger(id) || id < 1) return Promise.resolve(0);
  return db.$executeRaw`UPDATE board_notify SET has_read = 1 WHERE id = ${id} AND user_id = ${userId}`;
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
      const [row] = await db.$queryRaw<Array<{ count: bigint | number }>>`
        SELECT COUNT(*) AS count FROM board_notify WHERE user_id = ${user.id} AND has_read = 0
      `;
      return done({ count: Number(row.count) });
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
