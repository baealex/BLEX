import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir, truncate, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { PrismaClient } from '@prisma/client';
import { buildApp } from '../src/app.js';
import { buildImageCleanupPlan, executeImageCleanupPlan } from '../src/features/site-admin/services/image-cleanup.js';
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

async function image(root: string, name: string, bytes = 'image') {
  const path = join(root, 'images/content/2026/1/1', name);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, bytes);
  return path;
}

test('image cleanup keeps a file that starts being used after the preview', async () => {
  const fixture = await createMigratedDatabase();
  seedEditor(fixture.db, 1, 'writer');
  seedPost(fixture.db, 10, 1, 'post');
  const unused = await image(fixture.mediaRoot, 'unused.png');
  const adopted = await image(fixture.mediaRoot, 'adopted.png', 'other image');
  insertRow(fixture.db, 'UploadedImage', {
    id: 1,
    key: 'unused',
    path: 'images/content/2026/1/1/unused.png',
    size: 5,
    userId: 1,
  });
  insertRow(fixture.db, 'UploadedImage', {
    id: 2,
    key: 'adopted',
    path: 'images/content/2026/1/1/adopted.png',
    size: 11,
    userId: 1,
  });
  const db = new PrismaClient({ datasourceUrl: `file:${fixture.path}?connection_limit=1` });
  try {
    const plan = await buildImageCleanupPlan(db, fixture.mediaRoot, { target: 'content' });
    assert.equal(plan.unusedFiles.length, 2);
    insertRow(fixture.db, 'Comment', {
      id: 1,
      markdown: '![a](/resources/media/images/content/2026/1/1/adopted.png)',
      html: '',
      authorId: 1,
      postId: 10,
    });
    const result = await executeImageCleanupPlan(db, fixture.mediaRoot, plan);
    assert.equal(result.cleanedCount, 1);
    assert.equal(existsSync(unused), false);
    assert.equal(existsSync(adopted), true);
    assert.deepEqual(
      (await db.uploadedImage.findMany({ select: { id: true } })).map(({ id }) => id),
      [2],
    );
  } finally {
    await db.$disconnect();
    await fixture.cleanup();
  }
});

test('image cleanup leaves the database free while it reads large files', async () => {
  const fixture = await createMigratedDatabase();
  insertRow(fixture.db, 'User', {
    id: 1,
    username: 'owner',
    passwordHash: 'pbkdf2_sha256$fixture$owner',
    isActive: 1,
    isStaff: 1,
    isSuperuser: 1,
  });
  insertRow(fixture.db, 'Profile', { userId: 1, role: 'EDITOR' });
  seedPost(fixture.db, 10, 1, 'post');
  const large = await image(fixture.mediaRoot, 'large.png');
  await truncate(large, 1024 * 1024 * 1024);
  const headers = { ...signIn(fixture.db, 1), 'content-type': 'application/json' };
  const app = await buildApp(
    fixture.path,
    testSiteUrl,
    { secretKey: testSecretKey, cipherKey: testCipherKey },
    fixture.mediaRoot,
  );
  try {
    const preview = await app.inject({
      method: 'POST',
      url: '/v1/utilities/clean-images',
      headers,
      payload: JSON.stringify({ dryRun: true, target: 'content' }),
    });
    const { confirmationToken, previewHash } = preview.json().body;
    let finished = false;
    let slowest = 0;
    const started = performance.now();
    const run = app
      .inject({
        method: 'POST',
        url: '/v1/utilities/clean-images',
        headers,
        payload: JSON.stringify({ dryRun: false, target: 'content', confirmationToken, previewHash }),
      })
      .finally(() => {
        finished = true;
      });
    while (!finished) {
      const before = performance.now();
      await app.inject('/robots.txt');
      slowest = Math.max(slowest, performance.now() - before);
      await new Promise((accept) => setTimeout(accept, 10));
    }
    const elapsed = performance.now() - started;
    assert.equal((await run).json().body.cleanedCount, 1);
    assert.equal(existsSync(large), false);
    assert.ok(slowest < elapsed / 2, `slowest request ${Math.round(slowest)}ms of ${Math.round(elapsed)}ms`);
  } finally {
    await app.close();
    await fixture.cleanup();
  }
});
