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

    return (
        <ConfirmContext.Provider value={{ confirm }}>
            {children}

            <Modal
                isOpen={dialogState.isOpen}
                onClose={handleClose}
                maxWidth="md"
                showCloseButton={false}>
                <Modal.Body>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">{dialogState.title}</h3>
                    <p className="text-sm text-gray-600 mb-6">
                        {dialogState.message}
                    </p>
                </Modal.Body>
                <Modal.Footer>
                    <Modal.FooterAction
                        type="button"
                        variant="secondary"
                        onClick={handleClose}>
                        {dialogState.cancelText}
                    </Modal.FooterAction>
                    <Modal.FooterAction
                        type="button"
                        variant={dialogState.variant === 'danger' ? 'danger' : 'primary'}
                        onClick={handleConfirm}>
                        {dialogState.confirmText}
                    </Modal.FooterAction>
                </Modal.Footer>
            </Modal>
        </ConfirmContext.Provider>
    );
};
