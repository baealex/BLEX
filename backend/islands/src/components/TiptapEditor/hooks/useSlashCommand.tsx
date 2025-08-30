import { useEffect, useState, useCallback } from 'react';
import type { Editor } from '@tiptap/react';

interface SlashCommandState {
    isVisible: boolean;
    position: { top: number; left: number };
    slashPos: number | null;
}

export const useSlashCommand = (editor: Editor | null) => {
    const [state, setState] = useState<SlashCommandState>({
        isVisible: false,
        position: {
            top: 0,
            left: 0
        },
        slashPos: null
    });

    const hideMenu = useCallback(() => {
        setState(prev => ({
            ...prev,
            isVisible: false,
            slashPos: null
        }));
    }, []);

    const showMenu = useCallback((position: { top: number; left: number }, slashPos: number) => {
        setState({
            isVisible: true,
            position,
            slashPos
        });
    }, []);

    useEffect(() => {
        if (!editor || !editor.isEditable) return;

        let editorElement: HTMLElement | null = null;
        try {
            editorElement = editor.view?.dom as HTMLElement;
            if (!editorElement) return;
        } catch {
            // 에디터가 아직 마운트되지 않음
            return;
        }

        const handleKeyDown = (event: KeyboardEvent) => {
            const { selection } = editor.state;
            const { from } = selection;

            // ESC 키로 메뉴 닫기
            if (event.key === 'Escape' && state.isVisible) {
                hideMenu();
                return;
            }

            // "/" 키 감지
            if (event.key === '/' && !state.isVisible) {
                // 현재 위치가 빈 라인이거나 라인 시작인지 확인
                const $pos = editor.state.doc.resolve(from);
                const textBefore = $pos.parent.textBetween(0, $pos.parentOffset);

                if (textBefore.trim() === '' || textBefore.endsWith(' ')) {
                    // 즉시 슬래시 위치 저장 (아직 문자가 입력되기 전)
                    const slashPosition = from;

                    setTimeout(() => {
                        // "/" 문자가 삽입된 후 위치 계산
                        const coords = editor.view.coordsAtPos(slashPosition + 1);

                        showMenu({
                            top: coords.top + 25,
                            left: coords.left
                        }, slashPosition); // 원래 위치 저장
                    }, 10);
                }
            }
        };

        const handleTransaction = () => {
            if (!state.isVisible || state.slashPos === null) return;

            const { selection } = editor.state;
            const { from } = selection;

            // 커서가 슬래시 위치에서 벗어나면 메뉴 숨김
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
    }, [editor, state, hideMenu, showMenu]);

    const closeMenu = useCallback(() => {
        if (state.slashPos !== null && editor) {
            try {
                // "/" 문자 제거
                const doc = editor.state.doc;

                // 슬래시 위치에 "/" 문자가 있는지 확인하고 제거
                const slashChar = doc.textBetween(state.slashPos, state.slashPos + 1);
                if (slashChar === '/') {
                    const { tr } = editor.state;
                    editor.view.dispatch(tr.delete(state.slashPos, state.slashPos + 1));
                }
            } catch (error) {
                console.warn('슬래시 문자 제거 중 오류:', error);
            }
        }
        hideMenu();
    }, [editor, state.slashPos, hideMenu]);

    return {
        isVisible: state.isVisible,
        position: state.position,
        closeMenu
    };
};
