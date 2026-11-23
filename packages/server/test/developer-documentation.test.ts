import { Ajv } from 'ajv';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { promisify } from 'node:util';
import test, { type TestContext } from 'node:test';
import { Parser } from 'htmlparser2';
import sharp from 'sharp';
import { Type } from 'typebox';
import { buildApp } from '../src/app.js';
import { apiExamples } from '../src/features/developer-api/examples.js';
import { developerKorean } from '../src/features/developer-api/locales/ko.js';
import { developerApiRoot as root } from '../src/features/developer-api/schemas.js';
import {
  createMigratedDatabase,
  insertRow,
  seedEditor,
  signIn,
  testCipherKey,
  testSecretKey,
  testSiteUrl,
} from './fixtures/migrated-database.js';

const run = promisify(execFile);

test('keeps every translated message’s interpolation placeholders intact', () => {
  const placeholders = (message: string) => message.match(/\{\w+\}/g)?.sort() ?? [];
  for (const [source, translated] of Object.entries(developerKorean)) {
    assert.ok(translated.trim(), source);
    assert.deepEqual(placeholders(translated), placeholders(source), source);
  }
});

function englishUi(t: TestContext) {
  const previous = process.env.ENABLE_ENGLISH_UI;
  process.env.ENABLE_ENGLISH_UI = 'TRUE';
  t.after(() => {
    if (previous === undefined) delete process.env.ENABLE_ENGLISH_UI;
    else process.env.ENABLE_ENGLISH_UI = previous;
  });
}

async function documentationApp() {
  const fixture = await createMigratedDatabase();
  seedEditor(fixture.db, 1, 'writer');
  insertRow(fixture.db, 'User', { id: 2, username: 'reader', isActive: 1 });
  insertRow(fixture.db, 'Profile', { userId: 2, role: 'READER' });
  function token(id: number, scopes: string[]) {
    const prefix = `docs${String(id).padStart(8, '0')}`;
    const value = `blex_pat_${prefix}_documentation-test-secret`;
    insertRow(fixture.db, 'DeveloperToken', {
      id,
      userId: 1,
      name: 'Documentation test',
      tokenPrefix: prefix,
      tokenHash: createHash('sha256').update(value).digest('hex'),
      scopes: JSON.stringify(scopes),
    });
    return value;
  }
  const fullToken = token(1, ['posts:read', 'posts:write']);
  const readToken = token(2, ['posts:read']);
  const editor = signIn(fixture.db, 1);
  const reader = signIn(fixture.db, 2);
  const app = await buildApp(
    fixture.path,
    testSiteUrl,
    { secretKey: testSecretKey, cipherKey: testCipherKey, developerRateLimit: { read: Infinity, write: Infinity } },
    fixture.mediaRoot,
  );
  return {
    ...fixture,
    app,
    editor,
    reader,
    fullToken,
    readToken,
    headers: { authorization: `Bearer ${fullToken}` },
    async close() {
      await app.close();
      await fixture.cleanup();
    },
  };
}

test('generates the developer contract from registered routes and keeps documentation access restricted', async () => {
  const fixture = await documentationApp();
  try {
    fixture.app.get(
      `${root}/documentation-probe`,
      {
        schema: { operationId: 'documentationProbe', response: { 200: Type.Object({ added: Type.Boolean() }) } },
      },
      () => ({ added: true }),
    );
    for (const url of [`${root}/openapi.json`, `${root}/docs`, '/docs/developer-api/quickstart']) {
      assert.equal((await fixture.app.inject(url)).statusCode, 302);
      assert.equal((await fixture.app.inject({ url, headers: fixture.reader })).headers.location, '/');
    }
    const response = await fixture.app.inject({ url: `${root}/openapi.json`, headers: fixture.editor });
    assert.equal(response.statusCode, 200, response.body);
    assert.equal(response.headers['cache-control'], 'private, no-store');
    const spec = response.json();
    assert.equal(spec.openapi, '3.1.0');
    assert.equal(spec.paths[`${root}/documentation-probe`].get.operationId, 'documentationProbe');
    assert.equal(spec.paths[`${root}/posts`].post.operationId, 'createPost');
    assert.equal(spec.paths[`${root}/posts/{post_id}/publish`].post.requestBody.required, false);
    assert.ok(spec.paths[`${root}/images`].post.requestBody.content['multipart/form-data']);
    assert.ok(
      Object.keys(spec.paths).every((path) => path.startsWith(`${root}/`) && !/\/docs$|\/openapi\.json$/.test(path)),
    );
    assert.equal(Object.values(spec.paths).flatMap((path) => Object.keys(path as object)).length, 12);
    assert.equal(spec.components.securitySchemes.DeveloperBearerAuth.scheme, 'bearer');
    assert.match(spec.info.description, /빠른 시작/);
  } finally {
    await fixture.close();
  }
});

