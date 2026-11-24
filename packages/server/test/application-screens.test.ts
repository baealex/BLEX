import assert from 'node:assert/strict';
import test from 'node:test';
import sharp from 'sharp';
import { buildApp } from '../src/app.js';
import { isApplicationDocument } from '../src/platform/document.js';
import { readUiFile } from '../src/platform/ui-assets.js';
import { normalizedTags } from '../src/features/posts/services/post-content.js';
import {
  isoWithOffset,
  isoLocalMillis,
  isoUtcMillis,
  localDate,
  localDateTimeText,
} from '../src/platform/date-format.js';
import {
  createMigratedDatabase,
  insertRow,
  seedEditor,
  seedPost,
  signIn,
  testCipherKey,
  testSecretKey,
  testSiteUrl,
  prismaDate,
} from './fixtures/migrated-database.js';

const recent = new Date(Date.now() - 3_600_000).toISOString().slice(0, -1).replace('T', ' ');

async function screensApp() {
  const fixture = await createMigratedDatabase();
  const { db } = fixture;
  seedEditor(db, 1, 'writer');
  insertRow(db, 'User', { id: 2, username: 'reader', passwordHash: 'pbkdf2_sha256$fixture$reader', isActive: 1 });
  insertRow(db, 'Profile', { userId: 2, role: 'READER' });
  insertRow(db, 'User', {
    id: 3,
    username: 'staff',
    passwordHash: 'pbkdf2_sha256$fixture$staff',
    isActive: 1,
    isStaff: 1,
    isSuperuser: 1,
  });
  insertRow(db, 'Profile', { userId: 3, role: 'EDITOR' });
  insertRow(db, 'SiteSetting', { id: 1, seoEnabled: 1, aeoEnabled: 1 });
  insertRow(db, 'Series', {
    id: 7,
    ownerId: 1,
    name: 'Guide',
    slug: 'guide',
    layout: 'list',
    isHidden: 0,
    createdAt: prismaDate(recent),
  });
  seedPost(db, 1, 1, 'kept', { title: 'Kept', seriesId: 7, publishedAt: recent });
  insertRow(db, 'Tag', { id: 1, name: 'kept-tag' });
  insertRow(db, 'Tag', { id: 2, name: 'trashed-tag' });
  insertRow(db, '_PostToTag', { A: 1, B: 1 });
  seedPost(db, 2, 1, 'trashed', { publishedAt: recent, deletedAt: recent });
  insertRow(db, '_PostToTag', { A: 2, B: 2 });
  seedPost(db, 3, 1, 'draft', { publishedAt: null });
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

function screenProps(body: string) {
  const match = /<div data-screen="([^"]+)"[^>]*data-screen-props="([^"]+)"/.exec(body);
  assert.ok(match, 'the page mounts a 3.x screen');
  return { name: match[1], props: JSON.parse(decodeURIComponent(match[2])) as Record<string, unknown> };
}

function multipart(fields: Record<string, string>, file?: { name: string; filename: string; content: Buffer }) {
  const boundary = 'blexboundary';
  const parts: Uint8Array[] = Object.entries(fields).map(([name, value]) =>
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`),
  );
  if (file)
    parts.push(
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="${file.name}"; filename="${file.filename}"\r\nContent-Type: image/png\r\n\r\n`,
      ),
      file.content,
      Buffer.from('\r\n'),
    );
  parts.push(Buffer.from(`--${boundary}--\r\n`));
  return { payload: Buffer.concat(parts), contentType: `multipart/form-data; boundary=${boundary}` };
}

// No `/v1` field is defined by an external service today. Name one here if that changes.
const externallyDefinedKeys = new Set<string>();

function snakeCaseKeys(value: unknown, path = '$'): string[] {
  if (Array.isArray(value)) return value.flatMap((item, index) => snakeCaseKeys(item, `${path}[${index}]`));
  if (value === null || typeof value !== 'object') return [];
  return Object.entries(value).flatMap(([key, item]) => [
    ...(key.includes('_') && !externallyDefinedKeys.has(key) ? [`${path}.${key}`] : []),
    ...snakeCaseKeys(item, `${path}.${key}`),
  ]);
}

