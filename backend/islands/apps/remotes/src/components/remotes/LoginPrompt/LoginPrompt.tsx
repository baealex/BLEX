import { useState, useEffect } from 'react';
import { Trans, useLingui } from '@lingui/react/macro';
import { Modal } from '~/components/shared';
import {
    normalizeLoginPromptAction,
    type LoginPromptAction
} from '~/utils/loginPrompt';

interface LoginPromptProps {
    isOpen?: boolean;
    action?: LoginPromptAction;
}

const LoginPrompt = ({
    isOpen: initialIsOpen = false,
    action: initialAction = 'generic'
}: LoginPromptProps) => {
    const { t } = useLingui();
    const [isOpen, setIsOpen] = useState(initialIsOpen);
    const [action, setAction] = useState<LoginPromptAction>(
        normalizeLoginPromptAction(initialAction)
    );

    // 전역 이벤트로 모달 열기
    useEffect(() => {
        const handleShowLoginPrompt = (event: CustomEvent<{ action?: unknown }>) => {
            setAction(normalizeLoginPromptAction(event.detail?.action));
            setIsOpen(true);
        };

        window.addEventListener('showLoginPrompt', handleShowLoginPrompt as EventListener);
        return () => {
            window.removeEventListener('showLoginPrompt', handleShowLoginPrompt as EventListener);
        };
    }, []);

    const handleClose = () => {
        setIsOpen(false);
    };

    const handleLogin = () => {
        const currentPath = window.location.pathname + window.location.search;
        window.location.assign(`/login?next=${encodeURIComponent(currentPath)}`);
    };

    const descriptions: Record<LoginPromptAction, string> = {
        generic: t({
            id: 'login_prompt.description.generic',
            message: 'Log in to continue.'
        }),
        like: t({
            id: 'login_prompt.description.like',
            message: 'Log in to like this post.'
        }),
        comment: t({
            id: 'login_prompt.description.comment',
            message: 'Log in to leave a comment.'
        }),
        reply: t({
            id: 'login_prompt.description.reply',
            message: 'Log in to reply.'
        })
    };

    const title = t({
        id: 'login_prompt.title',
        message: 'Login required'
    });

    return (
        <Modal
            isOpen={isOpen}
            onClose={handleClose}
            ariaTitle={title}
            maxWidth="sm"
            showCloseButton={false}>
            <Modal.Body className="p-8 text-center">
                {/* Icon */}
                <div className="mx-auto w-16 h-16 bg-gradient-to-br from-surface-subtle to-surface-subtle rounded-full flex items-center justify-center mb-6 ring-4 ring-line-light">
                    <svg
                        className="w-8 h-8 text-content"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        aria-hidden="true">
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                        />
                    </svg>
                </div>

                {/* Title */}
                <h3 className="text-xl font-semibold text-content mb-2">
                    <Trans id="login_prompt.title">Login required</Trans>
                </h3>

                {/* Description */}
                <p className="text-content-secondary mb-8">
                    {descriptions[action]}
                </p>
            </Modal.Body>
            <Modal.Footer className="flex-col px-8 pt-0 pb-8 border-t-0 bg-transparent">
                <Modal.FooterAction
                    variant="primary"
                    onClick={handleLogin}
                    className="w-full">
                    <Trans id="login_prompt.login">Log in</Trans>
                </Modal.FooterAction>
                <Modal.FooterAction
                    variant="secondary"
                    onClick={handleClose}
                    className="w-full">
                    <Trans id="login_prompt.cancel">Cancel</Trans>
                </Modal.FooterAction>
            </Modal.Footer>
        </Modal>
    );
};

export default LoginPrompt;
