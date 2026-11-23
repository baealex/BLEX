import assert from 'node:assert/strict';
import test from 'node:test';
import { buildApp } from '../src/app.js';
import {
  createMigratedDatabase,
  insertRow,
  seedEditor,
  seedPost,
  signIn,
  testCipherKey,
  testSecretKey,
  testSiteUrl,
} from './fixtures/migrated-database.js';

interface PostPageData {
  csrfToken: string;
  comments: { csrfToken: string; comments: Array<{ permissions: { canEdit: boolean } }> };
}

function pageData(html: string): PostPageData {
  const match = /<script type="application\/json" id="blex-post-page-data">(.*?)<\/script>/s.exec(html);
  assert.ok(match, 'the post carries its client data');
  assert.doesNotMatch(match[1], /[<>]/, 'embedded JSON cannot close its script');
  return JSON.parse(match[1]) as PostPageData;
}

test('a post hydrates from a public view that leaves its body in the server markup', async () => {
  const fixture = await createMigratedDatabase();
  seedEditor(fixture.db, 1, 'writer');
  seedEditor(fixture.db, 2, 'commenter');
  fixture.db.prepare('UPDATE "User" SET email = ? WHERE id = 1').run('writer-private@example.test');
  seedPost(fixture.db, 10, 1, 'with-code');
  fixture.db
    .prepare('UPDATE "PostContent" SET html = ? WHERE postId = 10')
    .run('<pre><code class="language-python">unique_body_marker = 1</code></pre>');
  insertRow(fixture.db, 'Comment', {
    id: 20,
    postId: 10,
    authorId: 2,
    markdown: 'comment-source-marker',
    html: '<p>closing </script> tag</p>',
  });
  const app = await buildApp(
    fixture.path,
    testSiteUrl,
    { secretKey: testSecretKey, cipherKey: testCipherKey },
    fixture.mediaRoot,
  );
  try {
    const anonymous = await app.inject({ url: '/@writer/with-code', headers: { cookie: 'csrftoken=visitor-token' } });
    assert.match(anonymous.body, /unique_body_marker/, 'the body is readable without JavaScript');
    assert.doesNotMatch(anonymous.body, /data-blex-page-module|data-model=/);
    const data = pageData(anonymous.body);
    const serialized = JSON.stringify(data);
    assert.doesNotMatch(serialized, /unique_body_marker/);
    assert.doesNotMatch(serialized, /writer-private|comment-source-marker|authorId/);
    assert.equal(data.csrfToken, '');
    assert.equal(data.comments.csrfToken, '');
    assert.equal(data.comments.comments[0].permissions.canEdit, false);

    const commenter = await app.inject({ url: '/@writer/with-code', headers: signIn(fixture.db, 2) });
    assert.equal(commenter.headers['cache-control'], 'private, no-store');
    const commenterData = pageData(commenter.body);
    assert.equal(commenterData.comments.comments[0].permissions.canEdit, true);
    assert.match(commenterData.csrfToken, /\S/);
  } finally {
    await app.close();
    await fixture.cleanup();
  }
});

test('post content cannot forge the page data script', async () => {
  const fixture = await createMigratedDatabase();
  seedEditor(fixture.db, 1, 'writer');
  seedPost(fixture.db, 10, 1, 'forged', { title: 'Real title' });
  fixture.db
    .prepare('UPDATE "PostContent" SET html = ? WHERE postId = 10')
    .run(
      '<p id="blex-post-page-data">{"title":"forged"}</p>' +
        '<script type="application/json" id="blex-post-page-data">{"title":"forged"}</script>',
    );
  const app = await buildApp(
    fixture.path,
    testSiteUrl,
    { secretKey: testSecretKey, cipherKey: testCipherKey },
    fixture.mediaRoot,
  );
  try {
    const { body } = await app.inject('/@writer/forged');
    assert.equal(body.match(/<script[^>]*id="blex-post-page-data"/g)?.length, 1);
    // The client reads only a script directly under <body>, which sanitized content cannot create.
    assert.match(body, /<\/div><\/div><script type="application\/json" id="blex-post-page-data">/);
    assert.equal((pageData(body) as PostPageData & { title: string }).title, 'Real title');
  } finally {
    await app.close();
    await fixture.cleanup();
  }
});
