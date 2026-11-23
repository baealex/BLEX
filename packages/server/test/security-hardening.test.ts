import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { connect } from 'node:net';
import test from 'node:test';
import { PrismaClient } from '@prisma/client';
import Fastify from 'fastify';
import sharp from 'sharp';
import { buildApp } from '../src/app.js';
import { htmlToMarkdown } from '../src/features/discovery/feeds/markdown.js';
import { registerContentMedia } from '../src/features/media/content-media.js';
import { markdownToHtml } from '../src/features/posts/authoring/markdown.js';
import { postOutline } from '../src/features/posts/post-html.js';
import { saveBannerOrder } from '../src/features/site-admin/services/banners.js';
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
type Headers = Record<string, string>;

async function withApp(
  run: (context: {
    fixture: Fixture;
    app: Awaited<ReturnType<typeof buildApp>>;
    writer: Headers;
    reader: Headers;
  }) => Promise<void>,
) {
  const fixture = await createMigratedDatabase();
  seedEditor(fixture.db, 1, 'writer');
  seedEditor(fixture.db, 2, 'other');
  insertRow(fixture.db, 'User', {
    id: 3,
    username: 'reader',
    passwordHash: 'pbkdf2_sha256$fixture$reader',
    isActive: 1,
  });
  insertRow(fixture.db, 'Profile', { userId: 3, role: 'READER' });
  const writer = signIn(fixture.db, 1);
  const reader = signIn(fixture.db, 3);
  const app = await buildApp(
    fixture.path,
    testSiteUrl,
    { secretKey: testSecretKey, cipherKey: testCipherKey },
    fixture.mediaRoot,
  );
  try {
    await run({ fixture, app, writer, reader });
  } finally {
    await app.close();
    await fixture.cleanup();
  }
}

const json = (headers: Headers) => ({ ...headers, 'content-type': 'application/json' });
const form = (headers: Headers) => ({ ...headers, 'content-type': 'application/x-www-form-urlencoded' });

function multipart(fields: Record<string, string>, file?: { name: string; filename: string; buffer: Buffer }) {
  const boundary = 'blex-security-boundary';
  const chunks: Buffer[] = [];
  for (const [name, value] of Object.entries(fields)) {
    chunks.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`));
  }
  if (file) {
    chunks.push(
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="${file.name}"; filename="${file.filename}"\r\nContent-Type: application/octet-stream\r\n\r\n`,
      ),
    );
    chunks.push(file.buffer, Buffer.from('\r\n'));
  }
  chunks.push(Buffer.from(`--${boundary}--\r\n`));
  return { contentType: `multipart/form-data; boundary=${boundary}`, payload: Buffer.concat(chunks) };
}

function assertFast(label: string, run: () => unknown) {
  const started = performance.now();
  run();
  const elapsed = performance.now() - started;
  assert.ok(elapsed < 1000, `${label} took ${Math.round(elapsed)}ms`);
}

test('only editors can render Markdown previews', async () => {
  await withApp(async ({ app, writer, reader }) => {
    const forged = 'f'.repeat(43);
    const anonymous = { cookie: `csrftoken=${forged}`, 'x-csrftoken': forged, origin: testSiteUrl.origin };
    const render = (headers: Headers) =>
      app.inject({
        method: 'POST',
        url: '/v1/markdown',
        headers: json(headers),
        payload: JSON.stringify({ text: '**bold**' }),
      });
    assert.equal((await render(anonymous)).json().errorCode, 'error:NL');
    assert.equal((await render(reader)).json().errorCode, 'error:RJ');
    assert.match((await render(writer)).json().body.html, /<strong>bold<\/strong>/);
  });
});

const lineSeparator = String.fromCharCode(0x2028);
const nul = String.fromCharCode(0);

