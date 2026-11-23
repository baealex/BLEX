import assert from 'node:assert/strict';
import { test } from 'node:test';

import { keyedDropdownItems } from '../src/ui/components/dropdown-items.ts';

test('items that share a label keep separate values', () => {
    const values = keyedDropdownItems([{ label: 'Notes' }, { label: 'Notes' }, { id: 'other', label: 'Notes' }]).map(
        ({ value }) => value
    );
    assert.equal(new Set(values).size, 3);
    assert.equal(values[0], 'Notes');
    assert.equal(values[2], 'other');
});
