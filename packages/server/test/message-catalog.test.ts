import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import Fastify from 'fastify';
import type { PrismaClient } from '@prisma/client';
import ts from 'typescript';
import { registerDeveloperApi } from '../src/features/developer-api/index.js';
import { registerDeveloperOpenApi } from '../src/features/developer-api/openapi.js';
import { systemMessage } from '../src/platform/messages.js';

const catalog = JSON.parse(readFileSync(new URL('../../data/ui-messages.ko.json', import.meta.url), 'utf8')) as Record<
  string,
  string
>;
const apiFallback = JSON.parse(
  readFileSync(new URL('../../data/api-messages.ko.json', import.meta.url), 'utf8'),
) as Record<string, string>;
const variables = (message: string) =>
  [...new Set([...message.matchAll(/\{(\w+)\}/g)].map((match) => match[1]))].sort();

function assertTranslated(id: string, source: string, where: string) {
  assert.doesNotMatch(source, /[가-힣]/, `${where}: use an English source for ${id}`);
  assert.ok(catalog[id]?.trim(), `${where}: missing Korean translation for ${id}`);
  assert.deepEqual(variables(source), variables(catalog[id]), `${where}: placeholder mismatch for ${id}`);
}

function visitSources(visit: (node: ts.Node, path: string) => void) {
  const visitDirectory = (directory: string) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) visitDirectory(path);
      else if (entry.name.endsWith('.ts')) {
        const source = ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true);
        const walk = (node: ts.Node) => {
          visit(node, path);
          ts.forEachChild(node, walk);
        };
        walk(source);
      }
    }
  };
  visitDirectory(fileURLToPath(new URL('../../src', import.meta.url)));
}

const calleeName = (node: ts.CallExpression | ts.NewExpression) =>
  ts.isIdentifier(node.expression) ? node.expression.text : undefined;
const literal = (node: ts.Node | undefined): node is ts.StringLiteral | ts.NoSubstitutionTemplateLiteral =>
  Boolean(node && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)));

test('server product messages have English sources and complete Korean translations with matching placeholders', () => {
  let count = 0;
  visitSources((node, path) => {
    if (!ts.isCallExpression(node) || calleeName(node) !== 'systemMessage') return;
    const [message, , customId] = node.arguments;
    assert.ok(literal(message), `${path}: use a literal English source`);
    assertTranslated(
      customId && ts.isStringLiteral(customId) ? customId.text : `server.${message.text}`,
      message.text,
      path,
    );
    count += 1;
  });
  assert.ok(count > 100);
});

test('Developer API text has Korean translations under developer IDs', async () => {
  // Calls that name their English source.
  let count = 0;
  visitSources((node, path) => {
    if (!ts.isCallExpression(node) || calleeName(node) !== 'developerText') return;
    const message = node.arguments[1];
    if (!literal(message)) return;
    assertTranslated(`developer.${message.text}`, message.text, path);
    count += 1;
  });
  assert.ok(count > 5);

  // Error messages the API sends in English and translates when it responds; the site's API catalog covers the rest.
  visitSources((node, path) => {
    let message: ts.Node | undefined;
    if ((ts.isCallExpression(node) || ts.isNewExpression(node)) && node.arguments) {
      const name = calleeName(node);
      if (name === 'formatError' || name === 'DeveloperMutationInputError') message = node.arguments[1];
    } else if (
      path.includes('/features/developer-api/') &&
      ts.isPropertyAssignment(node) &&
      node.name.getText() === 'message'
    ) {
      message = node.initializer;
    }
    if (!literal(message) || !message.text) return;
    if (Object.hasOwn(apiFallback, message.text) && !Object.hasOwn(catalog, `developer.${message.text}`)) return;
    assertTranslated(`developer.${message.text}`, message.text, path);
  });

  // The reference's titles, summaries, descriptions, and tags, read from the routes the API registers.
  const app = Fastify();
  await registerDeveloperOpenApi(app);
  registerDeveloperApi(app, {} as PrismaClient, { writable: true, mediaRoot: '/nonexistent', mutations: {} as never });
  await app.ready();
  const texts = new Set<string>();
  const protectedKeys = new Set(['example', 'examples', 'enum', 'const', 'default']);
  const visit = (value: unknown) => {
    if (Array.isArray(value)) return value.forEach(visit);
    if (!value || typeof value !== 'object') return;
    for (const [key, entry] of Object.entries(value)) {
      if (protectedKeys.has(key)) continue;
      // Schema names such as PostDetail are identifiers, not prose.
      if (['title', 'summary', 'description'].includes(key) && typeof entry === 'string') {
        if (!/^[A-Z][A-Za-z0-9]*$/.test(entry) || key !== 'title') texts.add(entry);
      } else if (key === 'tags' && Array.isArray(entry)) {
        for (const tag of entry) {
          if (typeof tag === 'string') texts.add(tag);
          else if (tag && typeof tag === 'object' && typeof tag.name === 'string') texts.add(tag.name);
        }
        visit(entry);
      } else visit(entry);
    }
  };
  visit(app.swagger());
  await app.close();
  assert.ok(texts.size > 50);
  for (const text of texts) assertTranslated(`developer.${text}`, text, 'OpenAPI document');
});

