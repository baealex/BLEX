import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { PrismaClient } from '@prisma/client';
import { buildApp } from '../src/app.js';
import { buildImageCleanupPlan, executeImageCleanupPlan } from '../src/features/site-admin/services/image-cleanup.js';
import { deleteModeratedComment } from '../src/features/site-admin/services/moderation.js';
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

async function withSite(run: (fixture: Fixture, app: App, db: PrismaClient) => Promise<void>) {
  const fixture = await createMigratedDatabase();
  seedEditor(fixture.db, 1, 'writer');
  insertRow(fixture.db, 'User', {
    id: 2,
    username: 'reader',
    passwordHash: 'pbkdf2_sha256$fixture$reader',
    isActive: 1,
  });
  insertRow(fixture.db, 'Profile', { userId: 2, role: 'READER' });
  seedPost(fixture.db, 10, 1, 'open-post');
  const app = await buildApp(
    fixture.path,
    testSiteUrl,
    { secretKey: testSecretKey, cipherKey: testCipherKey },
    fixture.mediaRoot,
  );
  const db = new PrismaClient({ datasourceUrl: `file:${fixture.path}?connection_limit=1` });
  try {
    await run(fixture, app, db);
  } finally {
    await db.$disconnect();
    await app.close();
    await fixture.cleanup();
  }
}

async function mediaFile(root: string, name: string) {
  const relative = `images/content/2026/1/1/${name}`;
  const path = join(root, relative);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `image ${name}`);
  return { path, url: `/resources/media/${relative}` };
}

function apiToken(fixture: Fixture, id: number, prefix: string, scopes: string[]) {
  const raw = `blex_pat_${prefix}_test-secret`;
  insertRow(fixture.db, 'DeveloperToken', {
    id,
    name: `Token ${id}`,
    tokenPrefix: prefix,
    tokenHash: createHash('sha256').update(raw, 'utf8').digest('hex'),
    scopes: JSON.stringify(scopes),
    userId: 1,
  });
  return { authorization: `Bearer ${raw}` };
}

test('a soft-deleted comment stays stored but never reaches readers', async () => {
  await withSite(async (fixture, app, db) => {
    const own = await mediaFile(fixture.mediaRoot, 'own.png');
    const moderated = await mediaFile(fixture.mediaRoot, 'moderated.png');
    for (const [id, url] of [
      [1, own.url],
      [2, moderated.url],
    ] as const) {
      insertRow(fixture.db, 'Comment', {
        id,
        postId: 10,
        authorId: 2,
        markdown: `010-1234-5678 ![a](${url})`,
        html: `<p>010-1234-5678 <img src="${url}"></p>`,
      });
    }

    const removed = await app.inject({ method: 'DELETE', url: '/v1/comments/1', headers: signIn(fixture.db, 2) });
    assert.equal(removed.json().status, 'DONE', removed.body);
    assert.doesNotMatch(removed.body, /010-1234/);
    assert.equal((await deleteModeratedComment(db, 1, 2)).ok, true);

    const page = await app.inject('/v1/posts/open-post/comments');
    assert.doesNotMatch(page.body, /010-1234|own\.png|moderated\.png/);

    const rows = await db.comment.findMany({ select: { authorId: true, markdown: true } });
    assert.equal(rows.length, 2);
    for (const row of rows) {
      assert.equal(row.authorId, null);
      assert.match(row.markdown, /010-1234-5678/);
    }

    const plan = await buildImageCleanupPlan(db, fixture.mediaRoot, { target: 'content' });
    assert.equal(plan.unusedFiles.length, 0);
    await executeImageCleanupPlan(db, fixture.mediaRoot, plan);
    for (const file of [own, moderated]) assert.equal(existsSync(file.path), true);
  });
});