test('Markdown parsing stays fast on inputs built to backtrack', () => {
  const inputs = {
    brackets: '['.repeat(64_000),
    imageBrackets: '!['.repeat(32_000),
    unclosedLinks: '[a]('.repeat(32_000),
    unclosedImages: '![a]('.repeat(16_000),
    headingSpaces: `# a${' '.repeat(3_000)}b`,
    listSpaces: `- ${' '.repeat(64_000)}${lineSeparator}`,
  };
  for (const [label, input] of Object.entries(inputs)) assertFast(label, () => markdownToHtml(input));
});

test('Markdown output cannot be amplified from a small document', () => {
  const inputs = {
    forgedPlaceholders: `[a](https://a.example/${'x'.repeat(2_000)}) ${`${nul}0${nul}`.repeat(2_000)}`,
    repeatedReferences: `[a]: https://a.example/${'x'.repeat(2_000)}\n\n${'[a] '.repeat(2_000)}`,
    autocompletedCells: `${'|a'.repeat(2_000)}|\n${'|-'.repeat(2_000)}|\n${'b\n'.repeat(2_000)}`,
  };
  for (const [label, input] of Object.entries(inputs)) {
    assert.ok(markdownToHtml(input).length < 1_000_000, label);
  }
});

test('Markdown keeps its safety and block contract', () => {
  assert.match(markdownToHtml('[site](https://a.example)'), /<a href="https:\/\/a\.example">site<\/a>/);
  assert.match(markdownToHtml('![alt](https://a.example/a.png)'), /<img src="https:\/\/a\.example\/a\.png" alt="alt"/);
  assert.doesNotMatch(markdownToHtml('[x](javascript:alert(1))'), /<a /);
  assert.doesNotMatch(markdownToHtml('[x](//evil.example)'), /<a /);
  assert.doesNotMatch(markdownToHtml('<script>bad()</script><img src=x onerror=y>'), /<script|<img/);
  assert.match(markdownToHtml('## Title ##'), /<h2[^>]*>Title<\/h2>/);
  assert.match(markdownToHtml('a\nb'), /a<br \/?>\s*b/);
  assert.match(markdownToHtml('**"강조"**는'), /<strong>"강조"<\/strong>는/);
  assert.match(markdownToHtml('| a |\n|---|\n| 1 |'), /<table>/);
  assert.match(markdownToHtml('```ts\nconst a = 1;\n```'), /<code class="language-ts">/);
  assert.doesNotMatch(markdownToHtml('```a"b\nx\n```'), /language-/);
  assert.match(
    markdownToHtml('![clip](/resources/media/a/b.mp4)'),
    /<figure><video[^>]*><source src="\/resources\/media\/a\/b\.mp4" type="video\/mp4"[^>]*>(?:<\/source>)?<\/video><figcaption>clip<\/figcaption><\/figure>/,
  );
});

test('HTML to Markdown stays fast on inputs built to backtrack', () => {
  const inputs = {
    attributeSpaces: `<a title="${' '.repeat(64_000)}x">t</a>`,
    tagSpaces: `<a${' '.repeat(64_000)}x>t</a>`,
    unclosedTags: '<a'.repeat(64_000),
    unclosedQuotes: '<a "'.repeat(32_000),
    closersUnderDepth: `${'<div>'.repeat(1_000)}${'</x>y'.repeat(200_000)}`,
    paragraphNewlines: `<p>a${'\n'.repeat(64_000)}b</p>`,
    codeNewlines: `<pre><code>a${'\n'.repeat(64_000)}b</code></pre>`,
    unclosedComments: '<!--'.repeat(30_000),
  };
  for (const [label, input] of Object.entries(inputs)) assertFast(label, () => htmlToMarkdown(input));
  assert.equal(htmlToMarkdown('<p>a <a href="https://a.example" >link</a><br /></p>'), 'a [link](https://a.example)');
  assert.equal(htmlToMarkdown('<p>Hello  , world !</p>'), 'Hello, world!');
});

test('repeated headings get unique ids in linear time', () => {
  assertFast('headings', () => postOutline('<h2>a</h2>'.repeat(8_000)));
  const { headings } = postOutline('<h2>a</h2><h2 id="a-1">b</h2><h2>a</h2><h2>a</h2>');
  assert.deepEqual(
    headings.map(({ id }) => id),
    ['a', 'a-1', 'a-2', 'a-3'],
  );
});

