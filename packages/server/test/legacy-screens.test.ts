import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import sharp from 'sharp';
import { buildApp } from '../src/app.js';
import { djangoIso, djangoJsonLocal, djangoJsonUtc, localDate, localDateTimeText } from '../src/compat/django-format.js';
import { camelizeKey, camelizeKeys } from '../src/compat/legacy-api-contract.js';
import {
  createMigratedDatabase, insertRow, seedEditor, seedPost, signIn,
  testCipherKey, testSecretKey, testSiteUrl,
} from './fixtures/migrated-database.js';

const recent = new Date(Date.now() - 3_600_000).toISOString().slice(0, -1).replace('T', ' ');

async function screensApp({ assets = true } = {}) {
  const fixture = await createMigratedDatabase();
  const { db } = fixture;
  seedEditor(db, 1, 'writer');
  insertRow(db, 'auth_user', { id: 2, username: 'reader', password: 'pbkdf2_sha256$fixture$reader', is_active: 1 });
  insertRow(db, 'board_profile', { id: 2, user_id: 2, role: 'READER' });
  insertRow(db, 'auth_user', { id: 3, username: 'staff', password: 'pbkdf2_sha256$fixture$staff', is_active: 1, is_staff: 1, is_superuser: 1 });
  insertRow(db, 'board_profile', { id: 3, user_id: 3, role: 'EDITOR' });
  insertRow(db, 'SiteSetting', { id: 1, seoEnabled: 1, aeoEnabled: 1 });
  insertRow(db, 'board_series', { id: 7, owner_id: 1, name: 'Guide', url: 'guide', layout: 'list', hide: 0, created_date: recent });
  seedPost(db, 1, 1, 'kept', { title: 'Kept', series_id: 7, published_date: recent });
  insertRow(db, 'board_tag', { id: 1, value: 'kept-tag' });
  insertRow(db, 'board_tag', { id: 2, value: 'trashed-tag' });
  insertRow(db, 'board_post_tags', { post_id: 1, tag_id: 1 });
  seedPost(db, 2, 1, 'trashed', { published_date: recent, deleted_date: recent });
  insertRow(db, 'board_post_tags', { post_id: 2, tag_id: 2 });
  seedPost(db, 3, 1, 'draft', { published_date: null });
  const webAssetsRoot = await mkdtemp(join(tmpdir(), 'blex-v4-web-'));
  await mkdir(join(webAssetsRoot, '.vite'));
  const manifest = Object.fromEntries(['styles/tailwind.css', 'styles/main.scss', 'styles/post.scss', 'src/scripts/screen-loader.ts']
    .map((entry) => [entry, { file: `${entry.split('/').pop()}.hash` }]));
  await writeFile(join(webAssetsRoot, '.vite/manifest.json'), JSON.stringify(manifest));
  const app = await buildApp(fixture.path, testSiteUrl, { secretKey: testSecretKey, cipherKey: testCipherKey, ...(assets ? { webAssetsRoot: `${webAssetsRoot}/` } : {}) }, fixture.mediaRoot);
  await app.ready();
  return { ...fixture, app, async close() { await app.close(); await fixture.cleanup(); await rm(webAssetsRoot, { recursive: true, force: true }); } };
}

function screenProps(body: string) {
  const match = /<div data-screen="([^"]+)"[^>]*data-screen-props="([^"]+)"/.exec(body);
  assert.ok(match, 'the page mounts a 3.x screen');
  return { name: match[1], props: JSON.parse(decodeURIComponent(match[2])) as Record<string, unknown> };
}

function multipart(fields: Record<string, string>, file?: { name: string; filename: string; content: Buffer }) {
  const boundary = 'blexboundary';
  const parts: Uint8Array[] = Object.entries(fields).map(([name, value]) => Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`));
  if (file) parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${file.name}"; filename="${file.filename}"\r\nContent-Type: image/png\r\n\r\n`), file.content, Buffer.from('\r\n'));
  parts.push(Buffer.from(`--${boundary}--\r\n`));
  return { payload: Buffer.concat(parts), contentType: `multipart/form-data; boundary=${boundary}` };
}

