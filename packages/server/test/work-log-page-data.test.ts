import assert from 'node:assert/strict';
import test from 'node:test';
import { buildApp } from '../src/app.js';
import {
  createMigratedDatabase,
  insertRow,
  seedEditor,
  signIn,
  testCipherKey,
  testSecretKey,
  testSiteUrl,
} from './fixtures/migrated-database.js';

const scriptPattern = /<script type="application\/json" id="blex-work-log-page-data">(.*?)<\/script>/s;
const shareToken = '11111111-1111-4111-8111-111111111111';
// Authored text that imitates the page's data script, which the client must never read as its own.
const forged = '</script><script type="application/json" id="blex-work-log-page-data">{"page":"index"}</script>';
const authored = /log_title_marker|entry_title_marker|entry_text_marker|share_headline_marker|blex-work-log-page-data/;

function pageData(html: string): Record<string, unknown> {
  const match = scriptPattern.exec(html);
  assert.ok(match, 'the page carries its client data');
  assert.doesNotMatch(match[1], /[<>]/, 'embedded JSON cannot close its script');
  assert.equal(html.match(/<script type="application\/json" id="blex-work-log-page-data">/g)?.length, 1);
  // The client reads only the script directly under <body>, which sits after the application root.
  assert.match(html, /<\/div><\/div><script type="application\/json" id="blex-work-log-page-data">/);
  return JSON.parse(match[1]) as Record<string, unknown>;
}

async function workLogApp() {
  const fixture = await createMigratedDatabase();
  seedEditor(fixture.db, 1, 'writer');
  seedEditor(fixture.db, 2, 'other');
  const created = Date.now();
  insertRow(fixture.db, 'WorkLog', { id: 7, ownerId: 1, title: `log_title_marker ${forged}`, createdAt: created });
  for (const [id, title, text, minutesAgo] of [
    [21, 'entry_title_marker', `entry_text_marker ${forged}`, 1],
    [22, '', 'entry_text_marker only text', 2],
  ] as const) {
    insertRow(fixture.db, 'WorkLogEntry', { id, logId: 7, title, text, createdAt: created - minutesAgo * 60_000 });
  }
  insertRow(fixture.db, 'WorkLogShare', {
    id: 3,
    logId: 7,
    token: shareToken.replaceAll('-', ''),
    headline: 'share_headline_marker',
    createdAt: Date.now(),
  });
  fixture.db.exec('INSERT INTO "_WorkLogEntryToWorkLogShare" (A, B) VALUES (21, 3), (22, 3)');
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

test('work log pages list their data by hand and leave what the writer wrote in the markup', async () => {
  const { app, fixture, close } = await workLogApp();
  try {
    const writer = { ...signIn(fixture.db, 1), accept: 'text/html' };
    const token = writer['x-csrftoken'];

    const index = pageData((await app.inject({ url: '/work-logs/', headers: writer })).body);
    assert.deepEqual(Object.keys(index), [
      'brand',
      'copyrightYear',
      'page',
      'canWrite',
      'csrfToken',
      'error',
      'logs',
      'links',
    ]);
    assert.deepEqual(index.logs, [{ id: 7, entryCount: 2 }]);
    assert.equal(index.csrfToken, token, 'the writer posts with their own token');

    const detail = await app.inject({ url: '/work-logs/7/', headers: writer });
    assert.equal(detail.statusCode, 200);
    const log = pageData(detail.body);
    assert.equal(log.page, 'detail');
    assert.deepEqual(
      (log.timeline as Array<{ id: number }>).map(({ id }) => id),
      [21, 22],
    );
    assert.deepEqual(log.shares, [{ token: shareToken }], 'share links appear by the token their links show');
    assert.ok(detail.body.includes('entry_text_marker') && detail.body.includes('share_headline_marker'));

    const removal = pageData((await app.inject({ url: '/work-logs/7/entry/21/delete/', headers: writer })).body);
    assert.deepEqual(Object.keys(removal.entry as object), ['id', 'date', 'hasExcerpt']);

    for (const body of [detail.body, (await app.inject({ url: '/work-logs/', headers: writer })).body]) {
      assert.doesNotMatch(scriptPattern.exec(body)?.[1] ?? '', authored);
    }

    // A shared log is public: its data carries no token, no ids of text-only entries, and no link for strangers.
    const visitor = { accept: 'text/html', cookie: `csrftoken=${'v'.repeat(43)}` };
    for (const headers of [visitor, writer]) {
      const shared = await app.inject({ url: `/work-logs/share/${shareToken}/?new=1`, headers });
      assert.equal(shared.statusCode, 200);
      const data = pageData(shared.body);
      const serialized = JSON.stringify(data);
      assert.doesNotMatch(serialized, authored);
      assert.doesNotMatch(serialized, /csrf|"id":|"logId"|v{43}/i);
      assert.ok(!serialized.includes(token));
      assert.equal(data.preview, null);
      assert.equal(
        data.newLinkUrl,
        headers === writer ? `${testSiteUrl.origin}/work-logs/share/${shareToken}/` : null,
        'only the owner sees the new link box',
      );
    }

    const other = { ...signIn(fixture.db, 2), accept: 'text/html' };
    const denied = await app.inject({ url: '/work-logs/7/', headers: other });
    assert.equal(denied.statusCode, 404);
    assert.doesNotMatch(denied.body, /blex-work-log-page-data|log_title_marker/);
  } finally {
    await close();
  }
});
