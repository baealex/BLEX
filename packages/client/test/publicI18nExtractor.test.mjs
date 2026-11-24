import assert from 'node:assert/strict';
import test from 'node:test';
import { extractPublicMessages } from '../scripts/public-ui-extractor.mjs';

test('extracts public JSX copy, interpolation, plurals, and explicit IDs from their call sites', () => {
    const messages = extractPublicMessages(
        'example.tsx',
        `
        import { ui as translate } from './i18n/public-ui.js';
        const label = translate('Hello {name}', { name: 'reader' });
        const count = translate('{count, plural, one{# post} other{# posts}}', { count: 2 });
        const page = <button>{translate('Save', {}, 'public.action.save')}</button>;
    `
    );
    assert.deepEqual(
        messages.map(({ id, message }) => [id, message]),
        [
            ['public.Hello {name}', 'Hello {name}'],
            ['public.{count, plural, one{# post} other{# posts}}', '{count, plural, one{# post} other{# posts}}'],
            ['public.action.save', 'Save']
        ]
    );
    assert.equal(messages[0].origin[1], 3);
});

test('ignores similarly named functions that do not come from the public translation helper', () => {
    assert.deepEqual(extractPublicMessages('example.ts', `function ui(x) { return x; } ui('content');`), []);
});

test('refuses authored or computed content and untranslated Korean source messages', () => {
    // biome-ignore lint/suspicious/noTemplateCurlyInString: the extractor reads this template literal as source text.
    for (const expression of ['post.title', '`Hello ${name}`', "'한국어 문구'", "'Save', {}, id"]) {
        assert.throws(
            () =>
                extractPublicMessages(
                    'example.ts',
                    `
            import { ui } from './i18n/public-ui';
            ui(${expression});
        `
                ),
            /literal|English/
        );
    }
});
