import { readFileSync } from 'node:fs';
import type { DatabaseSync } from 'node:sqlite';

const notificationTables = ['Notification', 'NotificationDelivery', 'TelegramConnection', 'ScheduledPublication'];

export function installNotificationTables(db: DatabaseSync) {
  const schema = readFileSync(new URL('../../../prisma/migrations/0001_init/migration.sql', import.meta.url), 'utf8');
  const statements = schema.split(/;\n+/);
  for (const name of notificationTables) {
    const table = statements.find((statement) => statement.includes(`CREATE TABLE "${name}" `));
    if (!table) throw new Error(`Missing ${name} in the initial migration`);
    db.exec(table);
    for (const index of statements.filter((statement) => /CREATE (?:UNIQUE )?INDEX /.test(statement) && statement.includes(` ON "${name}"(`))) db.exec(index);
  }
}
