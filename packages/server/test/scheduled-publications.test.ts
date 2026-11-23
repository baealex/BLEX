import assert from 'node:assert/strict';
import test from 'node:test';
import { PrismaClient } from '@prisma/client';
import { processScheduledPublications } from '../src/features/notifications/model.js';
import { createMigratedDatabase, insertRow, seedEditor, seedPost } from './fixtures/migrated-database.js';

type Fixture = Awaited<ReturnType<typeof createMigratedDatabase>>;

function addSubscribers(fixture: Fixture, authorId: number, firstId: number, count: number) {
  fixture.db.exec(`
    WITH RECURSIVE ids(id) AS (SELECT ${firstId} UNION ALL SELECT id + 1 FROM ids WHERE id < ${firstId + count - 1})
    INSERT INTO "User" (id, username, email, passwordHash, joinedAt, isActive)
    SELECT id, 'reader' || id, '', 'pbkdf2_sha256$fixture$reader', 1577836800000, 1 FROM ids;
    WITH RECURSIVE ids(id) AS (SELECT ${firstId} UNION ALL SELECT id + 1 FROM ids WHERE id < ${firstId + count - 1})
    INSERT INTO "AuthorSubscription" (subscriberId, authorId, createdAt) SELECT id, ${authorId}, 1577836800000 FROM ids;
  `);
}

function schedule(fixture: Fixture, postId: number, authorId: number, slug: string) {
  const publishAt = Date.now() - 1000;
  seedPost(fixture.db, postId, authorId, slug, { publishedAt: publishAt, updatedAt: publishAt });
  insertRow(fixture.db, 'ScheduledPublication', { postId, publishAt });
}

const count = (fixture: Fixture, table: string) =>
  (fixture.db.prepare(`SELECT COUNT(*) AS total FROM "${table}"`).get() as { total: number }).total;

test('a large scheduled post notifies in steps without duplicates', async () => {
  const fixture = await createMigratedDatabase();
  seedEditor(fixture.db, 1, 'writer');
  addSubscribers(fixture, 1, 100, 2_100);
  schedule(fixture, 10, 1, 'large-post');
  insertRow(fixture.db, 'WebhookChannel', {
    id: 1,
    scope: 'global',
    isActive: 1,
    name: 'all',
    url: 'https://hooks.example/a',
  });
  const db = new PrismaClient({ datasourceUrl: `file:${fixture.path}?connection_limit=1` });
  try {
    await processScheduledPublications(db);
    assert.equal(count(fixture, 'Notification'), 2_000);
    assert.equal(count(fixture, 'ScheduledPublication'), 1);
    assert.equal(count(fixture, 'WebhookDelivery'), 0);

    await processScheduledPublications(db);
    assert.equal(count(fixture, 'Notification'), 2_100);
    assert.equal(count(fixture, 'ScheduledPublication'), 0);
    assert.equal(count(fixture, 'WebhookDelivery'), 1);

    await processScheduledPublications(db);
    assert.equal(count(fixture, 'Notification'), 2_100);
  } finally {
    await db.$disconnect();
    await fixture.cleanup();
  }
});

test('a restart resumes a scheduled post without notifying anyone twice', async () => {
  const fixture = await createMigratedDatabase();
  seedEditor(fixture.db, 1, 'writer');
  addSubscribers(fixture, 1, 100, 2_100);
  schedule(fixture, 10, 1, 'large-post');
  const first = new PrismaClient({ datasourceUrl: `file:${fixture.path}?connection_limit=1` });
  const restarted = new PrismaClient({ datasourceUrl: `file:${fixture.path}?connection_limit=1` });
  try {
    await processScheduledPublications(first);
    assert.equal(count(fixture, 'Notification'), 2_000);
    await processScheduledPublications(restarted);
    await processScheduledPublications(restarted);
    assert.equal(count(fixture, 'Notification'), 2_100);
    assert.equal(count(fixture, 'ScheduledPublication'), 0);
  } finally {
    await first.$disconnect();
    await restarted.$disconnect();
    await fixture.cleanup();
  }
});

test('one failing scheduled post does not stop the next one', async () => {
  const fixture = await createMigratedDatabase();
  seedEditor(fixture.db, 1, 'writer');
  seedEditor(fixture.db, 2, 'other');
  addSubscribers(fixture, 1, 100, 1);
  addSubscribers(fixture, 2, 200, 1);
  schedule(fixture, 10, 1, 'failing-post');
  schedule(fixture, 11, 2, 'working-post');
  fixture.db.exec(`CREATE TRIGGER reject_one BEFORE INSERT ON "Notification" WHEN NEW.userId = 100
    BEGIN SELECT RAISE(ABORT, 'rejected'); END;`);
  const db = new PrismaClient({ datasourceUrl: `file:${fixture.path}?connection_limit=1` });
  const logged = console.error;
  console.error = () => undefined;
  try {
    await processScheduledPublications(db);
    assert.equal(count(fixture, 'Notification'), 1);
    const left = fixture.db.prepare('SELECT postId FROM "ScheduledPublication"').all() as Array<{ postId: number }>;
    assert.deepEqual(
      left.map(({ postId }) => postId),
      [10],
    );
  } finally {
    console.error = logged;
    await db.$disconnect();
    await fixture.cleanup();
  }
});
