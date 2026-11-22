import assert from 'node:assert/strict';
import test from 'node:test';
import { PrismaClient } from '@prisma/client';
import { buildApp } from '../src/app.js';
import { PostValidationError, updateAuthorPost } from '../src/authoring/index.js';
import {
  createMigratedDatabase, insertRow, seedEditor, seedPost, signIn,
  testCipherKey, testSecretKey, testSiteUrl,
} from './fixtures/migrated-database.js';

const djangoDeletedDate = '2026-02-01 03:04:05.123456';
const editor = { id: 1, username: 'writer' };
const legacyShareToken = '12345678123442348234123456789abc';
const publicShareToken = '12345678-1234-4234-8234-123456789abc';

async function migratedApp() {
  const fixture = await createMigratedDatabase();
  seedEditor(fixture.db, 1, 'writer');
  seedEditor(fixture.db, 2, 'reader');
  const app = await buildApp(fixture.path, testSiteUrl, { secretKey: testSecretKey, cipherKey: testCipherKey }, fixture.mediaRoot);
  await app.ready();
  const headers = signIn(fixture.db, 1);
  const count = (table: string, where: string) => Number(
    (fixture.db.prepare(`SELECT COUNT(*) AS total FROM "${table}" WHERE ${where}`).get() as { total: number }).total,
  );
  return { ...fixture, app, headers, count, async close() { await app.close(); await fixture.cleanup(); } };
}

async function trashToken(fixture: Awaited<ReturnType<typeof migratedApp>>) {
  const listed = await fixture.app.inject({ url: '/v1/setting/trash-posts', headers: fixture.headers });
  assert.equal(listed.statusCode, 200, listed.body);
  return String(listed.json().body.posts[0].deletedDate);
}

test('permanently deletes a Django-era trashed post with the rows Django cascaded', async () => {
  const fixture = await migratedApp();
  try {
    const { db } = fixture;
    seedPost(db, 10, 1, 'trashed', { deleted_date: djangoDeletedDate });
    seedPost(db, 11, 1, 'kept');
    insertRow(db, 'board_comment', { id: 1, post_id: 10, author_id: 2, text_md: 'parent', text_html: 'parent' });
    insertRow(db, 'board_comment', { id: 2, post_id: 10, author_id: 2, parent_id: 1, text_md: 'child', text_html: 'child' });
    insertRow(db, 'board_comment', { id: 3, post_id: 11, author_id: 2, text_md: 'other', text_html: 'other' });
    insertRow(db, 'board_comment_likes', { comment_id: 2, user_id: 1 });
    insertRow(db, 'board_comment_likes', { comment_id: 3, user_id: 1 });
    insertRow(db, 'board_tag', { id: 1, value: 'kept-tag' });
    insertRow(db, 'board_post_tags', { post_id: 10, tag_id: 1 });
    insertRow(db, 'board_post_likes', { post_id: 10, user_id: 2 });
    insertRow(db, 'board_pinnedpost', { post_id: 10, user_id: 1 });
    insertRow(db, 'board_postconfigmeta', { post_id: 10, name: 'note', value: 'x' });
    insertRow(db, 'board_postsharelink', { id: 1, post_id: 10, token: 'a'.repeat(22) });
    insertRow(db, 'board_post_share_link_daily_counts', { link_id: 1, day: '2026-01-01', clicks: 1 });
    insertRow(db, 'board_edithistory', { id: 1, post_id: 10, change_type: 'edit' });
    insertRow(db, 'board_edithistory', { id: 2, post_id: 10, change_type: 'restore', restored_from_id: 1 });
    insertRow(db, 'board_editrequest', { post_id: 10, user_id: 2 });

    const expected = await trashToken(fixture);
    const response = await fixture.app.inject({
      method: 'DELETE',
      url: `/v1/setting/trash-posts/trashed?expectedDeletedDate=${encodeURIComponent(expected)}`,
      headers: fixture.headers,
    });
    assert.equal(response.statusCode, 200, response.body);
    assert.equal(response.json().status, 'DONE', response.body);

    assert.equal(fixture.count('board_post', 'id = 10'), 0);
    for (const table of ['board_comment', 'board_post_tags', 'board_post_likes', 'board_pinnedpost', 'board_postconfigmeta',
      'board_postsharelink', 'board_edithistory', 'board_editrequest', 'board_postcontent', 'board_postconfig']) {
      assert.equal(fixture.count(table, 'post_id = 10'), 0, table);
    }
    assert.equal(fixture.count('board_comment_likes', 'comment_id = 2'), 0);
    assert.equal(fixture.count('board_post_share_link_daily_counts', 'link_id = 1'), 0);
    assert.equal(fixture.count('board_comment', 'id = 3'), 1);
    assert.equal(fixture.count('board_comment_likes', 'comment_id = 3'), 1);
    assert.equal(fixture.count('board_tag', 'id = 1'), 1);
    assert.equal(fixture.count('board_post', 'id = 11'), 1);
  } finally {
    await fixture.close();
  }
});

