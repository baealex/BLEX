import { isLoginPromptAction } from '../features/engagement/ui/login-prompt.js';

let activePrompt: AbortController | undefined;

/** Opens the shared login modal when an anonymous reader activates a member-only control. */
export function openLoginPromptFrom(anchor: HTMLAnchorElement): boolean {
    const action = anchor.getAttribute('data-blex-login-prompt');
    const next = anchor.getAttribute('data-blex-login-next');
    if (!next || !action || !isLoginPromptAction(action)) return false;

    activePrompt?.abort();
    const prompt = new AbortController();
    activePrompt = prompt;
    document.addEventListener('blex:before-page-change', () => prompt.abort(), {
        once: true,
        signal: prompt.signal
    });
    void import('../features/engagement/ui/login-prompt-dialog.js')
        .then(({ showLoginPrompt }) => {
            if (!prompt.signal.aborted) showLoginPrompt(action, next, prompt.signal);
        })
        .catch(() => {
            // The link is a real login URL, so a chunk that fails to load still gets the reader there.
            if (!prompt.signal.aborted) window.location.assign(anchor.href);
        });
    return true;
}