test('author and tag searches use the same 100 character limit as site search', async () => {
  await withApp(async ({ app, fixture }) => {
    const long = 'a'.repeat(100);
    seedPost(fixture.db, 10, 1, 'long-title', { title: long });
    insertRow(fixture.db, 'Series', { id: 20, ownerId: 1, slug: 'long-series', name: long });
    fixture.db.prepare('UPDATE "Post" SET seriesId = 20 WHERE id = 10').run();
    insertRow(fixture.db, 'Tag', { id: 30, name: long });
    insertRow(fixture.db, '_PostToTag', { A: 10, B: 30 });
    const query = `${long}zzz`;
    assert.match((await app.inject(`/@writer/posts?q=${query}`)).body, /long-title/);
    assert.match((await app.inject(`/@writer/series?q=${query}`)).body, /long-series/);
    assert.match((await app.inject(`/tags?q=${query}`)).body, new RegExp(`/tag/${long}`));
  });
});

test('a search term cut at 100 characters never splits an emoji', async () => {
  await withApp(async ({ app }) => {
    const query = encodeURIComponent(`${'a'.repeat(99)}😀`);
    for (const path of ['/search', '/v1/search', '/tags', '/@writer/posts', '/@writer/series']) {
      assert.equal((await app.inject(`${path}?q=${query}`)).statusCode, 200, path);
    }
  });
});

test('the server enforces the 10,000 character comment limit', async () => {
  await withApp(async ({ app, fixture, writer, reader }) => {
    seedPost(fixture.db, 10, 1, 'open-post');
    const create = (commentMd: string) =>
      app.inject({
        method: 'POST',
        url: '/v1/comments?url=open-post',
        headers: form(reader),
        payload: new URLSearchParams({ commentMd }).toString(),
      });
    assert.equal((await create('a'.repeat(10_001))).json().errorCode, 'error:VA');
    assert.equal((await create('<'.repeat(10_001))).json().errorCode, 'error:VA');
    const exact = await create('a'.repeat(10_000));
    assert.equal(exact.json().status, 'DONE');
    // Browsers submit each textarea line break as CRLF, which the field limit counts as one character.
    assert.equal((await create(`${'a\r\n'.repeat(4_000)}${'a'.repeat(2_000)}`)).json().status, 'DONE');

    const { id } = fixture.db.prepare('SELECT id FROM "Comment" ORDER BY id LIMIT 1').get() as { id: number };
    const edited = await app.inject({
      method: 'PUT',
      url: `/v1/comments/${id}`,
      headers: form(reader),
      payload: new URLSearchParams({ comment: 'true', commentMd: 'a'.repeat(10_001) }).toString(),
    });
    assert.equal(edited.json().errorCode, 'error:VA');
    const stored = fixture.db.prepare('SELECT length(markdown) AS size FROM "Comment" WHERE id = ?').get(id) as {
      size: number;
    };
    assert.equal(stored.size, 10_000);
    // The reply box limits the text, and the client then prefixes the mention it names.
    assert.equal((await create(`@writer ${'a'.repeat(10_000)}`)).json().status, 'DONE');
    assert.equal((await create(`@writer ${'a'.repeat(10_001)}`)).json().errorCode, 'error:VA');
    assert.ok(writer);
  });
});

