import { type ComponentType, useEffect, useSyncExternalStore } from 'react';
import type { LoginPromptDialogProps } from '../features/engagement/ui/login-prompt-dialog.js';
import { isLoginPromptAction, type LoginPromptAction } from '../features/engagement/ui/login-prompt.js';
import type { TelegramHintProps } from '../features/engagement/ui/telegram-hint.js';
import { readToaster, subscribeToaster } from './toaster.js';

interface OpenPrompts {
    login: { Dialog: ComponentType<LoginPromptDialogProps>; action: LoginPromptAction; next: string } | null;
    hint: { Hint: ComponentType<TelegramHintProps>; raised: boolean } | null;
}

const closed: OpenPrompts = { login: null, hint: null };
const listeners = new Set<() => void>();
let open = closed;
let loginRequest = 0;
let hintRequest = 0;

function update(next: Partial<OpenPrompts>): void {
    open = { ...open, ...next };
    for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

const closeLogin = () => update({ login: null });
const closeHint = () => update({ hint: null });

function closePrompts(): void {
    loginRequest += 1;
    hintRequest += 1;
    update(closed);
}

/** Opens the shared login modal when an anonymous reader activates a member-only control. */
export function openLoginPromptFrom(anchor: HTMLAnchorElement): boolean {
    const action = anchor.getAttribute('data-blex-login-prompt');
    const next = anchor.getAttribute('data-blex-login-next');
    if (!next || !action || !isLoginPromptAction(action)) return false;
    const request = ++loginRequest;
    void import('../features/engagement/ui/login-prompt-dialog.js').then(
        ({ LoginPromptDialog }) => {
            if (request === loginRequest) update({ login: { Dialog: LoginPromptDialog, action, next } });
        },
        () => {
            // The link is a real login URL, so a chunk that fails to load still gets the reader there.
            if (request === loginRequest) window.location.assign(anchor.href);
        }
    );
    return true;
}

/** Shows the Telegram notice the server leaves after a subscription, once per account. */
export function offerTelegramHint(): void {
    if (!/(?:^|; )blex_telegram_hint=/.test(document.cookie)) return;
    const request = ++hintRequest;
    // The notice is optional, and its cookie stays so the next page can try again.
    void import('../features/engagement/ui/telegram-hint.js').then(
        ({ TelegramHint, claimTelegramHint }) => {
            if (request === hintRequest && claimTelegramHint())
                update({ hint: { Hint: TelegramHint, raised: document.querySelector('.post-action-dock') !== null } });
        },
        () => undefined
    );
}

/** Renders the prompts that float over application pages, whether or not the page itself is in the tree. */
export function ApplicationPrompts() {
    // The server never renders a prompt, so hydration starts from none.
    const { login, hint } = useSyncExternalStore(
        subscribe,
        () => open,
        () => closed
    );
    const toaster = useSyncExternalStore(subscribeToaster, readToaster, () => null);

    useEffect(() => {
        document.addEventListener('blex:before-page-change', closePrompts);
        return () => document.removeEventListener('blex:before-page-change', closePrompts);
    }, []);

    return (
        <>
            {login && (
                <login.Dialog
                    key={`${login.action}:${login.next}`}
                    action={login.action}
                    next={login.next}
                    onClose={closeLogin}
                />
            )}
            {hint && <hint.Hint raised={hint.raised} onClose={closeHint} />}
            {toaster}
        </>
    );
}
