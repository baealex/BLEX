import {
    useState,
    useEffect,
    useCallback,
    type ReactNode
} from 'react';
import { Modal } from '~/components/shared';
import { LoginPromptContext } from './internal/LoginPromptContextDef';

interface LoginPromptDialogState {
    isOpen: boolean;
    action: string;
}

export const LoginPromptProvider = ({ children }: { children: ReactNode }) => {
    const [dialogState, setDialogState] = useState<LoginPromptDialogState>({
        isOpen: false,
        action: ''
    });

    const isLoggedIn = !!window.configuration?.user?.username;

    const showLoginPrompt = useCallback((action: string) => {
        if (isLoggedIn) {
            return;
        }

        setDialogState({
            isOpen: true,
            action
        });
    }, [isLoggedIn]);

    // 전역 커스텀 이벤트로 모달 열기 (Alpine.js에서도 사용 가능)
    // 중복 방지: 같은 페이지에 여러 island가 있어도 한 번만 모달 표시
    useEffect(() => {
        const handleShowLoginPrompt = (event: CustomEvent<{ action: string }>) => {
            // 이미 모달이 열려있으면 무시
            if (dialogState.isOpen) {
                return;
            }

            const action = event.detail?.action || '이 작업';
            showLoginPrompt(action);
        };

        window.addEventListener('showLoginPrompt', handleShowLoginPrompt as EventListener);
    }, [showLoginPrompt, dialogState.isOpen]);

    const handleClose = () => {
        setDialogState({
            isOpen: false,
            action: ''
        });
    };

    const handleLogin = () => {
        const currentPath = window.location.pathname + window.location.search;
        window.location.assign(`/login?next=${encodeURIComponent(currentPath)}`);
    };

    return (
        <LoginPromptContext.Provider value={{ showLoginPrompt }}>
            {children}

            {/* Login Prompt Dialog using Modal component */}
            <Modal
                isOpen={dialogState.isOpen}
                onClose={handleClose}
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
                        로그인이 필요해요
                    </h3>

                    {/* Description */}
                    <p className="text-content-secondary mb-8">
                        {dialogState.action}을(를) 하려면 먼저 로그인해주세요.
                    </p>
                </Modal.Body>
                <Modal.Footer className="flex-col px-8 pt-0 pb-8 border-t-0 bg-transparent">
                    <Modal.FooterAction
                        variant="primary"
                        onClick={handleLogin}
                        className="w-full">
                        로그인하기
                    </Modal.FooterAction>
                    <Modal.FooterAction
                        variant="secondary"
                        onClick={handleClose}
                        className="w-full">
                        취소
                    </Modal.FooterAction>
                </Modal.Footer>
            </Modal>
        </LoginPromptContext.Provider>
    );
};
