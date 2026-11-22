import formBody from '@fastify/formbody';
import { Prisma, type PrismaClient } from '@prisma/client';
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

interface TokenRow {
  id: number;
  name: string;
  tokenPrefix: string;
  scopes: string;
  expiresAt: string | null;
  revokedAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
}

const tokenFields = Prisma.sql`id, name, token_prefix AS tokenPrefix, scopes,
  CAST(expires_at AS TEXT) AS expiresAt, CAST(revoked_at AS TEXT) AS revokedAt,
  CAST(last_used_at AS TEXT) AS lastUsedAt, CAST(created_date AS TEXT) AS createdAt`;

function serialize(token: TokenRow) {
  return { ...token, scopes: parseScopes(token.scopes), expiresAt: toIsoDateTime(token.expiresAt), revokedAt: toIsoDateTime(token.revokedAt),
    lastUsedAt: toIsoDateTime(token.lastUsedAt), createdAt: toIsoDateTime(token.createdAt) };
}

function listTokens(db: PrismaClient, userId: number) {
  return db.$queryRaw<TokenRow[]>`SELECT ${tokenFields} FROM board_developertoken WHERE user_id = ${userId} ORDER BY created_date DESC`;
}

function timestamp(date: Date) { return date.toISOString().slice(0, -1).replace('T', ' '); }

async function issueToken(db: PrismaClient, account: VerificationAccount | null, input: Record<string, unknown>) {
  if (!account || !hasVerification(account)) return verificationRequired;
  const rawScopes = input.scopes ?? ['posts:read'];
  const provided = typeof rawScopes === 'string' ? rawScopes.split(',').map((scope) => scope.trim()).filter(Boolean) : rawScopes;
  if (!Array.isArray(provided) || !provided.length || provided.some((scope) => !['posts:write', 'posts:read'].includes(scope))) {
    return securityError('VA', '지원되는 권한을 선택해 주세요.');
  }
  const scopes = [...new Set(provided)].sort();
  const rawDays = input.expires_in_days ?? input.expiresInDays ?? 90;
  const days = rawDays === '' ? 90 : typeof rawDays === 'number' || /^\d+$/.test(String(rawDays)) ? Number(rawDays) : NaN;
  if (!Number.isInteger(days) || days < 1 || days > 365) return securityError('VA', '유효 기간은 1일부터 365일까지 입력해 주세요.');
  if (input.name !== undefined && typeof input.name !== 'string') return securityError('VA', '토큰 이름을 확인해 주세요.');
  const name = typeof input.name === 'string' && input.name.trim() ? input.name.slice(0, 100) : 'Developer token';
  const prefix = randomBytes(6).toString('hex');
  const token = `blex_pat_${prefix}_${createToken()}`;
  const hash = createHash('sha256').update(token).digest('hex');
  const now = Date.now();
  const created = timestamp(new Date(now));
  const expiry = timestamp(new Date(now + days * 86_400_000));
  return db.$transaction(async (tx) => {
    if (!await acquireVerification(tx, account)) return verificationRequired;
    const [row] = await tx.$queryRaw<TokenRow[]>`
      INSERT INTO board_developertoken (name, token_prefix, token_hash, scopes, expires_at, created_date, updated_date, user_id)
      SELECT ${name}, ${prefix}, ${hash}, ${JSON.stringify(scopes)}, ${expiry}, ${created}, ${created}, id
        FROM auth_user AS account WHERE account.id = ${account.id} AND account.is_active = 1
          AND EXISTS(SELECT 1 FROM board_profile WHERE user_id = account.id AND role = 'EDITOR')
      RETURNING ${tokenFields}
    `;
    return row ? done({ ...serialize(row), token }) : securityError('AT');
  });
}

async function revokeToken(db: PrismaClient, account: TokenUser, tokenId: unknown) {
  const id = typeof tokenId === 'string' && /^\d+$/.test(tokenId) ? Number(tokenId) : tokenId;
  if (typeof id !== 'number' || !Number.isSafeInteger(id) || id < 1) return null;
  const now = timestamp(new Date());
  const [token] = await db.$queryRaw<TokenRow[]>`
    UPDATE board_developertoken SET revoked_at = ${now}, updated_date = ${now}
     WHERE id = ${id} AND user_id = ${account.id}
    RETURNING ${tokenFields}
  `;
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
