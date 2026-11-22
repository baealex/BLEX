import { createHash } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import sharp from 'sharp';
import { buildApp } from '../../src/app.js';
import { createMigratedDatabase, insertRow, seedPost, testCipherKey, testSecretKey, testSiteUrl, prismaDate } from './migrated-database.js';

export interface ContractToken {
  id: number;
  name: string;
  prefix: string;
  hash: string;
  scopes: string[];
  expiresAt: number | null;
  revokedAt: number | null;
  userId: number;
}

/** The scenario is replayed against whichever tables hold tokens, so its recording stays comparable. */
export interface ContractTokenStore {
  insert(db: DatabaseSync, token: ContractToken): void;
  requests(db: DatabaseSync): unknown[];
  usage(db: DatabaseSync): unknown[];
}

export interface ContractExchange {
  name: string;
  method: string;
  url: string;
  /** Set when Fastify, rather than the documented API, wrote the response. */
  framework?: boolean;
  status: number;
  headers: Record<string, string>;
  body: string;
}

export interface ContractRecording {
  exchanges: ContractExchange[];
  requests: unknown[];
  usage: unknown[];
}

interface Step {
  token?: string;
  json?: unknown;
  raw?: string | Buffer;
  headers?: Record<string, string>;
  framework?: boolean;
  omitBody?: boolean;
}

const API = '/api/developer/v1';
const volatileHeaders = new Set(['date', 'connection', 'content-length', 'keep-alive']);
const isoInstant = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{6})?\+00:00/g;
const uploadedFile = /images\/content\/\d+\/\d+\/\d+\/\d+_[0-9a-f]{30}\.[a-z0-9]+/g;
const generatedSlug = /untitled-[0-9a-f]{8}/g;
const oneDay = 86_400_000;

/** Only instants, upload names, and collision suffixes vary between runs. Seeded dates stay byte-exact. */
function normalize(body: string, now: number) {
  return body
    .replace(isoInstant, (instant) => (Math.abs(Date.parse(instant) - now) < oneDay ? '<now>' : instant))
    .replace(uploadedFile, '<uploaded-file>')
    .replace(generatedSlug, 'untitled-<suffix>');
}

function rawToken(prefix: string) {
  return `blex_pat_${prefix}_contract-secret`;
}

