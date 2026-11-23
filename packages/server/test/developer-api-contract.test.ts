import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { PrismaClient } from '@prisma/client';
import { buildApp } from '../src/app.js';
import { createDeveloperRateLimiter } from '../src/features/developer-api/services/rate-limit.js';
import { camelToSnake, keysFromWire, keysToWire, snakeToCamel } from '../src/features/developer-api/wire-format.js';
import {
  type ContractExchange,
  type ContractRecording,
  type ContractTokenStore,
  recordDeveloperApiContract,
} from './fixtures/developer-api-contract.js';
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

interface Schema {
  $ref?: string;
  properties?: Record<string, Schema>;
  required?: string[];
  items?: Schema;
  anyOf?: Schema[];
  allOf?: Schema[];
  oneOf?: Schema[];
  additionalProperties?: boolean | Schema;
}

interface Operation {
  parameters?: Array<{ name: string; in: string }>;
  responses: Record<string, { content?: Record<string, { schema: Schema }> }>;
}

const schemaFixture = await createMigratedDatabase();
const schemaApp = await buildApp(
  schemaFixture.path,
  testSiteUrl,
  { secretKey: testSecretKey, cipherKey: testCipherKey },
  schemaFixture.mediaRoot,
);
await schemaApp.ready();
const spec = schemaApp.swagger() as unknown as {
  paths: Record<string, Record<string, Operation>>;
  components: { schemas: Record<string, Schema> };
};
await schemaApp.close();
await schemaFixture.cleanup();
// Captured from the commit before the API moved to camelCase internals. Regenerating it would defeat its purpose.
const golden = JSON.parse(
  readFileSync(new URL('../../test/fixtures/developer-api-contract.golden.json', import.meta.url), 'utf8'),
) as ContractRecording;

const store: ContractTokenStore = {
  insert(db, token) {
    insertRow(db, 'DeveloperToken', {
      id: token.id,
      name: token.name,
      tokenPrefix: token.prefix,
      tokenHash: token.hash,
      scopes: JSON.stringify(token.scopes),
      expiresAt: token.expiresAt,
      revokedAt: token.revokedAt,
      userId: token.userId,
    });
  },
  requests(db) {
    return db
      .prepare(
        'SELECT id, method, path, statusCode, ipAddress, userAgent, tokenId, userId FROM DeveloperRequestLog ORDER BY id',
      )
      .all()
      .map((row) => ({ ...row }));
  },
  usage(db) {
    return db
      .prepare(
        `SELECT id, lastUsedAt IS NOT NULL AS used, lastUsedIp, updatedAt = lastUsedAt AS updatedWithUse FROM DeveloperToken ORDER BY id`,
      )
      .all()
      .map((row) => ({ ...row }));
  },
};

const recording = await recordDeveloperApiContract(store);

function documentedNames() {
  const names = new Set<string>();
  const walk = (node: unknown): void => {
    if (Array.isArray(node)) {
      for (const item of node) walk(item);
      return;
    }
    if (!node || typeof node !== 'object') return;
    for (const [key, value] of Object.entries(node)) {
      if (key === 'properties' && value && typeof value === 'object') {
        for (const name of Object.keys(value)) names.add(name);
      }
      if (key === 'required' && Array.isArray(value)) {
        for (const name of value) if (typeof name === 'string') names.add(name);
      }
      if (key === 'parameters' && Array.isArray(value)) {
        for (const parameter of value) names.add(parameter.name);
      }
      walk(value);
    }
  };
  walk(spec);
  for (const path of Object.keys(spec.paths)) {
    for (const [, name] of path.matchAll(/\{(\w+)\}/g)) names.add(name);
  }
  return names;
}

function resolve(schema: Schema): Schema {
  if (!schema.$ref) return schema;
  const name = schema.$ref.split('/').at(-1) as string;
  return resolve(spec.components.schemas[name]);
}

