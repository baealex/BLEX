import formBody from '@fastify/formbody';
import type { Prisma, PrismaClient } from '@prisma/client';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { createHash, randomBytes } from 'node:crypto';
import { formInput } from '../../platform/csrf.js';
import { securityError, verificationRequired } from '../auth/security.js';
import { createToken } from '../auth/session.js';
import { acquireVerification, hasVerification, readVerificationAccount, type VerificationAccount } from '../auth/verification.js';
import { parseScopes, toIsoDateTime } from './index.js';
import { done } from '../../platform/response.js';

interface TokenUser { id: number; username: string; hasEditorRole: boolean; isStaff?: boolean; notifyCount?: number }
interface TokenOptions {
  currentUser: (request: FastifyRequest) => Promise<TokenUser | null>;
  validateCsrf: (request: FastifyRequest) => boolean;
  secretKey: string;
  siteUrl: URL;
}

/** Lists what a response may show. The hash is deliberately absent, and the secret is only returned once at creation. */
const tokenFields = {
  id: true, name: true, tokenPrefix: true, scopes: true, expiresAt: true, revokedAt: true, lastUsedAt: true, createdAt: true,
} satisfies Prisma.DeveloperTokenSelect;

type TokenRow = Prisma.DeveloperTokenGetPayload<{ select: typeof tokenFields }>;

function serialize(token: TokenRow) {
  return { id: token.id, name: token.name, tokenPrefix: token.tokenPrefix, scopes: parseScopes(token.scopes),
    expiresAt: toIsoDateTime(token.expiresAt), revokedAt: toIsoDateTime(token.revokedAt),
    lastUsedAt: toIsoDateTime(token.lastUsedAt), createdAt: toIsoDateTime(token.createdAt) };
}

function listTokens(db: PrismaClient, userId: number) {
  return db.developerToken.findMany({ where: { userId }, select: tokenFields, orderBy: { createdAt: 'desc' } });
}

async function issueToken(db: PrismaClient, account: VerificationAccount | null, input: Record<string, unknown>) {
  if (!account || !hasVerification(account)) return verificationRequired;
  const rawScopes = input.scopes ?? ['posts:read'];
  const provided = typeof rawScopes === 'string' ? rawScopes.split(',').map((scope) => scope.trim()).filter(Boolean) : rawScopes;
  if (!Array.isArray(provided) || !provided.length || provided.some((scope) => !['posts:write', 'posts:read'].includes(scope))) {
    return securityError('VA', '지원되는 권한을 선택해 주세요.');
  }
  const scopes = [...new Set(provided)].sort();
  const rawDays = input.expiresInDays ?? 90;
  const days = rawDays === '' ? 90 : typeof rawDays === 'number' || /^\d+$/.test(String(rawDays)) ? Number(rawDays) : NaN;
  if (!Number.isInteger(days) || days < 1 || days > 365) return securityError('VA', '유효 기간은 1일부터 365일까지 입력해 주세요.');
  if (input.name !== undefined && typeof input.name !== 'string') return securityError('VA', '토큰 이름을 확인해 주세요.');
  const name = typeof input.name === 'string' && input.name.trim() ? input.name.slice(0, 100) : 'Developer token';
  const prefix = randomBytes(6).toString('hex');
  const token = `blex_pat_${prefix}_${createToken()}`;
  const hash = createHash('sha256').update(token).digest('hex');
  const created = new Date();
  const expiry = new Date(created.getTime() + days * 86_400_000);
  return db.$transaction(async (tx) => {
    if (!await acquireVerification(tx, account)) return verificationRequired;
    const eligible = await tx.user.findFirst({
      where: { id: account.id, isActive: true, profile: { role: 'EDITOR' } },
      select: { id: true },
    });
    if (!eligible) return securityError('AT');
    const row = await tx.developerToken.create({
      data: { userId: account.id, name, tokenPrefix: prefix, tokenHash: hash, scopes, expiresAt: expiry, createdAt: created, updatedAt: created },
      select: tokenFields,
    });
    return done({ ...serialize(row), token });
  });
}

async function revokeToken(db: PrismaClient, account: TokenUser, tokenId: unknown) {
  const id = typeof tokenId === 'string' && /^\d+$/.test(tokenId) ? Number(tokenId) : tokenId;
  if (typeof id !== 'number' || !Number.isSafeInteger(id) || id < 1) return null;
  const now = new Date();
  const [token] = await db.developerToken.updateManyAndReturn({
    where: { id, userId: account.id },
    data: { revokedAt: now, updatedAt: now },
    select: tokenFields,
  });
  return token ? serialize(token) : null;
}

export function registerDeveloperTokens(app: FastifyInstance, db: PrismaClient, options: TokenOptions) {
  app.register(async (routes) => {
    await routes.register(formBody);
    routes.addHook('onRequest', async (_request, reply) => { reply.header('Cache-Control', 'private, no-store'); });
    routes.get('/v1/developer-tokens', async (request) => {
      const user = await options.currentUser(request);
      if (!user) return securityError('NL');
      if (!user.hasEditorRole) return { status: 'ERROR', errorCode: 'error:RJ', errorMessage: 'Author access is required.' };
      return done({ tokens: (await listTokens(db, user.id)).map(serialize) });
    });
    routes.post('/v1/developer-tokens', async (request, reply) => {
      const user = await options.currentUser(request);
      if (!user?.hasEditorRole) return securityError(user ? 'AT' : 'NL');
      if (!options.validateCsrf(request)) return reply.code(403).send(securityError('RJ'));
      return issueToken(db, await readVerificationAccount(db, request, options.secretKey), formInput(request));
    });
    routes.delete<{ Params: { id: string } }>('/v1/developer-tokens/:id', async (request, reply) => {
      const user = await options.currentUser(request);
      if (!user?.hasEditorRole) return securityError(user ? 'AT' : 'NL');
      if (!options.validateCsrf(request)) return reply.code(403).send(securityError('RJ'));
      const token = await revokeToken(db, user, request.params.id);
      return token ? done(token) : reply.code(404).send('Not found');
    });
  });
}