for (const locale of ['ko', 'en'] as const)
  test(`runs the ${locale} quickstart commands and checks responses against generated OpenAPI`, async (t) => {
    englishUi(t);
    const fixture = await documentationApp();
    try {
      insertRow(fixture.db, 'UserPreference', { userId: 1, language: locale });
      const origin = await fixture.app.listen({ host: '127.0.0.1', port: 0 });
      const schema = (await fixture.app.inject({ url: `${root}/openapi.json`, headers: fixture.editor })).json();
      const validator = new Ajv({ strict: false, validateFormats: false });
      function checkResponse(path: string, method: string, status: number, body: unknown) {
        const responseSchema =
          schema.paths[path]?.[method.toLowerCase()]?.responses[status]?.content?.['application/json']?.schema;
        assert.ok(responseSchema, `${method} ${path}: ${status} is documented`);
        const validate = validator.compile({ ...responseSchema, components: schema.components });
        assert.ok(validate(body), `${method} ${path}: ${JSON.stringify(validate.errors)}`);
      }
      const quickstart = await fixture.app.inject({ url: '/docs/developer-api/quickstart', headers: fixture.editor });
      const commands: string[] = [];
      const parser = new Parser({
        onopentag(name, attrs) {
          if (name === 'button' && attrs['data-copy-link']?.startsWith('curl ')) commands.push(attrs['data-copy-link']);
        },
      });
      parser.end(quickstart.body);
      assert.equal(commands.length, Object.keys(apiExamples).length);
      assert.ok(quickstart.body.includes(testSiteUrl.origin));
      assert.doesNotMatch(quickstart.body, /__SITE_ORIGIN__/);
      await sharp({ create: { width: 2, height: 2, channels: 3, background: '#ffffff' } })
        .png()
        .toFile(join(dirname(fixture.path), 'cover.png'));
      let postId = '';
      for (const [index, [name, example]] of Object.entries(apiExamples).entries()) {
        const { stdout } = await run('sh', ['-c', `${commands[index]} --write-out '\n%{http_code}'`], {
          cwd: dirname(fixture.path),
          env: { ...process.env, BLEX_ORIGIN: origin, BLEX_TOKEN: fixture.fullToken, POST_ID: postId },
        });
        const split = stdout.lastIndexOf('\n');
        const status = Number(stdout.slice(split + 1));
        const body = JSON.parse(stdout.slice(0, split));
        assert.equal(status, name === 'create' || name === 'image' ? 201 : 200, stdout);
        checkResponse(example.path.replace('$POST_ID', '{post_id}'), example.method, status, body);
        if (name === 'me') assert.equal(body.data.user.username, 'writer');
        if (name === 'create') {
          postId = String(body.data.id);
          assert.equal(body.data.status, 'draft');
          assert.match(body.data.content_html, /<h2[^>]*>Hello BLEX<\/h2>/);
          assert.equal((await fixture.app.inject(body.data.public_url)).statusCode, 404);
        }
        if (name === 'publish') {
          assert.equal(body.data.status, 'published');
          assert.equal((await fixture.app.inject(body.data.public_url)).statusCode, 200);
        }
        if (name === 'update') assert.equal(body.data.title, apiExamples.update.body.title);
        if (name === 'image') assert.match(body.data.url, /^\/resources\/media\//);
      }
      for (const path of ['/posts', '/posts/search?q=API', `/posts/${postId}`, '/tags', '/series']) {
        const response = await fixture.app.inject({ url: `${root}${path}`, headers: fixture.headers });
        assert.equal(response.statusCode, 200, response.body);
        checkResponse(
          `${root}${path.startsWith(`/posts/${postId}`) ? '/posts/{post_id}' : path.split('?')[0]}`,
          'get',
          200,
          response.json(),
        );
      }
      for (const suffix of ['?dry_run=true', '']) {
        const response = await fixture.app.inject({
          method: 'DELETE',
          url: `${root}/posts/${postId}${suffix}`,
          headers: fixture.headers,
        });
        assert.equal(response.statusCode, 200, response.body);
        checkResponse(`${root}/posts/{post_id}`, 'delete', 200, response.json());
        assert.equal(response.json().data[suffix ? 'can_delete' : 'trashed'], true);
      }
      const missing = await fixture.app.inject({ url: `${root}/posts/${postId}`, headers: fixture.headers });
      assert.equal(missing.statusCode, 404);
      checkResponse(`${root}/posts/{post_id}`, 'get', 404, missing.json());
    } finally {
      await fixture.close();
    }
  });

test('uses one locale for documentation, OpenAPI, and API errors without translating API values', async (t) => {
  englishUi(t);
  const fixture = await documentationApp();
  try {
    insertRow(fixture.db, 'UserPreference', { userId: 1, language: 'en' });
    const canonical = structuredClone(await fixture.app.ready().then(() => fixture.app.swagger()));
    const specs: Record<string, unknown> = {};
    for (const locale of ['en', 'ko', 'en'] as const) {
      fixture.db.prepare('UPDATE UserPreference SET language = ? WHERE userId = 1').run(locale);
      for (const path of ['/docs/developer-api/quickstart', `${root}/docs`, `${root}/openapi.json`]) {
        const response = await fixture.app.inject({
          url: path,
          headers: { ...fixture.editor, 'accept-language': locale === 'en' ? 'ko' : 'en' },
        });
        assert.equal(response.statusCode, 200, response.body);
        assert.equal(response.headers['content-language'], locale);
        assert.equal(response.headers['cache-control'], 'private, no-store');
        assert.match(String(response.headers.vary), /Accept-Language/);
        if (path.endsWith('.json')) {
          const spec = response.json();
          if (specs[locale]) assert.deepEqual(spec, specs[locale], 'locales do not contaminate the cached source');
          specs[locale] = spec;
          assert.equal(spec.info.title, locale === 'en' ? 'BLEX Developer API' : 'BLEX 개발자 API');
          const create = spec.paths[`${root}/posts`].post;
          assert.equal(create.summary, locale === 'en' ? 'Create a post' : '포스트 만들기');
          assert.equal(create.operationId, 'createPost');
          assert.deepEqual(create.requestBody.content['application/json'].schema.example, apiExamples.create.body);
          assert.doesNotMatch(JSON.stringify(spec), /x-message-values|\{page\}|\{limit\}|\{max\}/);
        } else {
          assert.match(response.body, new RegExp(`<html lang="${locale}"`));
          if (path.includes('quickstart')) {
            assert.match(response.body, locale === 'en' ? /Developer API quickstart/ : /개발자 API 빠른 시작/);
            assert.ok(response.body.includes(`Accept-Language: ${locale}`));
            assert.match(response.body, locale === 'en' ? /aria-label="Account menu"/ : /aria-label="계정 메뉴"/);
            assert.match(
              response.body,
              locale === 'en'
                ? /data-copy-error-message="Could not copy\."/
                : /data-copy-error-message="복사에 실패했습니다\."/,
            );
          }
        }
      }
      const missing = await fixture.app.inject({ url: `${root}/posts/9999`, headers: fixture.headers });
      assert.equal(missing.statusCode, 404);
      assert.equal(missing.headers['content-language'], locale);
      assert.deepEqual(missing.json().error, {
        code: 'post.not_found',
        message: locale === 'en' ? 'Post not found.' : '포스트를 찾을 수 없습니다.',
        fields: null,
      });
      const invalid = await fixture.app.inject({
        method: 'POST',
        url: `${root}/posts`,
        headers: fixture.headers,
        payload: { title: 123 },
      });
      assert.equal(invalid.statusCode, 422, invalid.body);
      assert.equal(invalid.headers['content-language'], locale);
      assert.equal(invalid.json().error.code, 'request.invalid_payload');
      assert.deepEqual(invalid.json().error.fields.errors[0].loc, ['body', 'payload', 'title']);
      assert.match(invalid.json().error.message, locale === 'en' ? /request payload/ : /보낸 데이터/);
      const malformed = await fixture.app.inject({
        method: 'POST',
        url: `${root}/posts`,
        headers: { ...fixture.headers, 'content-type': 'application/json' },
        payload: '{',
      });
      assert.equal(malformed.statusCode, 400);
      assert.equal(malformed.headers['content-language'], locale, 'parser errors use the token owner’s language too');
      assert.equal(malformed.json().error.message, invalid.json().error.message);
      const denied = await fixture.app.inject({
        method: 'POST',
        url: `${root}/posts`,
        headers: { authorization: `Bearer ${fixture.readToken}` },
        payload: {},
      });
      assert.equal(denied.statusCode, 403);
      assert.equal(
        denied.json().error.message,
        locale === 'en' ? 'posts:write scope is required.' : 'posts:write 권한이 필요합니다.',
      );
    }
    function machineContract(value: unknown): unknown {
      if (Array.isArray(value)) return value.map(machineContract);
      if (value === null || typeof value !== 'object') return value;
      const presentation = 'operationId' in value || 'openapi' in value;
      return Object.fromEntries(
        Object.entries(value)
          .filter(
            ([key, entry]) =>
              !(presentation && key === 'tags') &&
              !(['title', 'description', 'summary'].includes(key) && typeof entry === 'string'),
          )
          .map(([key, entry]) => [key, machineContract(entry)]),
      );
    }
    assert.deepEqual(machineContract(specs.en), machineContract(specs.ko));
    assert.deepEqual(fixture.app.swagger(), canonical);
    const created = await fixture.app.inject({
      method: 'POST',
      url: `${root}/posts`,
      headers: fixture.headers,
      payload: {
        title: '포스트 만들기 / Create a post',
        markdown: '# 원문 유지\n\nMy own text.',
        tags: ['개발', 'api'],
      },
    });
    assert.equal(created.statusCode, 201, created.body);
    assert.equal(created.json().data.title, '포스트 만들기 / Create a post');
    assert.match(created.json().data.content_html, /원문 유지/);
    assert.deepEqual(created.json().data.tags, ['api', '개발']);
    assert.equal(created.json().data.status, 'draft');
  } finally {
    await fixture.close();
  }
});

test('follows the shared saved-language and site-default policy instead of browser headers', async (t) => {
  englishUi(t);
  const previousDefault = process.env.BLEX_DEFAULT_LANGUAGE;
  const previousDebug = process.env.DEBUG;
  t.after(() => {
    if (previousDefault === undefined) delete process.env.BLEX_DEFAULT_LANGUAGE;
    else process.env.BLEX_DEFAULT_LANGUAGE = previousDefault;
    if (previousDebug === undefined) delete process.env.DEBUG;
    else process.env.DEBUG = previousDebug;
  });
  process.env.DEBUG = 'FALSE';
  const fixture = await documentationApp();
  try {
    insertRow(fixture.db, 'UserPreference', { userId: 1, language: 'en' });
    for (const [enabled, site, saved, expected] of [
      ['TRUE', 'ko', 'en', 'en'],
      ['TRUE', 'en', 'ko', 'ko'],
      ['TRUE', 'en', '', 'en'],
      ['TRUE', 'ko', null, 'ko'],
      ['FALSE', 'en', 'en', 'ko'],
      ['TRUE', 'fr', '', 'ko'],
    ] as const) {
      process.env.ENABLE_ENGLISH_UI = enabled;
      process.env.BLEX_DEFAULT_LANGUAGE = site;
      fixture.db.prepare('UPDATE UserPreference SET language = ? WHERE userId = 1').run(saved);
      const response = await fixture.app.inject({
        url: `${root}/openapi.json`,
        headers: {
          ...fixture.editor,
          'accept-language': expected === 'en' ? 'ko' : 'en',
          cookie: `${fixture.editor.cookie}; django_language=${expected === 'en' ? 'ko' : 'en'}`,
        },
      });
      assert.equal(response.statusCode, 200, response.body);
      assert.equal(response.headers['content-language'], expected);
    }
  } finally {
    await fixture.close();
  }
});

test('validates requests with the documented schemas while preserving token checks and legacy input forms', async () => {
  const fixture = await documentationApp();
  try {
    const invalidBodies = [
      null,
      [],
      { title: 123 },
      { tags: ['valid', 1] },
      { status: 'unknown' },
      { content_type: 'text' },
      { cover_layout: 'wide' },
      { series_id: 'nope' },
      { is_hidden: 'perhaps' },
    ];
    for (const payload of invalidBodies) {
      const response = await fixture.app.inject({
        method: 'POST',
        url: `${root}/posts`,
        headers: { ...fixture.headers, 'content-type': 'application/json' },
        payload: JSON.stringify(payload),
      });
      assert.equal(response.statusCode, 422, response.body);
      assert.equal(response.json().error.code, 'request.invalid_payload');
      assert.ok(response.json().error.fields.errors.length);
    }
    for (const [headers, expected] of [
      [{}, 401],
      [{ authorization: `Bearer ${fixture.readToken}` }, 403],
    ] as const) {
      const response = await fixture.app.inject({
        method: 'POST',
        url: `${root}/posts`,
        headers,
        payload: { title: 123 },
      });
      assert.equal(response.statusCode, expected, response.body);
    }
    const malformed = await fixture.app.inject({
      method: 'POST',
      url: `${root}/posts`,
      headers: { ...fixture.headers, 'content-type': 'application/json' },
      payload: '{',
    });
    assert.equal(malformed.statusCode, 400, malformed.body);
    assert.equal(malformed.json().error.code, 'request.invalid_payload');
    const compatible = await fixture.app.inject({
      method: 'POST',
      url: `${root}/posts`,
      headers: fixture.headers,
      payload: {
        title: 'Compatibility',
        text_md: '# Legacy',
        content_type: 'markdown',
        tags: 'one,two',
        is_hide: 'YES',
        is_advertise: 0,
        subtitle: null,
        extra: 'ignored',
      },
    });
    assert.equal(compatible.statusCode, 201, compatible.body);
    const post = compatible.json().data;
    assert.deepEqual(post.tags, ['one', 'two']);
    assert.equal(post.is_hidden, true);
    assert.equal(post.is_advertise, false);
    assert.match(post.content_html, /<h2[^>]*>Legacy<\/h2>/);
    for (const [method, suffix] of [
      ['PATCH', ''],
      ['POST', '/publish'],
    ] as const) {
      const response = await fixture.app.inject({
        method,
        url: `${root}/posts/${post.id}${suffix}`,
        headers: fixture.headers,
        payload: { title: 123 },
      });
      assert.equal(response.statusCode, 422, response.body);
    }
    const published = await fixture.app.inject({
      method: 'POST',
      url: `${root}/posts/${post.id}/publish`,
      headers: fixture.headers,
    });
    assert.equal(published.statusCode, 200, published.body);
    for (const [query, status, code] of [
      ['status=unknown', 400, 'post.invalid_status'],
      ['page=nope', 422, 'request.invalid_payload'],
      ['series_id=nope', 400, 'request.invalid_series_id'],
    ] as const) {
      const response = await fixture.app.inject({ url: `${root}/posts/search?${query}`, headers: fixture.headers });
      assert.equal(response.statusCode, status, response.body);
      assert.equal(response.json().error.code, code);
    }
  } finally {
    await fixture.close();
  }
});
