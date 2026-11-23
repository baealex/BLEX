import assert from 'node:assert/strict';
import { test } from 'node:test';

import { escapeAction } from '../src/appearance/quick-search-escape.ts';

const press = { isComposing: false, keyCode: 27, repeat: false };

test('Esc closes an open panel before it touches the text', () => {
    assert.equal(escapeAction(press, true, true), 'close');
    assert.equal(escapeAction(press, true, false), 'close');
});

test('Esc clears the text once the panel is closed', () => {
    assert.equal(escapeAction(press, false, true), 'clear');
});

test('Esc leaves the browser default alone when there is nothing to dismiss', () => {
    assert.equal(escapeAction(press, false, false), 'none');
});

test('holding Esc closes the panel without going on to clear the text', () => {
    assert.equal(escapeAction({ ...press, repeat: true }, true, true), 'close');
    assert.equal(escapeAction({ ...press, repeat: true }, false, true), 'hold');
});

test('Esc during IME composition neither closes the panel nor clears the text', () => {
    for (const composing of [
        { ...press, isComposing: true },
        { ...press, keyCode: 229 }
    ]) {
        assert.equal(escapeAction(composing, true, true), 'hold');
        assert.equal(escapeAction(composing, false, true), 'hold');
    }
});
