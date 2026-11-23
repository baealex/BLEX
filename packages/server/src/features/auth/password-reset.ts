import { renderPage } from '../../platform/views.js';
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { formInput, validCsrf } from '../../platform/csrf.js';
import { readPublicSiteBrand } from '../discovery/http/pages.js';
import type { AuthConfig } from './http.js';
import { hashPassword } from './password-hash.js';
import { csrfForPage, submittedPasswordError } from './security.js';
import { revokeAccountTokens } from '../developer-api/services/token-auth.js';

const resetLifetimeMs = 24 * 60 * 60 * 1_000;
const tokenShape = /^(\d{1,10})\.(\d{13})\.([A-Za-z0-9_-]{43})$/;

// The password hash is part of the signature, so setting a new password spends every earlier link.
function resetSignature(userId: number, expiresAt: number, passwordHash: string, secretKey: string): string {
  return createHmac('sha256', secretKey)
    .update('blex.password-reset\0')
    .update(`${userId}\0${expiresAt}\0`)
    .update(passwordHash)
    .digest('base64url');
}

export function createPasswordResetToken(
  account: { id: number; passwordHash: string },
  secretKey: string,
  now = Date.now(),
) {
  const expiresAt = now + resetLifetimeMs;
  return {
    token: `${account.id}.${expiresAt}.${resetSignature(account.id, expiresAt, account.passwordHash, secretKey)}`,
    expiresAt: new Date(expiresAt),
  };
}

async function readResetAccount(db: PrismaClient, token: string, secretKey: string) {
  const match = tokenShape.exec(token);
  if (!match) return null;
  const id = Number(match[1]);
  const expiresAt = Number(match[2]);
  if (!Number.isSafeInteger(id) || expiresAt <= Date.now()) return null;
  const account = await db.user.findFirst({
    where: { id, isActive: true },
    select: { id: true, username: true, name: true, email: true, passwordHash: true },
  });
  if (!account) return null;
  const expected = Buffer.from(resetSignature(id, expiresAt, account.passwordHash, secretKey));
  const provided = Buffer.from(match[3]);
  return expected.length === provided.length && timingSafeEqual(expected, provided) ? account : null;
}

type ResetView =
  | { state: 'form'; username: string; csrf: string; action: string; error?: string }
  | { state: 'done' }
  | { state: 'invalid' };

async function sendResetPage(db: PrismaClient, reply: FastifyReply, view: ResetView, status = 200) {
  const brand = await readPublicSiteBrand(db);
  const fieldClass = 'block h-12 w-full rounded-lg border border-line bg-surface px-3';
  const linkClass =
    'mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-action px-4 text-content-inverted hover:bg-action-hover active:scale-95';
  return reply
    .code(status)
    .type('text/html; charset=utf-8')
    .header('Cache-Control', 'private, no-store')
    .header('Referrer-Policy', 'no-referrer')
    .header('X-Robots-Tag', 'noindex, nofollow, noarchive')
    .send(renderPage('password-reset/$token', { brand, view, linkClass, fieldClass }));
}

export function registerPasswordReset(app: FastifyInstance, db: PrismaClient, siteUrl: URL, config: AuthConfig) {
  const handle = async (request: FastifyRequest<{ Params: { token: string } }>, reply: FastifyReply) => {
    const { token } = request.params;
    const account = await readResetAccount(db, token, config.secretKey);
    if (!account) return sendResetPage(db, reply, { state: 'invalid' }, 404);

    let error: string | undefined;
    if (request.method === 'POST') {
      if (!validCsrf(request, siteUrl)) return reply.code(403).send('요청을 확인해 주세요.');
      const { password, passwordConfirm } = formInput(request);
      if (typeof password !== 'string' || !password) error = '새 비밀번호를 입력해 주세요.';
      else if (password !== passwordConfirm) error = '비밀번호 확인이 일치하지 않습니다.';
      else error = submittedPasswordError(password, account) || undefined;
      if (!error) {
        const passwordHash = await hashPassword(password as string);
        const saved = await db.$transaction(async (tx) => {
          const { count } = await tx.user.updateMany({
            where: { id: account.id, isActive: true, passwordHash: account.passwordHash },
            data: { passwordHash },
          });
          if (count !== 1) return false;
          await tx.session.deleteMany({ where: { userId: account.id } });
          await revokeAccountTokens(tx, account.id);
          return true;
        });
        return saved
          ? sendResetPage(db, reply, { state: 'done' })
          : sendResetPage(db, reply, { state: 'invalid' }, 404);
      }
    }
    const csrf = csrfForPage(request, reply, siteUrl);
    return sendResetPage(db, reply, {
      state: 'form',
      username: account.username,
      csrf,
      action: `/password-reset/${token}`,
      error,
    });
  };

  app.get('/password-reset/:token', handle);
  app.post('/password-reset/:token', handle);
}
