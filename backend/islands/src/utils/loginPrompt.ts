/**
 * Login Prompt Utility
 * Dispatches custom events that are handled by LoginPromptProvider (React)
 * Works with both Alpine.js and vanilla JavaScript
 */

/**
 * Check if user is logged in
 */
export const isLoggedIn = (): boolean => {
    return !!window.configuration?.user?.username;
};

/**
 * Show login prompt modal via custom event
 * Can be used from Alpine.js, React, or vanilla JavaScript
 *
 * @param action - The action name to display in the prompt (e.g., '좋아요', '댓글 작성')
 *
 * @example
 * // From Alpine.js
 * showLoginPrompt('좋아요');
 *
 * @example
 * // From vanilla JavaScript
 * import { showLoginPrompt } from '~/utils/loginPrompt';
 * showLoginPrompt('댓글 작성');
 */
export const showLoginPrompt = (action: string): void => {
    // If already logged in, don't show prompt
    if (isLoggedIn()) {
        return;
    }

    // Dispatch custom event that will be caught by LoginPromptProvider
    const event = new CustomEvent('showLoginPrompt', { detail: { action } });
    window.dispatchEvent(event);
};
