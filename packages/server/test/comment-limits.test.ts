import assert from 'node:assert/strict';
import test from 'node:test';
import { buildApp } from '../src/app.js';
import { createCommentRateLimiter } from '../src/features/engagement/services/comment-rate-limit.js';
import { countComments, mergeOlderComments } from './support/comment-model.js';
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

type Fixture = Awaited<ReturnType<typeof createMigratedDatabase>>;
type App = Awaited<ReturnType<typeof buildApp>>;
interface Page {
  comments: Array<{ id: number; replies?: Array<{ id: number }> }>;
  totalComments: number;
  olderCommentsCursor: number | null;
}

async function withPost(run: (fixture: Fixture, app: App) => Promise<void>) {
  const fixture = await createMigratedDatabase();
  seedEditor(fixture.db, 1, 'writer');
  for (const [id, username] of [
    [2, 'readerone'],
    [3, 'readertwo'],
  ] as const) {
    insertRow(fixture.db, 'User', { id, username, passwordHash: `pbkdf2_sha256$fixture$${username}`, isActive: 1 });
    insertRow(fixture.db, 'Profile', { userId: id, role: 'READER' });
  }
  seedPost(fixture.db, 10, 1, 'busy-post');
  const app = await buildApp(
    fixture.path,
    testSiteUrl,
    { secretKey: testSecretKey, cipherKey: testCipherKey },
    fixture.mediaRoot,
  );
  try {
    await run(fixture, app);
  } finally {
    await app.close();
    await fixture.cleanup();
  }
}

function seedComments(fixture: Fixture, count: number, html = '<p>comment</p>') {
  fixture.db.exec('BEGIN');
  for (let id = 1; id <= count; id += 1) {
    insertRow(fixture.db, 'Comment', {
      id,
      markdown: 'comment',
      html,
      authorId: 2,
      postId: 10,
      parentId: id % 5 === 0 ? id - 4 : null,
      createdAt: Date.UTC(2026, 0, 1) + id * 1000,
    });
  }
  fixture.db.exec('COMMIT');
}

const flatIds = (page: Page) => page.comments.flatMap(({ id, replies }) => [id, ...(replies ?? []).map((r) => r.id)]);

test('an account can write ten comments a minute without slowing other accounts', async () => {
  await withPost(async (fixture, app) => {
    const write = (headers: Record<string, string>) =>
      app.inject({
        method: 'POST',
        url: '/v1/comments?url=busy-post',
        headers: { ...headers, 'content-type': 'application/x-www-form-urlencoded' },
        payload: 'commentMd=hello',
      });
    const first = signIn(fixture.db, 2);
    for (let index = 0; index < 10; index += 1) assert.equal((await write(first)).json().status, 'DONE');
    const limited = await write(first);
    assert.equal(limited.statusCode, 429);
    assert.ok(Number(limited.headers['retry-after']) >= 1);
    assert.equal((await write(signIn(fixture.db, 3))).json().status, 'DONE');
    const { total } = fixture.db.prepare('SELECT COUNT(*) AS total FROM "Comment"').get() as { total: number };
    assert.equal(total, 11);
  });
});

test('the comment allowance reopens after its window', () => {
  let time = 0;
  const take = createCommentRateLimiter(() => time);
  for (let index = 0; index < 10; index += 1) assert.equal(take(1), null);
  assert.equal(take(1), 60);
  time = 60_000;
  assert.equal(take(1), null);
});

test('comment pages walk every comment once, newest first', async () => {
  await withPost(async (fixture, app) => {
    seedComments(fixture, 250);
    const seen: number[] = [];
    let before: number | null = null;
    let pages = 0;
    do {
      const query: string = before === null ? '' : `?before=${before}`;
      const page = (await app.inject(`/v1/posts/busy-post/comments${query}`)).json().body as Page;
      assert.equal(page.totalComments, 250);
      assert.ok(flatIds(page).length <= 140);
      seen.push(...flatIds(page));
      before = page.olderCommentsCursor;
      pages += 1;
    } while (before !== null && pages < 10);
    assert.equal(new Set(seen).size, 250);
    assert.ok(pages >= 3);
    assert.equal((await app.inject('/v1/posts/busy-post/comments?before=nope')).json().errorCode, 'error:VA');
  });
});

test('a post full of the longest comments stays a small response', async () => {
  await withPost(async (fixture, app) => {
    seedComments(fixture, 200, `<p>${'&lt;'.repeat(10_000)}</p>`);
    const api = await app.inject('/v1/posts/busy-post/comments');
    assert.ok(api.body.length < 3 * 1024 * 1024, `${api.body.length} bytes`);
    assert.notEqual(api.json().body.olderCommentsCursor, null);
    const page = await app.inject('/@writer/busy-post');
    assert.equal(page.statusCode, 200);
    assert.ok(page.body.length < 8 * 1024 * 1024, `${page.body.length} bytes`);
  });
});

test('an older page merges into the threads on screen without duplicates', () => {
  const comment = (id: number, replies: number[] = []) =>
    ({ id, author: 'a', replies: replies.map((reply) => ({ id: reply, author: 'a', parentId: id })) }) as never;
  const merged = mergeOlderComments([comment(5, [9]), comment(7)], [comment(1), comment(5, [6, 9])]) as Array<{
    id: number;
    replies: Array<{ id: number }>;
  }>;
  assert.deepEqual(
    merged.map(({ id }) => id),
    [1, 5, 7],
  );
  assert.ok(merged[1]);
  assert.deepEqual(
    merged[1].replies.map(({ id }) => id),
    [6, 9],
  );
  assert.equal(countComments(merged as never), 5);
});
