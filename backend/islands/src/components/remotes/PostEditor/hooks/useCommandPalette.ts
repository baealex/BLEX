import { useState, useEffect, useCallback } from 'react';

interface UseCommandPaletteOptions {
    shortcut?: string;
}

/**
 * Command Palette hook - manages command palette state and keyboard shortcuts
 */
export const useCommandPalette = (options: UseCommandPaletteOptions = {}) => {
    const { shortcut = 'k' } = options;
    const [isOpen, setIsOpen] = useState(false);

    const openCommandPalette = useCallback(() => {
        setIsOpen(true);
    }, []);

    const closeCommandPalette = useCallback(() => {
        setIsOpen(false);
    }, []);

    const toggleCommandPalette = useCallback(() => {
        setIsOpen(prev => !prev);
    }, []);

    // Keyboard shortcut: Cmd/Ctrl + K (or custom)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === shortcut) {
                e.preventDefault();
                toggleCommandPalette();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [shortcut, toggleCommandPalette]);

    return {
        isOpen,
        openCommandPalette,
        closeCommandPalette,
        toggleCommandPalette
    };
};
