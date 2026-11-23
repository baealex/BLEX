import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { failure } from './response.js';

declare module 'fastify' {
  interface FastifyContextConfig {
    /** Who may send a body above the default limit. Any signed-in account when unset. */
    bodyAccess?: 'author' | 'token' | 'public';
    /** The largest multipart request, when the route accepts more than its `bodyLimit`. */
    multipartLimit?: number;
  }
}

export const DEFAULT_BODY_LIMIT = 8 * 1024;
const DEFAULT_MULTIPART_LIMIT = 64 * 1024;
// Bodies are buffered in memory, so these budgets bound what unfinished requests can claim.
const MAX_BUFFERED_BYTES = 160 * 1024 * 1024;
const MAX_BUFFERED_BYTES_PER_ACCOUNT = 40 * 1024 * 1024;
const MAX_UPLOADS_PER_ACCOUNT = 2;
const BODYLESS_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

interface BodyGuardOptions {
  currentUser: (request: FastifyRequest) => Promise<{ id: number; hasEditorRole: boolean; isStaff: boolean } | null>;
  /** Resolves a write token's account. On null, a sent reply ends the request; otherwise its handler answers. */
  tokenAccount: (request: FastifyRequest, reply: FastifyReply) => Promise<number | null>;
}

export function isMultipart(request: FastifyRequest) {
  return request.headers['content-type']?.toLowerCase().startsWith('multipart/form-data') === true;
}

function refuse(reply: FastifyReply, status: number, message: string) {
  return reply.code(status).header('Connection', 'close').send(failure('VA', message));
}

/** Checks who is sending a large body before Fastify reads it, as multipart CSRF tokens live inside that body. */
export function registerBodyGuard(app: FastifyInstance, { currentUser, tokenAccount }: BodyGuardOptions) {
  const bufferedByAccount = new Map<number, number>();
  const uploadsByAccount = new Map<number, number>();
  const holders = new WeakMap<FastifyRequest, { account: number; bytes: number; upload: boolean }>();
  let buffered = 0;

  const release = async (request: FastifyRequest) => {
    const holder = holders.get(request);
    if (!holder) return;
    holders.delete(request);
    buffered -= holder.bytes;
    const remaining = (bufferedByAccount.get(holder.account) ?? holder.bytes) - holder.bytes;
    if (remaining > 0) bufferedByAccount.set(holder.account, remaining);
    else bufferedByAccount.delete(holder.account);
    if (!holder.upload) return;
    const uploads = (uploadsByAccount.get(holder.account) ?? 1) - 1;
    if (uploads) uploadsByAccount.set(holder.account, uploads);
    else uploadsByAccount.delete(holder.account);
  };

  app.addHook('onRequest', async (request, reply) => {
    if (BODYLESS_METHODS.has(request.method)) return;
    const { config, bodyLimit = DEFAULT_BODY_LIMIT } = request.routeOptions;
    const multipart = isMultipart(request);
    if (config?.bodyAccess === 'public' || (!multipart && bodyLimit <= DEFAULT_BODY_LIMIT)) return;
    if (request.headers['transfer-encoding']) return refuse(reply, 411, 'Send this request with a Content-Length header.');
    const size = Number(request.headers['content-length'] ?? 0);
    // Fastify refuses an oversized declared length itself, before reading the body.
    if (!multipart && (size <= DEFAULT_BODY_LIMIT || size > bodyLimit)) return;

    let account: number;
    if (config?.bodyAccess === 'token') {
      const tokenUser = await tokenAccount(request, reply);
      if (tokenUser === null) return reply.sent ? reply : undefined;
      account = tokenUser;
    } else {
      const user = await currentUser(request);
      if (!user && multipart) {
        reply.header('Connection', 'close');
        if (request.headers.accept?.includes('text/html')) {
          return reply.redirect(`/login?${new URLSearchParams({ next: request.url })}`, 303);
        }
        return reply.code(403).type('text/plain; charset=utf-8').send('Sign in before uploading files.');
      }
      if (!user) return reply.header('Connection', 'close').send(failure('NL', 'Login required.'));
      if (!multipart && config?.bodyAccess === 'author' && !user.hasEditorRole && !user.isStaff) {
        return reply.header('Connection', 'close').send(failure('RJ', 'Author access is required.'));
      }
      account = user.id;
    }

    if (request.is404) return;
    if (multipart && size > (config?.multipartLimit ?? Math.max(bodyLimit, DEFAULT_MULTIPART_LIMIT))) {
      return refuse(reply, 413, 'This request is too large.');
    }
    // An idle server always accepts one request, so a configured upload limit above a budget still works.
    const accountBytes = bufferedByAccount.get(account) ?? 0;
    const accountUploads = uploadsByAccount.get(account) ?? 0;
    if ((multipart && accountUploads >= MAX_UPLOADS_PER_ACCOUNT)
      || (accountBytes && accountBytes + size > MAX_BUFFERED_BYTES_PER_ACCOUNT)
      || (buffered && buffered + size > MAX_BUFFERED_BYTES)) {
      return reply.code(429).header('Connection', 'close').header('Retry-After', '5')
        .type('text/plain; charset=utf-8').send('Other uploads are in progress. Try again in a moment.');
    }
    buffered += size;
    bufferedByAccount.set(account, accountBytes + size);
    if (multipart) uploadsByAccount.set(account, accountUploads + 1);
    holders.set(request, { account, bytes: size, upload: multipart });
  });
  app.addHook('onResponse', release);
  app.addHook('onRequestAbort', release);
}
