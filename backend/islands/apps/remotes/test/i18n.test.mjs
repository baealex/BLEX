import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
    formatDateOnly,
    formatDateTime,
    formatLocalDateTime,
    formatPublishedDate
} from '../src/i18n/formatters.ts';
import { normalizeLocale } from '../src/i18n/locale.ts';
import { formatScheduleDateTime } from '../src/components/remotes/PostEditor/utils/scheduleDate.ts';
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
        const korean = formatDateOnly('2026-01-02', 'ko', 'legacy');
        const english = formatDateOnly('2026-01-02', 'en', 'legacy');

        assert.match(korean, /2026/);
        assert.match(korean, /1/);
        assert.match(korean, /2/);
        assert.match(english, /2026/);
        assert.match(english, /Jan/);
        assert.match(english, /2/);
        assert.equal(formatDateOnly('2026-02-30', 'en', 'legacy'), 'legacy');
        assert.equal(formatPublishedDate('2026-01-02', 'legacy', 'en'), english);
    });

    test('formats scheduled publication times with the selected UI locale', () => {
        const value = '2026-01-02T15:30';
        const date = new Date(value);
        const options = {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        };
        const korean = formatScheduleDateTime('2026-01-02T15:30', 'ko');
        const english = formatScheduleDateTime('2026-01-02T15:30', 'en');

        assert.notEqual(korean, english);
        assert.equal(korean, new Intl.DateTimeFormat('ko', options).format(date));
        assert.equal(english, new Intl.DateTimeFormat('en', options).format(date));
        assert.equal(formatScheduleDateTime('not-a-date', 'en'), 'not-a-date');
    });

    test('formats wall-clock and ISO timestamps without mixing their timezone semantics', () => {
        const wallClock = new Date(Date.UTC(2026, 0, 2, 15, 30));
        const wallClockOptions = {
            dateStyle: 'medium',
            timeStyle: 'short',
            timeZone: 'UTC'
        };

        assert.equal(
            formatLocalDateTime('2026-01-02 15:30', 'en', 'legacy'),
            new Intl.DateTimeFormat('en', wallClockOptions).format(wallClock)
        );
        assert.equal(formatLocalDateTime('2026-02-30 15:30', 'en', 'legacy'), 'legacy');

        const timestamp = '2026-01-02T15:30:00Z';
        const timestampOptions = {
            dateStyle: 'medium',
            timeStyle: 'short'
        };
        assert.equal(
            formatDateTime(timestamp, 'ko', 'legacy'),
            new Intl.DateTimeFormat('ko', timestampOptions).format(new Date(timestamp))
        );
        assert.equal(formatDateTime('not-a-date', 'ko', 'legacy'), 'legacy');
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
