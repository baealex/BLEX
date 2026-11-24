import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { parseScreen } from '../src/components/screen-props.ts';

describe('screen bootstrap props', () => {
    test('accepts every screen payload the host sends', () => {
        for (const [name, props] of [
            ['SearchPage', {}],
            ['SearchPage', { username: 'writer' }],
            ['Signup', {}],
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
            props: {}
        });
        assert.deepEqual(parseScreen('SearchPage', { username: 'writer', __name: 'PostEditor' }), {
            name: 'SearchPage',
            props: { username: 'writer' }
        });
    });
});