test('returns camelCase keys from every /v1 endpoint family', async () => {
  const fixture = await screensApp();
  try {
    const { db } = fixture;
    insertRow(db, 'Comment', {
      id: 1,
      postId: 1,
      authorId: 2,
      markdown: 'Hello',
      html: '<p>Hello</p>',
      createdAt: prismaDate(recent),
    });
    insertRow(db, 'Notification', {
      id: 1,
      userId: 1,
      key: 'comment',
      url: '/@writer/kept',
      content: 'Hello',
      messageKey: 'notify.post_comment',
      messageParams: JSON.stringify({ actor: 'reader', comment_id: 1, post_title: 'Kept' }),
    });
    insertRow(db, 'StaticPage', { id: 1, slug: 'about', title: 'About', content: '<p>About</p>', isPublished: 1 });
    insertRow(db, 'SiteNotice', { id: 1, scope: 'global', title: 'Notice', isActive: 1 });
    insertRow(db, 'SiteBanner', {
      id: 1,
      scope: 'global',
      type: 'horizontal',
      position: 'top',
      title: 'Banner',
      contentHtml: '<p>Banner</p>',
      isActive: 1,
    });
    const families = [
      {
        headers: signIn(db, 1),
        urls: [
          '/v1/setting/account',
          '/v1/setting/profile',
          '/v1/setting/posts',
          '/v1/setting/reserved-posts',
          '/v1/setting/series',
          '/v1/setting/tag',
          '/v1/setting/notify',
          '/v1/setting/notify-config',
          '/v1/setting/unread-notify',
          '/v1/setting/pinned-posts',
          '/v1/setting/pinnable-posts',
          '/v1/setting/trash-posts',
          '/v1/setting/heatmap',
          '/v1/setting/integration-telegram',
          '/v1/drafts',
          '/v1/forms',
          '/v1/series',
          '/v1/series/7',
          '/v1/series/valid-posts',
          '/v1/banners',
          '/v1/notices',
          '/v1/developer-tokens',
          '/v1/webhook/channels',
          '/v1/subscriptions',
          '/v1/comments/user',
          '/v1/social-providers',
          '/v1/search?q=Kept',
          '/v1/users/@writer/heatmap',
          '/v1/users/@writer/subscription',
          '/v1/users/@writer/posts/kept?mode=edit',
          '/v1/users/@writer/posts/kept/related',
          '/v1/users/@writer/posts/kept/revisions',
          '/v1/users/@writer/posts/kept/share-links',
          '/v1/users/@writer/posts/kept/timelapse',
          '/v1/posts/kept/comments',
        ],
      },
      {
        headers: signIn(db, 3),
        urls: [
          '/v1/admin/users',
          '/v1/admin/author-invites',
          '/v1/site-settings',
          '/v1/login-settings',
          '/v1/integration-settings',
          '/v1/static-pages',
          '/v1/static-pages/1',
          '/v1/global-banners',
          '/v1/global-banners/1',
          '/v1/global-notices',
          '/v1/global-notices/1',
          '/v1/webhook/global-channels',
          '/v1/utilities/stats',
        ],
      },
    ];
    for (const { headers, urls } of families) {
      for (const url of urls) {
        const response = await fixture.app.inject({ url, headers });
        const payload = response.json() as { status: string };
        assert.equal(payload.status, 'DONE', `${url} answered ${response.body.slice(0, 120)}`);
        assert.deepEqual(snakeCaseKeys(payload), [], url);
      }
    }
    const days = (await fixture.app.inject({ url: '/v1/users/@writer/heatmap' })).json() as {
      body: Record<string, number>;
    };
    assert.ok(Object.keys(days.body).length > 0);
    assert.ok(
      Object.keys(days.body).every((day) => /^\d{8}$/.test(day)),
      'heatmap days keep their compact key format',
    );
  } finally {
    await fixture.close();
  }
});

test('keeps the stored date output formats', () => {
  assert.equal(isoWithOffset('2026-11-01 01:02:03.000000'), '2026-11-01T01:02:03+00:00');
  assert.equal(isoWithOffset('2026-11-01 01:02:03.123456'), '2026-11-01T01:02:03.123456+00:00');
  assert.equal(isoUtcMillis('2026-02-22 19:16:06.827525'), '2026-02-22T19:16:06.827Z');
  assert.equal(isoLocalMillis('2022-04-01 04:39:30.157000'), '2022-04-01T13:39:30.157+09:00');
  assert.equal(localDate('2026-10-31 15:30:00'), '2026-11-01');
  assert.equal(localDateTimeText('2029-12-31 15:00:00'), '2030-01-01 00:00');
});

