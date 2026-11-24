import assert from 'node:assert/strict';
import { test } from 'node:test';
import hljs from 'highlight.js/lib/core';

import {
    getLanguageLabel,
    getLanguageLoader,
    SUPPORTED_LANGUAGES
} from '../src/features/editor/tiptap/utils/languages.ts';

test('a Markdown fence that uses a short name gets its language', () => {
    assert.equal(getLanguageLabel('ts'), 'TypeScript');
    assert.equal(getLanguageLabel('sh'), 'Bash');
    assert.equal(getLanguageLoader('yml'), getLanguageLoader('yaml'));
    assert.equal(getLanguageLabel('diff'), 'Plain Text');
    assert.equal(getLanguageLoader('diff'), null);
});

test('every short name is one highlight.js gives the same language', async () => {
    for (const language of SUPPORTED_LANGUAGES) {
        if (!language.aliases) continue;
        const definition = (await language.loader()).default(hljs);
        for (const alias of language.aliases) {
            assert.ok(definition.aliases?.includes(alias), `${alias} is not a highlight.js name for ${language.value}`);
        }
    }
});
