const loginPromptActions = ['like', 'comment', 'reply', 'subscribe'] as const;

export type LoginPromptAction = (typeof loginPromptActions)[number];

export function isLoginPromptAction(value: string): value is LoginPromptAction {
    return (loginPromptActions as readonly string[]).includes(value);
}

/** Links keep working without JavaScript; the application client opens them as a modal. */
export function loginPromptProps(returnTo: string, action: LoginPromptAction) {
    const url = new URL(returnTo, 'https://blex.invalid');
    const next = `${url.pathname}${url.search}${url.hash}`;
    return {
        href: `/login?next=${encodeURIComponent(next)}`,
        'data-blex-login-prompt': action,
        'data-blex-login-next': next
    };
}
