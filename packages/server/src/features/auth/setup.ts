import { systemMessage } from '../../platform/messages.js';
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
        .send(setupMarkup(csrf, validToken ? provided : '', message));

    if (!validToken) return fail(systemMessage('Check the setup token.'));
    if (!accountUsernamePattern.test(username))
      return fail(systemMessage('Usernames must contain 4–15 lowercase English letters or numbers.'));
    if (!displayName || displayName.length > 150) return fail(systemMessage('Check your display name.'));
    if (email.length > 254 || !accountEmailPattern.test(email))
      return fail(systemMessage('Enter a valid email address.'));
    if (password !== fields.passwordCheck) return fail(systemMessage('Passwords do not match.'));
    const passwordError = describeInvalidPassword(password, [username, displayName, email]);
    if (passwordError) return fail(passwordError);
    if (await db.user.findUnique({ where: { username }, select: { id: true } }))
      return fail(systemMessage('This username is already in use.'));

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
