import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildQueryCacheKey, removeSignedInCaches } from '../src/lib/query-cache-key.ts';

test('an account named anonymous never shares the signed-out cache', () => {
    const signedOut = buildQueryCacheKey(undefined, 'ko', 'UTC');
    assert.equal(signedOut, 'rq-cache-v4-anonymous-ko-UTC');
    assert.equal(buildQueryCacheKey('', 'ko', 'UTC'), signedOut);
    assert.equal(buildQueryCacheKey('  ', 'ko', 'UTC'), signedOut);
    assert.equal(buildQueryCacheKey('anonymous', 'ko', 'UTC'), 'rq-cache-v4-@anonymous-ko-UTC');
    assert.equal(buildQueryCacheKey('reader', 'en', 'Asia/Seoul'), 'rq-cache-v4-@reader-en-Asia%2FSeoul');
});

test('signing out keeps only the signed-out caches of the current format', (context) => {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage');
    context.after(() => {
        if (descriptor) Object.defineProperty(globalThis, 'sessionStorage', descriptor);
        else Reflect.deleteProperty(globalThis, 'sessionStorage');
    });
    // Like Storage, the entries are the object's own keys and the methods are not.
    const storage = Object.create({
        removeItem(key) {
            delete this[key];
        }
    });
    Object.assign(storage, {
        'rq-cache-v4-anonymous-ko-UTC': '{}',
        'rq-cache-v4-anonymous-en-Asia%2FSeoul': '{}',
        'rq-cache-v4-@anonymous-ko-UTC': '{}',
        'rq-cache-v4-@reader-ko-UTC': '{}',
        // The previous format named the signed-out visitor and an account called anonymous alike.
        'rq-cache-v3-anonymous-ko-UTC': '{}',
        'rq-cache-v3-reader-ko-UTC': '{}',
        'blex-other-entry': '{}'
    });
    Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: storage });

    removeSignedInCaches();

    assert.deepEqual(Object.keys(storage).sort(), [
        'blex-other-entry',
        'rq-cache-v4-anonymous-en-Asia%2FSeoul',
        'rq-cache-v4-anonymous-ko-UTC'
    ]);
});
