import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { verifyLegacyDatabase } from '../src/compat/legacy-database.js';

test('validates the Django baseline and refuses to adopt an incomplete or inconsistent database', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'blex-baseline-test-'));
  const databasePath = join(directory, 'legacy.sqlite3');
  const sql = await readFile(new URL('../../prisma/legacy/django-3.14.sql', import.meta.url), 'utf8');
  const db = new DatabaseSync(databasePath);
  try {
    db.exec(sql);
    assert.throws(() => verifyLegacyDatabase(databasePath), /Upgrade this BLEX 3\.x database to 3\.14 first/);
    db.exec("INSERT INTO django_migrations (app, name, applied) VALUES ('board', '0070_author_subscription', '2000-01-01');");
    assert.ok(verifyLegacyDatabase(databasePath) > 0);

    db.exec('PRAGMA foreign_keys = OFF; INSERT INTO auth_group_permissions (group_id, permission_id) VALUES (1, 1)');
    assert.throws(() => verifyLegacyDatabase(databasePath), /foreign-key violations/);
    db.exec('DELETE FROM auth_group_permissions; ALTER TABLE board_post ADD COLUMN incompatible TEXT;');
    assert.throws(() => verifyLegacyDatabase(databasePath), /table board_post/);
  } finally {
    db.close();
    await rm(directory, { recursive: true });
  }
});
