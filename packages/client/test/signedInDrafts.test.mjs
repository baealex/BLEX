import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readPostEditRecovery, writePostEditRecovery } from '../src/features/editor/utils/postEditRecovery.ts';
import { removeSignedInDrafts } from '../src/lib/signed-in-drafts.ts';

// Like Storage, the entries are the object's own keys and the methods are not.
const createStorage = (entries = {}) =>
    Object.assign(
        Object.create({
            getItem(key) {
                return Object.hasOwn(this, key) ? this[key] : null;
            },
            setItem(key, value) {
                this[key] = String(value);
            },
            removeItem(key) {
                delete this[key];
            }
        }),
        entries
    );

const useGlobal = (context, name, value) => {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, name);
    context.after(() => {
        if (descriptor) Object.defineProperty(globalThis, name, descriptor);
        else Reflect.deleteProperty(globalThis, name);
    });
    Object.defineProperty(globalThis, name, { configurable: true, value });
};

const baseline = {
    title: 'Saved title',
    subtitle: '',
    content: '<p>Saved body.</p>',
    metaDescription: '',
    hide: false,
    advertise: false,
    allowComments: true,
    coverLayout: 'default',
    coverImagePosition: 'right',
    coverImageRatio: 'auto',
    reservedDate: '',
    tags: [],
    seriesUrl: '',
    imageDeleted: false
};
const edited = { ...baseline, title: 'Unsaved title' };
const revision = '2026-11-25T00:00:00.000Z';

test('signing out removes the unsaved edits of every account and keeps the rest of browser storage', (context) => {
    const local = createStorage({
        'blex:post-edit-recovery:v1:writer:first-post': '{}',
        'blex:post-edit-recovery:v1:owner:second-post': '{}',
        'blex-recent-searches': '["public term"]',
        blex_recent_searches: '["public term"]',
        'blex:subscription-telegram-hint-shown:writer': '2026-11-25T00:00:00.000Z'
    });
    const session = createStorage({
        'blex:settings-post-classification-drafts': '{"writer:first-post":{}}',
        'rq-cache-v4-anonymous-ko-UTC': '{}',
        'blex-route-position:abc': '{}'
    });
    useGlobal(context, 'localStorage', local);
    useGlobal(context, 'sessionStorage', session);

    removeSignedInDrafts();

    assert.deepEqual(Object.keys(local).sort(), [
        'blex-recent-searches',
        'blex:subscription-telegram-hint-shown:writer',
        'blex_recent_searches'
    ]);
    assert.deepEqual(Object.keys(session).sort(), ['blex-route-position:abc', 'rq-cache-v4-anonymous-ko-UTC']);
});

test('a post edit recovery surfaces only for the account that wrote it, until that account signs out', (context) => {
    const local = createStorage();
    useGlobal(context, 'localStorage', local);
    useGlobal(context, 'sessionStorage', createStorage());
    useGlobal(context, 'window', { localStorage: local });
    const read = (username) =>
        readPostEditRecovery({ username, postUrl: 'shared-url', baseRevision: revision, baseline });

    assert.equal(
        writePostEditRecovery({ username: 'writer', postUrl: 'shared-url', baseRevision: revision, snapshot: edited }),
        true
    );

    assert.equal(read('owner'), null);
    assert.deepEqual(read('writer')?.snapshot, edited);

    removeSignedInDrafts();

    assert.equal(read('writer'), null);
    assert.deepEqual(Object.keys(local), []);
});
