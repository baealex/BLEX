import { timingSafeEqual } from 'node:crypto';
import type { FastifyRequest } from 'fastify';
import { csrfCookie, requestCookies } from './cookies.js';

export const csrfPattern = /^[a-zA-Z0-9_-]{43}$/;

export function formInput(request: FastifyRequest): Record<string, unknown> {
  const body = request.body;
  return body && typeof body === 'object' && !Array.isArray(body) ? body as Record<string, unknown> : {};
}

export function validCsrf(request: FastifyRequest, siteUrl: URL): boolean {
  const source = request.headers.origin ?? request.headers.referer;
  const sameOrigin = source ? URL.parse(source)?.origin === siteUrl.origin : siteUrl.protocol !== 'https:';
  const stored = requestCookies(request)[csrfCookie];
  const provided = request.headers['x-csrftoken'] ?? formInput(request).csrfmiddlewaretoken;
  return sameOrigin && typeof provided === 'string' && typeof stored === 'string' && csrfPattern.test(provided) &&
    csrfPattern.test(stored) && timingSafeEqual(Buffer.from(provided), Buffer.from(stored));
}
