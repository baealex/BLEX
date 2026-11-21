import { mkdir, mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { createToken, credentialTag, tokenHash } from '../../src/auth/session.js';

const migrationsRoot = new URL('../../../prisma/migrations/', import.meta.url);
const legacyTimestamp = '2020-01-02 03:04:05.123456';

export const testSecretKey = 'migrated-database-secret';
export const testCipherKey = '0123456789abcdef0123456789abcdef';
export const testSiteUrl = new URL('http://site.test');

type Row = Record<string, SQLInputValue>;
interface ColumnInfo { name: string; type: string; notnull: number; dflt_value: unknown; pk: number }

/** Fills the NOT NULL columns Django populated in the ORM so fixtures keep the real constraints. */
export function insertRow(db: DatabaseSync, table: string, values: Row) {
  const columns = db.prepare(`PRAGMA table_info("${table}")`).all() as unknown as ColumnInfo[];
  const row: Row = { ...values };
  for (const column of columns) {
    if (column.name in row || column.pk || !column.notnull || column.dflt_value !== null) continue;
    const type = column.type.toLowerCase();
    if (/int|bool|decimal/.test(type)) row[column.name] = 0;
    else if (/date/.test(type)) row[column.name] = legacyTimestamp;
    else row[column.name] = column.name === 'tags' ? '[]' : '';
  }
  const names = Object.keys(row);
  db.prepare(`INSERT INTO "${table}" (${names.map((name) => `"${name}"`).join(', ')}) VALUES (${names.map(() => '?').join(', ')})`)
    .run(...names.map((name) => row[name]));
}

export function seedEditor(db: DatabaseSync, id: number, username: string) {
  insertRow(db, 'auth_user', { id, username, password: `pbkdf2_sha256$fixture$${username}`, is_active: 1 });
  insertRow(db, 'board_profile', { id, user_id: id, role: 'EDITOR' });
}

export function seedPost(db: DatabaseSync, id: number, authorId: number, url: string, values: Row = {}) {
  insertRow(db, 'board_post', { id, author_id: authorId, url, title: url, published_date: legacyTimestamp, updated_date: legacyTimestamp, ...values });
  insertRow(db, 'board_postcontent', { id, post_id: id, content_html: '<p>Body</p>' });
  insertRow(db, 'board_postconfig', { id, post_id: id, hide: 0, cover_layout: 'default', cover_image_position: 'right', cover_image_ratio: 'auto' });
}

export function signIn(db: DatabaseSync, userId: number) {
  const { password } = db.prepare('SELECT password FROM auth_user WHERE id = ?').get(userId) as { password: string };
  const session = createToken();
  const csrf = createToken();
  insertRow(db, 'blex_session', {
    token_hash: tokenHash(session) as string,
    user_id: userId,
    credential_tag: credentialTag(password, testSecretKey),
    expires_at: BigInt(Date.now() + 3_600_000),
  });
  return { cookie: `blexsessionid=${session}; csrftoken=${csrf}`, 'x-csrftoken': csrf, origin: testSiteUrl.origin };
}

/** Applies the shipped migrations, so tests see Django's real foreign keys and NOT NULL columns. */
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
