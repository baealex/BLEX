import { readFileSync } from 'node:fs';
import { mkdir, mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { legacyDate } from '../../src/compat/legacy-import.js';
import { createToken, credentialTag, tokenHash } from '../../src/features/auth/session.js';

const migrationsRoot = new URL('../../../prisma/migrations/', import.meta.url);
const legacyTimestamp = '2020-01-02 03:04:05.123456';
const prismaTimestamp = Date.UTC(2020, 0, 2, 3, 4, 5, 123);

export const testSecretKey = 'migrated-database-secret';
export const testCipherKey = '0123456789abcdef0123456789abcdef';
export const testSiteUrl = new URL('http://site.test');

/** Every account table, for fixtures that hand-write the rest of their schema. */
export const accountTables = [
  'User', 'Profile', 'UserPreference', 'SocialLink', 'SocialProvider', 'SocialAccount', 'TwoFactorAuth',
  'UsernameChange', 'AuthorInvite', 'LoginAttempt', 'Session', 'FactorSetup', 'OAuthFlow', 'OAuthChallenge',
];

type Row = Record<string, SQLInputValue>;
interface ColumnInfo { name: string; type: string; notnull: number; dflt_value: unknown; pk: number }

/** Fills required columns the application normally populates, so fixtures keep the real constraints. */
export function insertRow(db: DatabaseSync, table: string, values: Row) {
  const columns = db.prepare(`PRAGMA table_info("${table}")`).all() as unknown as ColumnInfo[];
  const { sql } = db.prepare(`SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?`).get(table) as { sql: string };
  const row: Row = { ...values };
  for (const column of columns) {
    const type = column.type.toLowerCase();
    // Fixtures may write a migrated date the way 3.x stored it.
    if (/date/.test(type) && /^[A-Z_]/.test(table) && typeof row[column.name] === 'string') row[column.name] = prismaDate(row[column.name] as string);
    if (column.name in row || column.pk || !column.notnull) continue;
    if (/date/.test(type) && /[A-Z]/.test(column.name)) {
      row[column.name] = prismaTimestamp;
      continue;
    }
    if (column.dflt_value !== null) continue;
    if (type === 'jsonb') row[column.name] = column.name === 'tags' ? '[]' : '{}';
    else if (/int|bool|decimal/.test(type)) row[column.name] = 0;
    else if (/date/.test(type)) row[column.name] = legacyTimestamp;
    else if (sql.includes(`JSON_VALID("${column.name}")`)) row[column.name] = column.name === 'tags' ? '[]' : '{}';
    else row[column.name] = '';
  }
  const names = Object.keys(row);
  db.prepare(`INSERT INTO "${table}" (${names.map((name) => `"${name}"`).join(', ')}) VALUES (${names.map(() => '?').join(', ')})`)
    .run(...names.map((name) => row[name]));
}

export function seedEditor(db: DatabaseSync, id: number, username: string) {
  insertRow(db, 'User', { id, username, passwordHash: `pbkdf2_sha256$fixture$${username}`, isActive: 1 });
  insertRow(db, 'Profile', { userId: id, role: 'EDITOR' });
}

export function seedPost(db: DatabaseSync, id: number, authorId: number, slug: string, values: Row = {}) {
  insertRow(db, 'Post', { id, authorId, slug, title: slug, publishedAt: legacyTimestamp, updatedAt: legacyTimestamp, ...values });
  insertRow(db, 'PostContent', { postId: id, html: '<p>Body</p>' });
}

export function signIn(db: DatabaseSync, userId: number) {
  const { passwordHash } = db.prepare('SELECT passwordHash FROM "User" WHERE id = ?').get(userId) as { passwordHash: string };
  const session = createToken();
  const csrf = createToken();
  insertRow(db, 'Session', {
    tokenHash: tokenHash(session) as string,
    userId: userId,
    credentialTag: credentialTag(passwordHash, testSecretKey),
    expiresAt: Date.now() + 3_600_000,
  });
  return { cookie: `blexsessionid=${session}; csrftoken=${csrf}`, 'x-csrftoken': csrf, origin: testSiteUrl.origin };
}

/** The epoch milliseconds Prisma stores for a date a fixture writes as 3.x text. */
export function prismaDate(value: string): number {
  return Number(legacyDate(value));
}

/** The real DDL and indexes for tables, for fixtures that still hand-write other domains in one script. */
export function migratedTableSql(...tables: string[]): string {
  const migration = readFileSync(new URL('0001_init/migration.sql', migrationsRoot), 'utf8');
  return migration.split(/;\s*\n/).filter((statement) => {
    const table = /CREATE TABLE "(\w+)"/.exec(statement)?.[1] ?? /CREATE (?:UNIQUE )?INDEX "\w+" ON "(\w+)"/.exec(statement)?.[1];
    return table !== undefined && tables.includes(table);
  }).map((statement) => `${statement};\n`).join('');
}

/** Adds real migrated tables and indexes to a fixture that still hand-writes other domains. */
export function createMigratedTables(db: DatabaseSync, ...tables: string[]) {
  db.exec(migratedTableSql(...tables));
}

/** Applies the shipped migrations, so tests see the real foreign keys and NOT NULL columns. */
export async function createMigratedDatabase() {
  const directory = await mkdtemp(join(tmpdir(), 'blex-v4-migrated-'));
  const path = join(directory, 'db.sqlite3');
  const mediaRoot = join(directory, 'media');
  await mkdir(mediaRoot);
  const db = new DatabaseSync(path);
  const names = (await readdir(migrationsRoot)).filter((name) => /^\d/.test(name)).sort();
  for (const name of names) db.exec(await readFile(new URL(`${name}/migration.sql`, migrationsRoot), 'utf8'));
  return {
    db,
    path,
    mediaRoot,
    async cleanup() {
      db.close();
      await rm(directory, { recursive: true, force: true });
    },
  };
}
