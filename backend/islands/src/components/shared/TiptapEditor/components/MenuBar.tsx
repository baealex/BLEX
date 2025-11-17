import React, { useRef, useState } from 'react';
import type { Editor } from '@tiptap/react';
import YoutubeModal from './YoutubeModal';
import FloatingMenuBar from './FloatingMenuBar';
import MediaFloatingMenu from './MediaFloatingMenu';
import SlashCommandMenu from './SlashCommandMenu';
import EditorHelpText from './EditorHelpText';
import { useImageUpload } from '../hooks/useImageUpload';
import { useSlashCommand } from '../hooks/useSlashCommand';

interface MenuBarProps {
    editor: Editor | null;
}

const MenuBar: React.FC<MenuBarProps> = ({ editor }) => {
    const [isYoutubeModalOpen, setIsYoutubeModalOpen] = useState(false);
    const imageInput = useRef<HTMLInputElement>(null);
    const { handleImageUpload } = useImageUpload(editor);
    const { isVisible: isSlashMenuVisible, position: slashMenuPosition, closeMenu } = useSlashCommand(editor);

    if (!editor) return null;

    const handleYoutubeUpload = (id: string) => {
        if (id) {
            const youtubeMd = `@youtube[${id}]`;
            editor.chain().focus().insertContent(youtubeMd).run();
        }
    };

    return (
        <>
            <input
                ref={imageInput}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageUpload}
            />

            {/* 에디터 도움말 */}
            <EditorHelpText />

            {/* LazyImage CSS */}

            {/* 플로팅 메뉴바 - 텍스트 선택 시 나타남 */}
            <FloatingMenuBar editor={editor} />

            {/* 미디어 플로팅 메뉴바 - 이미지/비디오 선택 시 나타남 */}
            <MediaFloatingMenu editor={editor} />

            {/* 슬래시 커맨드 메뉴 - "/" 키 입력 시 나타남 */}
            <SlashCommandMenu
                editor={editor}
                isVisible={isSlashMenuVisible}
                position={slashMenuPosition}
                onClose={closeMenu}
                onImageUpload={() => {
                    closeMenu();
                    imageInput.current?.click();
                }}
                onYoutubeUpload={() => {
                    closeMenu();
                    setIsYoutubeModalOpen(true);
                }}
            />

            <YoutubeModal
                isOpen={isYoutubeModalOpen}
                onClose={() => setIsYoutubeModalOpen(false)}
                onUpload={handleYoutubeUpload}
            />
        </>
    );
};

export default MenuBar;