import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { toPostLinkCandidates } from '../src/features/editor/utils/postLinkCandidates.ts';

describe('toPostLinkCandidates', () => {
    const result = {
        username: 'writer',
        posts: [
            {
                url: 'first-post',
                title: 'First Post',
                createdDate: '2026-10-31'
            },
            {
                url: '두-번째-글',
                title: '두 번째 글',
                createdDate: '2026-06-25'
            }
        ]
    };

    test('builds public post paths in search order', () => {
        assert.deepEqual(toPostLinkCandidates(result, ''), [
            {
                title: 'First Post',
                href: '/@writer/first-post',
                meta: '2026-10-31'
            },
            {
                title: '두 번째 글',
                href: '/@writer/두-번째-글',
                meta: '2026-06-25'
            }
        ]);
    });

    test('leaves out the post that is being edited', () => {
        assert.deepEqual(
            toPostLinkCandidates(result, 'first-post').map(candidate => candidate.href),
            ['/@writer/두-번째-글']
        );
    });
});
