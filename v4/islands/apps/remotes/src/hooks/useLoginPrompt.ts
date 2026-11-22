import { useContext } from 'react';
import { LoginPromptContext } from '../contexts/internal/LoginPromptContextDef';

export const useLoginPrompt = () => {
    const context = useContext(LoginPromptContext);
    if (!context) {
        throw new Error('useLoginPrompt must be used within LoginPromptProvider');
    }
    return context;
};