test('restores a Django-era trashed post and still refuses a stale trash version', async () => {
  const fixture = await migratedApp();
  try {
    seedPost(fixture.db, 10, 1, 'trashed', { deleted_date: djangoDeletedDate });
    const restore = (expected: string) => fixture.app.inject({
      method: 'POST', url: '/v1/setting/trash-posts/trashed/restore', headers: fixture.headers,
      payload: { expected_deleted_date: expected },
    });
    assert.equal((await restore('2026-02-01T03:04:06.000Z')).json().status, 'ERROR');
    assert.equal(fixture.count('board_post', 'id = 10 AND deleted_date IS NOT NULL'), 1);

    const restored = await restore(await trashToken(fixture));
    assert.equal(restored.json().status, 'DONE', restored.body);
    assert.equal(fixture.count('board_post', 'id = 10 AND deleted_date IS NULL'), 1);
  } finally {
    await fixture.close();
  }
});

test('restores a revision of a post Django last updated with microseconds', async () => {
  const fixture = await migratedApp();
  try {
    seedPost(fixture.db, 10, 1, 'history', { updated_date: djangoDeletedDate });
    insertRow(fixture.db, 'board_edithistory', {
      id: 1, post_id: 10, change_type: 'edit', title: 'Earlier', content: '<p>Earlier</p>', tags: '[]',
    });
    const list = await fixture.app.inject({ url: '/v1/users/@writer/posts/history/revisions', headers: fixture.headers });
    const restored = await fixture.app.inject({
      method: 'POST', url: '/v1/users/@writer/posts/history/revisions/1/restore', headers: fixture.headers,
      payload: { expected_updated_date: list.json().body.currentUpdatedDate },
    });
    assert.equal(restored.json().status, 'DONE', restored.body);
    assert.equal(fixture.count('board_post', `id = 10 AND title = 'Earlier'`), 1);
  } finally {
    await fixture.close();
  }
});

test('deletes a revision that a later restore points to', async () => {
  const fixture = await migratedApp();
  try {
    seedPost(fixture.db, 10, 1, 'history');
    insertRow(fixture.db, 'board_edithistory', { id: 1, post_id: 10, change_type: 'edit' });
    insertRow(fixture.db, 'board_edithistory', { id: 2, post_id: 10, change_type: 'restore', restored_from_id: 1 });
    const response = await fixture.app.inject({
      method: 'DELETE', url: '/v1/users/@writer/posts/history/revisions/1', headers: fixture.headers,
    });
    assert.equal(response.statusCode, 200, response.body);
    assert.equal(fixture.count('board_edithistory', 'id = 1'), 0);
    assert.equal(fixture.count('board_edithistory', 'id = 2 AND restored_from_id IS NULL'), 1);
  } finally {
    await fixture.close();
  }
});

test('creates a writing form on the real schema', async () => {
  const fixture = await migratedApp();
  try {
    const response = await fixture.app.inject({
      method: 'POST', url: '/v1/forms', headers: fixture.headers, payload: { title: 'Template', content: 'Body' },
    });
    assert.equal(response.json().status, 'DONE', response.body);
    assert.equal(fixture.count('board_form', `title = 'Template' AND user_id = 1 AND is_public = 0 AND updated_date IS NOT NULL`), 1);
  } finally {
    await fixture.close();
  }
});

test('keeps Django work log share links working and revocable', async () => {
  const fixture = await migratedApp();
  try {
    const { db } = fixture;
    insertRow(db, 'board_worklog', { id: 1, title: 'Log', owner_id: 1 });
    insertRow(db, 'board_worklogentry', { id: 1, log_id: 1, title: 'Entry', text: 'Shared entry', media_type: 'text' });
    insertRow(db, 'board_worklogshare', { id: 1, token: legacyShareToken, headline: 'Shared', log_id: 1 });
    insertRow(db, 'board_worklogshare_entries', { worklogshare_id: 1, worklogentry_id: 1 });

    const shared = await fixture.app.inject(`/work-logs/share/${publicShareToken}/`);
    assert.equal(shared.statusCode, 200, shared.body);
    assert.match(shared.body, /Shared entry/);

    const owner = await fixture.app.inject({ url: '/work-logs/1/', headers: fixture.headers });
    assert.ok(owner.body.includes(`/work-logs/share/${publicShareToken}/`), 'owner page links the public URL');

    const revoked = await fixture.app.inject({
      method: 'POST', url: `/work-logs/1/share/${publicShareToken}/revoke/`, headers: fixture.headers,
    });
    assert.ok(revoked.statusCode < 400, revoked.body);
    assert.equal(fixture.count('board_worklogshare', 'id = 1'), 0);
    assert.equal((await fixture.app.inject(`/work-logs/share/${publicShareToken}/`)).statusCode, 404);
  } finally {
    await fixture.close();
  }
});

