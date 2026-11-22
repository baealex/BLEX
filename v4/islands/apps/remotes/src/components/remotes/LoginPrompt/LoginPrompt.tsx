import { useState, useEffect } from 'react';
import { Trans, useLingui } from '@lingui/react/macro';
import { Modal } from '~/components/shared';
import SocialLogin from '~/components/remotes/SocialLogin';
import {
    normalizeLoginPromptAction,
    type LoginPromptAction,
    type LoginPromptRequest
} from '~/utils/loginPrompt';
import { UserRound } from '@blex/ui/icons';

interface LoginPromptProps {
    isOpen?: boolean;
    action?: LoginPromptAction;
    nextUrl?: string;
}

const LoginPrompt = ({
    isOpen: initialIsOpen = false,
    action: initialAction = 'generic',
    nextUrl: initialNextUrl
}: LoginPromptProps) => {
    const { t } = useLingui();
    const [isOpen, setIsOpen] = useState(initialIsOpen);
    const [request, setRequest] = useState<LoginPromptRequest>({
        action: normalizeLoginPromptAction(initialAction),
        nextUrl: initialNextUrl
    });

    // 전역 이벤트로 모달 열기
    useEffect(() => {
        const handleShowLoginPrompt = (event: CustomEvent<Partial<LoginPromptRequest>>) => {
            setRequest({
                action: normalizeLoginPromptAction(event.detail?.action),
                nextUrl: event.detail?.nextUrl
            });
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

    const { pathname, search, hash } = window.location;
    const nextUrl = request.nextUrl ?? (pathname + search + hash);

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
        }),
        subscribe: t({
            id: 'login_prompt.description.subscribe',
            message: 'Log in to get notified about new posts from this author.'
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
                    <UserRound aria-hidden="true" className="w-8 h-8 text-content" />
                </div>

                {/* Title */}
                <h3 className="text-xl font-semibold text-content mb-2">
                    <Trans id="login_prompt.title">Login required</Trans>
                </h3>

                {/* Description */}
                <p className="mb-4 text-content-secondary">
                    {descriptions[request.action]}
                </p>
                <SocialLogin nextUrl={nextUrl} />
            </Modal.Body>
            <Modal.Footer className="flex-col px-8 pt-0 pb-8 border-t-0 bg-transparent">
                <Modal.FooterAction
                    variant="primary"
                    onClick={() => window.location.assign(`/login?next=${encodeURIComponent(nextUrl)}`)}
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
