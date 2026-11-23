import assert from 'node:assert/strict';
import { connect } from 'node:net';
import test from 'node:test';
import { PrismaClient } from '@prisma/client';
import Fastify from 'fastify';
import { buildApp } from '../src/app.js';
import { createAuthorPost, publishAuthorDraft, updateAuthorPost } from '../src/features/posts/authoring/index.js';
import { sanitizePostHtml } from '../src/features/posts/post-html.js';
import { registerBodyGuard } from '../src/platform/request-body.js';
import { trustedProxiesFromEnv } from '../src/platform/runtime-config.js';
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

const editor = { id: 1, username: 'writer' };

async function migratedApp() {
  const fixture = await createMigratedDatabase();
  seedEditor(fixture.db, 1, 'writer');
  const app = await buildApp(
    fixture.path,
    testSiteUrl,
    { secretKey: testSecretKey, cipherKey: testCipherKey },
    fixture.mediaRoot,
  );
  await app.ready();
  return {
    ...fixture,
    app,
    async close() {
      await app.close();
      await fixture.cleanup();
    },
  };
}

test('keeps the layout the BLEX editor stored in existing posts', () => {
  const columns = sanitizePostHtml(
    '<div data-type="columns" data-layout="2:1" style="display: grid; grid-template-columns: 2fr 1fr; gap: 16px; margin: 16px 0"><div data-type="column"><p>A</p></div></div>',
  );
  assert.match(columns, /data-type="columns"/);
  assert.match(columns, /data-layout="2:1"/);
  assert.match(columns, /grid-template-columns:2fr 1fr/);
  assert.match(columns, /gap:16px/);
  assert.match(columns, /<div data-type="column">/);

  const frame = sanitizePostHtml(
    '<figure style="width: 100%; margin: 0"><iframe src="https://www.youtube.com/embed/abc123" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen="" style="width: 100%; border: 0; aspect-ratio: 16 / 9" data-aspect-ratio="16:9"></iframe></figure>',
  );
  assert.match(frame, /style="width:100%;border:0;aspect-ratio:16 \/ 9"/);
  assert.match(
    frame,
    /allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"/,
  );
  assert.match(frame, /data-aspect-ratio="16:9"/);

  const media = sanitizePostHtml(
    '<figure data-size="medium" data-border="true" data-shadow="true" data-border-radius="8" style="max-width: 480px; margin-left: auto; margin-right: auto; border: 1px solid var(--color-line-strong, #d2d2d7); overflow: hidden; box-shadow: 8px 8px 40px 2px var(--color-shadow-lg, rgba(0, 0, 0, 0.15)); border-radius: 8px"><img src="/a.png"></figure>',
  );
  for (const kept of [
    'data-size="medium"',
    'margin-left:auto',
    'margin-right:auto',
    'border:1px solid var(--color-line-strong, #d2d2d7)',
    'overflow:hidden',
    'box-shadow:8px 8px 40px 2px var(--color-shadow-lg, rgba(0, 0, 0, 0.15))',
  ]) {
    assert.ok(media.includes(kept), `missing ${kept} in ${media}`);
  }
});

