import { ui } from '../../../i18n/public-ui.js';
import IconUser from '@tabler/icons-react/icons/IconUser';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { LoginPromptAction } from './login-prompt.js';

interface SocialProvider {
    key: string;
    name: string;
}

const descriptions: Record<LoginPromptAction, string> = {
    get like() {
        return ui('Sign in to like this post.');
    },
    get comment() {
        return ui('Sign in to leave a comment.');
    },
    get reply() {
        return ui('Sign in to reply.');
    },
    get subscribe() {
        return ui("Sign in to subscribe to this author's new posts.");
    }
};
const actionClass =
    'flex min-h-11 w-full items-center justify-center rounded-xl px-4 text-sm font-semibold transition-colors duration-150';

let providersRequest: Promise<SocialProvider[]> | undefined;

function loadProviders(): Promise<SocialProvider[]> {
    providersRequest ??= fetch('/v1/social-providers', { headers: { accept: 'application/json' } })
        .then((response) => (response.ok ? (response.json() as Promise<{ body?: unknown }>) : { body: [] }))
        .then(({ body }) =>
            Array.isArray(body)
                ? body.filter(
                      (item): item is SocialProvider => typeof item?.key === 'string' && typeof item?.name === 'string'
                  )
                : []
        )
        .catch(() => []);
    return providersRequest;
}

export interface LoginPromptDialogProps {
    action: LoginPromptAction;
    next: string;
    onClose: () => void;
}

export function LoginPromptDialog({ action, next, onClose }: LoginPromptDialogProps) {
    const dialog = useRef<HTMLDialogElement>(null);
    const [providers, setProviders] = useState<SocialProvider[]>([]);

    useLayoutEffect(() => {
        dialog.current?.showModal();
    }, []);

    useEffect(() => {
        let active = true;
        void loadProviders().then((items) => {
            if (active) setProviders(items);
        });
        return () => {
            active = false;
        };
    }, []);

    return (
        // biome-ignore lint/a11y/useKeyWithClickEvents: this click is only the backdrop; the native dialog closes on Esc.
        <dialog
            ref={dialog}
            id="blex-login-prompt"
            aria-labelledby="blex-login-prompt-title"
            aria-describedby="blex-login-prompt-description"
            className="fixed inset-0 m-auto h-fit w-[calc(100%-2rem)] max-w-sm rounded-2xl border border-line bg-surface p-8 text-center text-content shadow-xl backdrop:bg-black/50"
            onClose={onClose}
            onClick={(event) => {
                if (event.target === event.currentTarget) event.currentTarget.close();
            }}
        >
            <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-full bg-surface-subtle ring-4 ring-line-light">
                <IconUser className="size-5 text-content" aria-hidden="true" />
            </div>
            <h2 id="blex-login-prompt-title" className="mb-2 text-xl font-semibold text-content">
                {ui('Sign in to continue')}
            </h2>
            <p id="blex-login-prompt-description" className="mb-5 text-sm text-content-secondary">
                {descriptions[action]}
            </p>
            <div className="mb-3 grid gap-2">
                {providers.map((provider) => (
                    <a
                        key={provider.key}
                        href={`/login/start/${encodeURIComponent(provider.key)}?${new URLSearchParams({ next })}`}
                        data-no-spa=""
                        className={`${actionClass} border border-line bg-surface text-content hover:bg-surface-subtle`}
                    >
                        {ui('Continue with {value0}', { value0: provider.name })}
                    </a>
                ))}
            </div>
            <a
                href={`/login?next=${encodeURIComponent(next)}`}
                data-no-spa=""
                className={`${actionClass} bg-action text-content-inverted hover:bg-action-hover`}
            >
                {ui('Sign in')}
            </a>
            <button
                type="button"
                className={`${actionClass} mt-2 border border-line bg-surface text-content-secondary hover:text-content`}
                onClick={() => dialog.current?.close()}
            >
                {ui('Cancel')}
            </button>
        </dialog>
    );
}