test('answers a tab from before the browser build with the reload a missing catalog starts', async () => {
  const fixture = await screensApp();
  try {
    const old = await fixture.app.inject('/assets/web/chunks/search.PS94_Svm.js');
    assert.equal(old.statusCode, 200);
    assert.match(String(old.headers['content-type']), /^text\/javascript/);
    assert.equal(old.headers['cache-control'], 'no-store');
    assert.match(old.body, /dispatchEvent\(new Event\('blex:catalog-failed'\)\)/);
    assert.equal((await fixture.app.inject('/assets/web/mainStyle.BGuVjzlT.css')).statusCode, 404);
  } finally {
    await fixture.close();
  }
});

test('serves all stylesheets required by hosted screens', async () => {
  const fixture = await screensApp();
  try {
    const documentStyle = await readUiFile('styles/main.scss');
    assert.match(documentStyle, /^\/assets\/ui\/.+\.css$/);
    for (const url of ['/settings/posts', '/write', '/search']) {
      const response = await fixture.app.inject({ url, headers: signIn(fixture.db, 1) });
      assert.equal(response.statusCode, 200, url);
      const styles = [...response.body.matchAll(/<link rel="stylesheet" href="([^"]+)"/g)].map((match) => match[1]);
      assert.equal(styles.filter((href) => href === '/assets/blex/theme.css').length, 1, url);
      assert.ok(styles.includes(documentStyle), url);
      for (const href of styles) {
        const asset = await fixture.app.inject(href);
        assert.equal(asset.statusCode, 200, href);
        assert.match(String(asset.headers['content-type']), /^text\/css/, href);
      }
    }
  } finally {
    await fixture.close();
  }
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
  } finally {
    await fixture.close();
  }
});

test('mounts the 3.x editor for new, draft, and existing posts', async () => {
  const fixture = await screensApp();
  try {
    const headers = signIn(fixture.db, 1);
    const write = await fixture.app.inject({ url: '/write', headers });
    assert.equal(screenProps(write.body).props.mode, 'new');
    const draft = screenProps((await fixture.app.inject({ url: '/write?draft=draft', headers })).body);
    assert.deepEqual([draft.name, draft.props.mode, draft.props.draftUrl], ['PostEditor', 'draft', 'draft']);
    const editPage = await fixture.app.inject({ url: '/@writer/kept/edit', headers });
    const edit = screenProps(editPage.body);
    assert.deepEqual([edit.props.mode, edit.props.postUrl], ['edit', 'kept']);
    // The application moves to and from the editor, so its header is the application's header.
    for (const page of [write, editPage]) {
      assert.ok(isApplicationDocument(page.body));
      assert.match(page.body, /<script type="module" src="[^"]+" data-blex-page-module="screen">/);
    }
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
    assert.equal(
      screenProps((await fixture.app.inject({ url: '/@writer/kept/edit/', headers: writer })).body).name,
      'PostEditor',
    );
  } finally {
    await fixture.close();
  }
});

test('lets only the site frame the editor draft preview', async () => {
  const fixture = await screensApp();
  const policy = (response: { headers: Record<string, unknown> }) =>
    Object.fromEntries(
      String(response.headers['content-security-policy'])
        .split('; ')
        .map((directive) => {
          const [name, ...sources] = directive.split(' ');
          return [name, sources];
        }),
    );
  try {
    const writer = signIn(fixture.db, 1);
    const preview = await fixture.app.inject({ url: '/write/preview/draft', headers: writer });
    assert.equal(preview.statusCode, 200, preview.body);
    assert.deepEqual(policy(preview)['frame-ancestors'], ["'self'"]);
    assert.equal(preview.headers['x-frame-options'], 'SAMEORIGIN');

    const editor = await fixture.app.inject({ url: '/write', headers: writer });
    // Same-origin frames are limited to the preview path, next to the embeds posts and captcha already load.
    assert.deepEqual(policy(editor)['frame-src'], [
      'https://youtube.com',
      'https://www.youtube.com',
      'https://youtube-nocookie.com',
      'https://www.youtube-nocookie.com',
      'https://hcaptcha.com',
      'https://*.hcaptcha.com',
      'http://site.test/write/preview/',
    ]);
    assert.deepEqual({ ...policy(preview), 'frame-ancestors': ["'none'"] }, policy(editor));

    const refusals: Array<[string, Record<string, string>]> = [
      ['/write', writer],
      ['/@writer/kept', {}],
      ['/@writer/kept', writer],
      ['/', {}],
      ['/write/preview/draft', { accept: 'text/html' }],
    ];
    for (const [url, headers] of refusals) {
      const response = await fixture.app.inject({ url, headers });
      const label = `${url} ${headers.cookie ? 'signed in' : 'anonymous'}`;
      assert.equal(response.statusCode, url.startsWith('/write/preview/') ? 404 : 200, label);
      assert.deepEqual(policy(response)['frame-ancestors'], ["'none'"], label);
      assert.deepEqual(policy(response)['frame-src'], policy(editor)['frame-src'], label);
      assert.equal(response.headers['x-frame-options'], 'DENY', label);
    }
  } finally {
    await fixture.close();
  }
});

