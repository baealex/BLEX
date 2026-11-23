import assert from 'node:assert/strict';
import test from 'node:test';
import { buildApp } from '../src/app.js';
import {
  createMigratedDatabase,
  seedEditor,
  seedPost,
  testCipherKey,
  testSecretKey,
  testSiteUrl,
} from './fixtures/migrated-database.js';

test('public posts load the code block module only when they have a language block', async () => {
  const fixture = await createMigratedDatabase();
  seedEditor(fixture.db, 1, 'writer');
  seedPost(fixture.db, 10, 1, 'with-code');
  seedPost(fixture.db, 11, 1, 'without-code');
  fixture.db
    .prepare('UPDATE "PostContent" SET html = ? WHERE postId = 10')
    .run('<pre><code class="language-python">print(1)</code></pre>');
  fixture.db.prepare('UPDATE "PostContent" SET html = ? WHERE postId = 11').run('<p>language-python is plain text</p>');
  const app = await buildApp(
    fixture.path,
    testSiteUrl,
    { secretKey: testSecretKey, cipherKey: testCipherKey },
    fixture.mediaRoot,
  );
  try {
    const module = 'data-blex-page-module="code-blocks"';
    assert.ok((await app.inject('/@writer/with-code')).body.includes(module));
    assert.ok(!(await app.inject('/@writer/without-code')).body.includes(module));
    const asset = await app.inject('/assets/blex/code-blocks.js');
    assert.equal(asset.statusCode, 302);
    assert.match(String(asset.headers.location), /^\/assets\/ui\/.+\.js$/);
  } finally {
    await app.close();
    await fixture.cleanup();
  }
});
