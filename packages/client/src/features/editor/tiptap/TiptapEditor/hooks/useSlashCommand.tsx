import { useEffect, useState } from 'react';
import type { Editor } from '@tiptap/react';

interface SlashCommandState {
    isVisible: boolean;
    slashPos: number | null;
}

export const useSlashCommand = (editor: Editor | null) => {
    const [state, setState] = useState<SlashCommandState>({
        isVisible: false,
        slashPos: null
    });

    const hideMenu = () => {
        setState((prev) => ({
            ...prev,
            isVisible: false,
            slashPos: null
        }));
    };

    const showMenu = (slashPos: number) => {
        setState({
            isVisible: true,
            slashPos
        });
    };

    useEffect(() => {
        if (!editor || !editor.isEditable) return;

        let editorElement: HTMLElement | null = null;
        try {
            editorElement = editor.view?.dom as HTMLElement;
            if (!editorElement) return;
        } catch {
            // The editor view may not be mounted yet.
            return;
        }

        const handleKeyDown = (event: KeyboardEvent) => {
            const { selection } = editor.state;
            const { from } = selection;

            if (event.key === 'Escape' && state.isVisible) {
                hideMenu();
                return;
            }

            if (event.key === '/' && !state.isVisible) {
                const $pos = editor.state.doc.resolve(from);
                const textBefore = $pos.parent.textBetween(0, $pos.parentOffset);

                if (textBefore.trim() === '' || textBefore.endsWith(' ')) {
                    // Capture the insertion position before the slash key is applied.
                    const slashPosition = from;

                    setTimeout(() => {
                        showMenu(slashPosition);
                    }, 10);
                }
            }
        };

        const handleTransaction = () => {
            if (!state.isVisible || state.slashPos === null) return;

            const { selection } = editor.state;
            const { from } = selection;

            if (from < state.slashPos || from > state.slashPos + 10) {
                hideMenu();
            }
        };

        const handleClick = () => {
            if (state.isVisible) {
                hideMenu();
            }
        };

        editorElement.addEventListener('keydown', handleKeyDown);
        editor.on('transaction', handleTransaction);
        document.addEventListener('click', handleClick);

        return () => {
            if (editorElement) {
                editorElement.removeEventListener('keydown', handleKeyDown);
            }
            editor.off('transaction', handleTransaction);
            document.removeEventListener('click', handleClick);
        };
    }, [editor, state]);

    const closeMenu = () => {
        if (state.slashPos !== null && editor) {
            try {
                const doc = editor.state.doc;

                const slashChar = doc.textBetween(state.slashPos, state.slashPos + 1);
                if (slashChar === '/') {
                    const { tr } = editor.state;
                    editor.view.dispatch(tr.delete(state.slashPos, state.slashPos + 1));
                }
            } catch {
                // Another edit may have invalidated the saved slash position.
            }
        }
        hideMenu();
    };

    return {
        isVisible: state.isVisible,
        slashPos: state.slashPos,
        closeMenu
    };
};