test('passes each role its settings capabilities', async () => {
  const fixture = await screensApp();
  try {
    insertRow(fixture.db, 'User', {
      id: 8,
      username: 'delegate',
      passwordHash: 'pbkdf2_sha256$fixture$delegate',
      isActive: 1,
      isStaff: 1,
    });
    insertRow(fixture.db, 'Profile', { userId: 8, role: 'READER' });
    const owner = screenProps(
      (await fixture.app.inject({ url: '/admin-settings/users', headers: signIn(fixture.db, 3) })).body,
    );
    assert.deepEqual(owner.props.adminCapabilities, {
      canManageSiteSettings: true,
      canManageLoginSettings: true,
      canManageIntegrationSettings: true,
      canManageUtilities: true,
    });
    const delegate = screenProps(
      (await fixture.app.inject({ url: '/admin-settings/users', headers: signIn(fixture.db, 8) })).body,
    );
    assert.deepEqual(delegate.props.adminCapabilities, {
      canManageSiteSettings: false,
      canManageLoginSettings: false,
      canManageIntegrationSettings: false,
      canManageUtilities: false,
    });
  } finally {
    await fixture.close();
  }
});

test('sends anonymous visitors to sign in and hides screens a viewer cannot open', async () => {
  const fixture = await screensApp();
  try {
    const writer = signIn(fixture.db, 1);
    const anonymous = await fixture.app.inject('/settings/account');
    assert.equal(anonymous.statusCode, 302);
    assert.match(String(anonymous.headers.location), /^\/login\?next=/);
    assert.equal((await fixture.app.inject('/write')).headers.location, '/login');
    assert.equal(
      (await fixture.app.inject({ url: '/admin-settings/users', headers: signIn(fixture.db, 2) })).statusCode,
      404,
    );
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
    assert.deepEqual(JSON.parse(globals?.[1] ?? '{}'), {
      HCAPTCHA_SITE_KEY: '',
      NEXT_URL: '/tags',
      INVITE_CODE: 'welcome',
    });
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
    const denied = await fixture.app.inject({
      url: '/@writer/about/edit',
      headers: { ...signIn(fixture.db, 2), accept: 'text/html' },
    });
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
      const response = await fixture.app.inject({
        method: 'POST',
        url: '/like/kept',
        headers,
        payload: new URLSearchParams({ csrfmiddlewaretoken: headers['x-csrftoken'], returnTo: returnTo }).toString(),
      });
      assert.equal(response.statusCode, 200, response.body);
      assert.equal(response.headers.location, undefined);
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
    insertRow(fixture.db, 'UsernameChange', { id: 1, userId: 1, username: 'oldwriter', createdAt: recent });
    const moved = await fixture.app.inject('/@oldwriter/posts?page=1&q=kept');
    assert.equal(moved.statusCode, 302);
    assert.equal(moved.headers.location, '/@writer/posts?page=1&q=kept');
  } finally {
    await fixture.close();
  }
});

test('limits an author to 100 drafts', async () => {
  const fixture = await screensApp();
  try {
    for (let id = 100; id < 199; id += 1) seedPost(fixture.db, id, 1, `draft-${id}`, { publishedAt: null });
    const editor = signIn(fixture.db, 1);
    const blocked = await fixture.app.inject({
      method: 'POST',
      url: '/v1/drafts',
      headers: { ...editor, 'content-type': 'application/json' },
      payload: { title: 'One too many', textMd: 'Body', contentType: 'markdown' },
    });
    assert.equal(blocked.json().errorCode, 'error:OF');
  } finally {
    await fixture.close();
  }
});

