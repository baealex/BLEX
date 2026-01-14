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
            <div className="p-8 text-center">
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

                {/* Actions */}
                <div className="space-y-3">
                    <button
                        onClick={handleLogin}
                        className="block w-full py-3.5 px-6 bg-gray-900 hover:bg-gray-800 text-white font-semibold rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 focus:outline-none focus:ring-4 focus:ring-gray-300">
                        로그인하기
                    </button>
                    <button
                        onClick={handleClose}
                        className="block w-full py-3.5 px-6 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-gray-300">
                        취소
                    </button>
                </div>
            </div>
        </Modal>
    );
};

export default LoginPrompt;
