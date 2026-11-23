import { renderPage } from '../../platform/views.js';
import { timingSafeEqual } from 'node:crypto';
import type { Prisma, PrismaClient } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import {
  accountEmailPattern,
  accountUsernamePattern,
  describeInvalidPassword,
  normalizeAccountEmail,
} from './account-validation.js';
import { authCookieOptions, csrfCookie, sessionCookie, setSessionCookies } from '../../platform/cookies.js';
import { formInput, validCsrf } from '../../platform/csrf.js';
import { hashPassword } from './password-hash.js';
import { createSession, createToken } from './session.js';

const setupCsp =
  "default-src 'none'; style-src 'self' 'unsafe-inline'; script-src 'self'; img-src 'self'; font-src 'self'; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'";

export async function hasAdministrator(db: PrismaClient | Prisma.TransactionClient): Promise<boolean> {
  const admin = await db.user.findFirst({
    where: { OR: [{ isStaff: true }, { isSuperuser: true }] },
    select: { id: true },
  });
  return admin !== null;
}

interface AccountInput {
  username: string;
  displayName: string;
  email: string;
  passwordHash: string;
  administrator?: boolean;
  editor?: boolean;
  language?: string;
  timeZone?: string;
}

export async function insertAccount(db: Prisma.TransactionClient, input: AccountInput): Promise<number> {
  const administrator = Boolean(input.administrator);
  const { id } = await db.user.create({
    data: {
      username: input.username,
      passwordHash: input.passwordHash,
      name: input.displayName,
      email: input.email,
      isStaff: administrator,
      isSuperuser: administrator,
      profile: { create: { role: administrator || input.editor ? 'EDITOR' : 'READER' } },
      preference: {
        create: {
          language: input.language ?? null,
          timeZone: input.timeZone ?? '',
          notifyMention: true,
          notifyCommentLike: true,
        },
      },
    },
    select: { id: true },
  });
  return id;
}

function matchesToken(left: string, right: string): boolean {
  const first = Buffer.from(left, 'utf8');
  const second = Buffer.from(right, 'utf8');
  return first.length === second.length && timingSafeEqual(first, second);
}

function setupMarkup(csrf: string, token: string, error = ''): string {
  return renderPage('setup', { error, csrf, token });
}

export function registerSetup(app: FastifyInstance, db: PrismaClient, siteUrl: URL, token: string, secretKey: string) {
  app.get<{ Querystring: { token?: string } }>('/setup', async (request, reply) => {
    if (await hasAdministrator(db)) return reply.code(404).send('Not found');
    const csrf = createToken();
    const provided = typeof request.query.token === 'string' ? request.query.token : '';
    reply.setCookie(csrfCookie, csrf, authCookieOptions(siteUrl));
    return reply
      .type('text/html; charset=utf-8')
      .header('Referrer-Policy', 'strict-origin')
      .header('Content-Security-Policy', setupCsp)
      .send(setupMarkup(csrf, matchesToken(token, provided) ? token : ''));
  });

  app.post('/setup', async (request, reply) => {
    if (await hasAdministrator(db)) return reply.code(404).send('Not found');
    if (!validCsrf(request, siteUrl)) return reply.code(403).send('Forbidden');
    const fields = formInput(request);
    const get = (name: string) => (typeof fields[name] === 'string' ? fields[name].trim() : '');
    const username = get('username').toLowerCase();
    const displayName = get('displayName');
    const email = get('email');
    const password = typeof fields?.password === 'string' ? fields.password : '';
    const provided = get('setupToken');
    const validToken = matchesToken(token, provided);
    const csrf = request.cookies[csrfCookie] ?? '';
    const fail = (message: string) =>
      reply
        .type('text/html; charset=utf-8')
        .header('Referrer-Policy', 'strict-origin')
        .header('Content-Security-Policy', setupCsp)
        .send(setupMarkup(csrf, validToken ? provided : '', message));

    if (!validToken) return fail('설정 토큰을 확인해 주세요.');
    if (!accountUsernamePattern.test(username))
      return fail('사용자 이름은 4~15자 사이의 소문자 영어, 숫자만 가능합니다.');
    if (!displayName || displayName.length > 150) return fail('표시 이름을 확인해 주세요.');
    if (email.length > 254 || !accountEmailPattern.test(email)) return fail('올바른 이메일 주소가 아닙니다.');
    if (password !== fields.passwordCheck) return fail('비밀번호가 일치하지 않습니다.');
    const passwordError = describeInvalidPassword(password, [username, displayName, email]);
    if (passwordError) return fail(passwordError);
    if (await db.user.findUnique({ where: { username }, select: { id: true } }))
      return fail('이미 사용중인 아이디입니다.');

    const passwordHash = await hashPassword(password);
    const userId = await db.$transaction(async (tx) => {
      await tx.siteSetting.upsert({ where: { id: 1 }, create: { id: 1 }, update: {}, select: { id: true } });
      if (await hasAdministrator(tx)) return null;
      return insertAccount(tx, {
        username,
        displayName,
        email: normalizeAccountEmail(email),
        passwordHash,
        administrator: true,
      });
    });
    if (userId === null) return reply.code(404).send('Not found');

    const session = await createSession(db, { userId, passwordHash }, secretKey, request.cookies[sessionCookie]);
    if (!session) throw new Error('Could not open the initial administrator session.');
    return setSessionCookies(reply, siteUrl, session)
      .header('Referrer-Policy', 'strict-origin')
      .redirect('/admin-settings/site-settings', 302);
  });
}
