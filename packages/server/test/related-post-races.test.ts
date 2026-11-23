import assert from 'node:assert/strict';
import test from 'node:test';
import { PrismaClient } from '@prisma/client';
import { relatedPosts } from '../src/features/authors/public-activity.js';
import { createMigratedDatabase, insertRow, seedEditor, seedPost } from './fixtures/migrated-database.js';

for (const mutation of ['hidden', 'draft', 'scheduled', 'trash', 'delete', 'inactive'] as const) {
  test(`related posts omit a winner made ${mutation} between ranking and details`, async () => {
    const fixture = await createMigratedDatabase();
    const db = new PrismaClient({ datasourceUrl: `file:${fixture.path}` });
    try {
      seedEditor(fixture.db, 1, 'writer');
      seedEditor(fixture.db, 2, 'other-writer');
      seedPost(fixture.db, 1, 1, 'source');
      seedPost(fixture.db, 2, 2, 'changing');
      seedPost(fixture.db, 3, 1, 'unchanged');
      insertRow(fixture.db, 'Tag', { id: 1, name: 'shared' });
      for (const id of [1, 2, 3]) insertRow(fixture.db, '_PostToTag', { A: id, B: 1 });
      assert.equal((await relatedPosts(db, 1, 1)).length, 2);

      let changed = false;
      const concurrent = db.$extends({
        query: {
          post: {
            async findMany({ args, query }) {
              if (!changed && args.select?.slug) {
                changed = true;
                switch (mutation) {
                  case 'hidden':
                    await db.post.update({ where: { id: 2 }, data: { isHidden: true } });
                    break;
                  case 'draft':
                    await db.post.update({ where: { id: 2 }, data: { publishedAt: null } });
                    break;
                  case 'scheduled':
                    await db.post.update({ where: { id: 2 }, data: { publishedAt: new Date('2999-01-01') } });
                    break;
                  case 'trash':
                    await db.post.update({ where: { id: 2 }, data: { deletedAt: new Date() } });
                    break;
                  case 'delete':
                    await db.post.delete({ where: { id: 2 } });
                    break;
                  case 'inactive':
                    await db.user.update({ where: { id: 2 }, data: { isActive: false } });
                    break;
                }
              }
              return query(args);
            },
          },
        },
      });
      const rows = await relatedPosts(concurrent as unknown as PrismaClient, 1, 1);
      assert.equal(changed, true);
      assert.deepEqual(
        rows.map(({ slug }) => slug),
        ['unchanged'],
      );
    } finally {
      await db.$disconnect();
      await fixture.cleanup();
    }
  });
}