test('static page styles cannot close their element and inject markup', async () => {
  await withApp(async ({ app, fixture }) => {
    const page = (id: number, slug: string, content: string) =>
      insertRow(fixture.db, 'StaticPage', {
        id,
        slug,
        title: slug,
        content,
        isPublished: 1,
      });
    page(
      1,
      'slash',
      '<style>a{}</style/><meta http-equiv="refresh" content="0;url=https://evil.example"><p>Body</p></style>',
    );
    page(
      2,
      'attribute',
      '<style>a{}</style x><meta http-equiv="refresh" content="0;url=https://evil.example"></style>',
    );
    page(3, 'upper', '<STYLE>a{}</STYLE\n><meta http-equiv="refresh" content="0;url=https://evil.example"></STYLE>');
    page(4, 'plain', '<style>@media (width < 600px) { p { color: red; } }</style><p>Body</p>');
    for (const slug of ['slash', 'attribute', 'upper']) {
      const body = (await app.inject(`/static/${slug}`)).body;
      assert.doesNotMatch(body, /http-equiv="refresh"/, slug);
      assert.doesNotMatch(body, /evil\.example/, slug);
    }
    const plain = (await app.inject('/static/plain')).body;
    assert.ok(plain.includes('<style>@media (width < 600px) { p { color: red; } }</style>'));
  });
});

test('upload routes refuse large bodies that are not multipart before login', async () => {
  await withApp(async ({ app, writer }) => {
    const large = JSON.stringify({ value: 'a'.repeat(9 * 1024 * 1024) });
    for (const url of [
      '/v1/image',
      '/v1/setting/avatar',
      '/v1/setting/cover',
      '/v1/site-settings/brand-assets',
      '/work-logs/1/entry/',
    ]) {
      const response = await app.inject({
        method: 'POST',
        url,
        headers: { 'content-type': 'application/json' },
        payload: large,
      });
      assert.equal(response.json().errorCode, 'error:NL', url);
    }
    const small = await app.inject({ method: 'POST', url: '/v1/image', headers: json(writer), payload: '{}' });
    assert.equal(small.json().errorCode, 'error:VA');
  });
});

test('large bodies need the right account before they are read', async () => {
  await withApp(async ({ app, fixture, writer, reader }) => {
    seedPost(fixture.db, 10, 1, 'open-post');
    const large = JSON.stringify({ title: 'Large', content: 'a'.repeat(32 * 1024) });
    const forged = 'f'.repeat(43);
    const anonymous = { cookie: `csrftoken=${forged}`, 'x-csrftoken': forged, origin: testSiteUrl.origin };
    const send = (url: string, headers: Headers, method: 'POST' | 'PUT' = 'POST') =>
      app.inject({ method, url, headers: json(headers), payload: large });

    for (const url of ['/v1/forms', '/v1/markdown', '/v1/drafts', '/v1/notices', '/v1/comments?url=open-post']) {
      assert.equal((await send(url, anonymous)).json().errorCode, 'error:NL', `anonymous ${url}`);
    }
    for (const url of ['/v1/forms', '/v1/markdown', '/v1/drafts', '/v1/notices']) {
      assert.equal((await send(url, reader)).json().errorCode, 'error:RJ', `reader ${url}`);
    }
    assert.equal((await send('/v1/drafts', writer)).json().status, 'DONE');
    const comment = await app.inject({
      method: 'POST',
      url: '/v1/comments?url=open-post',
      headers: form(reader),
      payload: new URLSearchParams({ commentMd: '가'.repeat(5_000) }).toString(),
    });
    assert.equal(comment.json().status, 'DONE');

    const chunked = await app.inject({
      method: 'POST',
      url: '/v1/forms',
      headers: { ...json(writer), 'transfer-encoding': 'chunked' },
      payload: '{}',
    });
    assert.equal(chunked.statusCode, 411);
  });
});

test('editor multipart forms refuse parsed JSON fields', async () => {
  await withApp(async ({ app, fixture, writer }) => {
    const boundary = 'blex-json-part';
    const payload = [
      `--${boundary}`,
      'Content-Disposition: form-data; name="title"',
      '',
      'Draft',
      `--${boundary}`,
      'Content-Disposition: form-data; name="content"',
      '',
      '<p>Body</p>',
      `--${boundary}`,
      'Content-Disposition: form-data; name="padding"',
      'Content-Type: application/json',
      '',
      '{"a":1}',
      `--${boundary}--`,
      '',
    ].join('\r\n');
    const response = await app.inject({
      method: 'POST',
      url: '/v1/drafts',
      headers: { ...writer, 'content-type': `multipart/form-data; boundary=${boundary}` },
      payload,
    });
    assert.equal(response.json().status, 'ERROR');
    const { total } = fixture.db.prepare('SELECT COUNT(*) AS total FROM "Post"').get() as { total: number };
    assert.equal(total, 0);
  });
});

