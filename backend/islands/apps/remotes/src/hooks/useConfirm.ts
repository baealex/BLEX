import { useContext } from 'react';
import { ConfirmContext } from '../contexts/internal/ConfirmContextDef';

export const useConfirm = () => {
    const context = useContext(ConfirmContext);
    if (!context) {
        throw new Error('useConfirm must be used within ConfirmProvider');
    }
    return context;
};
