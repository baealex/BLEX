import { systemMessage } from '../../platform/messages.js';
import formBody from '@fastify/formbody';
import type { PrismaClient } from '@prisma/client';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { formInput } from '../../platform/csrf.js';
import {
  type NotificationPreference,
  notificationParams,
  notificationPreferenceColumns,
  notificationPreferenceSelect,
  notificationPreferences,
  notificationText,
} from './model.js';
import { done, failure } from '../../platform/response.js';
import { resolveUiLocale } from '../../platform/locale.js';

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
  if (seconds >= 31_536_000)
    return new Intl.DateTimeFormat(language, {
      dateStyle: 'long',
      timeZone: process.env.TZ || 'Asia/Seoul',
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
  const config = await db.userPreference.findUnique({ where: { userId }, select: { language: true } });
  const language = resolveUiLocale(config?.language);
  const rows = await db.notification.findMany({
    where: { userId, OR: [{ createdAt: { gt: since } }, { isRead: false }] },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    select: {
      id: true,
      url: true,
      content: true,
      messageKey: true,
      messageParams: true,
      isRead: true,
      createdAt: true,
    },
  });
  return rows.map((row) => ({
    id: row.id,
    url: row.url,
    isRead: row.isRead,
    content: notificationText(row.messageKey, notificationParams(row.messageParams), row.content, language),
    createdDate: relativeTime(row.createdAt, language),
  }));
}

function visiblePreferences(user: NotificationUser) {
  return user.hasEditorRole ? notificationPreferences : notificationPreferences.slice(2);
}

async function readPreferences(db: PrismaClient, user: NotificationUser) {
  const stored = await db.userPreference.findUnique({
    where: { userId: user.id },
    select: notificationPreferenceSelect,
  });
  return visiblePreferences(user).map((name) => ({
    name,
    value: stored?.[notificationPreferenceColumns[name]] ?? null,
  }));
}

async function savePreferences(db: PrismaClient, user: NotificationUser, input: Record<string, unknown>) {
  const changes: Partial<Record<(typeof notificationPreferenceColumns)[NotificationPreference], boolean>> = {};
  for (const name of visiblePreferences(user)) {
    const value = input[name];
    if (value === null || value === undefined || value === '') continue;
    changes[notificationPreferenceColumns[name]] = value === true || value === 'true';
  }
  if (!Object.keys(changes).length) return;
  await db.userPreference.upsert({
    where: { userId: user.id },
    create: { userId: user.id, ...changes },
    update: changes,
    select: { userId: true },
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
    routes.addHook('onRequest', async (_request, reply) => {
      reply.header('Cache-Control', 'private, no-store');
    });
    routes.get('/v1/setting/notify', async (request) => {
      const user = await options.currentUser(request);
      return user
        ? done({ notify: await notificationList(db, user.id), isTelegramSync: user.hasConnectedTelegram })
        : failure('NL');
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
      return (await markRead(db, user.id, formInput(request).id))
        ? done()
        : failure('NF', systemMessage('Notification not found.'));
    });
  });
}
