import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createElement as h } from 'react';
import { test } from 'node:test';
import { renderApplicationDocument, opensOutsideApplication, SiteHeader, SiteTheme } from './support/client-views.js';
import { isApplicationDocument } from '../src/platform/document.js';
import { clientAssets, readUiAsset } from '../src/platform/ui-assets.js';

test('renders the SSR page and its canonical metadata under one application root', () => {
  const url = 'https://blog.example/@writer/hello';
  const viewer = { username: 'writer', hasEditorRole: true, email: 'private@example.test' };
  const html = renderApplicationDocument(
    h(
      'html',
      { lang: 'ko' },
      h('head', null, h('title', null, 'Hello'), h('link', { rel: 'canonical', href: url }), h(SiteTheme)),
      h(
        'body',
        { className: 'page-body' },
        h(SiteHeader, { viewer }),
        h('main', null, h('h1', null, 'Hello'), h('p', null, 'Rendered article')),
        h('script', { type: 'module', src: '/assets/blex/comments.js', 'data-blex-page-module': '' }),
      ),
    ),
  );
  assert.ok(isApplicationDocument(html));
  assert.match(html, /rel="canonical" href="https:\/\/blog\.example\/@writer\/hello"/);
  assert.match(html, /id="blex-application" class="contents" data-header=/);
  assert.match(html, /id="blex-route-content" class="contents"><main><h1>Hello<\/h1><p>Rendered article<\/p>/);
  assert.equal(html.match(/data-site-header=/g)?.length, 1);
  assert.equal(html.match(/src="\/assets\/blex\/theme\.js"/g)?.length, 1);
  assert.match(html, /<script type="module" src="\/assets\/blex\/app\.js" data-blex-app-entry=""><\/script>/);
  assert.match(
    html,
    /<\/main><\/div><\/div><script type="module" src="\/assets\/blex\/comments\.js" data-blex-page-module="">/,
  );
  assert.doesNotMatch(html, /private@example/);
});

test('recognizes the application marker only in the response head', () => {
  assert.equal(isApplicationDocument('<meta name="blex-application" content="1"/>'), false);
  assert.equal(
    isApplicationDocument(
      '<!doctype html><html><head></head><body><meta name="blex-application" content="1"/></body></html>',
    ),
    false,
  );
});

test('opens a saved form result as a full page only when it redirects outside the application', () => {
  assert.equal(opensOutsideApplication({ ok: true, redirected: true }, false), true);
  assert.equal(opensOutsideApplication({ ok: true, redirected: true }, true), false);
  assert.equal(opensOutsideApplication({ ok: true, redirected: false }, false), false);
  assert.equal(opensOutsideApplication({ ok: false, redirected: true }, false), false);
});

test('keeps the route mount export in the built login entry', async () => {
  const entry = 'src/features/auth/ui/login-page.tsx';
  const { script } = await readUiAsset(entry);
  const source = await readFile(new URL(script.slice('/assets/ui/'.length), clientAssets), 'utf8');
  assert.match(source, /\bexport\s*\{[^}]*\bmountPage\b/, entry);
});
