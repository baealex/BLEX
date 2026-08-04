import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { formatPublishedDate } from '../src/i18n/formatters.ts';
import { normalizeLocale } from '../src/i18n/locale.ts';
import { buildQueryCacheKey } from '../src/lib/query-cache-key.ts';
import { normalizeLoginPromptAction } from '../src/utils/loginPrompt.ts';

describe('locale normalization', () => {
    test('normalizes supported BCP 47 language tags and safely defaults to Korean', () => {
        assert.equal(normalizeLocale('en-US'), 'en');
        assert.equal(normalizeLocale('ko_KR'), 'ko');
        assert.equal(normalizeLocale('fr'), 'ko');
        assert.equal(normalizeLocale(undefined), 'ko');
    });
});

describe('locale-sensitive cache boundaries', () => {
    test('separates persisted queries by both identity and locale', () => {
        const korean = buildQueryCacheKey('reader', 'ko');
        const english = buildQueryCacheKey('reader', 'en');

        assert.notEqual(korean, english);
        assert.notEqual(korean, buildQueryCacheKey('another-reader', 'ko'));
        assert.equal(buildQueryCacheKey(undefined, 'ko'), 'rq-cache-v2-anonymous-ko');
    });
});

describe('localized publication dates', () => {
    test('formats date-only values without a timezone day shift', () => {
        const korean = formatPublishedDate('2026-01-02', 'legacy', 'ko');
        const english = formatPublishedDate('2026-01-02', 'legacy', 'en');

        assert.match(korean, /2026/);
        assert.match(korean, /1/);
        assert.match(korean, /2/);
        assert.match(english, /2026/);
        assert.match(english, /Jan/);
        assert.match(english, /2/);
        assert.equal(formatPublishedDate('2026-02-30', 'legacy', 'en'), 'legacy');
    });
});

describe('localized login prompt actions', () => {
    test('uses stable action identifiers and safely falls back to generic copy', () => {
        assert.equal(normalizeLoginPromptAction('like'), 'like');
        assert.equal(normalizeLoginPromptAction('comment'), 'comment');
        assert.equal(normalizeLoginPromptAction('좋아요'), 'generic');
        assert.equal(normalizeLoginPromptAction(undefined), 'generic');
    });
});