function seed(db: DatabaseSync, store: ContractTokenStore) {
  const users: Array<[number, string, string, number, string]> = [
    [1, 'writer', 'Writer', 1, 'EDITOR'], [2, 'other', 'Other', 1, 'EDITOR'],
    [3, 'reader', 'Reader', 1, 'READER'], [4, 'inactive', 'Inactive', 0, 'EDITOR'],
  ];
  for (const [id, username, firstName, isActive, role] of users) {
    insertRow(db, 'User', { id, username, name: firstName, email: `${username}@example.test`, passwordHash: `pbkdf2_sha256$fixture$${username}`, isActive: isActive });
    insertRow(db, 'Profile', { userId: id, role });
  }

  const past = Date.UTC(2025, 0, 1);
  const tokens: Array<[number, string, number, string[], number | null, number | null]> = [
    [1, 'writer000001', 1, ['posts:read', 'posts:write'], null, null],
    [2, 'readonly0001', 1, ['posts:read'], null, null],
    [3, 'noscope00001', 1, [], null, null],
    [4, 'writeonly001', 1, ['posts:write'], null, null],
    [5, 'revoked00001', 1, ['posts:read'], null, past],
    [6, 'expired00001', 1, ['posts:read'], past, null],
    [7, 'readerrole01', 3, ['posts:read', 'posts:write'], null, null],
    [8, 'inactive0001', 4, ['posts:read'], null, null],
    [9, 'otheruser001', 2, ['posts:read', 'posts:write'], null, null],
  ];
  for (const [id, prefix, userId, scopes, expiresAt, revokedAt] of tokens) {
    store.insert(db, {
      id, name: `Token ${id}`, prefix, hash: createHash('sha256').update(rawToken(prefix), 'utf8').digest('hex'),
      scopes, expiresAt, revokedAt, userId,
    });
  }

  insertRow(db, 'Series', { id: 10, ownerId: 1, name: 'Writer Series', slug: 'writer-series', descriptionMarkdown: 'A series_description', isHidden: 1, order: 2, createdAt: prismaDate('2020-01-02 03:04:05'), updatedAt: prismaDate('2020-02-03 04:05:06') });
  insertRow(db, 'Series', { id: 11, ownerId: 1, name: 'Second Series', slug: 'second-series', descriptionMarkdown: '', isHidden: 0, order: 3, createdAt: prismaDate('2020-01-02 03:04:05.123456'), updatedAt: prismaDate('2020-02-03 04:05:06') });
  insertRow(db, 'Series', { id: 20, ownerId: 2, name: 'Other Series', slug: 'other-series', descriptionMarkdown: '', isHidden: 0, order: 1, createdAt: prismaDate('2020-01-02 03:04:05'), updatedAt: prismaDate('2020-02-03 04:05:06') });

  const created = '2020-01-01 00:00:00';
  const posts: Array<[number, number, number | null, string, string | null, string | null, string]> = [
    [1, 1, 10, 'draft-needle', null, null, '2025-01-01 00:00:09.123456'],
    [2, 2, 20, 'other-draft', null, null, '2025-01-01 00:00:08'],
    [3, 1, 10, 'public', created, null, '2025-01-01 00:00:07'],
    [4, 1, null, 'hidden', created, null, '2025-01-01 00:00:06'],
    [5, 1, null, 'scheduled', '2099-01-01 00:00:00', null, '2025-01-01 00:00:05'],
    [6, 1, 10, 'trashed', created, '2025-01-01 00:00:00', '2025-01-01 00:00:04'],
    [7, 1, null, 'dry-run-target', created, null, '2025-01-01 00:00:03'],
    [8, 1, null, 'delete-target', created, null, '2025-01-01 00:00:02'],
    [9, 1, null, 'camel-delete-target', created, null, '2025-01-01 00:00:01'],
    [12, 1, null, 'publish-target', null, null, '2024-12-31 00:00:00'],
    [13, 1, null, 'publish-empty-target', null, null, '2024-12-30 00:00:00'],
    [14, 1, null, 'update-target', created, null, '2024-12-29 00:00:00'],
  ];
  for (const [id, authorId, seriesId, url, published, deleted, updated] of posts) {
    seedPost(db, id, authorId, url, {
      title: `Title ${url}`, subtitle: 'sub_title', description: 'meta_description text', seriesId: seriesId,
      publishedAt: published, deletedAt: deleted, createdAt: created, updatedAt: updated, readTime: id,
    });
  }
  db.exec(`
    UPDATE "PostContent" SET html = '<p>needle some_key {"inner_key": 1}</p>' WHERE postId = 1;
    UPDATE "Post" SET isAdvertised = 1, coverLayout = 'split', coverImagePosition = 'left', coverImageRatio = '16:9' WHERE id = 1;
    UPDATE "Post" SET isHidden = 1, coverLayout = 'overlay', coverImageRatio = '4:3' WHERE id = 4;
  `);
  ['api', 'snake_tag', 'other-only', 'trashed-only'].forEach((value, index) => insertRow(db, 'Tag', { id: index + 1, name: value }));
  ([[1, 1], [1, 2], [2, 3], [3, 1], [3, 2], [6, 4]] as const).forEach(([postId, tagId], index) => {
    insertRow(db, '_PostToTag', { A: postId, B: tagId });
  });
}

function multipart(field: string, filename: string, content: Buffer) {
  const boundary = 'blex-contract-boundary';
  return {
    raw: Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${field}"; filename="${filename}"\r\nContent-Type: image/png\r\n\r\n`),
      content,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]),
    headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
  };
}

