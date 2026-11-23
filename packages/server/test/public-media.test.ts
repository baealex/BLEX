import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import Fastify from 'fastify';
import { registerPublicMedia } from '../src/features/media/public-media.js';

test('serves legacy media URLs and video ranges while keeping work-log files private', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'blex-media-test-'));
  const media = join(directory, 'media');
  await mkdir(join(media, '_work_logs'), { recursive: true });
  await mkdir(join(media, 'public'));
  await writeFile(join(media, 'public', '테스트 video.mp4'), '0123456789');
  await writeFile(join(media, '_work_logs', 'private-file'), 'private');
  await writeFile(join(directory, 'outside'), 'outside');
  await symlink(join(media, '_work_logs', 'private-file'), join(media, 'public', 'private-alias'));
  await symlink(join(directory, 'outside'), join(media, 'public', 'outside-alias'));
  const app = Fastify();
  try {
    await registerPublicMedia(app, media);
    const path = `/resources/media/public/${encodeURIComponent('테스트 video.mp4')}`;
    const streamed = await app.inject({ url: path, headers: { range: 'bytes=2-4' } });
    assert.equal(streamed.statusCode, 206, streamed.body);
    assert.equal(streamed.body, '234');
    assert.equal(streamed.headers['content-range'], 'bytes 2-4/10');
    assert.equal(streamed.headers['content-security-policy'], 'sandbox');
    assert.equal(streamed.headers['x-content-type-options'], 'nosniff');
    assert.match(streamed.headers['cache-control'] ?? '', /max-age=3600/);

    for (const name of [
      '_work_logs',
      '_work_logs/private-file',
      'public/private-alias',
      'public/outside-alias',
      'public',
    ]) {
      assert.equal((await app.inject(`/resources/media/${name}`)).statusCode, 404, name);
    }
  } finally {
    await app.close();
    await rm(directory, { recursive: true });
  }
});
