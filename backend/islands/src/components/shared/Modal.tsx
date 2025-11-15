import type { ReactNode } from 'react';
import React, { useEffect } from 'react';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    children: ReactNode;
    maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl';
    showCloseButton?: boolean;
}

const Modal: React.FC<ModalProps> = ({
    isOpen,
    onClose,
    title,
    children,
    maxWidth = '2xl',
    showCloseButton = true
}) => {
    // ESC 키로 모달 닫기
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) {
                onClose();
            }
        };

        if (isOpen) {
            document.addEventListener('keydown', handleEscape);
            document.body.style.overflow = 'hidden';
        }

        return () => {
            document.removeEventListener('keydown', handleEscape);
            document.body.style.overflow = 'unset';
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const maxWidthClasses = {
        sm: 'max-w-sm',
        md: 'max-w-md',
        lg: 'max-w-lg',
        xl: 'max-w-xl',
        '2xl': 'max-w-2xl',
        '3xl': 'max-w-3xl',
        '4xl': 'max-w-4xl'
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto"
            onClick={onClose}>
            {/* 블러 백드롭 */}
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" aria-hidden="true" />

            {/* 모달 컨텐츠 */}
            <div
                className={`relative w-full ${maxWidthClasses[maxWidth]} mx-4 my-8 bg-white rounded-2xl shadow-2xl`}
                onClick={(e) => e.stopPropagation()}>
                {/* 헤더 (title이나 showCloseButton이 있을 때만 표시) */}
                {(title || showCloseButton) && (
                    <div className="sticky top-0 bg-white border-b border-gray-200 rounded-t-2xl z-10">
                        <div className="flex items-center justify-between p-6">
                            {title && (
                                <h2 className="text-xl font-bold text-gray-900">{title}</h2>
                            )}
                            {showCloseButton && (
                                <button
                                    onClick={onClose}
                                    className="text-gray-400 hover:text-gray-600 transition-colors p-2 hover:bg-gray-100 rounded-lg ml-auto">
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {/* 컨텐츠 */}
                {children}
            </div>
        </div>
    );
};

export default Modal;
