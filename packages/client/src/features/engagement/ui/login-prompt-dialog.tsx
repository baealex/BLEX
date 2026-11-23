import IconUser from '@tabler/icons-react/icons/IconUser';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { renderBodyIsland } from '../../../application/island.js';
import type { LoginPromptAction } from './login-prompt.js';

interface SocialProvider {
    key: string;
    name: string;
}

const descriptions: Record<LoginPromptAction, string> = {
    like: '좋아요를 누르려면 로그인해 주세요.',
    comment: '댓글을 남기려면 로그인해 주세요.',
    reply: '답글을 작성하려면 로그인해 주세요.',
    subscribe: '이 작가의 새 글 알림을 받으려면 로그인해 주세요.'
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

function LoginPromptDialog({
    action,
    next,
    onClose
}: {
    action: LoginPromptAction;
    next: string;
    onClose: () => void;
}) {
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
                로그인이 필요해요
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
                        {`${provider.name}로 계속하기`}
                    </a>
                ))}
            </div>
            <a
                href={`/login?next=${encodeURIComponent(next)}`}
                data-no-spa=""
                className={`${actionClass} bg-action text-content-inverted hover:bg-action-hover`}
            >
                로그인하기
            </a>
            <button
                type="button"
                className={`${actionClass} mt-2 border border-line bg-surface text-content-secondary hover:text-content`}
                onClick={() => dialog.current?.close()}
            >
                취소
            </button>
        </dialog>
    );
}

export function showLoginPrompt(action: LoginPromptAction, next: string, signal: AbortSignal): void {
    const close = renderBodyIsland(<LoginPromptDialog action={action} next={next} onClose={() => close()} />, signal);
}
