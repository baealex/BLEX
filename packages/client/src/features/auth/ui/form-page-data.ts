import type { PageProps } from '@blex/contracts/pages';

/**
 * Everything the browser needs to hydrate the sign-up, setup, identity check, and password reset forms.
 * It is public in the HTML, so each field is listed by hand. Each CSRF token is the visitor's own, which its form posts.
 * The setup token and the reset link stay out: the browser reads them back from the server form.
 * The site brand stays out too, because the footer is read back from the server markup.
 */
export interface SignupPageData {
    page: 'sign';
    siteName: string;
    csrfToken: string;
    /** The `next` query the form, sign-in link, and social links carry. */
    query: string;
    providers: string[];
    captchaSiteKey: string;
    invite: string;
    error: string;
}

export interface SetupPageData {
    page: 'setup';
    csrfToken: string;
    error: string;
}

export interface ReauthenticatePageData {
    page: 'reauthenticate';
    csrfToken: string;
    next: string;
    showForm: boolean;
    pendingFactor: boolean;
    hasSecondFactor: boolean;
    providers: Array<{ key: 'google' | 'github'; name: string }>;
    error: string;
}

export type PasswordResetPageData = { page: 'password-reset' } & (
    | { state: 'form'; username: string; csrfToken: string; error: string }
    | { state: 'done' }
    | { state: 'invalid' }
);

export type AuthFormPageData = SignupPageData | SetupPageData | ReauthenticatePageData | PasswordResetPageData;

export function createSignupPageData({
    brand,
    siteKey,
    social,
    params,
    error,
    csrf,
    invite
}: PageProps['sign']): SignupPageData {
    return {
        page: 'sign',
        siteName: brand.siteName,
        csrfToken: csrf,
        query: params,
        providers: [...social],
        captchaSiteKey: siteKey,
        invite,
        error
    };
}

export function createSetupPageData({ csrf, error }: PageProps['setup']): SetupPageData {
    return { page: 'setup', csrfToken: csrf, error };
}

export function createReauthenticatePageData({
    account,
    csrf,
    error,
    showForm,
    next,
    pendingFactor,
    visibleProviders
}: PageProps['reauthenticate']): ReauthenticatePageData {
    return {
        page: 'reauthenticate',
        csrfToken: csrf,
        next,
        showForm,
        pendingFactor,
        hasSecondFactor: account.hasSecondFactor,
        providers: visibleProviders.map(({ key, name }) => ({ key, name })),
        error
    };
}

export function createPasswordResetPageData({ view }: PageProps['password-reset/$token']): PasswordResetPageData {
    if (view.state !== 'form') return { page: 'password-reset', state: view.state };
    return {
        page: 'password-reset',
        state: 'form',
        username: view.username,
        csrfToken: view.csrf,
        error: view.error ?? ''
    };
}

/* The readers below accept only the fields above, so a form never starts from data it cannot use. */

export function readSignupPageData(value: unknown): SignupPageData | null {
    if (
        !isRecord(value) ||
        value.page !== 'sign' ||
        !hasStrings(value, ['siteName', 'csrfToken', 'query', 'captchaSiteKey', 'invite', 'error']) ||
        !Array.isArray(value.providers)
    )
        return null;
    const providers = value.providers.filter((name): name is string => typeof name === 'string');
    if (providers.length !== value.providers.length) return null;
    return {
        page: 'sign',
        siteName: value.siteName,
        csrfToken: value.csrfToken,
        query: value.query,
        providers,
        captchaSiteKey: value.captchaSiteKey,
        invite: value.invite,
        error: value.error
    };
}

export function readSetupPageData(value: unknown): SetupPageData | null {
    if (!isRecord(value) || value.page !== 'setup' || !hasStrings(value, ['csrfToken', 'error'])) return null;
    return { page: 'setup', csrfToken: value.csrfToken, error: value.error };
}

export function readReauthenticatePageData(value: unknown): ReauthenticatePageData | null {
    if (
        !isRecord(value) ||
        value.page !== 'reauthenticate' ||
        !hasStrings(value, ['csrfToken', 'next', 'error']) ||
        typeof value.showForm !== 'boolean' ||
        typeof value.pendingFactor !== 'boolean' ||
        typeof value.hasSecondFactor !== 'boolean' ||
        !Array.isArray(value.providers)
    )
        return null;
    const providers = value.providers.filter(isProvider);
    if (providers.length !== value.providers.length) return null;
    return {
        page: 'reauthenticate',
        csrfToken: value.csrfToken,
        next: value.next,
        showForm: value.showForm,
        pendingFactor: value.pendingFactor,
        hasSecondFactor: value.hasSecondFactor,
        providers: providers.map(({ key, name }) => ({ key, name })),
        error: value.error
    };
}

export function readPasswordResetPageData(value: unknown): PasswordResetPageData | null {
    if (!isRecord(value) || value.page !== 'password-reset') return null;
    if (value.state === 'done' || value.state === 'invalid') return { page: 'password-reset', state: value.state };
    if (value.state !== 'form' || !hasStrings(value, ['username', 'csrfToken', 'error'])) return null;
    return {
        page: 'password-reset',
        state: 'form',
        username: value.username,
        csrfToken: value.csrfToken,
        error: value.error
    };
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasStrings<Key extends string>(
    value: Record<string, unknown>,
    keys: Key[]
): value is Record<string, unknown> & Record<Key, string> {
    return keys.every((key) => typeof value[key] === 'string');
}

function isProvider(value: unknown): value is ReauthenticatePageData['providers'][number] {
    return isRecord(value) && (value.key === 'google' || value.key === 'github') && typeof value.name === 'string';
}
