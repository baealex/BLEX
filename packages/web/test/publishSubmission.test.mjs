/* global FormData, Blob, File */
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
    buildPublishPayload,
    submitPublish
} from '../src/components/remotes/PostEditor/utils/publishSubmission.ts';

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

describe('publish submission', () => {
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
                content_html: '<p>Body the author wrote</p>',
                meta_description: 'Description',
                hide: 'true',
                advertise: 'true',
                block_comment: 'true',
                tag: 'one,two',
                series: '7',
                cover_layout: 'split',
                cover_image_position: 'left',
                cover_image_ratio: '4:3',
                reserved_date: '2099-01-02T03:04:05.000Z',
                draft_url: 'saved-draft'
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
        assert.equal(payload.get('image_delete'), 'true');
        assert.equal(payload.has('reserved_date'), false);
        assert.equal(payload.has('draft_url'), false);
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
            sent = payload.get('draft_url');
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