test('still removes unsafe values from the layout allowlist', () => {
  const html = sanitizePostHtml(
    '<div data-upload-id="x" onclick="x()" style="grid-template-columns: url(https://evil.example/a); gap: expression(alert(1)); border: 1px solid url(x); box-shadow: 0 0 0 url(x); overflow: url(x); margin-left: calc(1px)">A</div><iframe src="https://www.youtube.com/embed/abc123" allow="camera; microphone; autoplay" style="background-image: url(x); width: 100%"></iframe><iframe src="https://evil.example/embed/abc"></iframe>',
  );
  assert.doesNotMatch(html, /url\(|expression|onclick|data-upload-id|calc|camera|microphone|evil\.example/);
  assert.match(html, /allow="autoplay"/);
});

test('keeps a saved draft schedule when the API saves or publishes it again', async () => {
  const fixture = await migratedApp();
  const db = new PrismaClient({ datasourceUrl: `file:${fixture.path}` });
  try {
    const target = new Date(Date.now() + 30 * 86_400_000);
    target.setUTCMilliseconds(0);
    const draft = await createAuthorPost(
      db,
      editor,
      { title: 'Later', contentHtml: '<p>Later</p>', reservedDate: target.toISOString() },
      true,
    );
    await updateAuthorPost(db, editor, draft.id, { title: 'Later again' });
    const stored = await db.post.findUniqueOrThrow({ where: { id: draft.id }, select: { draftScheduledAt: true } });
    assert.equal(stored.draftScheduledAt?.toISOString(), target.toISOString());

    await publishAuthorDraft(db, editor, draft.id, {});
    const post = await db.post.findUniqueOrThrow({ where: { id: draft.id }, select: { publishedAt: true } });
    assert.equal(post.publishedAt?.toISOString(), target.toISOString());
  } finally {
    await db.$disconnect();
    await fixture.close();
  }
});

test('keeps a schedule Django stored with a time zone offset', async () => {
  const fixture = await migratedApp();
  const db = new PrismaClient({ datasourceUrl: `file:${fixture.path}` });
  try {
    const target = new Date(Date.now() + 30 * 86_400_000);
    target.setUTCMilliseconds(0);
    seedPost(fixture.db, 7, 1, 'django-draft', { publishedAt: null });
    fixture.db.prepare('UPDATE "Post" SET draftScheduledAt = ? WHERE id = 7').run(target.getTime());
    await publishAuthorDraft(db, editor, 7, {});
    const post = await db.post.findUniqueOrThrow({ where: { id: 7 }, select: { publishedAt: true } });
    assert.equal(post.publishedAt?.toISOString(), target.toISOString());
  } finally {
    await db.$disconnect();
    await fixture.close();
  }
});

test('rejects anonymous multipart requests before reading the body', async () => {
  const fixture = await migratedApp();
  const address = await fixture.app.listen({ host: '127.0.0.1', port: 0 });
  try {
    const { port } = new URL(address);
    const response = await new Promise<string>((resolve, reject) => {
      const socket = connect(Number(port), '127.0.0.1');
      let received = '';
      const timer = setTimeout(() => {
        socket.destroy();
        reject(new Error('The server waited for the upload body.'));
      }, 10_000);
      socket.on('data', (chunk) => {
        received += chunk.toString();
      });
      socket.on('close', () => {
        clearTimeout(timer);
        resolve(received);
      });
      socket.on('error', reject);
      socket.write(
        'POST /work-logs/1/entry/ HTTP/1.1\r\nHost: site.test\r\nContent-Type: multipart/form-data; boundary=x\r\nContent-Length: 11534336\r\n\r\n',
      );
    });
    assert.match(response, /^HTTP\/1\.1 403 /);
  } finally {
    await fixture.close();
  }
});

test('limits concurrent uploads per account', async () => {
  const app = Fastify();
  registerBodyGuard(app, {
    currentUser: async () => ({ id: 1, hasEditorRole: true, isStaff: false }),
    tokenAccount: async () => null,
  });
  app.addContentTypeParser('multipart/form-data', (_request, _payload, done) => done(null));
  let release = () => {};
  const held = new Promise<void>((accept) => {
    release = accept;
  });
  let bothArrived = () => {};
  const arrived = new Promise<void>((accept) => {
    bothArrived = accept;
  });
  let uploads = 0;
  app.post('/upload', async () => {
    uploads += 1;
    if (uploads === 2) bothArrived();
    await held;
    return { ok: true };
  });
  const upload = () =>
    app.inject({
      method: 'POST',
      url: '/upload',
      headers: { 'content-type': 'multipart/form-data; boundary=x' },
      payload: 'x',
    });
  try {
    const running = [upload(), upload()];
    await arrived;
    assert.equal((await upload()).statusCode, 429);
    release();
    for (const response of await Promise.all(running)) assert.equal(response.statusCode, 200);
    assert.equal((await upload()).statusCode, 200);
  } finally {
    release();
    await app.close();
  }
});

test('announces first publication but not hiding, unhiding, or restoring an old post', async () => {
  const fixture = await migratedApp();
  const db = new PrismaClient({ datasourceUrl: `file:${fixture.path}` });
  try {
    insertRow(fixture.db, 'WebhookChannel', {
      id: 1,
      scope: 'global',
      isActive: 1,
      name: 'all',
      url: 'https://hooks.test/a',
    });
    seedPost(fixture.db, 2, 1, 'old-post');
    seedPost(fixture.db, 3, 1, 'trashed-post', { deletedAt: Date.UTC(2026, 0, 1) });
    const queued = () => db.webhookDelivery.count();

    const headers = signIn(fixture.db, 1);
    for (const isHide of [true, false]) {
      const toggled = await fixture.app.inject({
        method: 'PUT',
        url: '/v1/users/@writer/posts/old-post?hide=hide',
        headers,
      });
      assert.deepEqual(toggled.json().body, { isHide });
    }
    const trash = await fixture.app.inject({ url: '/v1/setting/trash-posts?page=1', headers });
    const restored = await fixture.app.inject({
      method: 'POST',
      url: '/v1/setting/trash-posts/trashed-post/restore',
      headers: { ...headers, 'content-type': 'application/json' },
      payload: { expectedDeletedDate: trash.json().body.posts[0].deletedDate },
    });
    assert.equal(restored.json().body.restored, true, restored.body);
    assert.equal(await queued(), 0);

    const draft = await createAuthorPost(db, editor, { title: 'New', contentHtml: '<p>New</p>' }, true);
    assert.equal(await queued(), 0);
    await publishAuthorDraft(db, editor, draft.id, {});
    assert.equal(await queued(), 1);
  } finally {
    await db.$disconnect();
    await fixture.close();
  }
});

test('reads the 3.x trusted proxy setting when the BLEX 4 name is absent', () => {
  assert.deepEqual(trustedProxiesFromEnv({ TRUSTED_PROXY_IPS: '172.18.0.1, 10.0.0.0/8' }), [
    '172.18.0.1',
    '10.0.0.0/8',
  ]);
  assert.deepEqual(trustedProxiesFromEnv({ BLEX_TRUSTED_PROXIES: '192.0.2.1', TRUSTED_PROXY_IPS: '172.18.0.1' }), [
    '192.0.2.1',
  ]);
  assert.equal(trustedProxiesFromEnv({}), undefined);
  assert.equal(trustedProxiesFromEnv({ BLEX_TRUSTED_PROXIES: ' , ' }), undefined);
});
