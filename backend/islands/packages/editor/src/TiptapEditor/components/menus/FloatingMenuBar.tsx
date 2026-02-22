import { useEffect, useState } from 'react';
import type { Editor } from '@tiptap/react';
import { Popover } from '@blex/ui';
import ToolbarButton from '../ui/ToolbarButton';

interface FloatingMenuBarProps {
    editor: Editor | null;
}

const FloatingMenuBar = ({ editor }: FloatingMenuBarProps) => {
    const [isOpen, setIsOpen] = useState(false);
    const [virtualElement, setVirtualElement] = useState<HTMLElement | null>(null);

    useEffect(() => {
        if (!editor) return;

        const updateMenu = () => {
            const { state } = editor;
            const { selection } = state;
            const { empty, from, to } = selection;

            // 선택이 비어있으면 숨김
            if (empty) {
                setIsOpen(false);
                setVirtualElement(null);
                return;
            }

            // 이미지나 비디오가 선택된 경우 숨김
            const node = state.doc.nodeAt(from);
            if (node && (node.type.name === 'image' || node.type.name === 'video')) {
                setIsOpen(false);
                setVirtualElement(null);
                return;
            }

            // 가상 요소 생성 (매번 최신 좌표를 계산하도록)
            const newVirtualElement = {
                getBoundingClientRect: () => {
                    // getBoundingClientRect가 호출될 때마다 최신 좌표 계산
                    const currentStart = editor.view.coordsAtPos(from);
                    const currentEnd = editor.view.coordsAtPos(to);

                    const rect = {
                        top: Math.min(currentStart.top, currentEnd.top),
                        right: Math.max(currentStart.right, currentEnd.right),
                        bottom: Math.max(currentStart.bottom, currentEnd.bottom),
                        left: Math.min(currentStart.left, currentEnd.left),
                        width: Math.abs(currentEnd.right - currentStart.left),
                        height: Math.abs(currentEnd.bottom - currentStart.top),
                        x: Math.min(currentStart.left, currentEnd.left),
                        y: Math.min(currentStart.top, currentEnd.top)
                    };

                    return {
                        ...rect,
                        toJSON: () => rect
                    };
                }
            } as unknown as HTMLElement;

            setVirtualElement(newVirtualElement);
            setIsOpen(true);
        };

        editor.on('selectionUpdate', updateMenu);
        editor.on('transaction', updateMenu);

        return () => {
            editor.off('selectionUpdate', updateMenu);
            editor.off('transaction', updateMenu);
        };
    }, [editor]);

    if (!editor || !isOpen || !virtualElement) return null;

    return (
        <Popover.Root open={isOpen} onOpenChange={setIsOpen}>
            <Popover.Anchor virtualRef={{ current: virtualElement }} />
            <Popover.Portal>
                <Popover.Content
                    className="floating-glass-surface rounded-lg p-2 transition-all duration-200 z-50 outline-none"
                    side="top"
                    sideOffset={10}
                    onOpenAutoFocus={(e) => e.preventDefault()}
                    onCloseAutoFocus={(e) => e.preventDefault()}>
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
                </Popover.Content>
            </Popover.Portal>
        </Popover.Root>
    );
};

export default FloatingMenuBar;
