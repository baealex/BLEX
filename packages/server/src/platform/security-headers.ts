import type { FastifyReply } from 'fastify';

const securityHeaders = [
  ['X-Frame-Options', 'DENY'],
  ['X-Content-Type-Options', 'nosniff'],
  ['Referrer-Policy', 'same-origin'],
  ['Cross-Origin-Opener-Policy', 'same-origin'],
] as const;

export function applySecurityHeaders(reply: FastifyReply, httpsSite: boolean) {
  for (const [name, value] of securityHeaders) if (!reply.hasHeader(name)) reply.header(name, value);
  if (httpsSite) reply.header('Strict-Transport-Security', 'max-age=31536000');
}
