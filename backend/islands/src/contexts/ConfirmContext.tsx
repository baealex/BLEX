import React, {
 createContext, useContext, useState, useCallback, type ReactNode
} from 'react';
import Modal from '~/components/shared/Modal';

interface ConfirmOptions {
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    variant?: 'default' | 'danger';
}

interface ConfirmContextType {
    confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextType | null>(null);

export const useConfirm = () => {
    const context = useContext(ConfirmContext);
    if (!context) {
        throw new Error('useConfirm must be used within ConfirmProvider');
    }
    return context;
};

interface ConfirmDialogState extends ConfirmOptions {
    isOpen: boolean;
    resolve: (value: boolean) => void;
}

export const ConfirmProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [dialogState, setDialogState] = useState<ConfirmDialogState>({
        isOpen: false,
        title: '',
        message: '',
        confirmText: '확인',
        cancelText: '취소',
        variant: 'default',
        resolve: () => {}
    });

    const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
        return new Promise((resolve) => {
            setDialogState({
                isOpen: true,
                ...options,
                confirmText: options.confirmText || '확인',
                cancelText: options.cancelText || '취소',
                variant: options.variant || 'default',
                resolve
            });
        });
    }, []);

    const handleClose = useCallback(() => {
        setDialogState((prev) => ({
            ...prev,
            isOpen: false
        }));
        dialogState.resolve(false);
    }, [dialogState]);

    const handleConfirm = useCallback(() => {
        setDialogState((prev) => ({
            ...prev,
            isOpen: false
        }));
        dialogState.resolve(true);
    }, [dialogState]);

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
