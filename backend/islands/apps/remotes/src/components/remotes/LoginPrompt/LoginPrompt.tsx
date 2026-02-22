import { useState, useEffect } from 'react';
import { Modal } from '~/components/shared';

interface LoginPromptProps {
    isOpen?: boolean;
}

const LoginPrompt = ({ isOpen: initialIsOpen = false }: LoginPromptProps) => {
    const [isOpen, setIsOpen] = useState(initialIsOpen);
    const [action, setAction] = useState('이 작업');

    // 전역 이벤트로 모달 열기
    useEffect(() => {
        const handleShowLoginPrompt = (event: CustomEvent<{ action: string }>) => {
            const actionText = event.detail?.action || '이 작업';
            setAction(actionText);
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

    return (
        <Modal
            isOpen={isOpen}
            onClose={handleClose}
            maxWidth="sm"
            showCloseButton={false}>
            <Modal.Body className="p-8 text-center">
                {/* Icon */}
                <div className="mx-auto w-16 h-16 bg-gradient-to-br from-gray-100 to-gray-50 rounded-full flex items-center justify-center mb-6 ring-4 ring-gray-50">
                    <svg
                        className="w-8 h-8 text-gray-700"
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
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                    로그인이 필요해요
                </h3>

                {/* Description */}
                <p className="text-gray-600 mb-8">
                    {action}을(를) 하려면 먼저 로그인해주세요.
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
    );
};

export default LoginPrompt;
