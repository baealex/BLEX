import type { FastifyReply, FastifyRequest } from 'fastify';
import { createToken, SESSION_DURATION_SECONDS } from '../features/auth/session.js';

export const sessionCookie = 'blexsessionid';
export const csrfCookie = 'csrftoken';

export function requestCookies(request: FastifyRequest) {
  return request.cookies ?? {};
}

export function authCookieOptions(siteUrl: URL) {
  return { path: '/', secure: siteUrl.protocol === 'https:', sameSite: 'lax' as const };
}

export function refreshCsrf(reply: FastifyReply, siteUrl: URL) {
  return reply.setCookie(csrfCookie, createToken(), authCookieOptions(siteUrl));
}

export function setSessionCookies(reply: FastifyReply, siteUrl: URL, token: string) {
  reply.setCookie(sessionCookie, token, { ...authCookieOptions(siteUrl), httpOnly: true, maxAge: SESSION_DURATION_SECONDS });
  return refreshCsrf(reply, siteUrl);
}
