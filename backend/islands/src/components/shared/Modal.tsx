import type { ReactNode } from 'react';
import React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { cx } from '~/lib/classnames';

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
    // Use explicit class names for Tailwind to detect at build time
    const getMaxWidthClass = () => {
        switch (maxWidth) {
            case 'sm': return 'sm:max-w-sm';
            case 'md': return 'sm:max-w-md';
            case 'lg': return 'sm:max-w-lg';
            case 'xl': return 'sm:max-w-xl';
            case '2xl': return 'sm:max-w-2xl';
            case '3xl': return 'sm:max-w-3xl';
            case '4xl': return 'sm:max-w-4xl';
            default: return 'sm:max-w-2xl';
        }
    };

    return (
        <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <Dialog.Portal>
                {/* 블러 백드롭 */}
                <Dialog.Overlay
                    className={cx(
                        'fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0'
                    )}
                />

                <Dialog.Content
                    className={cx(
                        // Base styles
                        'fixed z-[61] bg-white shadow-2xl duration-200 focus:outline-none flex flex-col',
                        'max-h-[85vh] overflow-y-auto',

                        // Animations
                        'data-[state=open]:animate-in data-[state=closed]:animate-out',
                        'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',

                        // Mobile: Bottom Sheet
                        'bottom-0 left-0 w-full',
                        'translate-x-0 translate-y-0',
                        'rounded-t-2xl rounded-b-none',
                        'data-[state=closed]:slide-out-to-bottom hover:data-[state=closed]:slide-out-to-bottom',
                        'data-[state=open]:slide-in-from-bottom',

                        // Desktop: Centered Modal
                        'sm:top-[50%] sm:left-[50%] sm:bottom-auto',
                        'sm:w-full',
                        getMaxWidthClass(),
                        'sm:translate-x-[-50%] sm:translate-y-[-50%]',
                        'sm:rounded-2xl',
                        'sm:data-[state=closed]:slide-out-to-bottom-[48%]',
                        'sm:data-[state=open]:slide-in-from-bottom-[48%]'
                    )}>

                    {/* 헤더 */}
                    {(title || showCloseButton) && (
                        <div className="flex items-center justify-between p-6 border-b border-gray-200 sticky top-0 bg-white z-10">
                            {title && (
                                <Dialog.Title className="text-xl font-bold text-gray-900">
                                    {title}
                                </Dialog.Title>
                            )}
                            {showCloseButton && (
                                <Dialog.Close asChild>
                                    <button
                                        className="text-gray-400 hover:text-gray-600 transition-colors p-2 hover:bg-gray-100 rounded-lg ml-auto"
                                        aria-label="Close">
                                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </Dialog.Close>
                            )}
                        </div>
                    )}

                    {/* 컨텐츠 */}
                    <div className="p-0">
                        {children}
                    </div>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
};

export default Modal;
