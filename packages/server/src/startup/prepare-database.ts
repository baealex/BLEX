import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { importLegacyInstallation } from '../compat/legacy-import.js';
import { createInitialDatabase, deployMigrations } from './migrations.js';

/** A problem the operator has to fix. The data has not been changed. */
export class DatabaseSetupError extends Error {}

type DatabaseKind = 'missing' | 'current' | 'prerelease' | 'legacy' | 'unknown';

function databaseKind(path: string): DatabaseKind {
  if (!existsSync(path) || statSync(path).size === 0) return 'missing';
  let db: DatabaseSync | undefined;
  try {
    db = new DatabaseSync(path, { readOnly: true });
    const rows = db.prepare(`SELECT name FROM sqlite_schema WHERE type = 'table'`).all() as unknown as Array<{ name: string }>;
    const tables = new Set(rows.map(({ name }) => name));
    if (!tables.size) return 'missing';
    if (tables.has('_prisma_migrations')) {
      return db.prepare(`SELECT 1 FROM _prisma_migrations WHERE migration_name = '0000_django_3x'`).get() ? 'prerelease' : 'current';
    }
    return tables.has('django_migrations') ? 'legacy' : 'unknown';
  } catch {
    return 'unknown';
  } finally {
    db?.close();
  }
}

const guidance: Record<'legacy' | 'prerelease' | 'unknown', string> = {
  legacy: 'This is a BLEX 3.x database. Mount the 3.x data folder read-only at /legacy, leave the BLEX 4 data directory empty, and start again.',
  prerelease: 'This database came from a pre-release BLEX 4 build. Remove it and import from your BLEX 3.14 data, or start with an empty data directory.',
  unknown: 'This file is not a BLEX database. Check the BLEX 4 data directory.',
};

export interface PrepareDatabaseOptions {
  databasePath: string;
  mediaRoot?: string;
  legacyRoot?: string;
  oldComposeDatabase?: string;
  log?: (message: string) => void;
}

/** Brings the database to the current schema before the server opens it. */
export async function prepareDatabase({
  databasePath, mediaRoot, legacyRoot = '/legacy', oldComposeDatabase = '/app/db.sqlite3', log = console.info,
}: PrepareDatabaseOptions) {
  if (existsSync(oldComposeDatabase)) {
    throw new DatabaseSetupError('Found a BLEX 3.x Compose setup. Your data was not changed. Use the baealex/blex:4 image, map the port to 8040, '
      + 'mount a data volume at /var/lib/blex, and mount ./backend/src read-only at /legacy. See docs/UPGRADE_FROM_3.md.');
  }

  const kind = databaseKind(databasePath);
  if (kind === 'legacy' || kind === 'prerelease' || kind === 'unknown') {
    throw new DatabaseSetupError(`${guidance[kind]} Your data was not changed.`);
  }

  if (kind === 'missing' && existsSync(join(legacyRoot, 'db.sqlite3'))) {
    log('Importing the BLEX 3.14 data. The original stays unchanged.');
    try {
      const { rows } = await importLegacyInstallation({ legacyRoot, databasePath, mediaRoot, createDatabase: createInitialDatabase });
      log(`Imported ${rows} rows from BLEX 3.14.`);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new DatabaseSetupError(`Could not import the BLEX 3.14 data: ${reason} The original was not changed.`, { cause: error });
    }
  }
  await deployMigrations(databasePath);
}
