import {
    createContext,
    useContext,
    useState,
    useCallback,
    useMemo,
    useEffect,
    type ReactNode
} from 'react';
import Modal from '~/components/shared/Modal';

interface LoginPromptContextType {
    showLoginPrompt: (action: string) => void;
}

const LoginPromptContext = createContext<LoginPromptContextType | null>(null);

export const useLoginPrompt = () => {
    const context = useContext(LoginPromptContext);
    if (!context) {
        throw new Error('useLoginPrompt must be used within LoginPromptProvider');
    }
    return context;
};

interface LoginPromptDialogState {
    isOpen: boolean;
    action: string;
}

export const LoginPromptProvider = ({ children }: { children: ReactNode }) => {
    const [dialogState, setDialogState] = useState<LoginPromptDialogState>({
        isOpen: false,
        action: ''
    });

    const isLoggedIn = useMemo(() => {
        return !!window.configuration?.user?.username;
    }, []);

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
        return () => {
            window.removeEventListener('showLoginPrompt', handleShowLoginPrompt as EventListener);
        };
    }, [showLoginPrompt, dialogState.isOpen]);

    const handleClose = useCallback(() => {
        setDialogState({
            isOpen: false,
            action: ''
        });
    }, []);

    const handleLogin = useCallback(() => {
        const currentPath = window.location.pathname + window.location.search;
        window.location.href = `/login?next=${encodeURIComponent(currentPath)}`;
    }, []);

    return (
        <LoginPromptContext.Provider value={{ showLoginPrompt }}>
            {children}

            {/* Login Prompt Dialog using Modal component */}
            <Modal
                isOpen={dialogState.isOpen}
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
                        {dialogState.action}을(를) 하려면 먼저 로그인해주세요.
                    </p>

                    {/* Actions */}
                    <div className="space-y-3">
                        <button
                            onClick={handleLogin}
                            className="block w-full py-3.5 px-6 bg-gray-900 hover:bg-gray-800 text-white font-semibold rounded-xl
                                     transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5
                                     focus:outline-none focus:ring-4 focus:ring-gray-300">
                            로그인하기
                        </button>
                        <button
                            onClick={handleClose}
                            className="block w-full py-3.5 px-6 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl
                                     transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-gray-300">
                            취소
                        </button>
                    </div>
                </div>
            </Modal>
        </LoginPromptContext.Provider>
    );
};

// Export a helper to check login status
export const isUserLoggedIn = (): boolean => {
    return !!window.configuration?.user?.username;
};
