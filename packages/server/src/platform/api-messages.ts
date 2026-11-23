import type { PrismaClient } from '@prisma/client';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { readFileSync } from 'node:fs';
import { resolveUiLocale } from './locale.js';

const koreanMessages = JSON.parse(
  readFileSync(new URL('../../../data/api-messages.ko.json', import.meta.url), 'utf8'),
) as Record<string, string>;
const loginMessages = new Set(['', 'Login required.', 'Log in to continue.']);
// These endpoints use an empty message for a missing session.
const silentLoginPaths =
  /^\/v1\/(?:setting\/(?!trash-posts)|subscriptions|global-(?:banners|notices)|admin\/|site-settings|login-settings|integration-settings|static-pages|utilities)/;

async function prefersEnglish(
  request: FastifyRequest,
  db: PrismaClient,
  currentUser: ApiMessageOptions['currentUser'],
) {
  const user = await currentUser(request);
  const config = user
    ? await db.userPreference.findUnique({ where: { userId: user.id }, select: { language: true } })
    : null;
  return resolveUiLocale(config?.language) === 'en';
}

export interface ApiMessageOptions {
  currentUser(request: FastifyRequest): Promise<{ id: number } | null>;
}

/** Applies the reader's language and the login wording to `/v1` status messages. */
export function registerApiMessages(app: FastifyInstance, db: PrismaClient, options: ApiMessageOptions) {
  app.addHook('preSerialization', async (request, _reply, payload) => {
    if (!request.url.startsWith('/v1/') || payload === null || typeof payload !== 'object' || Array.isArray(payload))
      return payload;
    const { status } = payload as { status?: unknown };
    if (status !== 'DONE' && status !== 'ERROR') return payload;
    // Handlers may reuse a response object, so translations are written to a copy.
    const response = { ...payload } as Record<string, unknown>;
    if (response.errorCode === 'error:NL' && loginMessages.has(String(response.errorMessage ?? ''))) {
      response.errorMessage = silentLoginPaths.test(request.url) ? '' : 'Login required.';
    }
    if (
      status === 'ERROR' &&
      typeof response.errorMessage === 'string' &&
      koreanMessages[response.errorMessage] &&
      !(await prefersEnglish(request, db, options.currentUser))
    ) {
      response.errorMessage = koreanMessages[response.errorMessage];
    }
    const result = response.body as { message?: unknown } | undefined;
    if (
      status === 'DONE' &&
      typeof result?.message === 'string' &&
      koreanMessages[result.message] &&
      !(await prefersEnglish(request, db, options.currentUser))
    ) {
      response.body = { ...result, message: koreanMessages[result.message] };
    }
    return response;
  });
}
