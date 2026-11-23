import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const djangoBaseline = '0070_author_subscription';
const baselineSql = new URL('../../../prisma/legacy/django-3.14.sql', import.meta.url);

interface SchemaObject {
  type: string;
  name: string;
  sql: string;
}

function normalizeTableDefinition(sql: string): string {
  const open = sql.indexOf('(');
  const close = sql.lastIndexOf(')');
  if (open === -1 || close <= open) return sql;

  // Django upgrades may put the same columns in a different physical order.
  // Split only top-level clauses, preserving expressions and quoted defaults.
  const body = sql.slice(open + 1, close);
  const clauses: string[] = [];
  let depth = 0;
  let start = 0;
  const tokens = /"(?:[^"]|"")*"|'(?:[^']|'')*'|`(?:[^`]|``)*`|\[[^\]]*\]|[(),]/g;
  for (const match of body.matchAll(tokens)) {
    if (match[0] === '(') depth += 1;
    else if (match[0] === ')') depth -= 1;
    else if (match[0] === ',' && depth === 0) {
      clauses.push(body.slice(start, match.index).trim());
      start = match.index + 1;
    }
  }
  clauses.push(body.slice(start).trim());
  return sql.slice(0, open + 1) + clauses.sort().join(',') + sql.slice(close);
}

function schemaObjects(db: DatabaseSync): Map<string, string> {
  const rows = db
    .prepare(`
    SELECT type, name, sql FROM sqlite_schema
    WHERE sql IS NOT NULL AND name NOT GLOB 'sqlite_*' AND name <> '_prisma_migrations'
  `)
    .all() as unknown as SchemaObject[];
  return new Map(
    rows.map(({ type, name, sql }) => [`${type} ${name}`, type === 'table' ? normalizeTableDefinition(sql) : sql]),
  );
}

export function verifyLegacyDatabase(dbPath: string): number {
  const db = new DatabaseSync(resolve(dbPath), { readOnly: true });
  const baseline = new DatabaseSync(':memory:');
  try {
    const tables = db.prepare(`SELECT 1 FROM sqlite_schema WHERE type = 'table' AND name = 'django_migrations'`).get();
    const version =
      tables && db.prepare('SELECT 1 FROM django_migrations WHERE app = ? AND name = ?').get('board', djangoBaseline);
    if (!version)
      throw new Error(
        `Upgrade this BLEX 3.x database to 3.14 first: start the baealex/blex:3.14 image once so it applies ${djangoBaseline}, then start BLEX 4.`,
      );

    baseline.exec(readFileSync(baselineSql, 'utf8'));
    const expected = schemaObjects(baseline);
    const actual = schemaObjects(db);
    const differences = [...new Set([...expected.keys(), ...actual.keys()])]
      .filter((key) => expected.get(key) !== actual.get(key))
      .sort();
    if (differences.length)
      throw new Error(`SQLite schema differs from the BLEX 3.x baseline: ${differences.join(', ')}`);

    const integrity = db.prepare('PRAGMA integrity_check').all();
    if (integrity.length !== 1 || integrity[0].integrity_check !== 'ok') {
      throw new Error('SQLite integrity check failed. Restore a valid backup before upgrading.');
    }
    if (db.prepare('PRAGMA foreign_key_check').get()) {
      throw new Error('SQLite contains foreign-key violations. Resolve them before upgrading.');
    }
    return expected.size;
  } finally {
    db.close();
    baseline.close();
  }
}