test('converts keys exactly like the 3.x API', () => {
  assert.equal(camelizeKey('content_html'), 'contentHtml');
  assert.equal(camelizeKey('2026-11-01'), '20261101');
  assert.equal(camelizeKey('NOTIFY_MENTION'), 'NOTIFY_MENTION');
  assert.equal(camelizeKey('alreadyCamel'), 'alreadyCamel');
  assert.deepEqual(camelizeKeys({ a_b: [{ c_d: 1 }], e: null }), { aB: [{ cD: 1 }], e: null });
});

test('formats stored dates like Django', () => {
  assert.equal(djangoIso('2026-11-01 01:02:03.000000'), '2026-11-01T01:02:03+00:00');
  assert.equal(djangoIso('2026-11-01 01:02:03.123456'), '2026-11-01T01:02:03.123456+00:00');
  assert.equal(djangoJsonUtc('2026-02-22 19:16:06.827525'), '2026-02-22T19:16:06.827Z');
  assert.equal(djangoJsonLocal('2022-04-01 04:39:30.157000'), '2022-04-01T13:39:30.157+09:00');
  assert.equal(localDate('2026-10-31 15:30:00'), '2026-11-01');
  assert.equal(localDateTimeText('2029-12-31 15:00:00'), '2030-01-01 00:00');
});

test('applies 3.x access rules before mounting settings', async () => {
  const fixture = await screensApp();
  try {
    const anonymous = await fixture.app.inject('/settings/series/create');
    assert.equal(anonymous.statusCode, 302);
    assert.match(String(anonymous.headers.location), /^\/login\?next=/);
    const reader = signIn(fixture.db, 2);
    assert.equal((await fixture.app.inject({ url: '/settings/series', headers: reader })).statusCode, 404);
    assert.equal((await fixture.app.inject({ url: '/admin-settings/', headers: reader })).statusCode, 404);
    const account = await fixture.app.inject({ url: '/settings/account', headers: reader });
    assert.equal(screenProps(account.body).name, 'SettingsApp');
    assert.equal(screenProps(account.body).props.isEditor, false);
    assert.equal(screenProps(account.body).props.canUseTelegramIntegration, false);
    const staff = signIn(fixture.db, 3);
    const moved = await fixture.app.inject({ url: '/settings/users', headers: staff });
    assert.equal(moved.statusCode, 302);
    assert.equal(moved.headers.location, '/admin-settings/users');
    const admin = await fixture.app.inject({ url: '/admin-settings/users', headers: staff });
    assert.equal(screenProps(admin.body).props.settingsMode, 'admin');
  } finally {
    await fixture.close();
  }
});

test('mounts the 3.x editor for new, draft, and existing posts', async () => {
  const fixture = await screensApp();
  try {
    const headers = signIn(fixture.db, 1);
    assert.equal(screenProps((await fixture.app.inject({ url: '/write', headers })).body).props.mode, 'new');
    const draft = screenProps((await fixture.app.inject({ url: '/write?draft=draft', headers })).body);
    assert.deepEqual([draft.name, draft.props.mode, draft.props.draftUrl], ['PostEditor', 'draft', 'draft']);
    const edit = screenProps((await fixture.app.inject({ url: '/@writer/kept/edit', headers })).body);
    assert.deepEqual([edit.props.mode, edit.props.postUrl], ['edit', 'kept']);
    assert.equal((await fixture.app.inject({ url: '/@writer/kept/edit', headers: signIn(fixture.db, 3) })).statusCode, 404);
  } finally {
    await fixture.close();
  }
});

test('keeps login, role, and ownership answers for editor URLs the screen cannot serve', async () => {
  const fixture = await screensApp();
  try {
    const writer = signIn(fixture.db, 1);
    const reader = signIn(fixture.db, 2);
    const staff = signIn(fixture.db, 3);
    for (const url of ['/write', '/@writer/kept/edit']) {
      const anonymous = await fixture.app.inject(url);
      assert.deepEqual([anonymous.statusCode, anonymous.headers.location], [302, '/login']);
      const denied = await fixture.app.inject({ url, headers: reader });
      assert.deepEqual([denied.statusCode, denied.headers.location], [302, '/']);
    }
    assert.equal((await fixture.app.inject('/write/')).statusCode, 404);
    assert.equal((await fixture.app.inject({ url: '/@writer/kept/edit', headers: staff })).statusCode, 404);
    assert.equal((await fixture.app.inject({ url: '/@writer/missing/edit', headers: writer })).statusCode, 404);
    assert.equal((await fixture.app.inject({ url: '/@nobody/kept/edit', headers: writer })).statusCode, 404);
    assert.equal(screenProps((await fixture.app.inject({ url: '/@writer/kept/edit/', headers: writer })).body).name, 'PostEditor');
  } finally {
    await fixture.close();
  }
});

