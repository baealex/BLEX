import type { FastifyInstance, FastifyRequest } from 'fastify';

// Upload routes buffer files in memory, so these caps bound the memory a burst can claim.
const MAX_ACTIVE_UPLOADS = 8;
const MAX_ACTIVE_UPLOADS_PER_ACCOUNT = 2;
// Developer API routes authenticate their bearer token before they read the body.
const SELF_AUTHENTICATED_PREFIX = '/api/developer/';

function isGuardedUpload(request: FastifyRequest) {
  return request.method !== 'GET'
    && request.headers['content-type']?.toLowerCase().startsWith('multipart/form-data') === true
    && !request.url.startsWith(SELF_AUTHENTICATED_PREFIX);
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