/** Lists keys the schema does not name and required keys the value lacks. */
function schemaProblems(value: unknown, reference: Schema, path: string): string[] {
  const schema = resolve(reference);
  const alternatives = schema.anyOf ?? schema.oneOf;
  if (alternatives) {
    const results = alternatives.map((option) => schemaProblems(value, option, path));
    return results.find((problems) => problems.length === 0) ?? results[0];
  }
  if (schema.allOf) return schema.allOf.flatMap((part) => schemaProblems(value, part, path));
  if (Array.isArray(value))
    return schema.items
      ? value.flatMap((item, index) => schemaProblems(item, schema.items as Schema, `${path}[${index}]`))
      : [];
  if (value === null || typeof value !== 'object' || !schema.properties) return [];
  const entries = Object.entries(value);
  const problems = (schema.required ?? [])
    .filter((name) => !(name in value))
    .map((name) => `${path}.${name} is required`);
  for (const [key, item] of entries) {
    const property = schema.properties[key];
    if (property) problems.push(...schemaProblems(item, property, `${path}.${key}`));
    else if (!schema.additionalProperties) problems.push(`${path}.${key} is undocumented`);
  }
  return problems;
}

/** A literal path such as /posts/search wins over /posts/{post_id}, as it does in the router. */
function documentedPath(exchange: ContractExchange) {
  const path = exchange.url.split('?')[0];
  const candidates = Object.keys(spec.paths).filter((template) =>
    new RegExp(`^${template.replace(/\{\w+\}/g, '[^/]+')}$`).test(path),
  );
  return candidates.find((candidate) => !candidate.includes('{')) ?? candidates[0];
}

test('every documented property and parameter name round-trips through camelCase', () => {
  const names = documentedNames();
  assert.ok(names.size >= 50, `only found ${names.size} names`);
  for (const name of [
    'post_id',
    'dry_run',
    'series_id',
    'expected_updated_at',
    'cover_image_position',
    'is_hide',
    'text_md',
  ]) {
    assert.ok(names.has(name), name);
  }
  const camelNames = new Set<string>();
  for (const name of names) {
    const camel = snakeToCamel(name);
    assert.doesNotMatch(camel, /_/, name);
    assert.equal(camelToSnake(camel), name);
    assert.equal(Object.keys(keysFromWire({ [name]: 1 }) as object)[0], camel, name);
    assert.equal(Object.keys(keysToWire({ [camel]: 1 }) as object)[0], name, name);
    assert.equal(camelNames.has(camel), false, `${name} collides`);
    camelNames.add(camel);
  }
});

test('converts keys through nested arrays and objects without touching values', () => {
  const incoming = {
    series_id: 1,
    tags: ['snake_tag', { inner_key: 'value_kept' }],
    nested_value: { deep_key: [{ deeper_key: 'some_value' }] },
  };
  assert.equal(
    JSON.stringify(keysFromWire(incoming)),
    JSON.stringify({
      seriesId: 1,
      tags: ['snake_tag', { innerKey: 'value_kept' }],
      nestedValue: { deepKey: [{ deeperKey: 'some_value' }] },
    }),
  );
  const outgoing = {
    contentHtml: '<p data-someKey="x">camelCase some_key</p>',
    when: new Date(0),
    list: [{ postCount: 1 }],
    empty: null,
  };
  assert.equal(
    JSON.stringify(keysToWire(outgoing)),
    JSON.stringify({
      content_html: '<p data-someKey="x">camelCase some_key</p>',
      when: new Date(0),
      list: [{ post_count: 1 }],
      empty: null,
    }),
  );
  for (const value of ['plain_text', 7, true, null, undefined]) {
    assert.equal(keysFromWire(value), value);
    assert.equal(keysToWire(value), value);
  }
  const buffer = Buffer.from('snake_case');
  assert.equal(keysToWire(buffer), buffer);
});

test('ignores request keys the API never documented instead of aliasing them', () => {
  const converted = keysFromWire({
    isHidden: true,
    dryRun: 'true',
    SERIES_ID: 1,
    is__hidden: true,
    _series_id: 1,
    cover_layout_: 'split',
    title: 'kept',
  });
  assert.equal(JSON.stringify(converted), '{"title":"kept"}');
  const polluted = keysFromWire(JSON.parse('{"__proto__":{"isAdmin":true},"constructor":{"prototype":1}}')) as Record<
    string,
    unknown
  >;
  assert.equal(polluted.isAdmin, undefined);
  assert.equal(({} as Record<string, unknown>).isAdmin, undefined);
});