test('passes each role its settings capabilities', async () => {
  const fixture = await screensApp();
  try {
    insertRow(fixture.db, 'auth_user', { id: 8, username: 'delegate', password: 'pbkdf2_sha256$fixture$delegate', is_active: 1, is_staff: 1 });
    insertRow(fixture.db, 'board_profile', { id: 8, user_id: 8, role: 'READER' });
    const owner = screenProps((await fixture.app.inject({ url: '/admin-settings/users', headers: signIn(fixture.db, 3) })).body);
    assert.deepEqual(owner.props.adminCapabilities, {
      canManageSiteSettings: true, canManageLoginSettings: true, canManageIntegrationSettings: true, canManageUtilities: true,
    });
    const delegate = screenProps((await fixture.app.inject({ url: '/admin-settings/users', headers: signIn(fixture.db, 8) })).body);
    assert.deepEqual(delegate.props.adminCapabilities, {
      canManageSiteSettings: false, canManageLoginSettings: false, canManageIntegrationSettings: false, canManageUtilities: false,
    });
  } finally {
    await fixture.close();
  }
});

test('answers settings and editor pages with 503 when the web screens are not built', async () => {
  const fixture = await screensApp({ assets: false });
  try {
    const writer = signIn(fixture.db, 1);
    for (const url of ['/settings/account', '/settings/posts', '/write', '/@writer/kept/edit']) {
      const response = await fixture.app.inject({ url, headers: writer });
      assert.equal(response.statusCode, 503, url);
      assert.match(response.body, /pnpm build:web/);
    }
    const anonymous = await fixture.app.inject('/settings/account');
    assert.equal(anonymous.statusCode, 302);
    assert.match(String(anonymous.headers.location), /^\/login\?next=/);
    assert.equal((await fixture.app.inject('/write')).headers.location, '/login');
    assert.equal((await fixture.app.inject({ url: '/admin-settings/users', headers: signIn(fixture.db, 2) })).statusCode, 404);
    assert.equal((await fixture.app.inject({ url: '/@writer/missing/edit', headers: writer })).statusCode, 404);
    assert.equal((await fixture.app.inject('/search')).statusCode, 200);
    assert.equal((await fixture.app.inject('/sign')).statusCode, 200);
  } finally {
    await fixture.close();
  }
});

test('mounts the 3.x search and signup screens', async () => {
  const fixture = await screensApp();
  try {
    const search = await fixture.app.inject('/search?q=hello&username=writer');
    assert.equal(screenProps(search.body).name, 'SearchPage');
    assert.deepEqual(screenProps(search.body).props, { username: 'writer' });
    assert.match(search.body, /name="robots" content="noindex,follow"/);
    assert.doesNotMatch(search.body, /data-site-search/);
    assert.doesNotMatch(search.body, /isAuthenticated/);

    const signup = await fixture.app.inject('/sign?invite=welcome&next=/tags');
    assert.equal(screenProps(signup.body).name, 'Signup');
    const globals = /id="blex-screen-globals"[^>]*>([^<]+)</.exec(signup.body);
    assert.deepEqual(JSON.parse(globals?.[1] ?? '{}'), { HCAPTCHA_SITE_KEY: '', NEXT_URL: '/tags', INVITE_CODE: 'welcome' });
    assert.doesNotMatch(signup.body, /js\.hcaptcha\.com\/1\/api\.js/);

    const signedIn = await fixture.app.inject({ url: '/sign?next=/tags', headers: signIn(fixture.db, 2) });
    assert.equal(signedIn.statusCode, 302);
    assert.equal(signedIn.headers.location, '/tags');
  } finally {
    await fixture.close();
  }
});

