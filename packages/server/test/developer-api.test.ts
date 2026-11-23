import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { buildApp } from '../src/app.js';
import { createMigratedDatabase, insertRow, seedEditor, seedPost, testSiteUrl } from './fixtures/migrated-database.js';

// The recorded contract in developer-api-contract.test.ts covers the same routes on a writable server.
test('the read-only Developer API serves every read route and records nothing', async () => {
  const fixture = await createMigratedDatabase();
  seedEditor(fixture.db, 1, 'writer');
  seedPost(fixture.db, 10, 1, 'public-post');
  const token = 'blex_pat_readonly0001_test-secret';
  insertRow(fixture.db, 'DeveloperToken', {
    id: 1,
    name: 'Read token',
    tokenPrefix: 'readonly0001',
    tokenHash: createHash('sha256').update(token, 'utf8').digest('hex'),
    scopes: JSON.stringify(['posts:read']),
    userId: 1,
  });
  const app = await buildApp(fixture.path, testSiteUrl);
  try {
    const headers = { authorization: `Bearer ${token}` };
    for (const path of ['me', 'posts', 'posts/search', 'posts/10', 'tags', 'series']) {
      const response = await app.inject({ url: `/api/developer/v1/${path}`, headers });
      assert.equal(response.statusCode, 200, `${path}: ${response.body}`);
    }
    const write = await app.inject({
      method: 'POST',
      url: '/api/developer/v1/posts',
      headers,
      payload: { title: 'Refused' },
    });
    assert.equal(write.statusCode, 404);
    const logged = fixture.db.prepare('SELECT COUNT(*) AS total FROM "DeveloperRequestLog"').get() as { total: number };
    assert.equal(logged.total, 0);
  } finally {
    await app.close();
    await fixture.cleanup();
  }
});
