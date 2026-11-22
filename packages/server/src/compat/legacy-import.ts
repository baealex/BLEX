import { cp, lstat, rename, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { verifyLegacyDatabase } from './legacy-database.js';

const discardedTables = new Set(['django_migrations', 'django_session']);

const quote = (name: string) => `"${name.replaceAll('"', '""')}"`;

type ColumnMapping = string | { to: string; convert(value: SQLInputValue, source: string, id: SQLInputValue): SQLInputValue };

/** 3.x stored naive UTC text, sometimes with an offset. Prisma stores SQLite dates as epoch milliseconds. */
export function legacyDate(value: SQLInputValue): SQLInputValue {
  if (value === null) return null;
  const text = String(value).trim().replace(' ', 'T');
  const dated = text.includes('T') ? text : `${text}T00:00:00`;
  const milliseconds = Date.parse(/(?:Z|[+-]\d{2}:?\d{2})$/.test(dated) ? dated : `${dated}Z`);
  if (!Number.isFinite(milliseconds)) throw new Error(`Found an unreadable date: ${String(value)}.`);
  return BigInt(milliseconds);
}

const date = (to: string): ColumnMapping => ({ to, convert: legacyDate });

function rejectedValue(source: string, id: SQLInputValue, value: SQLInputValue, accepted: string) {
  return new Error(`${source} in row ${String(id)} is "${String(value)}", but BLEX 4 only accepts ${accepted}. Correct that row in the 3.14 database and start again.`);
}

/** Prisma fails every later read of a value outside its enum, so a hand-edited row stops the import here. */
const choice = (to: string, allowed: readonly string[]): ColumnMapping => ({
  to,
  convert(value, source, id) {
    if (typeof value === 'string' && allowed.includes(value)) return value;
    throw rejectedValue(source, id, value, allowed.join(', '));
  },
});

/** Prisma also fails every later read of an Int column holding a wider number. */
const int32 = (to: string): ColumnMapping => ({
  to,
  convert(value, source, id) {
    if (typeof value === 'bigint' && value >= -2147483648n && value <= 2147483647n) return value;
    throw rejectedValue(source, id, value, 'a 32-bit integer');
  },
});

const contentScope = choice('scope', ['user', 'global']);

const tableMappings: Record<string, { to: string; columns: Record<string, ColumnMapping> }> = {
  board_worklog: { to: 'WorkLog', columns: { id: 'id', owner_id: 'ownerId', title: 'title', created_at: date('createdAt') } },
  board_worklogentry: {
    to: 'WorkLogEntry',
    columns: { id: 'id', log_id: 'logId', title: 'title', text: 'text', media_type: 'mediaType', attachment: 'attachment', created_at: date('createdAt') },
  },
  board_worklogshare: { to: 'WorkLogShare', columns: { id: 'id', log_id: 'logId', token: 'token', headline: 'headline', created_at: date('createdAt') } },
  board_worklogshare_entries: { to: '_WorkLogEntryToWorkLogShare', columns: { worklogentry_id: 'A', worklogshare_id: 'B' } },
  board_form: {
    to: 'FormTemplate',
    columns: { id: 'id', user_id: 'userId', title: 'title', content: 'content', is_public: 'isPublic', created_date: date('createdAt'), updated_date: date('updatedAt') },
  },
  board_staticpage: {
    to: 'StaticPage',
    columns: {
      id: 'id', author_id: 'authorId', slug: 'slug', title: 'title', content: 'content', meta_description: 'description',
      is_published: 'isPublished', show_in_footer: 'showInFooter', order: int32('order'), created_date: date('createdAt'), updated_date: date('updatedAt'),
    },
  },
  board_sitenotice: {
    to: 'SiteNotice',
    columns: {
      id: 'id', user_id: 'userId', scope: contentScope, title: 'title', url: 'url', is_active: 'isActive',
      order: int32('order'), created_date: date('createdAt'), updated_date: date('updatedAt'),
    },
  },
  board_sitebanner: {
    to: 'SiteBanner',
    columns: {
      id: 'id', user_id: 'userId', scope: contentScope, banner_type: choice('type', ['horizontal', 'sidebar']),
      position: choice('position', ['top', 'bottom', 'left', 'right']), title: 'title', content_html: 'contentHtml', is_active: 'isActive',
      order: int32('order'), created_date: date('createdAt'), updated_date: date('updatedAt'),
    },
  },
};

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
  const mapping = tableMappings[table];
  const destination = mapping?.to ?? table;
  const columns = mapping ? Object.keys(mapping.columns) : columnNames(source, table);
  const outputs = columns.map((column) => mapping?.columns[column] ?? column);
  const names = outputs.map((output) => (typeof output === 'string' ? output : output.to));
  const available = new Set(columnNames(target, destination));
  const missing = names.filter((name) => !available.has(name));
  if (missing.length) throw new Error(`The BLEX 4 schema is missing ${destination}: ${missing.join(', ')}.`);

  const read = source.prepare(`SELECT ${columns.map(quote).join(', ')} FROM ${quote(table)}`);
  read.setReadBigInts(true);
  const write = target.prepare(`INSERT INTO ${quote(destination)} (${names.map(quote).join(', ')}) VALUES (${names.map(() => '?').join(', ')})`);
  let copied = 0;
  for (const row of read.iterate() as Iterable<Record<string, SQLInputValue>>) {
    write.run(...columns.map((column, index) => {
      const output = outputs[index];
      return typeof output === 'string' ? row[column] : output.convert(row[column], `${table}.${column}`, row.id ?? null);
    }));
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
      if (!targetTables.has(tableMappings[table]?.to ?? table)) throw new Error(`The BLEX 4 schema has no table for ${table}.`);
      rows += copyTable(source, target, table);
    }

    // Keep AUTOINCREMENT counters so the IDs of deleted rows are never handed out again.
    const sequences = source.prepare('SELECT name, seq FROM sqlite_sequence');
    sequences.setReadBigInts(true);
    target.exec('DELETE FROM sqlite_sequence');
    const sequence = target.prepare('INSERT INTO sqlite_sequence (name, seq) VALUES (?, ?)');
    for (const { name, seq } of sequences.iterate() as Iterable<{ name: string; seq: bigint }>) {
      const destination = tableMappings[name]?.to ?? name;
      if (targetTables.has(destination) && !discardedTables.has(name) && !destination.startsWith('_')) sequence.run(destination, seq);
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
