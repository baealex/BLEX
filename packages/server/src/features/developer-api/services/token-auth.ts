import type { Prisma, PrismaClient } from '@prisma/client';
import { createHash, timingSafeEqual } from 'node:crypto';
import { DeveloperApiError, formatError } from '../shared.js';

const TOKEN_PREFIX = 'blex_pat_';

interface UserRow {
  id: number;
  username: string;
  firstName: string;
  email: string;
  isActive: boolean;
  role: string | null;
}

export interface AuthenticatedToken {
  id: number;
  name: string;
  tokenPrefix: string;
  scopes: string[];
  user: UserRow;
}

/** Used when an account is recovered or loses access, so a leaked token cannot outlive that decision. */
export function revokeAccountTokens(tx: Prisma.TransactionClient, userId: number, revokedAt = new Date()) {
  return tx.developerToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt, updatedAt: revokedAt },
  });
}

export function parseScopes(scopes: Prisma.JsonValue): string[] {
  return Array.isArray(scopes) ? scopes.filter((scope): scope is string => typeof scope === 'string') : [];
}

export async function authenticate(
  db: PrismaClient,
  authorization: string | undefined,
): Promise<{ token?: AuthenticatedToken; error?: DeveloperApiError }> {
  const separator = authorization?.indexOf(' ') ?? -1;
  const scheme = separator >= 0 ? authorization?.slice(0, separator) : '';
  const rawToken = separator >= 0 ? authorization?.slice(separator + 1).trim() : '';
  if (scheme?.toLowerCase() !== 'bearer' || !rawToken) {
    return { error: formatError('auth.missing_token', 'A Bearer token is required.', 401) };
  }

  if (!rawToken.startsWith(TOKEN_PREFIX)) {
    return { error: formatError('auth.invalid_token', 'Invalid token.', 401) };
  }
  const [tokenPrefix, secret] = rawToken.slice(TOKEN_PREFIX.length).split(/_(.*)/s, 2);
  if (!tokenPrefix || !secret) {
    return { error: formatError('auth.invalid_token', 'Invalid token.', 401) };
  }

  const stored = await db.developerToken.findUnique({
    where: { tokenPrefix },
    select: {
      id: true,
      userId: true,
      name: true,
      tokenPrefix: true,
      tokenHash: true,
      scopes: true,
      expiresAt: true,
      revokedAt: true,
    },
  });

  const suppliedHash = createHash('sha256').update(rawToken, 'utf8').digest('hex');
  const expectedHash = stored ? Buffer.from(stored.tokenHash) : Buffer.alloc(0);
  const providedHash = Buffer.from(suppliedHash);
  if (!stored || expectedHash.length !== providedHash.length || !timingSafeEqual(expectedHash, providedHash)) {
    return { error: formatError('auth.invalid_token', 'Invalid token.', 401) };
  }

  const owner = await db.user.findUnique({
    where: { id: stored.userId },
    select: { id: true, username: true, name: true, email: true, isActive: true, profile: { select: { role: true } } },
  });
  const user: UserRow | null = owner && {
    id: owner.id,
    username: owner.username,
    firstName: owner.name,
    email: owner.email,
    isActive: owner.isActive,
    role: owner.profile?.role ?? null,
  };
  if (!user) return { error: formatError('auth.invalid_token', 'Invalid token.', 401) };

  if (stored.revokedAt !== null || (stored.expiresAt !== null && stored.expiresAt.getTime() <= Date.now())) {
    return {
      error: formatError('auth.invalid_token', 'This token has expired or been revoked.', 401),
    };
  }
  if (!user.isActive) {
    return { error: formatError('auth.inactive_user', 'This user is inactive.', 401) };
  }
  if (user.role !== 'EDITOR') {
    return {
      error: formatError('auth.editor_required', 'The Developer API requires author access.', 403),
    };
  }

  return {
    token: {
      id: stored.id,
      name: stored.name,
      tokenPrefix: stored.tokenPrefix,
      scopes: parseScopes(stored.scopes),
      user,
    },
  };
}

export function requireScope(token: AuthenticatedToken, scope = 'posts:read'): DeveloperApiError | undefined {
  if (token.scopes.includes(scope)) return undefined;
  return formatError('auth.insufficient_scope', `${scope} scope is required.`, 403);
}
