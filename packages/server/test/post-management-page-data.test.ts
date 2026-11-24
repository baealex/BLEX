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

const scriptPattern = /<script type="application\/json" id="blex-post-management-page-data">(.*?)<\/script>/s;

function pageData(html: string): Record<string, unknown> {
  const match = scriptPattern.exec(html);
  assert.ok(match, 'the page carries its client data');
  assert.doesNotMatch(match[1], /[<>]/, 'embedded JSON cannot close its script');
  return JSON.parse(match[1]) as Record<string, unknown>;
}

// Revision content imitates the page's own rows and data script, which the client must not mistake for its own.
const forged =
  '<div class="forms">forged_forms_marker</div><div class="revision-body">revision_html_marker</div>' +
  '<script type="application/json" id="blex-post-management-page-data">{"page":"share-links"}</script>';

async function managementApp() {
  const fixture = await createMigratedDatabase();
  seedEditor(fixture.db, 1, 'writer');
  seedEditor(fixture.db, 2, 'other');
  fixture.db.prepare('UPDATE "User" SET email = ? WHERE id = 1').run('writer-private@example.test');
  seedPost(fixture.db, 10, 1, 'kept', { title: 'Kept post' });
  fixture.db.prepare('UPDATE "PostContent" SET html = ? WHERE postId = 10').run('<p>current_body_marker</p>');
  for (const [id, type, content, contentExcerpt] of [
    [1, 'edit', `<p>${forged}</p>`, 'revision_excerpt_marker'],
    [2, 'legacy', '_NO_CHANGED_', null],
    [3, 'draft', '<p>draft_frame_marker</p>', null],
  ] as const) {
    insertRow(fixture.db, 'PostRevision', {
      id,
      postId: 10,
      actorId: 1,
      type,
      title: `Revision ${id}`,
      content,
      contentExcerpt,
      tags: '[]',
      createdAt: Date.now() - id * 60_000,
    });
  }
  insertRow(fixture.db, 'PostShareLink', {
    id: 5,
    postId: 10,
    token: 'abc234',
    label: 'Newsletter',
    createdAt: Date.now(),
  });
  const app = await buildApp(
    fixture.path,
    testSiteUrl,
    { secretKey: testSecretKey, cipherKey: testCipherKey },
    fixture.mediaRoot,
  );
  return {
    app,
    fixture,
    async close() {
      await app.close();
      await fixture.cleanup();
    },
  };
}

test('post management pages list their data by hand and leave revision content in the markup', async () => {
  const { app, fixture, close } = await managementApp();
  try {
    const author = signIn(fixture.db, 1);
    const token = author['x-csrftoken'];

    const revisions = await app.inject({ url: '/@writer/kept/revisions', headers: author });
    assert.equal(revisions.statusCode, 200);
    const history = pageData(revisions.body);
    assert.deepEqual(Object.keys(history), [
      'page',
      'postPath',
      'title',
      'totalCount',
      'notice',
      'csrfToken',
      'updatedDate',
      'pagination',
      'revisions',
    ]);
    assert.equal(history.csrfToken, token, 'the author posts with their own token');
    assert.deepEqual(
      (history.revisions as Array<Record<string, unknown>>).map(({ id, hasExcerpt, hasContent }) => [
        id,
        hasExcerpt,
        hasContent,
      ]),
      [
        [1, true, true],
        [2, false, false],
      ],
    );
    assert.ok(revisions.body.includes('revision_html_marker') && revisions.body.includes('revision_excerpt_marker'));

    const timelapse = await app.inject({ url: '/@writer/kept/timelapse', headers: author });
    assert.equal(timelapse.statusCode, 200);
    const timeline = pageData(timelapse.body);
    assert.deepEqual(Object.keys(timeline), ['page', 'postPath', 'title', 'totalCount', 'frames']);
    assert.deepEqual(Object.keys((timeline.frames as object[])[0]), ['savedAt', 'title', 'draft', 'savedLabel']);
    assert.ok(timelapse.body.includes('draft_frame_marker'));

    const shares = await app.inject({ url: '/@writer/kept/share-links', headers: author });
    assert.equal(shares.statusCode, 200);
    const links = pageData(shares.body);
    assert.equal(links.page, 'share-links');
    assert.equal(links.csrfToken, token);
    assert.deepEqual(links.links, [
      {
        id: 5,
        label: 'Newsletter',
        url: `${testSiteUrl.origin}/r/abc234`,
        isPaused: false,
        recentClicks: 0,
        totalClicks: 0,
      },
    ]);

    for (const body of [revisions.body, timelapse.body, shares.body]) {
      const serialized = scriptPattern.exec(body)?.[1] ?? '';
      assert.doesNotMatch(
        serialized,
        /revision_html_marker|revision_excerpt_marker|draft_frame_marker|current_body_marker|writer-private|forged_forms_marker/,
      );
      // The client reads only the script directly under <body>, which sits after the application root.
      assert.equal(body.match(/<script type="application\/json" id="blex-post-management-page-data">/g)?.length, 1);
      assert.match(body, /<\/div><\/div><script type="application\/json" id="blex-post-management-page-data">/);
    }

    // Another author, a visitor, and a missing post never receive the pages or their data.
    const other = signIn(fixture.db, 2);
    for (const url of ['/@writer/kept/revisions', '/@writer/kept/timelapse', '/@writer/kept/share-links']) {
      const denied = await app.inject({ url, headers: other });
      assert.equal(denied.statusCode, 404, url);
      assert.doesNotMatch(denied.body, /blex-post-management-page-data/);
      const visitor = await app.inject({ url });
      assert.equal(visitor.statusCode, 302, url);
    }
  } finally {
    await close();
  }
});
