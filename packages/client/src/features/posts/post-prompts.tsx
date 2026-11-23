import { useCallback, useEffect, useRef, useState, type ComponentType, type MouseEvent, type ReactNode } from 'react';
import type { LoginPromptDialogProps } from '../engagement/ui/login-prompt-dialog';
import { isLoginPromptAction, type LoginPromptAction } from '../engagement/ui/login-prompt';
import type { TelegramHintProps } from '../engagement/ui/telegram-hint';

interface OpenLoginPrompt {
    Dialog: ComponentType<LoginPromptDialogProps>;
    action: LoginPromptAction;
    next: string;
}

/** Owns the login prompt and the Telegram notice opened from a post, and loads each only when it appears. */
export function usePostPrompts(
    revision: number,
    raised: boolean
): {
    onClick: (event: MouseEvent<HTMLElement>) => void;
    dialogs: ReactNode;
} {
    const [loginPrompt, setLoginPrompt] = useState<OpenLoginPrompt | null>(null);
    const [Hint, setHint] = useState<ComponentType<TelegramHintProps> | null>(null);
    const loginRequest = useRef(0);
    const closeLogin = useCallback(() => setLoginPrompt(null), []);
    const closeHint = useCallback(() => setHint(null), []);

    useEffect(() => {
        const cancel = () => {
            loginRequest.current += 1;
            setLoginPrompt(null);
        };
        document.addEventListener('blex:before-page-change', cancel);
        return () => {
            document.removeEventListener('blex:before-page-change', cancel);
            loginRequest.current += 1;
        };
    }, []);

    // biome-ignore lint/correctness/useExhaustiveDependencies: each server document can carry a new notice.
    useEffect(() => {
        let active = true;
        if (/(?:^|; )blex_telegram_hint=/.test(document.cookie)) {
            // The notice is optional, and its cookie stays so the next page can try again.
            void import('../engagement/ui/telegram-hint').then(
                ({ TelegramHint, claimTelegramHint }) => {
                    if (active && claimTelegramHint()) setHint(() => TelegramHint);
                },
                () => undefined
            );
        }
        return () => {
            active = false;
            setHint(null);
        };
    }, [revision]);

    const onClick = (event: MouseEvent<HTMLElement>) => {
        if (
            event.defaultPrevented ||
            event.button !== 0 ||
            event.metaKey ||
            event.ctrlKey ||
            event.shiftKey ||
            event.altKey ||
            !(event.target instanceof Element)
        )
            return;
        const anchor = event.target.closest<HTMLAnchorElement>('a[data-blex-login-prompt]');
        const action = anchor?.getAttribute('data-blex-login-prompt');
        const next = anchor?.getAttribute('data-blex-login-next');
        if (!anchor || !next || !action || !isLoginPromptAction(action)) return;
        event.preventDefault();
        const request = ++loginRequest.current;
        void import('../engagement/ui/login-prompt-dialog').then(
            ({ LoginPromptDialog }) => {
                if (request === loginRequest.current)
                    setLoginPrompt({
                        Dialog: LoginPromptDialog,
                        action,
                        next
                    });
            },
            () => {
                // The link is a real login URL, so a chunk that fails to load still gets the reader there.
                if (request === loginRequest.current) window.location.assign(anchor.href);
            }
        );
    };

    return {
        onClick,
        dialogs: (
            <>
                {loginPrompt && (
                    <loginPrompt.Dialog
                        key={`${loginPrompt.action}:${loginPrompt.next}`}
                        action={loginPrompt.action}
                        next={loginPrompt.next}
                        onClose={closeLogin}
                    />
                )}
                {Hint && <Hint raised={raised} onClose={closeHint} />}
            </>
        )
    };
}