test('survives request bodies nested deeper than the call stack', () => {
  let nested: unknown = 1;
  for (let depth = 0; depth < 200_000; depth += 1) nested = { some_key: nested };
  let converted = keysFromWire(nested);
  for (let depth = 0; depth < 200_000; depth += 1) converted = (converted as { someKey: unknown }).someKey;
  assert.equal(converted, 1);
});

test('error fields keep the names callers sent, even ones camelCase cannot reproduce', () => {
  const fields = {
    expected_updated_at: 'a',
    post_id: 1,
    cover_image_2x: true,
    Odd_Key: 'kept',
    errors: [{ loc: ['body', 'payload', 'series_id'], msg: 'some_message' }],
  };
  const wire = keysToWire({ error: { code: 'request.invalid_payload', message: 'm', fields } }) as {
    error: { fields: unknown };
  };
  assert.equal(JSON.stringify(wire.error.fields), JSON.stringify(fields));
});

// The captured fixture remains unchanged. Only display text and newly documented language metadata differ.
function machineExchange(exchange: ContractExchange) {
  const copy = structuredClone(exchange);
  for (const header of ['content-language', 'vary', 'cache-control']) delete copy.headers[header];
  if (copy.body === '<omitted>' || !copy.body) return copy;
  const body = JSON.parse(copy.body);
  if (body.error && typeof body.error === 'object') {
    delete body.error.message;
    for (const issue of body.error.fields?.errors ?? []) delete issue.msg;
  }
  return { ...copy, body };
}

test('preserves recorded statuses, response data, and machine-readable errors', () => {
  const frameworkCodes: Record<string, string> = {
    'create malformed json': 'request.invalid_payload',
    'create prototype key': 'request.invalid_payload',
    'create form body': 'request.unsupported_media_type',
    'create too large': 'request.too_large',
  };
  assert.equal(recording.exchanges.length, golden.exchanges.length);
  recording.exchanges.forEach((exchange, index) => {
    const expected = machineExchange(golden.exchanges[index]);
    const code = frameworkCodes[exchange.name];
    if (code) expected.body = { error: { code, fields: null } };
    if (exchange.headers['content-language']) {
      assert.equal(exchange.headers['content-language'], 'ko');
      assert.equal(exchange.headers['cache-control'], 'private, no-store');
      assert.match(exchange.headers.vary, /Cookie/);
    }
    assert.deepEqual(machineExchange(exchange), expected, exchange.name);
  });
});

test('audits the same requests and token usage as the previous commit', () => {
  assert.deepEqual(recording.requests, golden.requests);
  assert.deepEqual(recording.usage, golden.usage);
});

test('real responses use exactly the documented key names', () => {
  const covered = new Set<string>();
  for (const exchange of recording.exchanges) {
    if (exchange.framework || exchange.method === 'HEAD') continue;
    const path = documentedPath(exchange);
    const operation = path ? spec.paths[path]?.[exchange.method.toLowerCase()] : undefined;
    assert.ok(operation, `${exchange.name} has no documented operation`);
    const schema = operation.responses[String(exchange.status)]?.content?.['application/json']?.schema;
    assert.ok(schema, `${exchange.name} returned undocumented status ${exchange.status}`);
    assert.deepEqual(schemaProblems(JSON.parse(exchange.body), schema, exchange.name), []);
    covered.add(`${exchange.method} ${path}`);
  }
  for (const [path, operations] of Object.entries(spec.paths)) {
    for (const method of Object.keys(operations))
      assert.ok(covered.has(`${method.toUpperCase()} ${path}`), `${method} ${path} was not exercised`);
  }
});

