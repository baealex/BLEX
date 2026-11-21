import assert from 'node:assert/strict';
import { mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { PrismaClient } from '@prisma/client';
import Fastify from 'fastify';
import sharp from 'sharp';
import { registerContentMedia } from '../src/content-media.js';

test('validates photo uploads, creates a preview, and deduplicates the same bytes', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'blex-content-media-'));
  const dbPath = join(directory, 'test.sqlite3');
  const fixture = new DatabaseSync(dbPath);
  fixture.exec(`CREATE TABLE board_imagecache (id INTEGER PRIMARY KEY, key TEXT UNIQUE, path TEXT UNIQUE, size INTEGER, user_id INTEGER)`);
  fixture.close();
  const db = new PrismaClient({ datasourceUrl: `file:${dbPath}` });
  const app = Fastify();
  registerContentMedia(app, db, {
    mediaRoot: directory, currentUser: async () => ({ id: 7, hasEditorRole: true }),
    validateCsrf: (request) => request.headers['x-test-origin'] === 'valid',
  });
  const png = await sharp({ create: { width: 16, height: 16, channels: 3, background: '#0077ff' } }).png().toBuffer();
  const upload = (buffer: Buffer, filename: string, validated = true) => {
    const boundary = 'blex-test-media-boundary';
    return app.inject({ method: 'POST', url: '/v1/image',
      headers: { 'content-type': `multipart/form-data; boundary=${boundary}`, 'x-test-origin': validated ? 'valid' : 'invalid' },
      payload: Buffer.concat([Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="${filename}"\r\nContent-Type: image/png\r\n\r\n`),
        buffer, Buffer.from(`\r\n--${boundary}--\r\n`)]),
    });
  };
  try {
    assert.equal((await upload(png, 'example.png', false)).statusCode, 403);
    assert.equal((await upload(Buffer.from('invalid image'), 'invalid.png')).json().status, 'ERROR');
    const original = await upload(png, 'example.png');
    assert.equal(original.json().status, 'DONE', original.body);
    const { url } = original.json().body;
    const output = join(directory, url.slice('/resources/media/'.length));
    assert.equal((await stat(output)).isFile(), true);
    assert.equal((await sharp(`${output}.preview.jpg`).metadata()).format, 'jpeg');
    assert.equal((await upload(png, 'same-file.png')).json().body.url, url);
    const [count] = await db.$queryRaw<Array<{ total: number | bigint }>>`SELECT COUNT(*) AS total FROM board_imagecache`;
    assert.equal(Number(count.total), 1);
  } finally {
    await app.close();
    await db.$disconnect();
    await rm(directory, { recursive: true, force: true });
  }
});
