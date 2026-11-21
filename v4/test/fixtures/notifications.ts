import { readFileSync } from 'node:fs';
import type { DatabaseSync } from 'node:sqlite';

export function installNotificationTables(db: DatabaseSync) {
  const baseline = readFileSync(new URL('../../../prisma/migrations/0000_django_3x/migration.sql', import.meta.url), 'utf8');
  for (const name of ['board_userconfigmeta', 'board_notify']) {
    const statement = baseline.split('\n').find((line) => line.startsWith(`CREATE TABLE "${name}" `));
    if (!statement) throw new Error(`Missing ${name} in the Django migration baseline`);
    db.exec(statement);
  }
  db.exec(readFileSync(new URL('../../../prisma/migrations/0004_notification_delivery/migration.sql', import.meta.url), 'utf8'));
}