const editorForm = (csrf: string, values: Record<string, string> = {}) => ({
  csrfmiddlewaretoken: csrf,
  title: 'Editor post',
  subtitle: 'Sub',
  url: 'editor-post',
  contentHtml: '<p>Written body</p>',
  metaDescription: 'Written description',
  tag: 'one,two',
  series: '7',
  hide: 'false',
  advertise: 'false',
  blockComment: 'false',
  coverLayout: 'split',
  coverImagePosition: 'left',
  coverImageRatio: '4:3',
  ...values,
});

const coverPng = () =>
  sharp({ create: { width: 32, height: 24, channels: 3, background: '#336699' } })
    .png()
    .toBuffer();

const postRow = (db: Awaited<ReturnType<typeof screensApp>>['db'], url: string) =>
  db
    .prepare(`
  SELECT p.title, p.subtitle, p.image, p.seriesId AS series, p.description, p.publishedAt AS published,
         c.html, p.isHidden AS hide, p.isAdvertised AS advertise, p.commentsBlocked AS blockComment, p.coverLayout AS layout,
         p.coverImagePosition AS position, p.coverImageRatio AS ratio,
         (SELECT GROUP_CONCAT(t.name) FROM "_PostToTag" l JOIN "Tag" t ON t.id = l.B WHERE l.A = p.id) AS tags
  FROM "Post" p JOIN "PostContent" c ON c.postId = p.id WHERE p.slug = ?
`)
    .get(url) as Record<string, string | number | null> | undefined;

test('publishes a new post from the editor form with every field', async () => {
  const fixture = await screensApp();
  try {
    const headers = signIn(fixture.db, 1);
    const body = `<p>${'긴 본문 '.repeat(120_000)}</p>`;
    const form = multipart(
      editorForm(headers['x-csrftoken'], { contentHtml: body, hide: 'true', advertise: 'true', blockComment: 'true' }),
      { name: 'image', filename: 'cover.png', content: await coverPng() },
    );
    const created = await fixture.app.inject({
      method: 'POST',
      url: '/v1/posts',
      headers: { ...headers, 'content-type': form.contentType },
      payload: form.payload,
    });
    assert.deepEqual(created.json(), { status: 'DONE', body: { url: 'editor-post' } });
    const row = postRow(fixture.db, 'editor-post');
    assert.ok(row);
    assert.ok(String(row.image).startsWith('images/content/'));
    assert.ok(Buffer.byteLength(String(row.html)) > 1024 * 1024);
    assert.deepEqual(
      [
        row.title,
        row.subtitle,
        row.series,
        row.description,
        row.hide,
        row.advertise,
        row.blockComment,
        row.layout,
        row.position,
        row.ratio,
        row.tags,
      ],
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
      return fixture.app.inject({
        method: 'POST',
        url: '/v1/posts',
        headers: { ...headers, 'content-type': form.contentType },
        payload: form.payload,
      });
    };
    const posts = () => (fixture.db.prepare('SELECT COUNT(*) AS n FROM "Post"').get() as { n: number }).n;
    const before = posts();

    const pastSchedule = await send({ reservedDate: '2020-01-01T00:00:00.000Z' });
    assert.equal(pastSchedule.statusCode, 200);
    assert.deepEqual(
      [pastSchedule.json().status, pastSchedule.json().errorMessage],
      ['ERROR', '예약시간이 현재시간보다 이전입니다.'],
    );
    const brokenCover = await send({}, { name: 'image', filename: 'cover.png', content: Buffer.from('not an image') });
    assert.deepEqual(
      [brokenCover.json().status, brokenCover.json().errorMessage],
      ['ERROR', '이미지 업로드에 실패했습니다.'],
    );
    assert.equal(posts(), before);

    const draftBefore = postRow(fixture.db, 'draft');
    const rejectedDraft = await send({
      draftUrl: 'draft',
      url: 'draft',
      title: 'Changed',
      reservedDate: '2020-01-01T00:00:00.000Z',
    });
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
    fixture.db.prepare(`UPDATE "Post" SET image = 'images/content/2026/1/1/old.png' WHERE id = 3`).run();
    fixture.db.prepare('UPDATE "Post" SET draftScheduledAt = ? WHERE id = 3').run(Date.UTC(2099, 0, 1));
    const publishAt = new Date(Date.now() + 86_400_000).toISOString();
    const form = multipart(
      editorForm(headers['x-csrftoken'], {
        draftUrl: 'draft',
        url: 'draft',
        series: '',
        advertise: 'true',
        imageDelete: 'true',
        reservedDate: publishAt,
      }),
    );
    const published = await fixture.app.inject({
      method: 'POST',
      url: '/v1/posts',
      headers: { ...headers, 'content-type': form.contentType },
      payload: form.payload,
    });
    assert.deepEqual(published.json(), { status: 'DONE', body: { url: 'draft' } });
    const row = postRow(fixture.db, 'draft');
    assert.ok(row);
    assert.deepEqual(
      [row.published, row.image, row.series, row.advertise, row.layout, row.tags],
      [Date.parse(publishAt), '', null, 1, 'split', 'one,two'],
    );
    assert.equal(
      (
        fixture.db.prepare(`SELECT COUNT(*) AS n FROM "Post" WHERE id = 3 AND draftScheduledAt IS NOT NULL`).get() as {
          n: number;
        }
      ).n,
      0,
    );
    assert.equal(
      (fixture.db.prepare('SELECT COUNT(*) AS n FROM "ScheduledPublication" WHERE postId = 3').get() as { n: number })
        .n,
      1,
    );
  } finally {
    await fixture.close();
  }
});

