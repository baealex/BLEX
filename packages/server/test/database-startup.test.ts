import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { DatabaseSetupError, prepareDatabase } from '../src/startup/prepare-database.js';
import { insertRow } from './fixtures/migrated-database.js';

const legacySchema = new URL('../../prisma/legacy/django-3.14.sql', import.meta.url);

async function workspace() {
  const root = await mkdtemp(join(tmpdir(), 'blex-startup-'));
  const paths = {
    root,
    databasePath: join(root, 'data', 'db.sqlite3'),
    mediaRoot: join(root, 'data', 'media'),
    legacyRoot: join(root, 'legacy'),
    oldComposeDatabase: join(root, 'old-compose.sqlite3'),
  };
  await mkdir(paths.mediaRoot, { recursive: true });
  await mkdir(join(paths.legacyRoot, 'resources', 'media', 'images'), { recursive: true });
  return { ...paths, options: { ...paths, log: () => {} }, cleanup: () => rm(root, { recursive: true, force: true }) };
}

async function createLegacyDatabase(path: string, version = '0070_author_subscription') {
  const db = new DatabaseSync(path);
  db.exec(await readFile(legacySchema, 'utf8'));
  db.prepare('INSERT INTO django_migrations (app, name, applied) VALUES (?, ?, ?)').run('board', version, '2026-01-01 00:00:00');
  return db;
}

const fileHash = async (path: string) => createHash('sha256').update(await readFile(path)).digest('hex');
const count = (db: DatabaseSync, table: string) => Number((db.prepare(`SELECT COUNT(*) AS total FROM "${table}"`).get() as { total: number }).total);

test('creates a new database and leaves it in place on the next start', async () => {
  const space = await workspace();
  try {
    await prepareDatabase(space.options);
    const first = new DatabaseSync(space.databasePath);
    insertRow(first, 'auth_user', { id: 1, username: 'kept' });
    first.close();

    await prepareDatabase(space.options);
    const second = new DatabaseSync(space.databasePath, { readOnly: true });
    assert.equal(count(second, 'auth_user'), 1);
    assert.equal(count(second, '_prisma_migrations'), 1);
    second.close();
  } finally {
    await space.cleanup();
  }
});

test('imports a 3.14 installation once and leaves the original unchanged', async () => {
  const space = await workspace();
  const source = join(space.legacyRoot, 'db.sqlite3');
  try {
    const legacy = await createLegacyDatabase(source);
    insertRow(legacy, 'auth_user', { id: 7, username: 'writer', password: 'pbkdf2_sha256$fixture$hash', is_active: 1 });
    insertRow(legacy, 'board_post', { id: 5, author_id: 7, url: 'scheduled', title: 'Scheduled', published_date: '2099-01-01 00:00:00' });
    insertRow(legacy, 'board_post', { id: 6, author_id: 7, url: 'published', title: 'Published', published_date: '2020-01-01 00:00:00.123456' });
    insertRow(legacy, 'board_comment', { id: 1, post_id: 6, author_id: 7, text_md: 'Hello', text_html: '<p>Hello</p>' });
    insertRow(legacy, 'django_session', { session_key: 'discarded', session_data: 'x', expire_date: '2099-01-01' });
    legacy.exec(`UPDATE sqlite_sequence SET seq = 40 WHERE name = 'board_post'`);
    legacy.close();
    await writeFile(join(space.legacyRoot, 'resources', 'media', 'images', 'cover.png'), 'image');
    const before = await fileHash(source);

    await prepareDatabase(space.options);

    assert.equal(await fileHash(source), before);
    assert.equal(existsSync(`${space.databasePath}.importing`), false);
    assert.equal(await readFile(join(space.mediaRoot, 'images', 'cover.png'), 'utf8'), 'image');
    const imported = new DatabaseSync(space.databasePath);
    assert.equal(count(imported, 'auth_user'), 1);
    assert.equal(count(imported, 'board_post'), 2);
    assert.equal(count(imported, 'board_comment'), 1);
    assert.equal(count(imported, 'django_session'), 0);
    assert.equal(imported.prepare(`SELECT 1 FROM sqlite_schema WHERE name = 'django_migrations'`).get(), undefined);
    assert.equal((imported.prepare('SELECT password FROM auth_user WHERE id = 7').get() as { password: string }).password, 'pbkdf2_sha256$fixture$hash');
    assert.deepEqual({ ...imported.prepare('SELECT post_id, publish_at FROM blex_scheduled_publication').get() }, { post_id: 5, publish_at: '2099-01-01 00:00:00' });
    assert.equal(Number((imported.prepare(`SELECT seq FROM sqlite_sequence WHERE name = 'board_post'`).get() as { seq: number }).seq), 40);
    assert.equal(count(imported, '_prisma_migrations'), 1);
    imported.close();

    const changed = new DatabaseSync(source);
    insertRow(changed, 'auth_user', { id: 8, username: 'after-import' });
    changed.close();
    await prepareDatabase(space.options);
    const again = new DatabaseSync(space.databasePath, { readOnly: true });
    assert.equal(count(again, 'auth_user'), 1);
    again.close();
  } finally {
    await space.cleanup();
  }
});

test('asks older 3.x installs to reach 3.14 first and creates nothing', async () => {
  const space = await workspace();
  try {
    (await createLegacyDatabase(join(space.legacyRoot, 'db.sqlite3'), '0069_older')).close();
    await assert.rejects(prepareDatabase(space.options), (error: Error) => error instanceof DatabaseSetupError && /to 3\.14 first/.test(error.message));
    assert.equal(existsSync(space.databasePath), false);
    assert.equal(existsSync(`${space.databasePath}.importing`), false);
  } finally {
    await space.cleanup();
  }
});

test('stops without changing data for a 3.x Compose file or an unrecognized database', async () => {
  const space = await workspace();
  try {
    await writeFile(space.oldComposeDatabase, 'old');
    await assert.rejects(prepareDatabase(space.options), /3\.x Compose setup.*not changed/s);
    await rm(space.oldComposeDatabase);

    (await createLegacyDatabase(space.databasePath)).close();
    const legacy = await fileHash(space.databasePath);
    await assert.rejects(prepareDatabase(space.options), /BLEX 3\.x database.*read-only at \/legacy/s);
    assert.equal(await fileHash(space.databasePath), legacy);
    await rm(space.databasePath);

    const prerelease = new DatabaseSync(space.databasePath);
    prerelease.exec(`CREATE TABLE _prisma_migrations (migration_name TEXT); INSERT INTO _prisma_migrations VALUES ('0000_django_3x');`);
    prerelease.close();
    await assert.rejects(prepareDatabase(space.options), /pre-release BLEX 4/);
    await rm(space.databasePath);

    await writeFile(space.databasePath, 'not a database');
    await assert.rejects(prepareDatabase(space.options), /not a BLEX database/);
  } finally {
    await space.cleanup();
  }
});

test('leaves no database behind when the import fails', async () => {
  const space = await workspace();
  const media = join(space.legacyRoot, 'resources', 'media');
  try {
    (await createLegacyDatabase(join(space.legacyRoot, 'db.sqlite3'))).close();
    await rm(media, { recursive: true });
    await writeFile(media, 'not a directory');
    await assert.rejects(prepareDatabase(space.options), /Could not import the BLEX 3\.14 data.*not changed/s);
    assert.equal(existsSync(space.databasePath), false);
    assert.equal(existsSync(`${space.databasePath}.importing`), false);
  } finally {
    await space.cleanup();
  }
});
