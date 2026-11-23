import assert from 'node:assert/strict';
import { test } from 'node:test';

import { normalizeTagInput } from '../src/components/remotes/PostEditor/utils/tagInput.ts';

test('keeps hyphens the author typed and cleans the rest of the tag', () => {
    assert.equal(normalizeTagInput('legacy-tag'), 'legacy-tag');
    assert.equal(normalizeTagInput('  Legacy Tag! '), 'legacy-tag');
    assert.equal(normalizeTagInput('--a -- b--'), 'a-b');
    assert.equal(normalizeTagInput('한글-태그'), '한글-태그');
    assert.equal(normalizeTagInput('---'), '');
});