test('a dry run under either name never deletes, and an unreadable flag is refused', async () => {
  const fixture = await createMigratedDatabase();
  const app = await buildApp(
    fixture.path,
    testSiteUrl,
    { secretKey: testSecretKey, cipherKey: testCipherKey },
    fixture.mediaRoot,
  );
  const prisma = new PrismaClient({ datasourceUrl: `file:${fixture.path}` });
  try {
    seedEditor(fixture.db, 1, 'writer');
    seedPost(fixture.db, 1, 1, 'kept-post');
    const raw = 'blex_pat_dryruntoken1_contract-secret';
    insertRow(fixture.db, 'DeveloperToken', {
      id: 1,
      userId: 1,
      name: 'Writer',
      tokenPrefix: 'dryruntoken1',
      tokenHash: createHash('sha256').update(raw, 'utf8').digest('hex'),
      scopes: '["posts:read","posts:write"]',
    });
    const remove = (query: string) =>
      app.inject({
        method: 'DELETE',
        url: `/api/developer/v1/posts/1?${query}`,
        headers: { authorization: `Bearer ${raw}` },
      });

    for (const query of [
      'dry_run=true',
      'dryRun=true',
      'dryRun=YES',
      'dryRun=1',
      'dry_run=false&dryRun=true',
      'dryRun=false&dry_run=true',
      'dry_run=true&dry_run=false',
      'dryRun=true&dryRun=false',
    ]) {
      const response = await remove(query);
      assert.equal(response.statusCode, 200, query);
      assert.equal(response.json().data.can_delete, true, query);
    }
    for (const [query, field] of [
      ['dry_run=maybe', 'dry_run'],
      ['dryRun=maybe', 'dryRun'],
      ['dry_run=', 'dry_run'],
      ['dryRun=', 'dryRun'],
      ['dry_run=false&dryRun=maybe', 'dryRun'],
      ['dry_run=maybe&dry_run=false', 'dry_run'],
    ]) {
      const response = await remove(query);
      assert.equal(response.statusCode, 422, query);
      assert.equal(response.json().error.code, 'request.invalid_payload', query);
      assert.deepEqual(response.json().error.fields.errors[0].loc, ['query', field], query);
    }
    assert.equal((await prisma.post.findUniqueOrThrow({ where: { id: 1 } })).deletedAt, null);

    assert.equal((await remove('dryRun=false')).json().data.deleted, true);
    assert.ok((await prisma.post.findUniqueOrThrow({ where: { id: 1 } })).deletedAt);
  } finally {
    await prisma.$disconnect();
    await app.close();
    await fixture.cleanup();
  }
});

test('limits each token per minute, reads and writes apart, with a documented 429', async () => {
  const fixture = await createMigratedDatabase();
  let clock = 0;
  const app = await buildApp(
    fixture.path,
    testSiteUrl,
    {
      secretKey: testSecretKey,
      cipherKey: testCipherKey,
      developerRateLimit: { read: 3, write: 2, now: () => clock },
    },
    fixture.mediaRoot,
  );
  const prisma = new PrismaClient({ datasourceUrl: `file:${fixture.path}` });
  try {
    seedEditor(fixture.db, 1, 'writer');
    seedPost(fixture.db, 1, 1, 'kept-post');
    const token = (id: number) => {
      const raw = `blex_pat_ratelimit000${id}_contract-secret`;
      insertRow(fixture.db, 'DeveloperToken', {
        id,
        userId: 1,
        name: `Token ${id}`,
        tokenPrefix: `ratelimit000${id}`,
        tokenHash: createHash('sha256').update(raw, 'utf8').digest('hex'),
        scopes: '["posts:read","posts:write"]',
      });
      return { authorization: `Bearer ${raw}` };
    };
    const [first, second] = [token(1), token(2)];
    const read = (headers: { authorization: string }) => app.inject({ url: '/api/developer/v1/me', headers });
    const write = (headers: { authorization: string }) =>
      app.inject({ method: 'DELETE', url: '/api/developer/v1/posts/1?dry_run=true', headers });

    for (let count = 0; count < 3; count += 1) assert.equal((await read(first)).statusCode, 200);
    clock = 15_500;
    const limited = await read(first);
    assert.equal(limited.statusCode, 429);
    assert.equal(limited.headers['retry-after'], '45');
    assert.deepEqual(limited.json(), {
      error: {
        code: 'request.rate_limited',
        message: '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.',
        fields: { retry_after: 45 },
      },
    });
    const documented = spec.paths['/api/developer/v1/me'].get.responses['429'].content?.['application/json'].schema;
    assert.deepEqual(schemaProblems(limited.json(), documented as Schema, 'limited'), []);

    // Reads and writes count apart, and one token's traffic never spends another's allowance.
    for (let count = 0; count < 2; count += 1) assert.equal((await write(first)).statusCode, 200);
    assert.equal((await write(first)).statusCode, 429);
    assert.equal((await read(second)).statusCode, 200);
    const logged = await prisma.developerRequestLog.count({ where: { statusCode: 429 } });
    assert.equal(logged, 0);

    // Each window opened with its own first request: reads at 0s, writes at 15.5s.
    clock = 60_000;
    assert.equal((await read(first)).statusCode, 200);
    assert.equal((await write(first)).statusCode, 429);
    clock = 75_500;
    assert.equal((await write(first)).statusCode, 200);
  } finally {
    await prisma.$disconnect();
    await app.close();
    await fixture.cleanup();
  }
});

