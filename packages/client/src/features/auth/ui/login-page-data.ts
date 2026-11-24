import type { LoginModel } from '@blex/contracts/views';

/**
 * Everything the browser needs to hydrate the sign-in form.
 * It is public in the HTML, so each field is listed by hand. The CSRF token is the visitor's own,
 * which the form sends with its request. The site brand stays out: the footer is read back from the server markup.
 */
export interface LoginPageData {
    csrfToken: string;
    next: string;
    providers: Array<{ key: 'google' | 'github'; name: string }>;
    pendingOAuth: { username: string } | null;
}

export function createLoginPageData(model: LoginModel): LoginPageData {
    return {
        csrfToken: model.csrfToken,
        next: model.next,
        providers: model.providers.map(({ key, name }) => ({ key, name })),
        pendingOAuth: model.pendingOAuth && { username: model.pendingOAuth.username }
    };
}

/** Accepts only the fields above, so the form never starts from data it cannot use. */
export function readLoginPageData(value: unknown): LoginPageData | null {
    if (
        !isRecord(value) ||
        typeof value.csrfToken !== 'string' ||
        typeof value.next !== 'string' ||
        !Array.isArray(value.providers)
    ) {
        return null;
    }
    const providers = value.providers.filter(isProvider);
    if (providers.length !== value.providers.length) return null;

    let pendingOAuth: LoginPageData['pendingOAuth'] = null;
    if (value.pendingOAuth !== null) {
        if (!isRecord(value.pendingOAuth) || typeof value.pendingOAuth.username !== 'string') return null;
        pendingOAuth = { username: value.pendingOAuth.username };
    }
    return {
        csrfToken: value.csrfToken,
        next: value.next,
        providers: providers.map(({ key, name }) => ({ key, name })),
        pendingOAuth
    };
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isProvider(value: unknown): value is LoginPageData['providers'][number] {
    return isRecord(value) && (value.key === 'google' || value.key === 'github') && typeof value.name === 'string';
}
