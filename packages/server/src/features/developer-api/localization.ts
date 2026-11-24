import type { PrismaClient } from '@prisma/client';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { readFileSync } from 'node:fs';
import { resolveUiLocale } from '../../platform/locale.js';
import { developerText, hasDeveloperText, type DeveloperLocale } from './messages.js';

const serverKorean = JSON.parse(
  readFileSync(new URL('../../../../data/api-messages.ko.json', import.meta.url), 'utf8'),
) as Record<string, string>;
const serverEnglish = new Map(Object.entries(serverKorean).map(([english, korean]) => [korean, english]));

export async function readDeveloperLocale(
  db: PrismaClient,
  _request: FastifyRequest,
  userId?: number,
): Promise<DeveloperLocale> {
  const preference =
    userId === undefined ? null : await db.userPreference.findUnique({ where: { userId }, select: { language: true } });
  return resolveUiLocale(preference?.language);
}

export function developerLanguageHeaders(reply: FastifyReply, locale: DeveloperLocale) {
  const vary = new Set(
    String(reply.getHeader('Vary') ?? '')
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean),
  );
  for (const name of ['Cookie', 'Accept-Language', 'Authorization']) vary.add(name);
  return reply
    .header('Content-Language', locale)
    .header('Vary', [...vary].join(', '))
    .header('Cache-Control', 'private, no-store');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** Translates a copy of presentation metadata, never schemas' keys, enums, defaults, or examples. */
export function localizeDeveloperOpenApi<T>(document: T, locale: DeveloperLocale): T {
  const copy = structuredClone(document);
  const protectedKeys = new Set(['example', 'examples', 'enum', 'const', 'default']);
  function visit(value: unknown) {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (!isRecord(value)) return;
    const values = isRecord(value['x-message-values'])
      ? (value['x-message-values'] as Record<string, string | number>)
      : {};
    delete value['x-message-values'];
    for (const [key, entry] of Object.entries(value)) {
      if (protectedKeys.has(key)) continue;
      if (['title', 'summary', 'description'].includes(key) && typeof entry === 'string') {
        value[key] = developerText(locale, entry, values);
      } else if (key === 'tags' && Array.isArray(entry)) {
        value[key] = entry.map((tag) => {
          if (typeof tag === 'string') return developerText(locale, tag);
          if (isRecord(tag) && typeof tag.name === 'string') tag.name = developerText(locale, tag.name);
          visit(tag);
          return tag;
        });
      } else visit(entry);
    }
  }
  visit(copy);
  return copy;
}

function errorText(locale: DeveloperLocale, source: string, code: string): string {
  const scope = /^(posts:(?:read|write)) scope is required\.$/.exec(source);
  if (scope) return developerText(locale, '{scope} scope is required.', { scope: scope[1] });
  const imageLimit = /^Image files must be ([\d.]+) MiB or smaller\.$/.exec(source);
  if (imageLimit) return developerText(locale, 'Image files must be {limit} MiB or smaller.', { limit: imageLimit[1] });
  const lengthLimit = /^(Titles|Subtitles|Descriptions|Post URLs|Each tag) can be up to (\d+) characters\.$/.exec(
    source,
  );
  if (lengthLimit)
    return developerText(locale, `${lengthLimit[1]} can be up to {limit} characters.`, { limit: lengthLimit[2] });
  if (code === 'post.of') {
    const limit = /\d+/.exec(source)?.[0];
    if (limit) return developerText(locale, 'You can save up to {limit} drafts.', { limit });
  }
  const english = serverEnglish.get(source) ?? source;
  if (hasDeveloperText(english)) return developerText(locale, english);
  if (locale === 'ko') return serverKorean[english] ?? developerText(locale, 'Could not complete the request.');
  return /[가-힣]/.test(english) ? developerText(locale, 'Could not complete the request.') : english;
}

export function localizeDeveloperError(payload: unknown, locale: DeveloperLocale): unknown {
  if (
    !isRecord(payload) ||
    !isRecord(payload.error) ||
    typeof payload.error.code !== 'string' ||
    typeof payload.error.message !== 'string'
  )
    return payload;
  const error: Record<string, unknown> = {
    ...payload.error,
    message: errorText(locale, payload.error.message, payload.error.code),
  };
  if (isRecord(error.fields) && Array.isArray(error.fields.errors)) {
    error.fields = {
      ...error.fields,
      errors: error.fields.errors.map((issue: unknown) => {
        if (!isRecord(issue) || typeof issue.msg !== 'string') return issue;
        const source = issue.type === 'int_parsing' ? 'Input should be a valid integer' : issue.msg;
        return {
          ...issue,
          msg:
            hasDeveloperText(source) || locale !== 'ko'
              ? developerText(locale, source)
              : developerText(locale, 'Check this field’s type and value.'),
        };
      }),
    };
  }
  return { ...payload, error };
}
