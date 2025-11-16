import React, { useEffect, useRef, useState } from 'react';
import type { Editor } from '@tiptap/react';
import ToolbarButton from './ToolbarButton';

interface FloatingMenuBarProps {
    editor: Editor | null;
}

const FloatingMenuBar: React.FC<FloatingMenuBarProps> = ({ editor }) => {
    const [isVisible, setIsVisible] = useState(false);
    const [position, setPosition] = useState({
        top: 0,
        left: 0
    });
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!editor) return;

        const updateMenuPosition = () => {
            const { state } = editor;
            const { selection } = state;

            if (selection.empty) {
                setIsVisible(false);
                return;
            }

            const { from, to } = selection;

            // 이미지나 비디오가 선택된 경우 FloatingMenuBar 숨김
            const node = state.doc.nodeAt(from);
            if (node && (node.type.name === 'image' || node.type.name === 'video')) {
                setIsVisible(false);
                return;
            }
            const start = editor.view.coordsAtPos(from);
            const end = editor.view.coordsAtPos(to);

            const rect = {
                left: Math.min(start.left, end.left),
                right: Math.max(start.right, end.right),
                top: Math.min(start.top, end.top),
                bottom: Math.max(start.bottom, end.bottom)
            };

            const centerX = (rect.left + rect.right) / 2;
            const menuWidth = menuRef.current?.offsetWidth || 300;

            setPosition({
                top: rect.top - 50,
                left: Math.max(10, centerX - menuWidth / 2)
            });

            setIsVisible(true);
        };

        const handleSelectionUpdate = () => {
            setTimeout(updateMenuPosition, 10);
        };

        const handleTransaction = () => {
            setTimeout(updateMenuPosition, 10);
        };

        editor.on('selectionUpdate', handleSelectionUpdate);
        editor.on('transaction', handleTransaction);

        return () => {
            editor.off('selectionUpdate', handleSelectionUpdate);
            editor.off('transaction', handleTransaction);
        };
    }, [editor]);

    if (!editor || !isVisible) return null;

    return (
        <div
            ref={menuRef}
            className="fixed z-50 bg-white border border-gray-200 rounded-lg shadow-lg p-2 transition-all duration-200"
            style={{
                top: `${position.top}px`,
                left: `${position.left}px`
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