test('guards editor publishing by session, role, CSRF, and draft ownership', async () => {
  const fixture = await screensApp();
  try {
    seedPost(fixture.db, 20, 3, 'someone-elses-draft', { publishedAt: null });
    const writer = signIn(fixture.db, 1);
    const count = () => (fixture.db.prepare('SELECT COUNT(*) AS n FROM "Post"').get() as { n: number }).n;
    const before = count();
    const send = (headers: Record<string, string>, csrf: string, fields: Record<string, string> = {}) => {
      const form = multipart(editorForm(csrf, fields));
      return fixture.app.inject({
        method: 'POST',
        url: '/v1/posts',
        headers: { ...headers, 'content-type': form.contentType },
        payload: form.payload,
      });
    };

    assert.equal((await send({}, 'x'.repeat(43))).statusCode, 403);
    const { 'x-csrftoken': _token, ...withoutHeader } = writer;
    assert.equal((await send(withoutHeader, 'y'.repeat(43))).statusCode, 403);
    assert.equal((await send(signIn(fixture.db, 2), writer['x-csrftoken'])).json().errorCode, 'error:RJ');
    assert.equal((await send(writer, writer['x-csrftoken'], { draftUrl: 'someone-elses-draft' })).statusCode, 404);
    assert.equal((await send(writer, writer['x-csrftoken'], { draftUrl: 'kept' })).statusCode, 404);
    assert.equal(count(), before);
    assert.equal(
      (
        fixture.db.prepare('SELECT publishedAt AS published FROM "Post" WHERE id = 20').get() as {
          published: string | null;
        }
      ).published,
      null,
    );
  } finally {
    await fixture.close();
  }
});

test('edits a post from the editor form and keeps what it leaves out', async () => {
  const fixture = await screensApp();
  try {
    const headers = signIn(fixture.db, 1);
    fixture.db.prepare('UPDATE "Post" SET isAdvertised = 1 WHERE id = 1').run();
    const {
      series: _series,
      tag: _tag,
      ...fields
    } = editorForm(headers['x-csrftoken'], { title: 'Kept edited', url: 'kept', contentHtml: '<p>Edited</p>' });
    const { advertise: _advertise, ...withoutAdvertise } = fields;
    const form = multipart(withoutAdvertise, { name: 'image', filename: 'cover.png', content: await coverPng() });
    const saved = await fixture.app.inject({
      method: 'POST',
      url: '/v1/users/@writer/posts/kept',
      headers: { ...headers, 'content-type': form.contentType },
      payload: form.payload,
    });
    assert.deepEqual(saved.json(), { status: 'DONE', body: {} });
    const row = postRow(fixture.db, 'kept');
    assert.ok(row);
    assert.deepEqual(
      [row.title, row.series, row.tags, row.advertise, row.layout],
      ['Kept edited', 7, 'kept-tag', 1, 'split'],
    );
    assert.ok(String(row.image).startsWith('images/content/'));

    const rejected = multipart(editorForm(headers['x-csrftoken'], { url: 'kept', contentHtml: '' }));
    const failed = await fixture.app.inject({
      method: 'POST',
      url: '/v1/users/@writer/posts/kept',
      headers: { ...headers, 'content-type': rejected.contentType },
      payload: rejected.payload,
    });
    assert.deepEqual([failed.json().status, failed.json().errorMessage], ['ERROR', '내용을 입력해주세요.']);
    assert.equal(postRow(fixture.db, 'kept')?.title, 'Kept edited');

    const other = signIn(fixture.db, 3);
    const notOwner = multipart(editorForm(other['x-csrftoken'], { url: 'kept' }));
    const denied = await fixture.app.inject({
      method: 'POST',
      url: '/v1/users/@writer/posts/kept',
      headers: { ...other, 'content-type': notOwner.contentType },
      payload: notOwner.payload,
    });
    assert.equal(denied.statusCode, 404);
  } finally {
    await fixture.close();
  }
});