test('serves the 3.x introduction editor only to its owner', async () => {
  const fixture = await screensApp();
  try {
    const anonymous = await fixture.app.inject('/@writer/about/edit');
    assert.equal(anonymous.statusCode, 302);
    assert.match(String(anonymous.headers.location), /^\/login\?next=/);
    const denied = await fixture.app.inject({ url: '/@writer/about/edit', headers: { ...signIn(fixture.db, 2), accept: 'text/html' } });
    assert.equal(denied.statusCode, 403);
    assert.match(denied.body, /이 페이지에 접근할 권한이 없습니다/);
    const owner = await fixture.app.inject({ url: '/@writer/about/edit', headers: signIn(fixture.db, 1) });
    assert.equal(owner.statusCode, 200);
    assert.match(owner.body, /자신을 소개해 보세요/);
    assert.match(owner.body, /data-about-page/);
    const overview = await fixture.app.inject({ url: '/@writer', headers: signIn(fixture.db, 1) });
    assert.match(overview.body, /data-about-editor/);
    assert.doesNotMatch((await fixture.app.inject('/@writer')).body, /data-about-editor/);
  } finally {
    await fixture.close();
  }
});

test('serves the 3.x developer docs without outside requests', async () => {
  const fixture = await screensApp();
  try {
    const editor = signIn(fixture.db, 1);
    assert.equal((await fixture.app.inject('/api/developer/v1/docs')).statusCode, 302);
    const docs = await fixture.app.inject({ url: '/api/developer/v1/docs', headers: editor });
    assert.equal(docs.statusCode, 200);
    assert.match(docs.body, /id="swagger-ui"/);
    assert.match(docs.body, /"validatorUrl":null/);
    assert.doesNotMatch(String(docs.headers['content-security-policy']), /https:/);
    const bundle = await fixture.app.inject('/assets/swagger-ui/swagger-ui-bundle.js');
    assert.equal(bundle.statusCode, 200);
    assert.equal((await fixture.app.inject('/assets/swagger-ui/..%2f..%2fdeveloper-openapi.json')).statusCode, 404);
    const quickstart = await fixture.app.inject({ url: '/docs/developer-api/quickstart', headers: editor });
    assert.match(quickstart.body, /개발자 API 빠른 시작/);
    assert.doesNotMatch(quickstart.body, /__SITE_ORIGIN__/);
  } finally {
    await fixture.close();
  }
});

