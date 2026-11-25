import { AsyncLocalStorage } from 'node:async_hooks';
import type { FastifyInstance } from 'fastify';

const returnPaths = new AsyncLocalStorage<string>();

/** Where signing in from the page being answered returns to, or nothing outside a request. */
export function requestReturnPath(): string | undefined {
  return returnPaths.getStore();
}

/**
 * Keeps each request's path for the site header's sign-in link. `toReturnPath` is the sign-in page's own check of
 * `next`, so the link never carries a path that page would refuse.
 */
export function registerRequestReturnPath(app: FastifyInstance, toReturnPath: (url: string) => string): void {
  app.addHook('onRequest', (request, _reply, done) => {
    if (/^\/(?:assets|resources)\//.test(request.url)) return done();
    returnPaths.run(toReturnPath(request.url), done);
  });
}
