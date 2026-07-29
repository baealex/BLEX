import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { isMentionQuery, isMentionStart } from '../src/components/remotes/Comments/utils/mentionText.ts';
import { buildReplySubmissionText } from '../src/components/remotes/Comments/utils/replyText.ts';

describe('mention text boundaries', () => {
    test('does not start autocomplete inside email or code-like text', () => {
        assert.equal(isMentionStart('contact@', 7), false);
        assert.equal(isMentionStart('`@', 1), false);
        assert.equal(isMentionStart('**@', 2), false);
        assert.equal(isMentionStart('@@', 1), false);
    });

    test('allows mentions at the beginning or after normal punctuation', () => {
        assert.equal(isMentionStart('@', 0), true);
        assert.equal(isMentionStart('(@', 1), true);
        assert.equal(isMentionStart('hello @', 6), true);
    });

    test('accepts only valid username characters while searching', () => {
        assert.equal(isMentionQuery('viewer'), true);
        assert.equal(isMentionQuery('viewer.'), false);
        assert.equal(isMentionQuery('viewer-name'), false);
    });
});

describe('buildReplySubmissionText', () => {
    test('adds a plain-text mention when replying to a comment', () => {
        assert.equal(
            buildReplySubmissionText('답글 내용', 'viewer'),
            '@viewer 답글 내용'
        );
    });

    test('does not duplicate an existing target mention', () => {
        assert.equal(
            buildReplySubmissionText('@viewer 답글 내용', 'viewer'),
            '@viewer 답글 내용'
        );
    });

    test('does not treat a username prefix as the target mention', () => {
        assert.equal(
            buildReplySubmissionText('@viewers 답글 내용', 'viewer'),
            '@viewer @viewers 답글 내용'
        );
    });

    test('does not treat a domain-like prefix as the target mention', () => {
        assert.equal(
            buildReplySubmissionText('@viewer.com 답글 내용', 'viewer'),
            '@viewer @viewer.com 답글 내용'
        );
    });
});
