/**
 * Login Prompt Utility
 * Lazily mounts the LoginPrompt island and dispatches custom events to it.
 * Works with both Alpine.js and vanilla JavaScript
 */

const LOGIN_PROMPT_ROOT_ID = 'blex-login-prompt-root';

export const LOGIN_PROMPT_ACTIONS = ['generic', 'like', 'comment', 'reply'] as const;
export type LoginPromptAction = typeof LOGIN_PROMPT_ACTIONS[number];

export interface LoginPromptRequest {
    action: LoginPromptAction;
    nextUrl?: string;
}

export const normalizeLoginPromptAction = (action: unknown): LoginPromptAction => (
    typeof action === 'string'
    && LOGIN_PROMPT_ACTIONS.includes(action as LoginPromptAction)
        ? action as LoginPromptAction
        : 'generic'
);

/**
 * Check if user is logged in
 */
export const isLoggedIn = (): boolean => {
    return !!window.configuration?.user?.username;
};

const encodeProps = (request: LoginPromptRequest) =>
    encodeURIComponent(JSON.stringify({
        isOpen: true,
        ...request
    }));

const ensureLoginPrompt = (request: LoginPromptRequest): boolean => {
    if (typeof document === 'undefined') {
        return false;
    }

    const existingLoginPrompt = document.getElementById(LOGIN_PROMPT_ROOT_ID);

    if (existingLoginPrompt) {
        if (existingLoginPrompt.dataset.islandStatus !== 'mounted') {
            existingLoginPrompt.setAttribute('props', encodeProps(request));
            return true;
        }

        return false;
    }

    const loginPrompt = document.createElement('island-component');
    loginPrompt.id = LOGIN_PROMPT_ROOT_ID;
    loginPrompt.setAttribute('name', 'LoginPrompt');
    loginPrompt.setAttribute('props', encodeProps(request));
    loginPrompt.dataset.islandName = 'LoginPrompt';
    loginPrompt.dataset.islandStatus = 'pending';
    document.body.appendChild(loginPrompt);

    return true;
};

/**
 * Show login prompt modal via custom event
 * Can be used from Alpine.js, React, or vanilla JavaScript
 *
 * @param action - Stable action identifier used to select a complete localized sentence.
 * @param nextUrl - Optional same-site destination after sign-in.
 *
 * @example
 * // From Alpine.js
 * showLoginPrompt('like');
 *
 * @example
 * // From vanilla JavaScript
 * import { showLoginPrompt } from '~/utils/loginPrompt';
 * showLoginPrompt('comment');
 */
export const showLoginPrompt = (action: LoginPromptAction = 'generic', nextUrl?: string): void => {
    if (isLoggedIn()) {
        return;
    }

    const request: LoginPromptRequest = {
        action,
        nextUrl
    };
    if (ensureLoginPrompt(request)) {
        return;
    }

    const event = new CustomEvent('showLoginPrompt', { detail: request });
    window.dispatchEvent(event);
};