test('stores new work log share tokens in the Django column format', async () => {
  const fixture = await migratedApp();
  try {
    insertRow(fixture.db, 'board_worklog', { id: 1, title: 'Log', owner_id: 1 });
    insertRow(fixture.db, 'board_worklogentry', { id: 1, log_id: 1, title: 'Entry', text: 'Shared entry', media_type: 'text' });
    const created = await fixture.app.inject({
      method: 'POST', url: '/work-logs/1/share/',
      headers: { ...fixture.headers, 'content-type': 'application/x-www-form-urlencoded' },
      payload: new URLSearchParams({ action: 'publish', headline: 'New link', entries: '1', selected_entries: '1', entry_ids: '1' }).toString(),
    });
    assert.equal(created.statusCode, 302, created.body);
    const { token } = fixture.db.prepare('SELECT token FROM board_worklogshare').get() as { token: string };
    assert.match(token, /^[0-9a-f]{32}$/);
    const location = String(created.headers.location);
    assert.match(location, /^\/work-logs\/share\/[0-9a-f]{8}-[0-9a-f]{4}-/);
    assert.equal((await fixture.app.inject(location)).statusCode, 200);
  } finally {
    await fixture.close();
  }
});

test('deletes a Django series that still has configuration rows', async () => {
  const fixture = await migratedApp();
  try {
    insertRow(fixture.db, 'board_series', { id: 5, owner_id: 1, name: 'Series', url: 'series-five', layout: 'list' });
    insertRow(fixture.db, 'board_seriesconfigmeta', { post_id: 5, name: 'note', value: 'x' });
    seedPost(fixture.db, 10, 1, 'in-series', { series_id: 5 });
    const response = await fixture.app.inject({ method: 'DELETE', url: '/v1/series/5', headers: fixture.headers });
    assert.equal(response.statusCode, 200, response.body);
    assert.equal(response.json().status, 'DONE', response.body);
    assert.equal(fixture.count('board_series', 'id = 5'), 0);
    assert.equal(fixture.count('board_seriesconfigmeta', 'post_id = 5'), 0);
    assert.equal(fixture.count('board_post', 'id = 10 AND series_id IS NULL'), 1);
  } finally {
    await fixture.close();
  }
});

test('applies Django empty title and content rules to API updates', async () => {
  const fixture = await migratedApp();
  const db = new PrismaClient({ datasourceUrl: `file:${fixture.path}` });
  try {
    seedPost(fixture.db, 10, 1, 'published');
    seedPost(fixture.db, 11, 1, 'draft', { published_date: null });
    await assert.rejects(updateAuthorPost(db, editor, 10, { title: '' }), PostValidationError);
    await assert.rejects(updateAuthorPost(db, editor, 10, { content: '' }), PostValidationError);
    assert.equal(fixture.count('board_post', `id = 10 AND title = 'published'`), 1);
    assert.equal(fixture.count('board_postcontent', `post_id = 10 AND content_html = '<p>Body</p>'`), 1);

    await updateAuthorPost(db, editor, 10, { subtitle: 'Only subtitle' });
    assert.equal(fixture.count('board_post', `id = 10 AND title = 'published' AND subtitle = 'Only subtitle'`), 1);

    await updateAuthorPost(db, editor, 11, { title: '', content: '' });
    assert.equal(fixture.count('board_post', `id = 11 AND title = 'Untitled'`), 1);
    assert.equal(fixture.count('board_postcontent', `post_id = 11 AND content_html = ''`), 1);
  } finally {
    await db.$disconnect();
    await fixture.close();
  }
});

test('keeps the advertising flag when the web editor saves a post', async () => {
  const fixture = await migratedApp();
  try {
    seedPost(fixture.db, 10, 1, 'promoted');
    fixture.db.exec('UPDATE board_postconfig SET advertise = 1 WHERE post_id = 10');
    const saved = await fixture.app.inject({
      method: 'POST', url: '/@writer/promoted/edit',
      headers: { ...fixture.headers, 'content-type': 'application/x-www-form-urlencoded' },
      payload: new URLSearchParams({
        action: 'publish', title: 'Promoted', text_md: 'Changed body', content_type: 'markdown', url: 'promoted', tag: '',
      }).toString(),
    });
    assert.equal(saved.statusCode, 302, saved.body);
    assert.equal(fixture.count('board_post', `id = 10 AND title = 'Promoted'`), 1);
    assert.equal(fixture.count('board_postconfig', 'post_id = 10 AND advertise = 1'), 1);
  } finally {
    await fixture.close();
  }
});
