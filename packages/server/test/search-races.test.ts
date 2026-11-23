import assert from 'node:assert/strict';
import test from 'node:test';
import { PrismaClient } from '@prisma/client';
import { listPosts } from '../src/features/developer-api/services/posts.js';
import { rankPublicSearch, readSearchPage } from '../src/features/discovery/services/public-posts.js';
import { createMigratedDatabase, seedEditor, seedPost } from './fixtures/migrated-database.js';

const token = {
  id: 1,
  name: 'Search test',
  tokenPrefix: 'fixture',
  scopes: ['posts:read'],
  user: { id: 1, username: 'writer', firstName: 'Writer', email: '', isActive: true, role: 'EDITOR' },
};

test('search cards omit posts deleted or made private after ranking', async () => {
  const fixture = await createMigratedDatabase();
  const db = new PrismaClient({ datasourceUrl: `file:${fixture.path}` });
  try {
    seedEditor(fixture.db, 1, 'writer');
    for (let id = 1; id <= 6; id += 1) seedPost(fixture.db, id, 1, `needle-${id}`, { title: `Needle ${id}` });
    const matches = await rankPublicSearch(db, ['Needle'], 'writer');
    assert.equal(matches.length, 6);
    await db.post.update({ where: { id: 1 }, data: { isHidden: true } });
    await db.post.update({ where: { id: 2 }, data: { publishedAt: null } });
    await db.post.update({ where: { id: 3 }, data: { publishedAt: new Date('2999-01-01') } });
    await db.post.update({ where: { id: 4 }, data: { deletedAt: new Date() } });
    await db.post.delete({ where: { id: 5 } });

    const page = await readSearchPage(db, matches, 20, 0);
    assert.deepEqual(
      page.map((post) => post.id),
      [6],
    );
    await db.user.update({ where: { id: 1 }, data: { isActive: false } });
    assert.deepEqual(await readSearchPage(db, matches, 20, 0), []);
  } finally {
    await db.$disconnect();
    await fixture.cleanup();
  }
});

test('search ranking rechecks visibility when loading matched publication dates', async () => {
  const fixture = await createMigratedDatabase();
  const db = new PrismaClient({ datasourceUrl: `file:${fixture.path}` });
  try {
    seedEditor(fixture.db, 1, 'writer');
    seedPost(fixture.db, 1, 1, 'needle', { title: 'Needle' });
    let changed = false;
    const concurrent = db.$extends({
      query: {
        post: {
          async findMany({ args, query }) {
            if (!changed && args.select?.publishedAt) {
              changed = true;
              await db.post.update({ where: { id: 1 }, data: { publishedAt: null } });
            }
            return query(args);
          },
        },
      },
    });
    assert.deepEqual(await rankPublicSearch(concurrent as unknown as PrismaClient, ['Needle'], 'writer'), []);
    assert.equal(changed, true);
  } finally {
    await db.$disconnect();
    await fixture.cleanup();
  }
});

for (const mutation of ['trash', 'delete'] as const) {
  test(`developer search tolerates a post being ${mutation === 'trash' ? 'trashed' : 'deleted'} before details load`, async () => {
    const fixture = await createMigratedDatabase();
    const db = new PrismaClient({ datasourceUrl: `file:${fixture.path}` });
    try {
      seedEditor(fixture.db, 1, 'writer');
      seedPost(fixture.db, 1, 1, 'needle', { title: 'Needle' });
      let changed = false;
      const concurrent = db.$extends({
        query: {
          post: {
            async findMany({ args, query }) {
              if (!changed && args.select?.title) {
                changed = true;
                if (mutation === 'trash') await db.post.update({ where: { id: 1 }, data: { deletedAt: new Date() } });
                else await db.post.delete({ where: { id: 1 } });
              }
              return query(args);
            },
          },
        },
      });
      const result = await listPosts(concurrent as unknown as PrismaClient, token, {}, { q: 'Needle' });
      assert.equal(changed, true);
      assert.deepEqual(result.data?.posts, []);
    } finally {
      await db.$disconnect();
      await fixture.cleanup();
    }
  });
}
