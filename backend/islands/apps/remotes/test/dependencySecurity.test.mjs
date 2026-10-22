import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { describe, test } from 'node:test';

const require = createRequire(import.meta.url);
const cliRequire = createRequire(require.resolve('@lingui/cli'));
const braces = createRequire(cliRequire.resolve('micromatch'))('braces');
const { http: redirectHttp } = createRequire(require.resolve('axios'))('follow-redirects');

const nestedPattern = (depth, open = '{', close = '}') =>
    open.repeat(depth) + 'x' + close.repeat(depth);

const redirectedHeaders = async (t, options) => {
    const destination = createServer((request, response) => {
        response.end(JSON.stringify(request.headers));
    });
    const redirector = createServer((request, response) => {
        response.writeHead(302, { Location: `http://127.0.0.1:${destination.address().port}/` });
        response.end();
    });

    for (const server of [destination, redirector]) {
        server.listen(0, '127.0.0.1');
        await once(server, 'listening');
        t.after(() => new Promise((resolve, reject) => {
            server.close((error) => error ? reject(error) : resolve());
            server.closeAllConnections();
        }));
    }

    return new Promise((resolve, reject) => {
        const request = redirectHttp.get({
            hostname: '127.0.0.1',
            port: redirector.address().port,
            path: '/',
            ...options
        }, (response) => {
            let body = '';
            response.setEncoding('utf8');
            response.on('data', (chunk) => { body += chunk; });
            response.on('error', reject);
            response.on('end', () => { resolve(JSON.parse(body)); });
        });
        request.on('error', reject);
        request.setTimeout(5000, () => {
            request.destroy(new Error('Local redirect request timed out'));
        });
    });
};

describe('installed follow-redirects credential protection', () => {
    test('strips credentials from array headers across origins', async (t) => {
        const headers = await redirectedHeaders(t, {
            headers: [
                'Host', '127.0.0.1',
                'Authorization', 'Bearer test-token',
                'Proxy-Authorization', 'Basic test-proxy',
                'Cookie', 'session=test-session',
                'X-Public', 'visible'
            ]
        });

        assert.equal(headers.authorization, undefined);
        assert.equal(headers['proxy-authorization'], undefined);
        assert.equal(headers.cookie, undefined);
        assert.equal(headers['x-public'], 'visible');
    });

    test('strips custom sensitive headers with regex metacharacters', async (t) => {
        const headers = await redirectedHeaders(t, {
            headers: {
                'X-Api^Key': 'test-key',
                'X-Token|Secret': 'test-secret',
                'X-Public': 'visible'
            },
            sensitiveHeaders: ['X-Api^Key', 'X-Token|Secret']
        });

        assert.equal(headers['x-api^key'], undefined);
        assert.equal(headers['x-token|secret'], undefined);
        assert.equal(headers['x-public'], 'visible');
    });
});

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
