import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
    MAX_RELATED_POSTS,
    selectVisibleRelatedPosts
} from '../src/components/remotes/RelatedPosts/selection.ts';

describe('selectVisibleRelatedPosts', () => {
    test('keeps every related post when the API returns five to seven posts', () => {
        for (const count of [5, 6, 7]) {
            const posts = Array.from({ length: count }, (_, index) => index);

            assert.deepEqual(selectVisibleRelatedPosts(posts), posts);
        }
    });

    test('preserves ranking order and caps the result at eight posts', () => {
        const posts = Array.from({ length: 10 }, (_, index) => index);

        assert.deepEqual(
            selectVisibleRelatedPosts(posts),
            posts.slice(0, MAX_RELATED_POSTS)
        );
    });
});
