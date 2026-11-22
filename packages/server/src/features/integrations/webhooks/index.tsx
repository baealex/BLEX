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

interface Channel { id: number; name: string; webhookUrl: string; isActive: number | bigint; failureCount: number | bigint; createdDate: string }
type Scope = 'user' | 'global';

async function channels(db: PrismaClient, scope: Scope, owner: number | null) {
  return db.$queryRaw<Channel[]>`
    SELECT id, name, webhook_url AS webhookUrl, CAST(is_active AS INTEGER) AS isActive,
      CAST(failure_count AS INTEGER) AS failureCount, CAST(created_date AS TEXT) AS createdDate
    FROM board_webhooksubscription WHERE scope = ${scope} AND author_id IS ${owner} ORDER BY created_date DESC, id DESC
  `;
}

async function saveChannel(db: PrismaClient, scope: Scope, owner: number | null, url: string, name: string) {
  return db.$transaction(async (tx) => {
    const [existing] = await tx.$queryRaw<Array<{ id: number }>>`
      UPDATE board_webhooksubscription SET name = COALESCE(NULLIF(${name}, ''), name), is_active = 1, failure_count = 0
       WHERE id = (SELECT id FROM board_webhooksubscription WHERE scope = ${scope} AND author_id IS ${owner}
         AND webhook_url = ${url} ORDER BY id LIMIT 1)
      RETURNING id
    `;
    if (existing) return existing.id;
    const now = new Date().toISOString().slice(0, -1).replace('T', ' ');
    const [created] = await tx.$queryRaw<Array<{ id: number }>>`
      INSERT INTO board_webhooksubscription (name, webhook_url, author_id, scope, is_active, failure_count, created_date)
      VALUES (${name}, ${url}, ${owner}, ${scope}, 1, 0, ${now}) RETURNING id
    `;
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
        const profile = global ? null : await db.board_profile.findUnique({ where: { user_id: user.id }, select: { id: true } });
        if (!global && !profile) return failure('NF');
        const owner = profile?.id ?? null;
        if (request.method === 'GET') {
          return done({ channels: (await channels(db, scope, owner)).map((channel) => ({ ...channel,
            isActive: Boolean(channel.isActive), failureCount: Number(channel.failureCount), createdDate: djangoJsonUtc(channel.createdDate) })) });
        }
        if (!options.validateCsrf(request)) return reply.code(403).send(failure('RJ'));
        const body = formInput(request);
        if (request.method === 'DELETE' || body.action === 'delete') {
          const raw = request.params?.id ?? body.channel_id;
          const id = typeof raw === 'string' && /^\d+$/.test(raw) ? Number(raw) : 0;
          if (!Number.isSafeInteger(id) || id < 1) return failure('NF');
          const removed = await db.$executeRaw`DELETE FROM board_webhooksubscription WHERE id = ${id} AND scope = ${scope} AND author_id IS ${owner}`;
          if (!removed) return failure('NF');
          return done({ success: true });
        }
        const url = typeof body.webhook_url === 'string' ? body.webhook_url.trim() : '';
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
      const url = parseWebhookUrl(formInput(request).webhook_url);
      if (!url) return failure('VA', 'Webhook URL을 확인해 주세요.');
      return done({ success: await test(url) });
    });
  });
}
