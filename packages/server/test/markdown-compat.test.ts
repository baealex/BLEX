import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { parseDocument } from 'htmlparser2';
import { markdownToHtml } from '../src/features/posts/authoring/markdown.js';
import { sanitizeAboutHtml, sanitizePostHtml } from '../src/features/posts/post-html.js';

interface GoldenCase {
  name: string;
  markdown: string;
  html: string;
}
type HtmlNode = { type: string; name?: string; data?: string; attribs?: Record<string, string>; children?: HtmlNode[] };

const golden = JSON.parse(
  readFileSync(new URL('../../test/fixtures/markdown-3.14.golden.json', import.meta.url), 'utf8'),
) as { cases: GoldenCase[] };

// Each entry is a deliberate difference from the recorded output.
const knownDifferences: Record<string, string> = {
  'bold-italic': 'strong and em nest in the other order, with the same appearance',
  'fence-info': 'fence titles were a Pygments feature',
  'gif-amp': 'the recorded output escaped the query twice and broke the video URL',
  'gif-code': 'code keeps the syntax as text instead of embedding a video',
  'kor-em': 'strikethrough and highlight also work next to Korean particles',
  'link-angle': 'spaces in link URLs are percent-encoded',
  'list-code': 'list item paragraphs follow CommonMark looseness',
  'para-then-fence': 'no stray line break before a fence',
  'table-pipe-code': 'an escaped pipe in table code renders as a pipe',
};

function codeText(node: HtmlNode): string {
  return node.type === 'text' ? (node.data ?? '') : (node.children ?? []).map(codeText).join('');
}

/** Compares document structure. Syntax highlight markup and whitespace between elements are not part of the contract. */
function canonical(html: string): string {
  const walk = (node: HtmlNode): string[] => {
    if (node.name === 'pre' || (node.name === 'div' && node.attribs?.class === 'highlight')) {
      return ['<pre>', codeText(node).trimEnd(), '</pre>'];
    }
    if (node.type === 'text') {
      const text = (node.data ?? '').replace(/\s+/g, ' ').trim();
      return text ? [text] : [];
    }
    if (!node.name) return (node.children ?? []).flatMap(walk);
    const attributes = Object.entries(node.attribs ?? {})
      .filter(([name]) => name !== 'style')
      .sort()
      .map(([name, value]) => ` ${name}="${value}"`)
      .join('');
    const body = (node.children ?? []).flatMap(walk);
    return node.name === 'p' && !body.length ? [] : [`<${node.name}${attributes}>`, ...body, `</${node.name}>`];
  };
  return walk(parseDocument(html) as unknown as HtmlNode).join('');
}

for (const { name, markdown, html } of golden.cases) {
  if (knownDifferences[name]) continue;
  test(`matches recorded Markdown: ${name}`, () => {
    assert.equal(canonical(markdownToHtml(markdown)), canonical(sanitizePostHtml(html)));
  });
}

test('about sections keep everything the Markdown renderer writes on its own', () => {
  for (const { name, markdown } of golden.cases) {
    if (name.includes('attr')) continue;
    const html = markdownToHtml(markdown);
    assert.equal(sanitizeAboutHtml(html), sanitizePostHtml(html), name);
  }
});

test('every known difference names a recorded case', () => {
  const names = new Set(golden.cases.map(({ name }) => name));
  for (const name of Object.keys(knownDifferences)) assert.ok(names.has(name), name);
});