test('clears series and tags only when the editor sends them empty', async () => {
  const fixture = await screensApp();
  try {
    const headers = signIn(fixture.db, 1);
    const csrf = headers['x-csrftoken'];
    const send = (method: string, url: string, form: ReturnType<typeof multipart>) =>
      fixture.app.inject({
        method: method as 'POST' | 'PUT',
        url,
        headers: { ...headers, 'content-type': form.contentType },
        payload: form.payload,
      });
    const place = (slug: string) => {
      const { id } = fixture.db.prepare('SELECT id FROM "Post" WHERE slug = ?').get(slug) as { id: number };
      fixture.db.prepare('UPDATE "Post" SET seriesId = 7 WHERE id = ?').run(id);
      fixture.db.prepare('DELETE FROM "_PostToTag" WHERE A = ?').run(id);
      fixture.db.prepare('INSERT INTO "_PostToTag" (A, B) VALUES (?, 3)').run(id);
    };
    const placement = (slug: string) => {
      const row = postRow(fixture.db, slug);
      assert.ok(row);
      return [row.series, row.tags];
    };
    insertRow(fixture.db, 'Tag', { id: 3, name: 'keptword' });
    const edit = (values: Record<string, string>) =>
      multipart(editorForm(csrf, { title: 'Kept', url: 'kept', contentHtml: '<p>Edited</p>', ...values }));

    // Editing a published post.
    place('kept');
    const {
      series: _series,
      tag: _tag,
      ...untouched
    } = editorForm(csrf, { title: 'Kept', url: 'kept', contentHtml: '<p>Edited</p>' });
    assert.equal((await send('POST', '/v1/users/@writer/posts/kept', multipart(untouched))).json().status, 'DONE');
    assert.deepEqual(placement('kept'), [7, 'keptword']);
    assert.equal(
      (await send('POST', '/v1/users/@writer/posts/kept', edit({ series: '7', tag: 'keptword' }))).json().status,
      'DONE',
    );
    assert.deepEqual(placement('kept'), [7, 'keptword']);
    assert.equal(
      (await send('POST', '/v1/users/@writer/posts/kept', edit({ series: '999', tag: 'keptword' }))).json().status,
      'DONE',
    );
    assert.deepEqual(placement('kept'), [7, 'keptword'], 'an unknown series id is not a request to clear');
    assert.equal(
      (await send('POST', '/v1/users/@writer/posts/kept', edit({ series: '', tag: '' }))).json().status,
      'DONE',
    );
    assert.deepEqual(placement('kept'), [null, null]);

    // Autosaving a draft, as JSON and as a form with a cover change.
    place('draft');
    const autosave = (payload: Record<string, unknown>) =>
      fixture.app.inject({
        method: 'PUT',
        url: '/v1/drafts/draft',
        headers: { ...headers, 'content-type': 'application/json' },
        payload,
      });
    assert.equal((await autosave({ title: 'Draft', content: '<p>Saved</p>' })).json().status, 'DONE');
    assert.deepEqual(placement('draft'), [7, 'keptword']);
    assert.equal(
      (await autosave({ title: 'Draft', content: '<p>Saved</p>', tags: '', seriesUrl: '' })).json().status,
      'DONE',
    );
    assert.deepEqual(placement('draft'), [null, null]);
    place('draft');
    const draftForm = multipart({
      csrfmiddlewaretoken: csrf,
      title: 'Draft',
      content: '<p>Saved</p>',
      tags: '',
      seriesUrl: '',
    });
    assert.equal((await send('PUT', '/v1/drafts/draft', draftForm)).json().status, 'DONE');
    assert.deepEqual(placement('draft'), [null, null]);

    // Publishing that draft keeps a series the form left out, then a new draft clears when asked.
    place('draft');
    const { series: _omitted, ...publishFields } = editorForm(csrf, {
      draftUrl: 'draft',
      url: 'draft',
      title: 'Draft',
      tag: 'keptword',
    });
    assert.equal((await send('POST', '/v1/posts', multipart(publishFields))).json().status, 'DONE');
    assert.deepEqual(placement('draft'), [7, 'keptword']);
    seedPost(fixture.db, 30, 1, 'second-draft', { publishedAt: null });
    place('second-draft');
    const cleared = multipart(
      editorForm(csrf, { draftUrl: 'second-draft', url: 'second-draft', title: 'Second', series: '', tag: '' }),
    );
    assert.equal((await send('POST', '/v1/posts', cleared)).json().status, 'DONE');
    assert.deepEqual(placement('second-draft'), [null, null]);
  } finally {
    await fixture.close();
  }
});

