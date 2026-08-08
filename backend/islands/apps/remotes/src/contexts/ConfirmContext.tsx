import {
    useState,
    useRef,
    useEffect,
    useCallback,
    type ReactNode
} from 'react';
import { useLingui } from '@lingui/react/macro';
import { Modal } from '@blex/ui/modal';
import { ConfirmContext, type ConfirmOptions } from './internal/ConfirmContextDef';

interface ConfirmDialogState extends ConfirmOptions {
    isOpen: boolean;
}

export const ConfirmProvider = ({ children }: { children: ReactNode }) => {
    const { t } = useLingui();
    const [dialogState, setDialogState] = useState<ConfirmDialogState>({
        isOpen: false,
        title: '',
        message: '',
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
                ariaTitle={dialogState.title}
                maxWidth="md"
                showCloseButton={false}>
                <Modal.Body>
                    <h3 className="text-lg font-semibold text-content mb-2">{dialogState.title}</h3>
                    <p className="text-sm text-content-secondary mb-6">
                        {dialogState.message}
                    </p>
                </Modal.Body>
                <Modal.Footer>
                    <Modal.FooterAction
                        type="button"
                        variant="secondary"
                        onClick={handleClose}>
                        {dialogState.cancelText || t({
                            id: 'common.cancel',
                            message: 'Cancel'
                        })}
                    </Modal.FooterAction>
                    <Modal.FooterAction
                        type="button"
                        variant={dialogState.variant === 'danger' ? 'danger-solid' : 'primary'}
                        onClick={handleConfirm}>
                        {dialogState.confirmText || t({
                            id: 'common.confirm',
                            message: 'Confirm'
                        })}
                    </Modal.FooterAction>
                </Modal.Footer>
            </Modal>
        </ConfirmContext.Provider>
    );
};
