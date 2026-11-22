import type { Prisma, PrismaClient } from '@prisma/client';
import { createHash, timingSafeEqual } from 'node:crypto';
import { DeveloperApiError, asBoolean, formatError } from '../shared.js';

const TOKEN_PREFIX = 'blex_pat_';

interface UserRow {
  id: number;
  username: string;
  firstName: string;
  email: string;
  isActive: number | bigint | boolean;
  role: string | null;
}

export interface AuthenticatedToken {
  id: number;
  name: string;
  tokenPrefix: string;
  scopes: string[];
  user: UserRow;
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
    select: { id: true, userId: true, name: true, tokenPrefix: true, tokenHash: true, scopes: true, expiresAt: true, revokedAt: true },
  });

  const suppliedHash = createHash('sha256').update(rawToken, 'utf8').digest('hex');
  const expectedHash = stored ? Buffer.from(stored.tokenHash) : Buffer.alloc(0);
  const providedHash = Buffer.from(suppliedHash);
  if (!stored || expectedHash.length !== providedHash.length || !timingSafeEqual(expectedHash, providedHash)) {
    return { error: formatError('auth.invalid_token', 'Invalid token.', 401) };
  }

  const [user] = await db.$queryRaw<UserRow[]>`
    SELECT user.id, user.username, user.first_name AS firstName, user.email, user.is_active AS isActive, profile.role
      FROM auth_user AS user
      LEFT JOIN board_profile AS profile ON profile.user_id = user.id
     WHERE user.id = ${stored.userId}
     LIMIT 1
  `;
  if (!user) return { error: formatError('auth.invalid_token', 'Invalid token.', 401) };

  if (stored.revokedAt !== null || (stored.expiresAt !== null && stored.expiresAt.getTime() <= Date.now())) {
    return {
      error: formatError('auth.invalid_token', 'This token has expired or been revoked.', 401),
    };
  }
  if (!asBoolean(user.isActive)) {
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
  return formatError(
    'auth.insufficient_scope',
    `${scope} scope is required.`,
    403,
  );
}