test('keeps hyphens inside tags through the editor while the other separators still split', async () => {
  assert.deepEqual(normalizedTags('legacy-tag'), ['legacy-tag']);
  assert.deepEqual(normalizedTags('Legacy-Tag, legacy-tag,new_tag  spaced'), ['legacy-tag', 'new', 'tag', 'spaced']);
  assert.deepEqual(normalizedTags('--edge--, a--b, -, 한글-태그, Ａ－Ｂ'), ['edge', 'a-b', '한글-태그']);
  assert.deepEqual(normalizedTags(''), []);

  const fixture = await screensApp();
  try {
    const headers = signIn(fixture.db, 1);
    const form = multipart(
      editorForm(headers['x-csrftoken'], {
        title: 'Kept',
        url: 'kept',
        contentHtml: '<p>Edited</p>',
        tag: 'kept-tag,second-tag',
      }),
    );
    const saved = await fixture.app.inject({
      method: 'POST',
      url: '/v1/users/@writer/posts/kept',
      headers: { ...headers, 'content-type': form.contentType },
      payload: form.payload,
    });
    assert.equal(saved.json().status, 'DONE', saved.body);
    assert.deepEqual(String(postRow(fixture.db, 'kept')?.tags).split(',').sort(), ['kept-tag', 'second-tag']);
    assert.equal(
      (
        fixture.db.prepare(`SELECT COUNT(*) AS n FROM "Tag" WHERE name IN ('kept', 'tag', 'second')`).get() as {
          n: number;
        }
      ).n,
      0,
    );
    assert.equal((await fixture.app.inject('/tag/kept-tag')).statusCode, 200);
    assert.equal((await fixture.app.inject('/tag/second-tag')).statusCode, 200);
  } finally {
    await fixture.close();
  }
});

test('retires the old editor, image upload, and series form URLs', async () => {
  const fixture = await screensApp();
  try {
    const headers = signIn(fixture.db, 1);
    const form = { ...headers, 'content-type': 'application/x-www-form-urlencoded' };
    const payload = `csrfmiddlewaretoken=${headers['x-csrftoken']}&title=Gone&textMd=Gone&name=Gone`;
    const before = (fixture.db.prepare('SELECT COUNT(*) AS n FROM "Post"').get() as { n: number }).n;
    for (const url of ['/write', '/@writer/kept/edit', '/write/images', '/series/create', '/series/edit/7']) {
      assert.equal(
        (await fixture.app.inject({ method: 'POST', url, headers: form, payload })).statusCode,
        404,
        `POST ${url}`,
      );
    }
    for (const url of [
      '/write/images',
      '/series/create',
      '/series/edit/7',
      '/assets/blex/editor.js',
      '/assets/blex/editor.css',
    ]) {
      assert.equal((await fixture.app.inject({ url, headers })).statusCode, 404, `GET ${url}`);
    }
    assert.equal((fixture.db.prepare('SELECT COUNT(*) AS n FROM "Post"').get() as { n: number }).n, before);
    assert.equal(
      (fixture.db.prepare(`SELECT title FROM "Post" WHERE id = 1`).get() as { title: string }).title,
      'Kept',
    );
    assert.equal(
      (fixture.db.prepare(`SELECT name FROM "Series" WHERE id = 7`).get() as { name: string }).name,
      'Guide',
    );
  } finally {
    await fixture.close();
  }
});

test('counts management tags on live posts only', async () => {
  const fixture = await screensApp();
  try {
    const { body } = (await fixture.app.inject({ url: '/v1/setting/tag', headers: signIn(fixture.db, 1) })).json() as {
      body: { tags: Array<{ name: string | null; count: number }> };
    };
    assert.ok(body.tags.some((tag) => tag.name === 'kept-tag' && tag.count === 1));
    assert.ok(!body.tags.some((tag) => tag.name === 'trashed-tag'));
  } finally {
    await fixture.close();
  }
});
