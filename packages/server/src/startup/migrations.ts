import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execute = promisify(execFile);
const prismaCli = fileURLToPath(new URL('../../../node_modules/prisma/build/index.js', import.meta.url));
const schema = fileURLToPath(new URL('../../../prisma/schema.prisma', import.meta.url));
const initialMigration = '0001_init';

async function migrate(databasePath: string, args: string[]) {
  try {
    await execute(process.execPath, [prismaCli, 'migrate', ...args, `--schema=${schema}`], {
      env: { ...process.env, DATABASE_URL: `file:${resolve(databasePath)}`, PRISMA_HIDE_UPDATE_MESSAGE: 'true' },
      maxBuffer: 4 * 1024 * 1024,
    });
  } catch (error) {
    const detail = (error as { stderr?: string }).stderr?.trim();
    throw new Error(`Could not apply the database migrations.${detail ? `\n${detail}` : ''}`, { cause: error });
  }
}

export function deployMigrations(databasePath: string) {
  return migrate(databasePath, ['deploy']);
}

/** Stops at the first migration: the 3.14 import maps to this schema, and later versions migrate from it. */
export async function createInitialDatabase(databasePath: string) {
  const sql = await readFile(new URL(`../../../prisma/migrations/${initialMigration}/migration.sql`, import.meta.url), 'utf8');
  const db = new DatabaseSync(databasePath);
  try {
    db.exec(sql);
  } finally {
    db.close();
  }
  await migrate(databasePath, ['resolve', '--applied', initialMigration]);
}
