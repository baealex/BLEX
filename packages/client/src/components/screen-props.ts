import type { ComponentProps } from 'react';
import type PostEditor from '../features/editor';
import type SearchPage from '../features/search';
import type SettingsApp from '../features/settings';
import type { AdminCapabilities } from '../features/settings/access';

export type Screen =
    | { name: 'SearchPage'; props: ComponentProps<typeof SearchPage> }
    | { name: 'Signup'; props: Record<string, never> }
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

/** Validate the JSON boundary before passing props to a lazy-loaded screen. */
export function parseScreen(name: string, props: unknown): Screen | null {
    if (!isRecord(props)) return null;

    switch (name) {
        case 'SearchPage': {
            const { username } = props;
            return isOptionalString(username) ? { name, props: { username } } : null;
        }
        case 'Signup':
            return { name, props: {} };
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
