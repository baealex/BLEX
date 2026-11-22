import { cp, lstat, rename, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { verifyLegacyDatabase } from './legacy-database.js';

const discardedTables = new Set(['django_migrations', 'django_session']);

const quote = (name: string) => `"${name.replaceAll('"', '""')}"`;

function tableNames(db: DatabaseSync) {
  const rows = db.prepare(`
    SELECT name FROM sqlite_schema
    WHERE type = 'table' AND name NOT GLOB 'sqlite_*' AND name <> '_prisma_migrations'
  `).all() as unknown as Array<{ name: string }>;
  return rows.map(({ name }) => name);
}

function columnNames(db: DatabaseSync, table: string) {
  const rows = db.prepare(`PRAGMA table_info(${quote(table)})`).all() as unknown as Array<{ name: string }>;
  return rows.map(({ name }) => name);
}

function copyTable(source: DatabaseSync, target: DatabaseSync, table: string) {
  const columns = columnNames(source, table);
  const available = new Set(columnNames(target, table));
  const missing = columns.filter((column) => !available.has(column));
  if (missing.length) throw new Error(`The BLEX 4 schema is missing ${table}: ${missing.join(', ')}.`);

  const list = columns.map(quote).join(', ');
  const read = source.prepare(`SELECT ${list} FROM ${quote(table)}`);
  read.setReadBigInts(true);
  const write = target.prepare(`INSERT INTO ${quote(table)} (${list}) VALUES (${columns.map(() => '?').join(', ')})`);
  let copied = 0;
  for (const row of read.iterate() as Iterable<Record<string, SQLInputValue>>) {
    write.run(...columns.map((column) => row[column]));
    copied += 1;
  }
  return copied;
}

function copyRows(sourcePath: string, targetPath: string) {
  const source = new DatabaseSync(sourcePath, { readOnly: true });
  const target = new DatabaseSync(targetPath);
  try {
    target.exec('PRAGMA foreign_keys = OFF');
    target.exec('BEGIN IMMEDIATE');
    const targetTables = new Set(tableNames(target));
    let rows = 0;
    for (const table of tableNames(source)) {
      if (discardedTables.has(table)) continue;
      if (!targetTables.has(table)) throw new Error(`The BLEX 4 schema has no table for ${table}.`);
      rows += copyTable(source, target, table);
    }

    // Keep AUTOINCREMENT counters so the IDs of deleted rows are never handed out again.
    const sequences = source.prepare('SELECT name, seq FROM sqlite_sequence');
    sequences.setReadBigInts(true);
    target.exec('DELETE FROM sqlite_sequence');
    const sequence = target.prepare('INSERT INTO sqlite_sequence (name, seq) VALUES (?, ?)');
    for (const { name, seq } of sequences.iterate() as Iterable<{ name: string; seq: bigint }>) {
      if (targetTables.has(name) && !discardedTables.has(name)) sequence.run(name, seq);
    }

    // 3.x published scheduled posts by date alone. BLEX 4 queues them explicitly.
    target.exec(`
      INSERT INTO blex_scheduled_publication (post_id, publish_at)
      SELECT id, CAST(published_date AS TEXT) FROM board_post
      WHERE deleted_date IS NULL AND published_date > strftime('%Y-%m-%d %H:%M:%f', 'now')
    `);

    const integrity = target.prepare('PRAGMA integrity_check').all();
    if (integrity.length !== 1 || integrity[0].integrity_check !== 'ok') throw new Error('The imported database failed the integrity check.');
    if (target.prepare('PRAGMA foreign_key_check').get()) throw new Error('The imported database has foreign-key violations.');
    target.exec('COMMIT');
    return rows;
  } catch (error) {
    if (target.isTransaction) target.exec('ROLLBACK');
    throw error;
  } finally {
    source.close();
    target.close();
  }
}

async function copyMedia(legacyRoot: string, mediaRoot: string) {
  const source = join(legacyRoot, 'resources', 'media');
  if (!existsSync(source)) return;
  await cp(source, mediaRoot, {
    recursive: true,
    force: true,
    preserveTimestamps: true,
    filter: async (path) => !(await lstat(path)).isSymbolicLink(),
  });
}

async function removeDatabase(path: string) {
  await Promise.all(['', '-journal', '-wal', '-shm'].map((suffix) => rm(`${path}${suffix}`, { force: true })));
}

export interface LegacyImportOptions {
  legacyRoot: string;
  databasePath: string;
  mediaRoot?: string;
  createDatabase(path: string): Promise<void>;
}

/** Builds the BLEX 4 database beside its destination so a failed import never leaves a usable file. */
export async function importLegacyInstallation({ legacyRoot, databasePath, mediaRoot, createDatabase }: LegacyImportOptions) {
  const source = join(legacyRoot, 'db.sqlite3');
  verifyLegacyDatabase(source);
  const temporary = `${databasePath}.importing`;
  await removeDatabase(temporary);
  try {
    await createDatabase(temporary);
    const rows = copyRows(source, temporary);
    if (mediaRoot) await copyMedia(legacyRoot, mediaRoot);
    await rename(temporary, databasePath);
    return { rows };
  } catch (error) {
    await removeDatabase(temporary);
    throw error;
  }
}
