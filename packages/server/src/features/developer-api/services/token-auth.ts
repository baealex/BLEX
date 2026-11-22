import { type PrismaClient } from '@prisma/client';
import { createHash, timingSafeEqual } from 'node:crypto';
import { DeveloperApiError, asBoolean, dateTimeValue, formatError } from '../shared.js';

const TOKEN_PREFIX = 'blex_pat_';

interface UserRow {
  id: number;
  username: string;
  firstName: string;
  email: string;
  isActive: number | bigint | boolean;
  role: string | null;
}

interface TokenRow extends UserRow {
  tokenId: number;
  name: string;
  tokenPrefix: string;
  tokenHash: string;
  scopes: string;
  expiresAt: string | Date | null;
  revokedAt: string | Date | null;
}

export interface AuthenticatedToken {
  id: number;
  name: string;
  tokenPrefix: string;
  scopes: string[];
  user: UserRow;
}

export function parseScopes(scopes: string): string[] {
  try {
    const value: unknown = JSON.parse(scopes);
    return Array.isArray(value) ? value.filter((scope): scope is string => typeof scope === 'string') : [];
  } catch {
    return [];
  }
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

  const [row] = await db.$queryRaw<TokenRow[]>`
    SELECT token.id AS tokenId, token.name, token.token_prefix AS tokenPrefix,
           token.token_hash AS tokenHash, token.scopes,
           CAST(token.expires_at AS TEXT) AS expiresAt,
           CAST(token.revoked_at AS TEXT) AS revokedAt, user.id, user.username,
           user.first_name AS firstName, user.email, user.is_active AS isActive,
           profile.role
      FROM board_developertoken AS token
      JOIN auth_user AS user ON user.id = token.user_id
      LEFT JOIN board_profile AS profile ON profile.user_id = user.id
     WHERE token.token_prefix = ${tokenPrefix}
     LIMIT 1
  `;

  const suppliedHash = createHash('sha256').update(rawToken, 'utf8').digest('hex');
  const expectedHash = row ? Buffer.from(row.tokenHash) : Buffer.alloc(0);
  const providedHash = Buffer.from(suppliedHash);
  if (!row || expectedHash.length !== providedHash.length || !timingSafeEqual(expectedHash, providedHash)) {
    return { error: formatError('auth.invalid_token', 'Invalid token.', 401) };
  }

  if (row.revokedAt !== null || (
    row.expiresAt !== null && (dateTimeValue(row.expiresAt) ?? Number.POSITIVE_INFINITY) <= Date.now()
  )) {
    return {
      error: formatError('auth.invalid_token', 'This token has expired or been revoked.', 401),
    };
  }
  if (!asBoolean(row.isActive)) {
    return { error: formatError('auth.inactive_user', 'This user is inactive.', 401) };
  }
  if (row.role !== 'EDITOR') {
    return {
      error: formatError('auth.editor_required', 'The Developer API requires author access.', 403),
    };
  }

  return {
    token: {
      id: row.tokenId,
      name: row.name,
      tokenPrefix: row.tokenPrefix,
      scopes: parseScopes(row.scopes),
      user: {
        id: row.id,
        username: row.username,
        firstName: row.firstName,
        email: row.email,
        isActive: row.isActive,
        role: row.role,
      },
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
