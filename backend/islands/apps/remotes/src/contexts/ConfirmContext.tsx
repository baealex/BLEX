import {
    useState,
    useRef,
    useEffect,
    useCallback,
    type ReactNode
} from 'react';
import { Modal } from '@blex/ui';
import { ConfirmContext, type ConfirmOptions } from './internal/ConfirmContextDef';

interface ConfirmDialogState extends ConfirmOptions {
    isOpen: boolean;
}

export const ConfirmProvider = ({ children }: { children: ReactNode }) => {
    const [dialogState, setDialogState] = useState<ConfirmDialogState>({
        isOpen: false,
        title: '',
        message: '',
        confirmText: '확인',
        cancelText: '취소',
        variant: 'default'
    });

    const resolveRef = useRef<((value: boolean) => void) | null>(null);

    // Handle bfcache restoration - reset modal state when page is restored
    useEffect(() => {
        const handlePageShow = (event: PageTransitionEvent) => {
            if (event.persisted) {
                // Page was restored from bfcache, reset modal state
                setDialogState((prev) => ({
                    ...prev,
                    isOpen: false
                }));
                resolveRef.current = null;
            }
        };

        window.addEventListener('pageshow', handlePageShow);
        return () => window.removeEventListener('pageshow', handlePageShow);
    }, []);

    const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
        return new Promise((resolve) => {
            resolveRef.current = resolve;
            setDialogState({
                isOpen: true,
                ...options,
                confirmText: options.confirmText || '확인',
                cancelText: options.cancelText || '취소',
                variant: options.variant || 'default'
            });
        });
    }, []);

    const handleClose = useCallback(() => {
        if (resolveRef.current) {
            resolveRef.current(false);
            resolveRef.current = null;
        }
        setDialogState((prev) => ({
            ...prev,
            isOpen: false
        }));
    }, []);

    const handleConfirm = useCallback(() => {
        if (resolveRef.current) {
            resolveRef.current(true);
            resolveRef.current = null;
        }
        setDialogState((prev) => ({
            ...prev,
            isOpen: false
        }));
    }, []);

    const getConfirmButtonClass = () => {
        const baseClass = 'px-4 py-2 text-sm rounded-lg transition-colors';

        switch (dialogState.variant) {
            case 'danger':
                return `${baseClass} bg-red-600 text-white hover:bg-red-700`;
            default:
                return `${baseClass} bg-black text-white hover:bg-gray-800`;
        }
    };

    return (
        <ConfirmContext.Provider value={{ confirm }}>
            {children}

            <Modal
                isOpen={dialogState.isOpen}
                onClose={handleClose}
                maxWidth="md"
                showCloseButton={false}>
                <div className="p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">{dialogState.title}</h3>
                    <p className="text-sm text-gray-600 mb-6">
                        {dialogState.message}
                    </p>
                    <div className="flex gap-3 justify-end">
                        <button
                            onClick={handleClose}
                            className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
                            {dialogState.cancelText}
                        </button>
                        <button
                            onClick={handleConfirm}
                            className={getConfirmButtonClass()}>
                            {dialogState.confirmText}
                        </button>
                    </div>
                </div>
            </Modal>
        </ConfirmContext.Provider>
    );
};
