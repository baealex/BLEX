import { useEffect } from 'react';
import type { Editor } from '@tiptap/react';
import type { VirtualElement } from '@floating-ui/react';
import ToolbarButton from '../ui/ToolbarButton';
import { useFloatingMenu } from '../../hooks/useFloatingMenu';

interface FloatingMenuBarProps {
    editor: Editor | null;
}

const FloatingMenuBar = ({ editor }: FloatingMenuBarProps) => {
    const {
        isVisible,
        setIsVisible,
        setReferenceElement,
        refs,
        floatingStyles,
        isHidden
    } = useFloatingMenu({
        placement: 'top',
        offsetValue: 10,
        isVirtual: true
    });

    useEffect(() => {
        if (!editor) return;

        const updateMenu = () => {
            const { state } = editor;
            const { selection } = state;
            const { empty, from, to } = selection;

            // 선택이 비어있으면 숨김
            if (empty) {
                setIsVisible(false);
                setReferenceElement(null);
                return;
            }

            // 이미지나 비디오가 선택된 경우 숨김
            const node = state.doc.nodeAt(from);
            if (node && (node.type.name === 'image' || node.type.name === 'video')) {
                setIsVisible(false);
                setReferenceElement(null);
                return;
            }

            // 가상 참조 요소 생성 (getBoundingClientRect가 호출될 때마다 최신 좌표 계산)
            const virtualElement: VirtualElement = {
                getBoundingClientRect: () => {
                    const start = editor.view.coordsAtPos(from);
                    const end = editor.view.coordsAtPos(to);

                    return {
                        top: Math.min(start.top, end.top),
                        right: Math.max(start.right, end.right),
                        bottom: Math.max(start.bottom, end.bottom),
                        left: Math.min(start.left, end.left),
                        width: Math.abs(end.right - start.left),
                        height: Math.abs(end.bottom - start.top),
                        x: Math.min(start.left, end.left),
                        y: Math.min(start.top, end.top)
                    };
                }
            };

            setReferenceElement(virtualElement);
            setIsVisible(true);
        };

        editor.on('selectionUpdate', updateMenu);
        editor.on('transaction', updateMenu);

        return () => {
            editor.off('selectionUpdate', updateMenu);
            editor.off('transaction', updateMenu);
        };
    }, [editor, setIsVisible, setReferenceElement]);

    if (!editor || !isVisible) return null;

    return (
        <div
            ref={refs.setFloating}
            className="bg-white border border-gray-200 rounded-lg shadow-lg p-2 transition-all duration-200 z-50"
            style={{
                ...floatingStyles,
                visibility: isHidden ? 'hidden' : 'visible'
            }}>
            <div className="flex gap-1">
                <ToolbarButton
                    onClick={() => editor.chain().focus().toggleBold().run()}
                    isActive={editor.isActive('bold')}
                    title="볼드 (Ctrl+B)">
                    <i className="fa fa-bold text-sm" />
                </ToolbarButton>
                <ToolbarButton
                    onClick={() => editor.chain().focus().toggleItalic().run()}
                    isActive={editor.isActive('italic')}
                    title="이텔릭 (Ctrl+I)">
                    <i className="fa fa-italic text-sm" />
                </ToolbarButton>
                <ToolbarButton
                    onClick={() => editor.chain().focus().toggleUnderline().run()}
                    isActive={editor.isActive('underline')}
                    title="밑줄 (Ctrl+U)">
                    <i className="fa fa-underline text-sm" />
                </ToolbarButton>
                <ToolbarButton
                    onClick={() => editor.chain().focus().toggleStrike().run()}
                    isActive={editor.isActive('strike')}
                    title="취소선">
                    <i className="fa fa-strikethrough text-sm" />
                </ToolbarButton>
                <ToolbarButton
                    onClick={() => editor.chain().focus().toggleHighlight().run()}
                    isActive={editor.isActive('highlight')}
                    title="형광펜">
                    <i className="fa fa-marker text-sm" />
                </ToolbarButton>

                <div className="w-px bg-gray-300 mx-1" />

                <ToolbarButton
                    onClick={() => {
                        const url = window.prompt('링크 URL을 입력하세요:');
                        if (url) {
                            editor.chain().focus().setLink({ href: url }).run();
                        }
                    }}
                    isActive={editor.isActive('link')}
                    title="링크 (Ctrl+K)">
                    <i className="fa fa-link text-sm" />
                </ToolbarButton>
            </div>
        </div>
    );
};

export default FloatingMenuBar;
