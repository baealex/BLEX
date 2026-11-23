import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { failure } from '../../platform/response.js';

// Upload routes buffer files in memory, so these caps bound the memory a burst can claim.
const MAX_ACTIVE_UPLOADS = 8;
const MAX_ACTIVE_UPLOADS_PER_ACCOUNT = 2;
const DEFAULT_NON_MULTIPART_BYTES = 8 * 1024;
// Developer API routes authenticate their bearer token before they read the body.
const SELF_AUTHENTICATED_PREFIX = '/api/developer/';

function isMultipart(request: FastifyRequest) {
  return request.headers['content-type']?.toLowerCase().startsWith('multipart/form-data') === true;
}

function isGuardedUpload(request: FastifyRequest) {
  return request.method !== 'GET' && isMultipart(request) && !request.url.startsWith(SELF_AUTHENTICATED_PREFIX);
}

/**
 * A route's large body limit exists for files. Other content types are parsed before the handler can check the
 * session, so this hook holds them to a small size.
 */
export function limitNonMultipartBody(maxBytes = DEFAULT_NON_MULTIPART_BYTES) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (isMultipart(request)) return;
    const declared = Number(request.headers['content-length'] ?? 0);
    if (!request.headers['transfer-encoding'] && declared <= maxBytes) return;
    return reply.code(413).header('Connection', 'close').send(failure('VA', 'Upload files as multipart form data.'));
  };
}

/** Rejects uploads before Fastify reads the body, because form CSRF tokens live inside that body. */
export function registerUploadGuard(
  app: FastifyInstance,
  currentUser: (request: FastifyRequest) => Promise<{ id: number } | null>,
) {
  const activeByAccount = new Map<number, number>();
  const holders = new WeakMap<FastifyRequest, number>();
  let active = 0;

  const release = async (request: FastifyRequest) => {
    const account = holders.get(request);
    if (account === undefined) return;
    holders.delete(request);
    active -= 1;
    const remaining = (activeByAccount.get(account) ?? 1) - 1;
    if (remaining) activeByAccount.set(account, remaining);
    else activeByAccount.delete(account);
  };

  app.addHook('onRequest', async (request, reply) => {
    if (!isGuardedUpload(request)) return;
    const user = await currentUser(request);
    if (!user) {
      reply.header('Connection', 'close');
      if (request.headers.accept?.includes('text/html')) {
        return reply.redirect(`/login?${new URLSearchParams({ next: request.url })}`, 303);
      }
      return reply.code(403).type('text/plain; charset=utf-8').send('Sign in before uploading files.');
    }
    if (active >= MAX_ACTIVE_UPLOADS || (activeByAccount.get(user.id) ?? 0) >= MAX_ACTIVE_UPLOADS_PER_ACCOUNT) {
      return reply.code(429).header('Connection', 'close').header('Retry-After', '5')
        .type('text/plain; charset=utf-8').send('Other uploads are in progress. Try again in a moment.');
    }
    active += 1;
    activeByAccount.set(user.id, (activeByAccount.get(user.id) ?? 0) + 1);
    holders.set(request, user.id);
  });
  app.addHook('onResponse', release);
  app.addHook('onRequestAbort', release);
}