test('a post that stops being public leaves a past commenter list', async () => {
  await withSite(async (fixture, app, db) => {
    seedPost(fixture.db, 11, 1, 'other-post');
    insertRow(fixture.db, 'Comment', { id: 1, postId: 10, authorId: 2, markdown: 'a', html: '<p>hidden one</p>' });
    insertRow(fixture.db, 'Comment', { id: 2, postId: 11, authorId: 2, markdown: 'b', html: '<p>public one</p>' });
    insertRow(fixture.db, 'Comment', { id: 3, postId: 10, authorId: 1, markdown: 'c', html: '<p>author one</p>' });
    await db.post.update({ where: { id: 10 }, data: { isHidden: true, title: 'Secret new title' } });

    const reader = signIn(fixture.db, 2);
    const list = async (headers: Record<string, string>) =>
      (await app.inject({ url: '/v1/comments/user', headers })).json().body;
    const hidden = await list(reader);
    assert.doesNotMatch(JSON.stringify(hidden), /Secret new title|open-post|hidden one/);
    assert.deepEqual(
      hidden.comments.map((row: { posts: { url: string } }) => row.posts.url),
      ['other-post'],
    );
    assert.equal(hidden.lastPage, 1);

    const author = await list(signIn(fixture.db, 1));
    assert.equal(author.comments[0].posts.title, 'Secret new title');

    await db.post.update({ where: { id: 10 }, data: { isHidden: false } });
    assert.equal((await list(reader)).comments.length, 2);
  });
});

test('a write-only token confirms a change without reading the post', async () => {
  await withSite(async (fixture, app) => {
    seedPost(fixture.db, 20, 1, 'private-draft', { title: 'Private draft title', publishedAt: null });
    const writeOnly = apiToken(fixture, 1, 'writeonlytok', ['posts:write']);
    const both = apiToken(fixture, 2, 'readwritetok', ['posts:read', 'posts:write']);
    const url = '/api/developer/v1/posts/20';

    const patched = await app.inject({ method: 'PATCH', url, headers: writeOnly, payload: {} });
    assert.equal(patched.statusCode, 200, patched.body);
    assert.doesNotMatch(patched.body, /Private draft title|private-draft|Body/);
    assert.deepEqual(Object.keys(patched.json().data).sort(), ['id', 'published_at', 'status', 'updated_at']);
    assert.equal(patched.json().data.status, 'draft');

    const dryRun = await app.inject({ method: 'DELETE', url: `${url}?dry_run=true`, headers: writeOnly });
    assert.equal(dryRun.json().data.can_delete, true);
    assert.doesNotMatch(dryRun.body, /Private draft title|private-draft/);

    const full = await app.inject({ method: 'PATCH', url, headers: both, payload: {} });
    assert.equal(full.json().data.title, 'Private draft title');
    const fullDryRun = await app.inject({ method: 'DELETE', url: `${url}?dry_run=true`, headers: both });
    assert.equal(fullDryRun.json().data.post.title, 'Private draft title');

    const published = await app.inject({ method: 'POST', url: `${url}/publish`, headers: writeOnly, payload: {} });
    assert.equal(published.statusCode, 200, published.body);
    assert.equal(published.json().data.status, 'published');
    assert.equal(published.json().data.public_url, '/@writer/private-draft');
    assert.doesNotMatch(published.body, /Private draft title/);
  });
});

test('a response for a signed-in visitor is never stored by a shared cache', async () => {
  await withSite(async (fixture, app) => {
    const signedIn = signIn(fixture.db, 2);
    for (const url of [
      '/v1/subscriptions',
      '/v1/comments/user',
      '/v1/setting/heatmap',
      '/v1/posts/open-post/comments',
      '/v1/users/@writer/subscription',
    ]) {
      const response = await app.inject({ url, headers: signedIn });
      assert.equal(response.headers['cache-control'], 'private, no-store', url);
    }

    const missing = await app.inject({ url: '/x.css', headers: { ...signedIn, accept: 'text/html' } });
    assert.equal(missing.statusCode, 404);
    assert.equal(missing.headers['cache-control'], 'private, no-store');

    const csrf = 'a'.repeat(43);
    const visitor = await app.inject({ url: '/x.css', headers: { cookie: `csrftoken=${csrf}`, accept: 'text/html' } });
    assert.equal(visitor.statusCode, 404);
    assert.equal(visitor.headers['cache-control'], 'private, no-store');

    const anonymous = await app.inject('/v1/posts/open-post/comments');
    assert.equal(anonymous.headers['cache-control'], undefined);

    const image = await mediaFile(fixture.mediaRoot, 'public.png');
    const asset = await app.inject({ url: image.url, headers: signedIn });
    assert.equal(asset.statusCode, 200);
    assert.doesNotMatch(String(asset.headers['cache-control']), /no-store/);
  });
});