test('the rate limiter keeps a bounded number of windows', () => {
  let clock = 0;
  const take = createDeveloperRateLimiter({ read: 1, windowMs: 1_000, maxTrackedWindows: 2, now: () => clock });
  assert.equal(take(1, 'read'), null);
  assert.equal(take(1, 'read'), 1);
  assert.equal(take(2, 'read'), null);
  // A third token evicts the oldest window instead of growing past the bound.
  assert.equal(take(3, 'read'), null);
  assert.equal(take(1, 'read'), null);
  clock = 1_000;
  assert.equal(take(3, 'read'), null);
});

test('never returns a token secret or hash from token management', async () => {
  const fixture = await createMigratedDatabase();
  const app = await buildApp(
    fixture.path,
    testSiteUrl,
    { secretKey: testSecretKey, cipherKey: testCipherKey },
    fixture.mediaRoot,
  );
  const prisma = new PrismaClient({ datasourceUrl: `file:${fixture.path}` });
  try {
    seedEditor(fixture.db, 1, 'writer');
    const session = signIn(fixture.db, 1);
    insertRow(fixture.db, 'DeveloperToken', {
      id: 1,
      userId: 1,
      name: 'Stored',
      tokenPrefix: 'storedprefix',
      tokenHash: 'stored-secret-hash',
      scopes: '["posts:read"]',
      lastUsedAt: Date.UTC(2025, 0, 2),
      lastUsedIp: '203.0.113.5',
    });
    const expected = ['id', 'name', 'tokenPrefix', 'scopes', 'expiresAt', 'revokedAt', 'lastUsedAt', 'createdAt'];

    const listed = await app.inject({ url: '/v1/developer-tokens', headers: session });
    assert.equal(listed.statusCode, 200, listed.body);
    const [token] = listed.json<{ body: { tokens: Array<Record<string, unknown>> } }>().body.tokens;
    assert.deepEqual(Object.keys(token), expected);
    assert.equal(token.lastUsedAt, '2025-01-02T00:00:00+00:00');
    assert.equal(listed.body.includes('stored-secret-hash'), false);
    assert.equal(listed.body.includes('203.0.113.5'), false);

    const revoked = await app.inject({ method: 'DELETE', url: '/v1/developer-tokens/1', headers: session });
    assert.deepEqual(Object.keys(revoked.json<{ body: object }>().body), expected);
    assert.equal(revoked.body.includes('stored-secret-hash'), false);
    const stored = await prisma.developerToken.findUniqueOrThrow({ where: { id: 1 } });
    assert.ok(stored.revokedAt);
    assert.equal(stored.updatedAt.getTime(), stored.revokedAt.getTime());
    assert.equal(
      (await app.inject({ method: 'DELETE', url: '/v1/developer-tokens/99', headers: session })).statusCode,
      404,
    );
  } finally {
    await prisma.$disconnect();
    await app.close();
    await fixture.cleanup();
  }
});

