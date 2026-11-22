import type { PrismaClient } from '@prisma/client';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { readFileSync } from 'node:fs';

const koreanMessages = JSON.parse(
  readFileSync(new URL('../../../data/api-messages.ko.json', import.meta.url), 'utf8'),
) as Record<string, string>;
const separators = /(?<=[^\-_])[\-_]+[^\-_]/g;
const loginMessages = new Set(['', 'Login required.', 'Log in to continue.']);
// These 3.x views reported a missing session without a message.
const silentLoginPaths = /^\/v1\/(?:setting\/(?!trash-posts)|subscriptions|global-(?:banners|notices)|admin\/|site-settings|login-settings|integration-settings|static-pages|utilities)/;

const isUpper = (value: string) => value === value.toUpperCase() && value !== value.toLowerCase();

/** Applies the key conversion every 3.x `/v1` response went through. */
export function camelizeKey(key: string): string {
  if (isUpper(key) || /^\p{N}+$/u.test(key)) return key;
  const start = key.length && !isUpper(key.slice(0, 2)) ? key[0].toLowerCase() + key.slice(1) : key;
  return start.replace(separators, (match) => match.at(-1)!.toUpperCase());
}

export function camelizeKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(camelizeKeys);
  if (value === null || typeof value !== 'object' || value instanceof Date) return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [camelizeKey(key), camelizeKeys(item)]));
}

async function prefersEnglish(request: FastifyRequest, db: PrismaClient, currentUser: LegacyApiOptions['currentUser']) {
  if (process.env.ENABLE_ENGLISH_UI !== 'TRUE' && process.env.DEBUG !== 'TRUE') return false;
  const user = await currentUser(request);
  if (!user) return false;
  const [config] = await db.$queryRaw<Array<{ language: string | null }>>`
    SELECT language FROM board_config WHERE user_id = ${user.id} LIMIT 1
  `;
  return config?.language === 'en';
}

export interface LegacyApiOptions {
  currentUser(request: FastifyRequest): Promise<{ id: number } | null>;
}

export function registerLegacyApiContract(app: FastifyInstance, db: PrismaClient, options: LegacyApiOptions) {
  app.addHook('preSerialization', async (request, _reply, payload) => {
    if (!request.url.startsWith('/v1/') || payload === null || typeof payload !== 'object' || Array.isArray(payload)) return payload;
    const { status } = payload as { status?: unknown };
    if (status !== 'DONE' && status !== 'ERROR') return payload;
    const body = camelizeKeys(payload) as Record<string, unknown>;
    if (body.errorCode === 'error:NL' && loginMessages.has(String(body.errorMessage ?? ''))) {
      body.errorMessage = silentLoginPaths.test(request.url) ? '' : 'Login required.';
    }
    if (status === 'ERROR' && typeof body.errorMessage === 'string' && koreanMessages[body.errorMessage]
      && !await prefersEnglish(request, db, options.currentUser)) {
      body.errorMessage = koreanMessages[body.errorMessage];
    }
    const result = body.body as { message?: unknown } | undefined;
    if (status === 'DONE' && typeof result?.message === 'string' && koreanMessages[result.message]
      && !await prefersEnglish(request, db, options.currentUser)) {
      result.message = koreanMessages[result.message];
    }
    return body;
  });
}
