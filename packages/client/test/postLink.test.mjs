import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
    buildPostLinkContent,
    isPostLinkQuery
} from '../src/features/editor/tiptap/TiptapEditor/config/postLink.ts';

describe('isPostLinkQuery', () => {
    test('keeps searching for empty and spaced title queries', () => {
        assert.equal(isPostLinkQuery(''), true);
        assert.equal(isPostLinkQuery('두 번째 글'), true);
    });

    test('stops once the writer closes the brackets', () => {
        assert.equal(isPostLinkQuery('docker]'), false);
        assert.equal(isPostLinkQuery('docker]]'), false);
    });

    test('stops when the query is longer than any post title can be', () => {
        assert.equal(isPostLinkQuery('a'.repeat(65)), true);
        assert.equal(isPostLinkQuery('a'.repeat(66)), false);
    });
});

describe('buildPostLinkContent', () => {
    test('marks the title as a post link and leaves a plain space so following text is not linked', () => {
        assert.deepEqual(buildPostLinkContent({
            title: '도커 이미지 줄이기',
            href: '/@writer/docker-image',
            meta: '2026-01-02'
        }), [
            {
                type: 'text',
                text: '도커 이미지 줄이기',
                marks: [{
                    type: 'link',
                    attrs: {
                        href: '/@writer/docker-image',
                        class: 'post-link'
                    }
                }]
            },
            {
                type: 'text',
                text: ' '
            }
        ]);
    });
});
