import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { getSafeNotificationNavigationUrl } from '../src/components/remotes/SettingsApp/pages/NotifySetting/notificationNavigation.ts';

const BASE_URL = 'https://blex.example/settings/notify';

describe('getSafeNotificationNavigationUrl', () => {
    test('keeps relative and HTTPS notification destinations', () => {
        assert.equal(
            getSafeNotificationNavigationUrl('/@author/post', BASE_URL),
            '/@author/post'
        );
        assert.equal(
            getSafeNotificationNavigationUrl(
                'https://blex.example/notice',
                BASE_URL
            ),
            'https://blex.example/notice'
        );
        assert.equal(
            getSafeNotificationNavigationUrl('http://blex/welcome', BASE_URL),
            'http://blex/welcome'
        );
    });

    test('refuses executable or malformed legacy destinations', () => {
        for (const url of [
            'javascript:alert(1)',
            'data:text/html,unsafe',
            'mailto:admin@example.com',
            'http://[invalid',
            'http://',
            'https://',
            '//',
            String.raw`\\javascript:alert(1)`,
            String.raw`\\[invalid`
        ]) {
            assert.equal(
                getSafeNotificationNavigationUrl(url, BASE_URL),
                null
            );
        }
    });
});
