import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { parseScreen, parseScreenPage } from '../src/components/screen-props.ts';

describe('screen bootstrap props', () => {
    test('accepts every screen payload the host sends', () => {
        for (const [name, props] of [
            ['SearchPage', {}],
            ['SearchPage', { username: 'writer' }],
            ['Signup', {}],
            ['Signup', { hcaptchaSiteKey: 'site-key', nextUrl: '/tags', inviteCode: 'welcome' }],
            ['PostEditor', { mode: 'new', username: 'writer', showFirstPublishGuide: true }],
            ['PostEditor', { mode: 'draft', username: 'writer', draftUrl: 'saved-draft' }],
            ['PostEditor', { mode: 'edit', username: 'writer', postUrl: 'existing-post' }],
            ['SettingsApp', { isEditor: true, isStaff: false }],
            [
                'SettingsApp',
                {
                    isEditor: true,
                    isStaff: true,
                    isSuperuser: false,
                    canUseTelegramIntegration: true,
                    adminCapabilities: { canManageSiteSettings: true, canManageUtilities: false }
                }
            ]
        ]) {
            const screen = parseScreen(name, props);
            assert.equal(screen?.name, name);
            for (const [key, value] of Object.entries(props)) assert.deepEqual(screen.props[key], value);
        }
    });

    test('rejects unknown screen names and non-object JSON', () => {
        for (const name of ['MissingScreen', '__proto__', 'constructor', '<img src=x>']) {
            assert.equal(parseScreen(name, {}), null);
        }
        for (const props of [null, [], 'settings', true, 0]) {
            assert.equal(parseScreen('SettingsApp', props), null);
            assert.equal(parseScreen('Signup', props), null);
        }
    });

    test('rejects malformed editor and search values without coercing them', () => {
        for (const props of [
            {},
            { mode: 'unknown' },
            { mode: 'edit', username: 1 },
            { mode: 'edit', postUrl: null },
            { mode: 'draft', draftUrl: [] },
            { mode: 'new', showFirstPublishGuide: 'false' }
        ]) {
            assert.equal(parseScreen('PostEditor', props), null);
        }
        assert.equal(parseScreen('SearchPage', { username: ['writer'] }), null);
        for (const props of [{ hcaptchaSiteKey: true }, { nextUrl: ['/tags'] }, { inviteCode: 1 }]) {
            assert.equal(parseScreen('Signup', props), null);
        }
    });

    test('rejects truthy permission strings and malformed capability maps', () => {
        for (const invalid of [
            { isEditor: 'false' },
            { isStaff: 'false' },
            { isSuperuser: 'false' },
            { canUseTelegramIntegration: 1 },
            { adminCapabilities: [] },
            { adminCapabilities: null },
            { adminCapabilities: { canManageUtilities: 'false' } }
        ]) {
            assert.equal(parseScreen('SettingsApp', { isEditor: false, isStaff: false, ...invalid }), null);
        }
        assert.equal(parseScreen('SettingsApp', { isEditor: false }), null);
    });

    test('preserves false permissions and the distinction between absent and empty capabilities', () => {
        const screen = parseScreen('SettingsApp', {
            isEditor: false,
            isStaff: false,
            isSuperuser: false,
            canUseTelegramIntegration: false,
            adminCapabilities: { canManageSiteSettings: false }
        });
        assert.deepEqual(screen.props, {
            isEditor: false,
            isStaff: false,
            isSuperuser: false,
            canUseTelegramIntegration: false,
            adminCapabilities: { canManageSiteSettings: false }
        });
        assert.equal(parseScreen('SettingsApp', { isEditor: true, isStaff: true }).props.adminCapabilities, undefined);
        assert.deepEqual(
            parseScreen('SettingsApp', { isEditor: true, isStaff: true, adminCapabilities: {} }).props
                .adminCapabilities,
            {}
        );
    });

    test('does not let JSON props replace the selected screen or its mounted callback', () => {
        assert.deepEqual(parseScreen('Signup', { __name: 'SettingsApp', __onMounted: 'override', isStaff: true }), {
            name: 'Signup',
            props: { hcaptchaSiteKey: undefined, nextUrl: undefined, inviteCode: undefined }
        });
        assert.deepEqual(parseScreen('SearchPage', { username: 'writer', __name: 'PostEditor' }), {
            name: 'SearchPage',
            props: { username: 'writer' }
        });
    });
});

describe('screen page data', () => {
    const page = {
        screen: { name: 'SearchPage', props: { username: 'writer' } },
        csrf: 'token',
        contentClass: 'max-w-7xl',
        footer: {
            brand: {
                siteName: 'BLEX',
                logoUrl: null,
                darkLogoUrl: null,
                footerPages: [{ title: 'About', slug: 'about' }]
            },
            copyrightYear: 2026
        },
        viewer: { username: 'writer' },
        timeZone: 'Asia/Seoul'
    };

    test('keeps the frame the server sent and leaves the props to the screen', () => {
        assert.deepEqual(parseScreenPage(page), page);
        assert.deepEqual(parseScreenPage({ ...page, footer: undefined, contentClass: undefined }), {
            ...page,
            footer: undefined,
            contentClass: undefined
        });
        assert.deepEqual(parseScreenPage({ ...page, viewer: null }), { ...page, viewer: null });
        assert.deepEqual(parseScreenPage({ ...page, viewer: { username: 'writer', isStaff: true } }), page);
    });

    test('rejects a page whose frame cannot render', () => {
        const brand = page.footer.brand;
        for (const invalid of [
            null,
            [],
            'page',
            { ...page, screen: null },
            { ...page, screen: { name: 1, props: {} } },
            { ...page, csrf: undefined },
            { ...page, viewer: undefined },
            { ...page, viewer: { username: 1 } },
            { ...page, timeZone: undefined },
            { ...page, contentClass: 1 },
            { ...page, footer: null },
            { ...page, footer: { ...page.footer, copyrightYear: '2026' } },
            { ...page, footer: { ...page.footer, brand: { ...brand, footerPages: [{ title: 'About' }] } } },
            { ...page, footer: { ...page.footer, brand: { ...brand, logoUrl: 1 } } }
        ]) {
            assert.equal(parseScreenPage(invalid), null);
        }
    });
});