/** Sends every documented operation and failure, in a fixed order, to a real application. */
export async function recordDeveloperApiContract(store: ContractTokenStore): Promise<ContractRecording> {
  const fixture = await createMigratedDatabase();
  try {
    seed(fixture.db, store);
    const app = await buildApp(fixture.path, testSiteUrl, { secretKey: testSecretKey, cipherKey: testCipherKey }, fixture.mediaRoot);
    await app.ready();
    const exchanges: ContractExchange[] = [];
    const writer = rawToken('writer000001');
    const reader = rawToken('readonly0001');

    const send = async (name: string, method: 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'HEAD', path: string, step: Step = {}) => {
      const url = `${API}${path}`;
      const headers: Record<string, string> = { 'user-agent': 'contract-client/1.0', ...step.headers };
      if (step.token !== undefined) headers.authorization = `Bearer ${step.token}`;
      let payload: string | Buffer | undefined = step.raw;
      if (step.json !== undefined) {
        payload = JSON.stringify(step.json);
        headers['content-type'] = 'application/json';
      }
      const response = await app.inject({ method, url, headers, ...(payload === undefined ? {} : { payload }) });
      const kept: Record<string, string> = {};
      for (const [header, value] of Object.entries(response.headers)) {
        if (!volatileHeaders.has(header)) kept[header] = String(value);
      }
      exchanges.push({
        name, method, url, ...(step.framework ? { framework: true } : {}), status: response.statusCode, headers: kept,
        body: step.omitBody ? '<omitted>' : normalize(response.body, Date.now()),
      });
      return response;
    };

    // Authentication.
    await send('me', 'GET', '/me', { token: writer });
    await send('me without any scope', 'GET', '/me', { token: rawToken('noscope00001') });
    await send('missing token', 'GET', '/me');
    await send('wrong scheme', 'GET', '/me', { headers: { authorization: `Basic ${writer}` } });
    await send('malformed token', 'GET', '/me', { token: 'blex_pat_not-a-token' });
    await send('foreign prefix', 'GET', '/me', { token: 'not_a_blex_token' });
    await send('unknown token', 'GET', '/me', { token: rawToken('unknown00001') });
    await send('wrong secret', 'GET', '/me', { token: writer.replace('contract-secret', 'wrong-secret') });
    await send('revoked token', 'GET', '/me', { token: rawToken('revoked00001') });
    await send('expired token', 'GET', '/me', { token: rawToken('expired00001') });
    await send('inactive account', 'GET', '/me', { token: rawToken('inactive0001') });
    await send('non-editor account', 'GET', '/me', { token: rawToken('readerrole01') });
    for (const path of ['/posts', '/posts/search', '/posts/1', '/tags', '/series']) {
      await send(`read scope required ${path}`, 'GET', path, { token: rawToken('noscope00001') });
    }
    await send('write scope required', 'POST', '/posts', { token: reader, json: { title: 'Denied' } });
    await send('read scope is separate from write', 'GET', '/posts', { token: rawToken('writeonly001') });

    // Reads.
    await send('post list', 'GET', '/posts', { token: reader });
    await send('post list drafts paged', 'GET', '/posts?status=draft&page=2&limit=1', { token: reader });
    await send('post list published', 'GET', '/posts?status=published', { token: reader });
    await send('post list hidden', 'GET', '/posts?status=hidden', { token: reader });
    await send('post list scheduled', 'GET', '/posts?status=scheduled', { token: reader });
    await send('post list clamped', 'GET', '/posts?page=0&limit=500', { token: reader });
    await send('post list repeated parameter', 'GET', '/posts?limit=50&limit=1', { token: reader });
    await send('post list beyond the end', 'GET', '/posts?page=99', { token: reader });
    await send('post list bad page', 'GET', '/posts?page=abc', { token: reader });
    await send('post list bad limit', 'GET', '/posts?limit=1.5', { token: reader });
    await send('post list bad status', 'GET', '/posts?status=trashed', { token: reader });
    await send('search', 'GET', '/posts/search?q=NEEDLE&tag=missing,snake_tag&status=draft&series_id=10', { token: reader });
    await send('search by series', 'GET', '/posts/search?series_id=10', { token: reader });
    await send('search empty series', 'GET', '/posts/search?series_id=', { token: reader });
    await send('search repeated tags', 'GET', '/posts/search?tag=api&tag=snake_tag', { token: reader });
    await send('search wildcard is literal', 'GET', '/posts/search?q=%25', { token: reader });
    await send('search underscore is literal', 'GET', '/posts/search?q=some_key', { token: reader });
    await send('search bad series', 'GET', '/posts/search?series_id=not-a-number', { token: reader });
    await send('search ignores a camelCase series filter', 'GET', '/posts/search?seriesId=20', { token: reader });
    await send('search ignores an uppercase query key', 'GET', '/posts/search?Q=needle&SERIES_ID=20', { token: reader });
    await send('post detail', 'GET', '/posts/1', { token: reader });
    await send('post detail published', 'GET', '/posts/3', { token: reader });
    await send('post detail other owner', 'GET', '/posts/2', { token: reader });
    await send('post detail missing', 'GET', '/posts/999', { token: reader });
    await send('post detail trashed', 'GET', '/posts/6', { token: reader });
    await send('post detail bad id', 'GET', '/posts/abc', { token: reader });
    await send('post detail head', 'HEAD', '/posts/1', { token: reader });
    await send('post detail as a browser', 'GET', '/posts/999', { token: reader, headers: { accept: 'text/html' }, framework: true, omitBody: true });
    await send('tags', 'GET', '/tags', { token: reader });
    await send('series', 'GET', '/series', { token: reader });
    await send('unknown route', 'GET', '/unknown', { token: reader, framework: true });

    // Create.
    await send('create draft', 'POST', '/posts', { token: writer, json: {
      title: 'snake_case title', subtitle: 'sub_title value', description: 'meta_key description', slug: 'contract-draft',
      markdown: '# some_key\n\n`foo_bar: {"inner_key": 1}` and camelCase', tags: ['snake_case_tag', 'camelCaseTag'], series_id: 10,
      cover_layout: 'split', cover_image_position: 'left', cover_image_ratio: '1:1', status: 'draft', published_at: '2099-01-01T00:00:00+00:00',
      is_advertise: true,
    } });
    await send('create from content_html', 'POST', '/posts', { token: writer, json: { title: 'From html', url: 'from-html', content_html: '<p data-some_key="x">html_body</p>', tag: 'one_tag,two' } });
    await send('create from text_md', 'POST', '/posts', { token: writer, json: { title: 'From text md', slug: 'from-text-md', text_md: '**text_md**', content_type: 'markdown', series_url: 'second-series' } });
    await send('create from text_html', 'POST', '/posts', { token: writer, json: { title: 'From text html', slug: 'from-text-html', text_html: '<p>text_html</p>', is_hidden: true } });
    await send('create from content', 'POST', '/posts', { token: writer, json: { title: 'From content', slug: 'from-content', content: '_em_', content_type: 'markdown', is_hide: 'yes' } });
    await send('create scheduled', 'POST', '/posts', { token: writer, json: { title: 'Scheduled post', slug: 'contract-scheduled', content_html: '<p>Later</p>', status: 'scheduled', published_at: '2098-05-06T07:08:09+00:00' } });
    await send('create published', 'POST', '/posts', { token: writer, json: { title: 'Published post', slug: 'contract-published', content_html: '<p>Now</p>', status: 'published' } });
    await send('create ignores camelCase keys', 'POST', '/posts', { token: writer, json: {
      title: 'Camel keys ignored', slug: 'camel-ignored', contentHtml: '<p>must not store</p>', isHidden: true, seriesId: 10, coverLayout: 'split', isAdvertise: true,
    } });
    await send('create ignores malformed snake keys', 'POST', '/posts', { token: writer, json: {
      title: 'Malformed keys ignored', slug: 'malformed-ignored', CONTENT_HTML: '<p>no</p>', is__hidden: true, _series_id: 10, cover_layout_: 'split',
    } });
    await send('create with a null body field', 'POST', '/posts', { token: writer, json: { title: 'Null content', slug: 'null-content', content_html: null } });
    await send('create invalid array', 'POST', '/posts', { token: writer, json: [{ title: 'x' }] });
    await send('create invalid string field', 'POST', '/posts', { token: writer, json: { title: 1 } });
    await send('create invalid snake string field', 'POST', '/posts', { token: writer, json: { title: 'x', content_html: 1 } });
    await send('create invalid series_url', 'POST', '/posts', { token: writer, json: { title: 'x', series_url: 1 } });
    await send('create invalid expected_updated_at', 'POST', '/posts', { token: writer, json: { title: 'x', expected_updated_at: 1 } });
    await send('create invalid published_at', 'POST', '/posts', { token: writer, json: { title: 'x', published_at: 1 } });
    await send('create invalid cover_layout', 'POST', '/posts', { token: writer, json: { title: 'x', cover_layout: 'wide' } });
    await send('create invalid cover_image_position', 'POST', '/posts', { token: writer, json: { title: 'x', cover_image_position: 'top' } });
    await send('create invalid cover_image_ratio', 'POST', '/posts', { token: writer, json: { title: 'x', cover_image_ratio: '2:1' } });
    await send('create invalid content_type', 'POST', '/posts', { token: writer, json: { title: 'x', content_type: 'rtf' } });
    await send('create invalid status', 'POST', '/posts', { token: writer, json: { title: 'x', status: 'archived' } });
    await send('create null status', 'POST', '/posts', { token: writer, json: { title: 'x', status: null } });
    await send('create scheduled without time', 'POST', '/posts', { token: writer, json: { title: 'x', status: 'scheduled' } });
    await send('create null content_type', 'POST', '/posts', { token: writer, json: { title: 'x', content_html: '<p>x</p>', content_type: null } });
    await send('create invalid tags', 'POST', '/posts', { token: writer, json: { title: 'x', tags: [1] } });
    await send('create invalid is_hidden', 'POST', '/posts', { token: writer, json: { title: 'x', is_hidden: 'maybe' } });
    await send('create invalid is_hide', 'POST', '/posts', { token: writer, json: { title: 'x', is_hide: 'maybe' } });
    await send('create invalid is_advertise', 'POST', '/posts', { token: writer, json: { title: 'x', is_advertise: 'maybe' } });
    await send('create invalid series_id', 'POST', '/posts', { token: writer, json: { title: 'x', series_id: 'abc' } });
    await send('create unknown series_id', 'POST', '/posts', { token: writer, json: { title: 'x', series_id: 999 } });
    await send('create other owner series_id', 'POST', '/posts', { token: writer, json: { title: 'x', series_id: 20 } });
    await send('create missing title', 'POST', '/posts', { token: writer, json: { content_html: '<p>x</p>' } });
    await send('create malformed json', 'POST', '/posts', { token: writer, raw: '{"title":', headers: { 'content-type': 'application/json' }, framework: true });
    await send('create prototype key', 'POST', '/posts', { token: writer, raw: '{"title":"x","__proto__":{"status":"published"}}', headers: { 'content-type': 'application/json' }, framework: true });
    await send('create text body', 'POST', '/posts', { token: writer, raw: 'title=x', headers: { 'content-type': 'text/plain' } });
    await send('create form body', 'POST', '/posts', { token: writer, raw: 'title=x', headers: { 'content-type': 'application/x-www-form-urlencoded' }, framework: true });
    await send('create too large', 'POST', '/posts', { token: writer, json: { title: 'x', content_html: 'y'.repeat(1024 * 1024) }, framework: true });
    const deep = `${'{"a":'.repeat(20_000)}1${'}'.repeat(20_000)}`;
    await send('create deeply nested', 'POST', '/posts', { token: writer, raw: deep, headers: { 'content-type': 'application/json' } });

    // Update.
    const original = (await send('read before update', 'GET', '/posts/14', { token: writer })).json<{ data: { updated_at: string } }>().data;
    await send('update stale version', 'PATCH', '/posts/14', { token: writer, json: { title: 'Stale', expected_updated_at: '2001-01-01T00:00:00+00:00' } });
    await send('update', 'PATCH', '/posts/14', { token: writer, json: {
      title: 'Updated_title', subtitle: 'new_sub', content_html: '<p>new_body</p>', tags: ['new_tag'], series_id: 11, is_hidden: false,
      cover_layout: 'none', expected_updated_at: original.updated_at,
    } });
    await send('update ignores published_at', 'PATCH', '/posts/14', { token: writer, json: { published_at: '2097-01-01T00:00:00+00:00' } });
    await send('update clears tags', 'PATCH', '/posts/14', { token: writer, json: { tags: [] } });
    await send('update null tags', 'PATCH', '/posts/14', { token: writer, json: { tags: null } });
    await send('update with empty series', 'PATCH', '/posts/14', { token: writer, json: { series_id: '' } });
    await send('update with string series', 'PATCH', '/posts/14', { token: writer, json: { series_id: '10' } });
    await send('update ignores camelCase version', 'PATCH', '/posts/14', { token: writer, json: { subtitle: 'kept', expectedUpdatedAt: '2001-01-01T00:00:00+00:00' } });
    await send('update invalid', 'PATCH', '/posts/14', { token: writer, json: { cover_layout: 'wide' } });
    await send('update other owner', 'PATCH', '/posts/2', { token: writer, json: { title: 'x' } });
    await send('update missing', 'PATCH', '/posts/999', { token: writer, json: { title: 'x' } });
    await send('update bad id', 'PATCH', '/posts/abc', { token: writer, json: { title: 'x' } });
    await send('update without write scope', 'PATCH', '/posts/14', { token: reader, json: { title: 'x' } });

    // Publish.
    await send('publish', 'POST', '/posts/12/publish', { token: writer, json: { title: 'Published_title', is_hidden: false, is_advertise: true } });
    await send('publish empty body', 'POST', '/posts/13/publish', { token: writer, headers: { 'content-type': 'application/json', 'content-length': '0' } });
    await send('publish twice', 'POST', '/posts/12/publish', { token: writer, json: {} });
    await send('publish other owner', 'POST', '/posts/2/publish', { token: writer, json: {} });
    await send('publish bad id', 'POST', '/posts/abc/publish', { token: writer, json: {} });
    await send('publish invalid', 'POST', '/posts/1/publish', { token: writer, json: { published_at: 5 } });

    // Delete.
    await send('delete dry run', 'DELETE', '/posts/7?dry_run=true', { token: writer });
    await send('delete dry run one', 'DELETE', '/posts/7?dry_run=1', { token: writer });
    await send('delete dry run repeated', 'DELETE', '/posts/7?dry_run=false&dry_run=YES', { token: writer });
    await send('delete dry run invalid', 'DELETE', '/posts/7?dry_run=maybe', { token: writer });
    await send('post survives dry run', 'GET', '/posts/7', { token: writer });
    await send('delete with dry run false', 'DELETE', '/posts/7?dry_run=false', { token: writer });
    await send('delete', 'DELETE', '/posts/8', { token: writer });
    await send('delete twice', 'DELETE', '/posts/8', { token: writer });
    await send('camelCase dry run is not a dry run', 'DELETE', '/posts/9?dryRun=true', { token: writer });
    await send('camelCase dry run removed the post', 'GET', '/posts/9', { token: writer });
    await send('delete other owner', 'DELETE', '/posts/2', { token: writer });
    await send('delete bad id', 'DELETE', '/posts/abc', { token: writer });
    await send('delete without write scope', 'DELETE', '/posts/3', { token: reader });

    // Image upload.
    const png = await sharp({ create: { width: 8, height: 8, channels: 3, background: '#336699' } }).png().toBuffer();
    await send('image upload', 'POST', '/images', { token: writer, ...multipart('image', 'contract_image.png', png) });
    await send('image upload deduplicated', 'POST', '/images', { token: writer, ...multipart('image', 'renamed_image.png', png) });
    const other = await sharp({ create: { width: 9, height: 9, channels: 3, background: '#993366' } }).png().toBuffer();
    await send('image bad extension', 'POST', '/images', { token: writer, ...multipart('image', 'contract.exe', other) });
    await send('image wrong field', 'POST', '/images', { token: writer, ...multipart('not_image', 'contract.png', other) });
    await send('image not multipart', 'POST', '/images', { token: writer, json: { image: 'x' } });
    await send('image without write scope', 'POST', '/images', { token: reader, ...multipart('image', 'contract.png', other) });

    await app.close();
    return { exchanges, requests: store.requests(fixture.db), usage: store.usage(fixture.db) };
  } finally {
    await fixture.cleanup();
  }
}