test('revoking a token keeps the first timestamp, even under concurrency', async () => {
  const fixture = await createMigratedDatabase();
  const app = await buildApp(
    fixture.path,
    testSiteUrl,
    { secretKey: testSecretKey, cipherKey: testCipherKey },
    fixture.mediaRoot,
  );
  const prisma = new PrismaClient({ datasourceUrl: `file:${fixture.path}` });
  try {
    seedEditor(fixture.db, 1, 'writer');
    seedEditor(fixture.db, 2, 'other');
    const session = signIn(fixture.db, 1);
    const firstRevocation = Date.UTC(2025, 0, 2, 3, 4, 5);
    insertRow(fixture.db, 'DeveloperToken', {
      id: 1,
      userId: 1,
      name: 'Revoked',
      tokenPrefix: 'revokedonce1',
      tokenHash: 'hash-1',
      scopes: '[]',
      revokedAt: firstRevocation,
      updatedAt: firstRevocation,
    });
    insertRow(fixture.db, 'DeveloperToken', {
      id: 2,
      userId: 1,
      name: 'Active',
      tokenPrefix: 'activetoken1',
      tokenHash: 'hash-2',
      scopes: '[]',
    });
    insertRow(fixture.db, 'DeveloperToken', {
      id: 3,
      userId: 2,
      name: 'Other',
      tokenPrefix: 'othertoken01',
      tokenHash: 'hash-3',
      scopes: '[]',
    });
    const revoke = (id: number) =>
      app.inject({ method: 'DELETE', url: `/v1/developer-tokens/${id}`, headers: session });

    const repeated = await revoke(1);
    assert.equal(repeated.json().status, 'DONE');
    assert.equal(repeated.json().body.revokedAt, '2025-01-02T03:04:05+00:00');
    const unchanged = await prisma.developerToken.findUniqueOrThrow({ where: { id: 1 } });
    assert.equal(unchanged.revokedAt?.getTime(), firstRevocation);
    assert.equal(unchanged.updatedAt.getTime(), firstRevocation);

    const concurrent = await Promise.all(Array.from({ length: 5 }, () => revoke(2)));
    const stored = await prisma.developerToken.findUniqueOrThrow({ where: { id: 2 } });
    assert.ok(stored.revokedAt);
    for (const response of concurrent) {
      assert.equal(response.json().status, 'DONE');
      assert.equal(Date.parse(response.json().body.revokedAt), stored.revokedAt.getTime());
    }
    assert.equal((await revoke(3)).statusCode, 404);
    assert.equal((await prisma.developerToken.findUniqueOrThrow({ where: { id: 3 } })).revokedAt, null);
  } finally {
    await prisma.$disconnect();
    await app.close();
    await fixture.cleanup();
  }
});

test('deleting an account removes its tokens and logs and detaches logs written by others', async () => {
  const fixture = await createMigratedDatabase();
  const prisma = new PrismaClient({ datasourceUrl: `file:${fixture.path}` });
  try {
    seedEditor(fixture.db, 1, 'leaving');
    seedEditor(fixture.db, 2, 'staying');
    insertRow(fixture.db, 'DeveloperToken', {
      id: 1,
      userId: 1,
      name: 'Leaving',
      tokenPrefix: 'leaving00001',
      tokenHash: 'hash-1',
      scopes: '[]',
    });
    insertRow(fixture.db, 'DeveloperToken', {
      id: 2,
      userId: 2,
      name: 'Staying',
      tokenPrefix: 'staying00001',
      tokenHash: 'hash-2',
      scopes: '[]',
    });
    const log = (id: number, userId: number, tokenId: number) =>
      insertRow(fixture.db, 'DeveloperRequestLog', {
        id,
        userId,
        tokenId,
        method: 'GET',
        path: '/me',
        statusCode: 200,
      });
    log(1, 1, 1);
    log(2, 2, 1);
    log(3, 2, 2);

    const { deleteAccountRows } = await import('../src/features/auth/services/deletions.js');
    await prisma.$transaction((tx) => deleteAccountRows(tx, 1));

    assert.deepEqual(
      (await prisma.developerToken.findMany({ select: { id: true } })).map(({ id }) => id),
      [2],
    );
    assert.deepEqual(
      await prisma.developerRequestLog.findMany({ orderBy: { id: 'asc' }, select: { id: true, tokenId: true } }),
      [
        { id: 2, tokenId: null },
        { id: 3, tokenId: 2 },
      ],
    );
  } finally {
    await prisma.$disconnect();
    await fixture.cleanup();
  }
});
