import formBody from '@fastify/formbody';
import type { PrismaClient } from '@prisma/client';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { formInput } from '../../platform/csrf.js';
import { markdownToHtml } from './authoring/markdown.js';
import { isoLocalMillis } from '../../platform/date-format.js';
import { sanitizePostHtml } from './post-html.js';
import { done, failure } from '../../platform/response.js';

interface FormViewer {
  id: number;
  username?: string;
  hasEditorRole: boolean;
  isStaff?: boolean;
  notifyCount?: number;
  hasConnectedTelegram?: boolean;
}

interface FormOptions {
  currentUser: (request: FastifyRequest) => Promise<FormViewer | null>;
  validateCsrf: (request: FastifyRequest) => boolean;
  siteUrl: URL;
}

const bodyLimit = 1024 * 1024;

export function registerAuthorForms(app: FastifyInstance, db: PrismaClient, options: FormOptions) {
  app.register(async (routes) => {
    await routes.register(formBody);
    routes.addHook('onRequest', async (_request, reply) => { reply.header('Cache-Control', 'private, no-store'); });
    const handle = async (request: FastifyRequest<{ Params: { id?: string } }>, reply: FastifyReply) => {
      const editor = await options.currentUser(request);
      if (!editor) return failure('NL');
      if (!editor.hasEditorRole) return failure('RJ', 'Author access is required.');
      const input = formInput(request);
      const rawId = request.params?.id;
      const id = typeof rawId === 'string' && /^\d+$/.test(rawId) ? Number(rawId) : undefined;
      if (rawId !== undefined && (!id || !Number.isSafeInteger(id))) return reply.code(404).send('Not found');
      const selected = id
        ? await db.formTemplate.findFirst({ where: { id, userId: editor.id }, select: { id: true, title: true, content: true } })
        : null;
      if (id && !selected) return reply.code(404).send('Not found');
      const forms = () => db.formTemplate.findMany({
        where: { userId: editor.id },
        orderBy: { id: 'asc' },
        select: { id: true, title: true, createdAt: true },
      });
      if (request.method === 'GET') {
        if (selected) return done(selected);
        return done({ forms: (await forms()).map(({ id, title, createdAt }) => ({ id, title, createdDate: isoLocalMillis(createdAt) })) });
      }
      if (!options.validateCsrf(request)) return reply.code(403).send(failure('RJ'));
      if (request.method === 'DELETE' || input.action === 'delete') {
        if (!id) return reply.code(404).send('Not found');
        await db.formTemplate.deleteMany({ where: { id, userId: editor.id } });
      } else {
        const title = input.title ?? '';
        const content = input.content ?? '';
        if (typeof title !== 'string' || title.length > 50 || typeof content !== 'string') {
          return failure('IP', '글 양식을 확인해 주세요.');
        }
        if (id) await db.formTemplate.updateMany({ where: { id, userId: editor.id }, data: { title, content } });
        else return done(await db.formTemplate.create({ data: { title, content, userId: editor.id }, select: { id: true } }));
      }
      return done();
    };
    type Request = { Params: { id?: string } };
    routes.route<Request>({ method: ['GET', 'POST'], url: '/v1/forms', bodyLimit, handler: handle });
    routes.route<Request>({ method: ['GET', 'PUT', 'DELETE'], url: '/v1/forms/:id', bodyLimit, handler: handle });
    routes.post('/v1/markdown', { bodyLimit }, async (request, reply) => {
      const editor = await options.currentUser(request);
      if (!editor) return failure('NL');
      if (!editor.hasEditorRole) return failure('RJ', 'Author access is required.');
      if (!options.validateCsrf(request)) return reply.code(403).send(failure('RJ'));
      const { text, sourceType } = formInput(request);
      return typeof text === 'string' && text ? done({ html: sourceType === 'html' ? sanitizePostHtml(text) : markdownToHtml(text) }) :
        failure('IP', '텍스트가 비어 있습니다.');
    });
  });
}
