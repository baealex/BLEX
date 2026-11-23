import { AsyncLocalStorage } from 'node:async_hooks';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import { defaultUiLocale, resolveUiLocale, type UiLocale } from './locale.js';

const requestLocales = new AsyncLocalStorage<UiLocale>();

export function requestLocale(): UiLocale {
  return requestLocales.getStore() ?? defaultUiLocale();
}

export function registerRequestLocale(
  app: FastifyInstance,
  db: PrismaClient,
  currentUser: (request: FastifyRequest) => Promise<{ id: number } | null>,
): void {
  app.addHook('onRequest', (request, _reply, done) => {
    if (/^\/(?:assets|resources)\//.test(request.url)) return done();
    const resolve = async () => {
      const user = await currentUser(request);
      const preference = user
        ? await db.userPreference.findUnique({ where: { userId: user.id }, select: { language: true } })
        : null;
      return resolveUiLocale(preference?.language);
    };
    void resolve().then((locale) => requestLocales.run(locale, done), done);
  });
}