function readWebCatalog(locale: string) {
  const text = readFileSync(new URL(`../../../client/src/locales/${locale}/messages.po`, import.meta.url), 'utf8');
  const messages = new Map<string, string>();
  for (const entry of text.split(/\r?\n\r?\n/)) {
    const fields: Record<string, string> = {};
    let field = '';
    for (const line of entry.split(/\r?\n/)) {
      const start = /^(msgid|msgstr) (".*")$/.exec(line);
      if (start) {
        field = start[1];
        fields[field] = JSON.parse(start[2]);
      } else if (field && line.startsWith('"')) fields[field] += JSON.parse(line);
      else field = '';
    }
    if (fields.msgid) messages.set(fields.msgid, fields.msgstr ?? '');
  }
  return messages;
}

// Entries whose screen needs other Korean wording for the same English, keyed by catalog ID.
const intentionalVariants: Record<string, string> = {
  'public.Name': 'Tag sort option; Korean sort options end in 순 (이름순).',
  'settings.posts.order.recently_updated': 'Post sort option; Korean sort options end in 순 (최근 수정순).',
  'settings.users.role.author': 'The account role is 작가; elsewhere Author is the writer of a post (작성자).',
  'settings.static_pages.editor.published': 'Static page visibility switch (공개); static pages are not posts.',
  'settings.forms.update.updating': 'Repeats its button, 서식 수정, while account fields say 업데이트.',
};

test('each English source has one Korean translation across the server, /v1, and web catalogs', () => {
  const webEnglish = readWebCatalog('en');
  const entries = [
    ...Object.entries(catalog).map(([id, korean]) => ({
      id,
      english: id.replace(/^(?:server|developer)\./, ''),
      korean,
    })),
    ...Object.entries(apiFallback).map(([english, korean]) => ({ id: `/v1 ${english}`, english, korean })),
    ...[...readWebCatalog('ko')].map(([id, korean]) => ({ id, english: webEnglish.get(id) || id, korean })),
  ];
  const translations = new Map<string, Map<string, string[]>>();
  for (const { id, english, korean } of entries) {
    if (Object.hasOwn(intentionalVariants, id)) continue;
    const byKorean = translations.get(english) ?? new Map<string, string[]>();
    byKorean.set(korean, [...(byKorean.get(korean) ?? []), id]);
    translations.set(english, byKorean);
  }
  const conflicts = [...translations]
    .filter(([, byKorean]) => byKorean.size > 1)
    .map(([english, byKorean]) =>
      [english, ...[...byKorean].map(([korean, ids]) => `  ${korean} ← ${ids.join(', ')}`)].join('\n'),
    );
  assert.deepEqual(
    conflicts,
    [],
    'Use one Korean translation, or list the entry in intentionalVariants with a reason.',
  );

  for (const [id, reason] of Object.entries(intentionalVariants)) {
    assert.ok(reason.trim(), `${id}: give a reason`);
    const entry = entries.find((candidate) => candidate.id === id);
    assert.ok(entry, `${id}: listed as intentional but not in a catalog`);
    const others = translations.get(entry.english);
    assert.ok(others && !others.has(entry.korean), `${id}: no longer differs from the other "${entry.english}"`);
  }
});

test('message interpolation keeps authored values in their original language', () => {
  const values = { value0: '작가', value1: '사용자 제목', value2: 'https://site.test/post' };
  assert.equal(
    systemMessage('[{value0}] published a new post. [{value1}]({value2})', values, undefined, 'en'),
    '[작가] published a new post. [사용자 제목](https://site.test/post)',
  );
});
