import formBody from '@fastify/formbody';
import type { PrismaClient } from '@prisma/client';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { formInput } from '../../../platform/csrf.js';
import { djangoJsonUtc } from '../../../compat/django-format.js';
import { parseWebhookUrl, sendWebhook, type SendWebhook } from './transport.js';
import { done, failure } from '../../../platform/response.js';

interface ChannelOptions {
  currentUser: (request: FastifyRequest) => Promise<{
    id: number; username: string; hasEditorRole: boolean; isStaff: boolean; notifyCount?: number;
  } | null>;
  validateCsrf: (request: FastifyRequest) => boolean;
  siteUrl: URL;
  send?: SendWebhook;
}

type Scope = 'user' | 'global';

async function channels(db: PrismaClient, scope: Scope, owner: number | null) {
  const rows = await db.webhookChannel.findMany({
    where: { scope, ownerId: owner },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    select: { id: true, name: true, url: true, isActive: true, failureCount: true, createdAt: true },
  });
  return rows.map(({ url, createdAt, ...channel }) => ({
    ...channel, webhookUrl: url, createdDate: djangoJsonUtc(createdAt.toISOString()),
  }));
}

async function saveChannel(db: PrismaClient, scope: Scope, owner: number | null, url: string, name: string) {
  return db.$transaction(async (tx) => {
    // SQLite treats NULL owners as distinct, so global channels cannot use the compound unique key here.
    const existing = await tx.webhookChannel.findFirst({ where: { scope, ownerId: owner, url }, orderBy: { id: 'asc' }, select: { id: true } });
    if (existing) {
      await tx.webhookChannel.update({
        where: { id: existing.id },
        data: { ...(name ? { name } : {}), isActive: true, failureCount: 0 },
      });
      return existing.id;
    }
    const created = await tx.webhookChannel.create({ data: { name, url, ownerId: owner, scope, createdAt: new Date() }, select: { id: true } });
    return created.id;
  });
}

export function registerWebhooks(app: FastifyInstance, db: PrismaClient, options: ChannelOptions) {
  const send = options.send ?? sendWebhook;
  let testRequests = 0;
  async function test(url: URL) {
    if (testRequests >= 2) return false;
    testRequests += 1;
    try {
      return await send(url, 'BLEX 웹훅 연결 테스트입니다.', options.siteUrl.origin);
    } finally {
      testRequests -= 1;
    }
  }

  app.register(async (routes) => {
    await routes.register(formBody);
    routes.addHook('onRequest', async (_request, reply) => { reply.header('Cache-Control', 'private, no-store'); });
    for (const scope of ['user', 'global'] as const) {
      const global = scope === 'global';
      const apiPath = `/v1/webhook/${global ? 'global-' : ''}channels`;
      type Params = { Params: { id?: string } };
      const handler = async (request: FastifyRequest<Params>, reply: FastifyReply) => {
        const user = await options.currentUser(request);
        if (!user) return failure('NL');
        if (!(global ? user.isStaff : user.hasEditorRole)) return failure('RJ', global ? 'Administrator access is required.' : 'Author access is required.');
        const owner = global ? null : user.id;
        if (request.method === 'GET') return done({ channels: await channels(db, scope, owner) });
        if (!options.validateCsrf(request)) return reply.code(403).send(failure('RJ'));
        const body = formInput(request);
        if (request.method === 'DELETE' || body.action === 'delete') {
          const raw = request.params?.id ?? body.channelId;
          const id = typeof raw === 'string' && /^\d+$/.test(raw) ? Number(raw) : 0;
          if (!Number.isSafeInteger(id) || id < 1) return failure('NF');
          const { count } = await db.webhookChannel.deleteMany({ where: { id, scope, ownerId: owner } });
          if (!count) return failure('NF');
          return done({ success: true });
        }
        const url = typeof body.webhookUrl === 'string' ? body.webhookUrl.trim() : '';
        if (!parseWebhookUrl(url)) return failure(url ? 'VA' : 'RE', 'Webhook URL을 확인해 주세요.');
        const name = typeof body.name === 'string' ? body.name.trim().slice(0, 100) : '';
        const channelId = await saveChannel(db, scope, owner, url, name);
        return done({ success: true, channelId });
      };
      routes.route<Params>({ method: ['GET', 'POST'], url: apiPath, handler });
      routes.route<Params>({ method: 'DELETE', url: `${apiPath}/:id`, handler });
    }
    routes.post('/v1/webhook/test', async (request, reply) => {
      const user = await options.currentUser(request);
      if (!user) return failure('NL');
      if (!user.hasEditorRole && !user.isStaff) return failure('RJ');
      if (!options.validateCsrf(request)) return reply.code(403).send(failure('RJ'));
      const url = parseWebhookUrl(formInput(request).webhookUrl);
      if (!url) return failure('VA', 'Webhook URL을 확인해 주세요.');
      return done({ success: await test(url) });
    });
  });
}
