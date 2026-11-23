/* global URL */
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const stylesRoot = fileURLToPath(new URL('../styles', import.meta.url));

test('no stylesheet opts in to cross-document view transitions', () => {
    // Only the React screens load these styles, so a navigation to a server-rendered page
    // leaves a one-sided transition that stops rendering in Chromium 149.
    const sheets = readdirSync(stylesRoot, {
        recursive: true,
        encoding: 'utf8'
    })
        .filter((name) => /\.s?css$/.test(name));
    assert.ok(sheets.includes('main.scss'));
    for (const name of sheets) {
        assert.doesNotMatch(readFileSync(join(stylesRoot, name), 'utf8'), /@view-transition/, name);
    }
});
