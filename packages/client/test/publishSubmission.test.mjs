/* global FormData, Blob, File */
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
    buildPublishPayload,
    submitPublish
} from '../src/features/editor/utils/publishSubmission.ts';
import { resolveRecoveredSeries } from '../src/features/editor/utils/postEditRecovery.ts';

const fields = {
    title: 'Title',
    subtitle: 'Subtitle',
    url: 'title',
    content: '<p>Body the author wrote</p>',
    metaDescription: 'Description',
    hide: true,
    advertise: true,
    allowComments: false,
    tags: ['one', 'two'],
    seriesId: '7',
    coverLayout: 'split',
    coverImagePosition: 'left',
    coverImageRatio: '4:3',
    reservedDate: '2099-01-02T03:04:05.000Z'
};

const run = async (send, overrides = {}) => {
    const events = {
        published: [],
        rejected: []
    };
    await submitPublish({
        readForm: () => new FormData(),
        fields,
        settleDraft: async () => undefined,
        send,
        fallbackError: 'Could not save the post.',
        onPublished: (url) => events.published.push(url),
        onRejected: (message) => events.rejected.push(message),
        ...overrides
    });
    return events;
};

describe('restoring an edit recovery', () => {
    const current = {
        id: '1',
        url: 'current'
    };
    const other = {
        id: '2',
        url: 'other'
    };
    const none = {
        id: '',
        url: ''
    };

    test('clears the series only when the saved edit had cleared it', () => {
        assert.equal(resolveRecoveredSeries('other', [current, other], current, none), other);
        assert.equal(resolveRecoveredSeries('', [current, other], current, none), none);
        assert.equal(resolveRecoveredSeries('deleted-series', [current, other], current, none), current);
    });
});

describe('publish submission', () => {
    test('leaves out an untouched series and sends an empty one to clear it', () => {
        const stale = new FormData();
        stale.set('series', '9');
        assert.equal(buildPublishPayload(stale, {
            ...fields,
            seriesId: undefined
        }).has('series'), false);
        const cleared = buildPublishPayload(new FormData(), {
            ...fields,
            seriesId: '',
            tags: []
        });
        assert.equal(cleared.get('series'), '');
        assert.equal(cleared.get('tag'), '');
    });

    test('sends every editor field and the draft being published', () => {
        const source = new FormData();
        source.set('image', new Blob(['cover']), 'cover.png');
        const payload = buildPublishPayload(source, fields, 'saved-draft');
        assert.deepEqual(
            Object.fromEntries([...payload.entries()].filter(([name]) => name !== 'image')),
            {
                title: 'Title',
                subtitle: 'Subtitle',
                url: 'title',
                contentHtml: '<p>Body the author wrote</p>',
                metaDescription: 'Description',
                hide: 'true',
                advertise: 'true',
                blockComment: 'true',
                tag: 'one,two',
                series: '7',
                coverLayout: 'split',
                coverImagePosition: 'left',
                coverImageRatio: '4:3',
                reservedDate: '2099-01-02T03:04:05.000Z',
                draftUrl: 'saved-draft'
            }
        );
        assert.ok(payload.get('image') instanceof File);
    });

    test('drops the cover file when the author removed the image', () => {
        const source = new FormData();
        source.set('image', new Blob(['cover']), 'cover.png');
        const payload = buildPublishPayload(source, {
            ...fields,
            imageDeleted: true,
            reservedDate: ''
        });
        assert.equal(payload.has('image'), false);
        assert.equal(payload.get('imageDelete'), 'true');
        assert.equal(payload.has('reservedDate'), false);
        assert.equal(payload.has('draftUrl'), false);
    });

    test('stays in the editor and reports the server error when publishing is rejected', async () => {
        const events = await run(async () => ({
            data: {
                status: 'ERROR',
                errorMessage: 'The scheduled time must be in the future.'
            }
        }));
        assert.deepEqual(events, {
            published: [],
            rejected: ['The scheduled time must be in the future.']
        });
    });

    test('reports a guard rejection and falls back for a missing draft', async () => {
        const busy = await run(async () => {
            throw {
                response: {
                    status: 429,
                    data: 'Other uploads are in progress. Try again in a moment.'
                }
            };
        });
        assert.deepEqual(busy.rejected, ['Other uploads are in progress. Try again in a moment.']);

        const missing = await run(async () => {
            throw {
                response: {
                    status: 404,
                    data: 'Not found'
                }
            };
        });
        assert.deepEqual(missing.rejected, ['Could not save the post.']);
    });

    test('publishes the draft an in-flight autosave just created', async () => {
        let sent;
        const events = await run(async (payload) => {
            sent = payload.get('draftUrl');
            return {
                data: {
                    status: 'DONE',
                    body: { url: 'published-post' }
                }
            };
        }, { settleDraft: async () => 'autosaved-draft' });
        assert.equal(sent, 'autosaved-draft');
        assert.deepEqual(events, {
            published: ['published-post'],
            rejected: []
        });
    });
});
