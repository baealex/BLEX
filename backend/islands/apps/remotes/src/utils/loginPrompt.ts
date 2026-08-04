/**
 * Login Prompt Utility
 * Lazily mounts the LoginPrompt island and dispatches custom events to it.
 * Works with both Alpine.js and vanilla JavaScript
 */

const LOGIN_PROMPT_ROOT_ID = 'blex-login-prompt-root';

export const LOGIN_PROMPT_ACTIONS = ['generic', 'like', 'comment', 'reply'] as const;
export type LoginPromptAction = typeof LOGIN_PROMPT_ACTIONS[number];

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

const encodeProps = (action: LoginPromptAction) =>
    encodeURIComponent(JSON.stringify({
        isOpen: true,
        action
    }));

const ensureLoginPrompt = (action: LoginPromptAction): boolean => {
    if (typeof document === 'undefined') {
        return false;
    }

    const existingLoginPrompt = document.getElementById(LOGIN_PROMPT_ROOT_ID);

    if (existingLoginPrompt) {
        if (existingLoginPrompt.dataset.islandStatus !== 'mounted') {
            existingLoginPrompt.setAttribute('props', encodeProps(action));
            return true;
        }

        return false;
    }

    const loginPrompt = document.createElement('island-component');
    loginPrompt.id = LOGIN_PROMPT_ROOT_ID;
    loginPrompt.setAttribute('name', 'LoginPrompt');
    loginPrompt.setAttribute('props', encodeProps(action));
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
export const showLoginPrompt = (action: LoginPromptAction = 'generic'): void => {
    if (isLoggedIn()) {
        return;
    }

    if (ensureLoginPrompt(action)) {
        return;
    }

    const event = new CustomEvent('showLoginPrompt', { detail: { action } });
    window.dispatchEvent(event);
};
