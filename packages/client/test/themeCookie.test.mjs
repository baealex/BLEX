import assert from 'node:assert/strict';
import { test } from 'node:test';
import { writeThemePreferenceCookie } from '../src/appearance/theme-cookie.ts';

for (const protocol of ['http:', 'https:']) {
    test(`theme cookies preserve preference, expiry, and scope over ${protocol}`, (context) => {
        const descriptors = ['document', 'location'].map((name) => [
            name,
            Object.getOwnPropertyDescriptor(globalThis, name)
        ]);
        context.after(() => {
            for (const [name, descriptor] of descriptors) {
                if (descriptor) Object.defineProperty(globalThis, name, descriptor);
                else Reflect.deleteProperty(globalThis, name);
            }
        });
        let written = '';
        Object.defineProperties(globalThis, {
            document: {
                configurable: true,
                value: {
                    set cookie(value) {
                        written = value;
                    }
                }
            },
            location: { configurable: true, value: { protocol } }
        });

        for (const preference of ['light', 'dark', 'system']) {
            writeThemePreferenceCookie(preference);
            const [cookie, ...attributes] = written.split('; ');
            assert.equal(cookie, `blex_theme=${preference === 'system' ? '' : preference}`);
            assert.ok(attributes.includes('Path=/'));
            assert.ok(attributes.includes('SameSite=Lax'));
            assert.ok(attributes.includes(`Max-Age=${preference === 'system' ? 0 : 31_536_000}`));
            assert.equal(attributes.includes('Secure'), protocol === 'https:');
        }
    });
}
