import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isLongIntroduction } from '../src/features/authors/introduction-length.ts';

test('a short introduction stays open', () => {
    assert.equal(isLongIntroduction('<p><strong>Hello!</strong></p><p>I write about software.</p>'), false);
});

test('character references count as the one character they show', () => {
    assert.equal(isLongIntroduction(`<p>${'&amp;'.repeat(73)}</p>`), false);
    assert.equal(isLongIntroduction(`<p>${'&#x1F600;'.repeat(73)}</p>`), false);
});

test('a long paragraph or many short blocks fold', () => {
    assert.equal(isLongIntroduction(`<p>${'word '.repeat(80)}</p>`), true);
    assert.equal(isLongIntroduction(`<ul>${'<li>Series</li>'.repeat(7)}</ul>`), true);
});

test('each line of a code block counts toward the length', () => {
    const code = Array.from({ length: 30 }, (_, index) => `line ${index}`).join('\n');
    assert.equal(isLongIntroduction(`<pre><code>${code}</code></pre>`), true);
    assert.equal(isLongIntroduction('<pre><code>one\ntwo</code></pre>'), false);
});