test('keeps return paths local after dot segments are resolved', async () => {
  const fixture = await screensApp();
  try {
    const headers = { ...signIn(fixture.db, 2), 'content-type': 'application/x-www-form-urlencoded' };
    for (const returnTo of ['/.//evil.example', '/..//evil.example', '/a/..//evil.example']) {
      const response = await fixture.app.inject({ method: 'POST', url: '/like/kept', headers,
        payload: new URLSearchParams({ csrfmiddlewaretoken: headers['x-csrftoken'], return_to: returnTo }).toString() });
      assert.doesNotMatch(String(response.headers.location ?? ''), /^\/\//);
    }
  } finally {
    await fixture.close();
  }
});

test('serves the 3.x page for missing documents and plain answers elsewhere', async () => {
  const fixture = await screensApp();
  try {
    const page = await fixture.app.inject({ url: '/@writer/missing-post', headers: { accept: 'text/html' } });
    assert.equal(page.statusCode, 404);
    assert.match(String(page.headers['content-type']), /text\/html/);
    assert.match(page.body, /페이지를 찾을 수 없습니다/);
    const api = await fixture.app.inject({ url: '/v1/missing', headers: { accept: 'text/html' } });
    assert.doesNotMatch(String(api.headers['content-type']), /text\/html/);
  } finally {
    await fixture.close();
  }
});

test('keeps the query when an old username redirects to the author page', async () => {
  const fixture = await screensApp();
  try {
    insertRow(fixture.db, 'board_usernamechangelog', { id: 1, user_id: 1, username: 'oldwriter', created_date: recent });
    const moved = await fixture.app.inject('/@oldwriter/posts?page=1&q=kept');
    assert.equal(moved.statusCode, 302);
    assert.equal(moved.headers.location, '/@writer/posts?page=1&q=kept');
  } finally {
    await fixture.close();
  }
});

test('limits drafts and creates a complete profile on a role change', async () => {
  const fixture = await screensApp();
  try {
    for (let id = 100; id < 199; id += 1) seedPost(fixture.db, id, 1, `draft-${id}`, { published_date: null });
    const editor = signIn(fixture.db, 1);
    const blocked = await fixture.app.inject({ method: 'POST', url: '/v1/drafts', headers: { ...editor, 'content-type': 'application/json' },
      payload: { title: 'One too many', text_md: 'Body', content_type: 'markdown' } });
    assert.equal(blocked.json().errorCode, 'error:OF');
    assert.match(blocked.json().errorMessage, /100개/);

    insertRow(fixture.db, 'auth_user', { id: 9, username: 'noprofile', password: 'pbkdf2_sha256$fixture$none', is_active: 1 });
    const staff = signIn(fixture.db, 3);
    const changed = await fixture.app.inject({ method: 'PATCH', url: '/v1/admin/users/9/role',
      headers: { ...staff, 'content-type': 'application/json' }, payload: { role: 'EDITOR' } });
    assert.equal(changed.json().status, 'DONE', changed.body);
    const profile = fixture.db.prepare('SELECT role FROM board_profile WHERE user_id = 9').get() as { role: string };
    assert.equal(profile.role, 'EDITOR');
  } finally {
    await fixture.close();
  }
});

const editorForm = (csrf: string, values: Record<string, string> = {}) => ({
  csrfmiddlewaretoken: csrf, title: 'Editor post', subtitle: 'Sub', url: 'editor-post', content_html: '<p>Written body</p>',
  meta_description: 'Written description', tag: 'one,two', series: '7', hide: 'false', advertise: 'false', block_comment: 'false',
  cover_layout: 'split', cover_image_position: 'left', cover_image_ratio: '4:3', ...values,
});

const coverPng = () => sharp({ create: { width: 32, height: 24, channels: 3, background: '#336699' } }).png().toBuffer();

const postRow = (db: Awaited<ReturnType<typeof screensApp>>['db'], url: string) => db.prepare(`
  SELECT p.title, p.subtitle, p.image, p.series_id AS series, p.meta_description AS description, p.published_date AS published,
         c.content_html AS html, g.hide, g.advertise, g.block_comment AS blockComment, g.cover_layout AS layout,
         g.cover_image_position AS position, g.cover_image_ratio AS ratio,
         (SELECT GROUP_CONCAT(t.value) FROM board_post_tags l JOIN board_tag t ON t.id = l.tag_id WHERE l.post_id = p.id) AS tags
  FROM board_post p JOIN board_postcontent c ON c.post_id = p.id JOIN board_postconfig g ON g.post_id = p.id WHERE p.url = ?
`).get(url) as Record<string, string | number | null> | undefined;

test('publishes a new post from the editor form with every field', async () => {
  const fixture = await screensApp();
  try {
    const headers = signIn(fixture.db, 1);
    const body = `<p>${'긴 본문 '.repeat(120_000)}</p>`;
    const form = multipart(editorForm(headers['x-csrftoken'], { content_html: body, hide: 'true', advertise: 'true', block_comment: 'true' }),
      { name: 'image', filename: 'cover.png', content: await coverPng() });
    const created = await fixture.app.inject({ method: 'POST', url: '/v1/posts', headers: { ...headers, 'content-type': form.contentType }, payload: form.payload });
    assert.deepEqual(created.json(), { status: 'DONE', body: { url: 'editor-post' } });
    const row = postRow(fixture.db, 'editor-post')!;
    assert.ok(String(row.image).startsWith('images/content/'));
    assert.ok(Buffer.byteLength(String(row.html)) > 1024 * 1024);
    assert.deepEqual(
      [row.title, row.subtitle, row.series, row.description, row.hide, row.advertise, row.blockComment, row.layout, row.position, row.ratio, row.tags],
      ['Editor post', 'Sub', 7, 'Written description', 1, 1, 1, 'split', 'left', '4:3', 'one,two'],
    );
  } finally {
    await fixture.close();
  }
});

test('a rejected publish answers with the error and changes nothing', async () => {
  const fixture = await screensApp();
  try {
    const headers = signIn(fixture.db, 1);
    const send = (fields: Record<string, string>, file?: { name: string; filename: string; content: Buffer }) => {
      const form = multipart(editorForm(headers['x-csrftoken'], fields), file);
      return fixture.app.inject({ method: 'POST', url: '/v1/posts', headers: { ...headers, 'content-type': form.contentType }, payload: form.payload });
    };
    const posts = () => (fixture.db.prepare('SELECT COUNT(*) AS n FROM board_post').get() as { n: number }).n;
    const before = posts();

    const pastSchedule = await send({ reserved_date: '2020-01-01T00:00:00.000Z' });
    assert.equal(pastSchedule.statusCode, 200);
    assert.deepEqual([pastSchedule.json().status, pastSchedule.json().errorMessage], ['ERROR', '예약시간이 현재시간보다 이전입니다.']);
    const brokenCover = await send({}, { name: 'image', filename: 'cover.png', content: Buffer.from('not an image') });
    assert.deepEqual([brokenCover.json().status, brokenCover.json().errorMessage], ['ERROR', '이미지 업로드에 실패했습니다.']);
    assert.equal(posts(), before);

    const draftBefore = postRow(fixture.db, 'draft');
    const rejectedDraft = await send({ draft_url: 'draft', url: 'draft', title: 'Changed', reserved_date: '2020-01-01T00:00:00.000Z' });
    assert.equal(rejectedDraft.json().status, 'ERROR');
    assert.deepEqual(postRow(fixture.db, 'draft'), draftBefore);
    assert.equal(draftBefore?.published, null);
  } finally {
    await fixture.close();
  }
});

test('publishes and schedules an owned draft from the editor form', async () => {
  const fixture = await screensApp();
  try {
    const headers = signIn(fixture.db, 1);
    fixture.db.prepare(`UPDATE board_post SET image = 'images/content/2026/1/1/old.png' WHERE id = 3`).run();
    insertRow(fixture.db, 'board_postconfigmeta', { name: 'draft_reserved_date', value: '2099-01-01 00:00:00.000', post_id: 3 });
    const publishAt = new Date(Date.now() + 86_400_000).toISOString();
    const form = multipart(editorForm(headers['x-csrftoken'], { draft_url: 'draft', url: 'draft', series: '', advertise: 'true', image_delete: 'true', reserved_date: publishAt }));
    const published = await fixture.app.inject({ method: 'POST', url: '/v1/posts', headers: { ...headers, 'content-type': form.contentType }, payload: form.payload });
    assert.deepEqual(published.json(), { status: 'DONE', body: { url: 'draft' } });
    const row = postRow(fixture.db, 'draft')!;
    assert.deepEqual([row.published, row.image, row.series, row.advertise, row.layout, row.tags], [publishAt.replace('T', ' ').replace('Z', ''), '', null, 1, 'split', 'one,two']);
    assert.equal((fixture.db.prepare(`SELECT COUNT(*) AS n FROM board_postconfigmeta WHERE post_id = 3 AND name = 'draft_reserved_date'`).get() as { n: number }).n, 0);
    assert.equal((fixture.db.prepare('SELECT COUNT(*) AS n FROM blex_scheduled_publication WHERE post_id = 3').get() as { n: number }).n, 1);
  } finally {
    await fixture.close();
  }
});

test('guards editor publishing by session, role, CSRF, and draft ownership', async () => {
  const fixture = await screensApp();
  try {
    seedPost(fixture.db, 20, 3, 'someone-elses-draft', { published_date: null });
    const writer = signIn(fixture.db, 1);
    const count = () => (fixture.db.prepare('SELECT COUNT(*) AS n FROM board_post').get() as { n: number }).n;
    const before = count();
    const send = (headers: Record<string, string>, csrf: string, fields: Record<string, string> = {}) => {
      const form = multipart(editorForm(csrf, fields));
      return fixture.app.inject({ method: 'POST', url: '/v1/posts', headers: { ...headers, 'content-type': form.contentType }, payload: form.payload });
    };

    assert.equal((await send({}, 'x'.repeat(43))).statusCode, 403);
    const { 'x-csrftoken': _token, ...withoutHeader } = writer;
    assert.equal((await send(withoutHeader, 'y'.repeat(43))).statusCode, 403);
    assert.equal((await send(signIn(fixture.db, 2), writer['x-csrftoken'])).json().errorCode, 'error:RJ');
    assert.equal((await send(writer, writer['x-csrftoken'], { draft_url: 'someone-elses-draft' })).statusCode, 404);
    assert.equal((await send(writer, writer['x-csrftoken'], { draft_url: 'kept' })).statusCode, 404);
    assert.equal(count(), before);
    assert.equal((fixture.db.prepare('SELECT published_date AS published FROM board_post WHERE id = 20').get() as { published: string | null }).published, null);
  } finally {
    await fixture.close();
  }
});

test('edits a post from the editor form and keeps what it leaves out', async () => {
  const fixture = await screensApp();
  try {
    const headers = signIn(fixture.db, 1);
    fixture.db.prepare('UPDATE board_postconfig SET advertise = 1 WHERE post_id = 1').run();
    const { series: _series, tag: _tag, ...fields } = editorForm(headers['x-csrftoken'], { title: 'Kept edited', url: 'kept', content_html: '<p>Edited</p>' });
    const { advertise: _advertise, ...withoutAdvertise } = fields;
    const form = multipart(withoutAdvertise, { name: 'image', filename: 'cover.png', content: await coverPng() });
    const saved = await fixture.app.inject({ method: 'POST', url: '/v1/users/@writer/posts/kept', headers: { ...headers, 'content-type': form.contentType }, payload: form.payload });
    assert.deepEqual(saved.json(), { status: 'DONE', body: {} });
    const row = postRow(fixture.db, 'kept')!;
    assert.deepEqual([row.title, row.series, row.tags, row.advertise, row.layout], ['Kept edited', 7, 'kept-tag', 1, 'split']);
    assert.ok(String(row.image).startsWith('images/content/'));

    const rejected = multipart(editorForm(headers['x-csrftoken'], { url: 'kept', content_html: '' }));
    const failed = await fixture.app.inject({ method: 'POST', url: '/v1/users/@writer/posts/kept', headers: { ...headers, 'content-type': rejected.contentType }, payload: rejected.payload });
    assert.deepEqual([failed.json().status, failed.json().errorMessage], ['ERROR', '내용을 입력해주세요.']);
    assert.equal(postRow(fixture.db, 'kept')?.title, 'Kept edited');

    const other = signIn(fixture.db, 3);
    const notOwner = multipart(editorForm(other['x-csrftoken'], { url: 'kept' }));
    const denied = await fixture.app.inject({ method: 'POST', url: '/v1/users/@writer/posts/kept', headers: { ...other, 'content-type': notOwner.contentType }, payload: notOwner.payload });
    assert.equal(denied.statusCode, 404);
  } finally {
    await fixture.close();
  }
});

test('retires the old editor, image upload, and series form URLs', async () => {
  const fixture = await screensApp();
  try {
    const headers = signIn(fixture.db, 1);
    const form = { ...headers, 'content-type': 'application/x-www-form-urlencoded' };
    const payload = `csrfmiddlewaretoken=${headers['x-csrftoken']}&title=Gone&text_md=Gone&name=Gone`;
    const before = (fixture.db.prepare('SELECT COUNT(*) AS n FROM board_post').get() as { n: number }).n;
    for (const url of ['/write', '/@writer/kept/edit', '/write/images', '/series/create', '/series/edit/7']) {
      assert.equal((await fixture.app.inject({ method: 'POST', url, headers: form, payload })).statusCode, 404, `POST ${url}`);
    }
    for (const url of ['/write/images', '/series/create', '/series/edit/7', '/assets/blex/editor.js', '/assets/blex/editor.css']) {
      assert.equal((await fixture.app.inject({ url, headers })).statusCode, 404, `GET ${url}`);
    }
    assert.equal((fixture.db.prepare('SELECT COUNT(*) AS n FROM board_post').get() as { n: number }).n, before);
    assert.equal((fixture.db.prepare(`SELECT title FROM board_post WHERE id = 1`).get() as { title: string }).title, 'Kept');
    assert.equal((fixture.db.prepare(`SELECT name FROM board_series WHERE id = 7`).get() as { name: string }).name, 'Guide');
  } finally {
    await fixture.close();
  }
});

test('rejects a large anonymous draft before parsing it', async () => {
  const fixture = await screensApp();
  try {
    const response = await fixture.app.inject({ method: 'POST', url: '/v1/drafts', headers: { 'content-type': 'application/json' }, payload: JSON.stringify({ content: 'x'.repeat(64 * 1024) }) });
    assert.equal(response.json().errorCode, 'error:NL');
  } finally {
    await fixture.close();
  }
});

test('counts management tags on live posts only', async () => {
  const fixture = await screensApp();
  try {
    const { body } = (await fixture.app.inject({ url: '/v1/setting/tag', headers: signIn(fixture.db, 1) })).json() as { body: { tags: Array<{ name: string | null; count: number }> } };
    assert.ok(body.tags.some((tag) => tag.name === 'kept-tag' && tag.count === 1));
    assert.ok(!body.tags.some((tag) => tag.name === 'trashed-tag'));
  } finally {
    await fixture.close();
  }
});
