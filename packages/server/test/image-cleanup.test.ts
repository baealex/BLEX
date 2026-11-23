import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { PrismaClient } from '@prisma/client';
import { buildImageCleanupPlan, executeImageCleanupPlan } from '../src/features/site-admin/services/image-cleanup.js';
import { createMigratedDatabase, insertRow, seedEditor, seedPost } from './fixtures/migrated-database.js';

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

test('image cleanup leaves the database free while it reads a file', async () => {
  const fixture = await createMigratedDatabase();
  const path = await image(fixture.mediaRoot, 'unused.png');
  const db = new PrismaClient({ datasourceUrl: `file:${fixture.path}?connection_limit=1` });
  let release = () => {};
  const held = new Promise<void>((accept) => {
    release = accept;
  });
  let reading = () => {};
  const isReading = new Promise<void>((accept) => {
    reading = accept;
  });
  try {
    const plan = await buildImageCleanupPlan(db, fixture.mediaRoot, { target: 'content' });
    const { contentHash } = plan.unusedFiles[0]!;
    const cleanup = executeImageCleanupPlan(db, fixture.mediaRoot, plan, async () => {
      reading();
      await held;
      return contentHash;
    });
    await isReading;
    // With a single connection, this query would wait if cleanup held a transaction while reading.
    assert.equal(await db.user.count(), 0);
    release();
    assert.equal((await cleanup).cleanedCount, 1);
    assert.equal(existsSync(path), false);
  } finally {
    release();
    await db.$disconnect();
    await fixture.cleanup();
  }
});