test('Developer API uploads share the per-account body budget', async () => {
  await withApp(async ({ app, fixture }) => {
    const rawToken = 'blex_pat_budget00001_test-secret';
    insertRow(fixture.db, 'DeveloperToken', {
      id: 1,
      userId: 1,
      name: 'Upload',
      tokenPrefix: 'budget00001',
      tokenHash: createHash('sha256').update(rawToken).digest('hex'),
      scopes: JSON.stringify(['posts:write']),
    });
    const address = await app.listen({ port: 0, host: '127.0.0.1' });
    const { port } = new URL(address);
    const open = () =>
      new Promise<{ socket: ReturnType<typeof connect>; status: Promise<number> }>((accept) => {
        const socket = connect(Number(port), '127.0.0.1');
        socket.on('error', () => undefined);
        const status = new Promise<number>((done) =>
          socket.once('data', (chunk) => done(Number(String(chunk).split(' ')[1]))),
        );
        socket.write(
          [
            'POST /api/developer/v1/images HTTP/1.1',
            'Host: localhost',
            `Authorization: Bearer ${rawToken}`,
            'Content-Type: multipart/form-data; boundary=slow',
            `Content-Length: ${19 * 1024 * 1024}`,
            '',
            '--slow',
            'Content-Disposition: form-data; name="image"; filename="slow.png"',
            '',
            'x',
          ].join('\r\n'),
          () => accept({ socket, status }),
        );
      });
    const first = await open();
    const second = await open();
    await new Promise((accept) => setTimeout(accept, 100));
    const third = await open();
    try {
      const unanswered = new Promise<number>((accept) => setTimeout(() => accept(0), 2_000));
      assert.equal(await Promise.race([third.status, unanswered]), 429);
    } finally {
      for (const { socket } of [first, second, third]) socket.destroy();
    }
  });
});

test('oversized GIF frames are rejected before transcoding', async () => {
  await withApp(async ({ app, writer }) => {
    const gif = await sharp({ create: { width: 3000, height: 3000, channels: 3, background: '#000000' } })
      .gif()
      .toBuffer();
    const body = multipart({}, { name: 'image', filename: 'large.gif', buffer: gif });
    const response = await app.inject({
      method: 'POST',
      url: '/v1/image',
      headers: { ...writer, 'content-type': body.contentType },
      payload: body.payload,
    });
    assert.equal(response.json().status, 'ERROR');
    assert.match(response.json().errorMessage, /GIF/);
  });
});

test('slow upload bodies do not take the image processing slots', async () => {
  const fixture = await createMigratedDatabase();
  seedEditor(fixture.db, 1, 'writer');
  const db = new PrismaClient({ datasourceUrl: `file:${fixture.path}?connection_limit=1` });
  const app = Fastify();
  registerContentMedia(app, db, {
    mediaRoot: fixture.mediaRoot,
    currentUser: async () => ({ id: 1, hasEditorRole: true }),
    validateCsrf: () => true,
  });
  const address = await app.listen({ port: 0, host: '127.0.0.1' });
  const { port } = new URL(address);
  const sockets = [connect(Number(port), '127.0.0.1'), connect(Number(port), '127.0.0.1')];
  try {
    for (const socket of sockets) {
      socket.on('error', () => undefined);
      socket.write(
        [
          'POST /v1/image HTTP/1.1',
          'Host: localhost',
          'Content-Type: multipart/form-data; boundary=slow',
          'Content-Length: 1000000',
          '',
          '--slow',
          'Content-Disposition: form-data; name="image"; filename="slow.png"',
          '',
          'x',
        ].join('\r\n'),
      );
    }
    await new Promise((accept) => setTimeout(accept, 200));
    const png = await sharp({ create: { width: 8, height: 8, channels: 3, background: '#0077ff' } })
      .png()
      .toBuffer();
    const body = multipart({}, { name: 'image', filename: 'small.png', buffer: png });
    const response = await app.inject({
      method: 'POST',
      url: '/v1/image',
      headers: { 'content-type': body.contentType },
      payload: body.payload,
    });
    assert.equal(response.json().status, 'DONE', response.body);
  } finally {
    for (const socket of sockets) socket.destroy();
    await app.close();
    await db.$disconnect();
    await fixture.cleanup();
  }
});

