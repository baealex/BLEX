import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { describe, test } from 'node:test';

const require = createRequire(import.meta.url);
const cliRequire = createRequire(require.resolve('@lingui/cli'));
const braces = createRequire(cliRequire.resolve('micromatch'))('braces');

const nestedPattern = (depth, open = '{', close = '}') =>
    open.repeat(depth) + 'x' + close.repeat(depth);

describe('installed braces nesting protection', () => {
    test('preserves ordinary glob compilation and expansion', () => {
        assert.equal(braces.compile('src/{one,two}.js'), 'src/(one|two).js');
        assert.deepEqual(braces.expand('src/{one,two}.js'), ['src/one.js', 'src/two.js']);
    });

    test('allows patterns at and below the nesting limit', () => {
        for (const depth of [99, 100]) {
            for (const [open, close] of [['{', '}'], ['(', ')']]) {
                const pattern = nestedPattern(depth, open, close);
                assert.equal(braces.compile(pattern), pattern);
                assert.deepEqual(braces.expand(pattern), [pattern]);
            }
        }
    });

    test('rejects excessive nesting before recursive walkers can exhaust the stack', () => {
        for (const depth of [101, 4000]) {
            for (const [open, close] of [['{', '}'], ['(', ')']]) {
                for (const operation of [braces.parse, braces.compile, braces.expand, braces.stringify]) {
                    assert.throws(() => operation(nestedPattern(depth, open, close)), {
                        name: 'SyntaxError',
                        message: 'Input nesting depth exceeds maximum of 100'
                    });
                }
            }
        }
    });

    test('counts mixed and unclosed groups toward the same nesting limit', () => {
        for (const pattern of [nestedPattern(51, '{(', ')}'), '{'.repeat(101)]) {
            assert.throws(() => braces.compile(pattern), {
                name: 'SyntaxError',
                message: 'Input nesting depth exceeds maximum of 100'
            });
        }
    });

    test('keeps escaped, quoted, and character-class braces literal', () => {
        const literal = '{'.repeat(101);
        assert.equal(braces.compile('\\{'.repeat(101)), literal);
        assert.equal(braces.compile(`"${literal}"`), literal);
        assert.equal(braces.compile(`[${literal}]`), `[${literal}]`);
    });
});
