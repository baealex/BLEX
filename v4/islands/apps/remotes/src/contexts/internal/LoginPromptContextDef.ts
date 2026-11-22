import { createContext } from 'react';

export interface LoginPromptContextType {
    showLoginPrompt: (action: string) => void;
}

export const LoginPromptContext = createContext<LoginPromptContextType | null>(null);