test('editor multipart forms cannot exceed the editor body limit across fields', async () => {
  await withApp(async ({ app, fixture, writer }) => {
    const padding = 'a'.repeat(7 * 1024 * 1024);
    const body = multipart({ title: 'Too large', content: '<p>Body</p>', paddingOne: padding, paddingTwo: padding });
    const response = await app.inject({
      method: 'POST',
      url: '/v1/drafts',
      headers: { ...writer, 'content-type': body.contentType },
      payload: body.payload,
    });
    assert.equal(response.json().status, 'ERROR');
    const { total } = fixture.db.prepare('SELECT COUNT(*) AS total FROM "Post"').get() as { total: number };
    assert.equal(total, 0);

    const allowed = multipart({ title: 'Normal', content: '<p>Body</p>' });
    const saved = await app.inject({
      method: 'POST',
      url: '/v1/drafts',
      headers: { ...writer, 'content-type': allowed.contentType },
      payload: allowed.payload,
    });
    assert.equal(saved.json().status, 'DONE', saved.body);
  });
});

test('banner ordering writes only the changed banners the owner has', async () => {
  const fixture = await createMigratedDatabase();
  seedEditor(fixture.db, 1, 'writer');
  seedEditor(fixture.db, 2, 'other');
  const banner = (id: number, userId: number, order: number) =>
    insertRow(fixture.db, 'SiteBanner', {
      id,
      userId,
      scope: 'user',
      type: 'horizontal',
      position: 'top',
      order,
    });
  banner(100, 1, 0);
  banner(101, 1, 3);
  banner(200, 2, 5);
  const db = new PrismaClient({
    datasourceUrl: `file:${fixture.path}?connection_limit=1`,
    log: [{ emit: 'event', level: 'query' }],
  });
  const writes: string[] = [];
  db.$on('query', ({ query }) => {
    if (/^UPDATE/i.test(query)) writes.push(query);
  });
  try {
    await saveBannerOrder(
      db,
      [...Array.from({ length: 5_000 }, () => [100, 1]), [100, 7], [101, 3], [200, 9], [999, 9], ['bad']],
      'user',
      1,
    );
    await new Promise((accept) => setTimeout(accept, 20));
    const order = (id: number) =>
      (fixture.db.prepare('SELECT "order" AS value FROM "SiteBanner" WHERE id = ?').get(id) as { value: number }).value;
    assert.deepEqual([order(100), order(101), order(200)], [7, 3, 5]);
    assert.ok(writes.length <= 1, `${writes.length} banner updates`);
  } finally {
    await db.$disconnect();
    await fixture.cleanup();
  }
});

test('an author can keep at most 20 webhook channels', async () => {
  await withApp(async ({ app, fixture, writer }) => {
    const save = (index: number) =>
      app.inject({
        method: 'POST',
        url: '/v1/webhook/channels',
        headers: form(writer),
        payload: new URLSearchParams({
          webhookUrl: `https://hooks.example/${index}`,
          name: `Hook ${index}`,
        }).toString(),
      });
    for (let index = 0; index < 20; index += 1) assert.equal((await save(index)).json().status, 'DONE');
    assert.equal((await save(20)).json().errorCode, 'error:VA');
    assert.equal((await save(3)).json().status, 'DONE');
    const { total } = fixture.db.prepare('SELECT COUNT(*) AS total FROM "WebhookChannel" WHERE ownerId = 1').get() as {
      total: number;
    };
    assert.equal(total, 20);
  });
});
