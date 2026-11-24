import type { ComponentProps } from 'react';
import type { ScreenPageData } from '../application/screen-page';
import type Signup from '../features/auth/signup';
import type PostEditor from '../features/editor';
import type SearchPage from '../features/search';
import type SettingsApp from '../features/settings';
import type { AdminCapabilities } from '../features/settings/access';

export type Screen =
    | { name: 'SearchPage'; props: ComponentProps<typeof SearchPage> }
    | { name: 'Signup'; props: ComponentProps<typeof Signup> }
    | { name: 'PostEditor'; props: ComponentProps<typeof PostEditor> }
    | { name: 'SettingsApp'; props: ComponentProps<typeof SettingsApp> };

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

const isOptionalString = (value: unknown): value is string | undefined =>
    value === undefined || typeof value === 'string';

const isBoolean = (value: unknown): value is boolean => typeof value === 'boolean';

const isOptionalBoolean = (value: unknown): value is boolean | undefined => value === undefined || isBoolean(value);

const isAdminCapabilities = (value: unknown): value is Partial<AdminCapabilities> =>
    isRecord(value) && Object.values(value).every(isBoolean);

const isNullableString = (value: unknown): value is string | null => value === null || typeof value === 'string';

type FooterBrand = NonNullable<ScreenPageData['footer']>['brand'];

const isFooterBrand = (value: unknown): value is FooterBrand =>
    value === undefined ||
    (isRecord(value) &&
        typeof value.siteName === 'string' &&
        isNullableString(value.logoUrl) &&
        isNullableString(value.darkLogoUrl) &&
        Array.isArray(value.footerPages) &&
        value.footerPages.every(
            (page: unknown) => isRecord(page) && typeof page.title === 'string' && typeof page.slug === 'string'
        ));

/** Validate the page around a screen before rendering it. The screen's own props go through `parseScreen`. */
export function parseScreenPage(value: unknown): ScreenPageData | null {
    if (!isRecord(value) || !isRecord(value.screen) || typeof value.screen.name !== 'string') return null;
    const { csrf, contentClass, footer, viewer, timeZone } = value;
    if (typeof csrf !== 'string' || !isOptionalString(contentClass) || typeof timeZone !== 'string') return null;
    let pageViewer: ScreenPageData['viewer'] = null;
    if (viewer !== null) {
        if (!isRecord(viewer) || typeof viewer.username !== 'string') return null;
        pageViewer = { username: viewer.username };
    }
    let pageFooter: ScreenPageData['footer'];
    if (footer !== undefined) {
        if (!isRecord(footer) || typeof footer.copyrightYear !== 'number' || !isFooterBrand(footer.brand)) return null;
        pageFooter = { brand: footer.brand, copyrightYear: footer.copyrightYear };
    }
    return {
        screen: { name: value.screen.name, props: value.screen.props },
        csrf,
        contentClass,
        footer: pageFooter,
        viewer: pageViewer,
        timeZone
    };
}

/** Validate the JSON boundary before passing props to a lazy-loaded screen. */
export function parseScreen(name: string, props: unknown): Screen | null {
    if (!isRecord(props)) return null;

    switch (name) {
        case 'SearchPage': {
            const { username } = props;
            return isOptionalString(username) ? { name, props: { username } } : null;
        }
        case 'Signup': {
            const { hcaptchaSiteKey, nextUrl, inviteCode } = props;
            if (!isOptionalString(hcaptchaSiteKey) || !isOptionalString(nextUrl) || !isOptionalString(inviteCode)) {
                return null;
            }
            return { name, props: { hcaptchaSiteKey, nextUrl, inviteCode } };
        }
        case 'PostEditor': {
            const { mode, username, postUrl, draftUrl, showFirstPublishGuide } = props;
            if (
                (mode !== 'new' && mode !== 'edit' && mode !== 'draft') ||
                !isOptionalString(username) ||
                !isOptionalString(postUrl) ||
                !isOptionalString(draftUrl) ||
                !isOptionalBoolean(showFirstPublishGuide)
            ) {
                return null;
            }
            return { name, props: { mode, username, postUrl, draftUrl, showFirstPublishGuide } };
        }
        case 'SettingsApp': {
            const { isEditor, isStaff, isSuperuser, canUseTelegramIntegration, adminCapabilities } = props;
            if (
                !isBoolean(isEditor) ||
                !isBoolean(isStaff) ||
                !isOptionalBoolean(isSuperuser) ||
                !isOptionalBoolean(canUseTelegramIntegration) ||
                (adminCapabilities !== undefined && !isAdminCapabilities(adminCapabilities))
            ) {
                return null;
            }
            return { name, props: { isEditor, isStaff, isSuperuser, canUseTelegramIntegration, adminCapabilities } };
        }
        default:
            return null;
    }
}
