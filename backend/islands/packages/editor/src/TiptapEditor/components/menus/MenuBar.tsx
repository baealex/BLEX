import { useRef, useState } from 'react';
import type { Editor } from '@tiptap/react';
import YoutubeModal from '../modals/YoutubeModal';
import MarkdownPasteModal from '../modals/MarkdownPasteModal';
import FloatingMenuBar from './FloatingMenuBar';
import MediaFloatingMenu from './MediaFloatingMenu';
import SlashCommandMenu from './SlashCommandMenu';
import EditorHelpText from '../ui/EditorHelpText';
import { useImageUpload } from '../../hooks/useImageUpload';
import { useSlashCommand } from '../../hooks/useSlashCommand';

interface MarkdownPasteState {
    isOpen: boolean;
    markdown: string;
    html: string;
}

interface MenuBarProps {
    editor: Editor | null;
    onImageUpload?: (file: File) => Promise<string | undefined>;
    onImageUploadError?: (errorMessage: string) => void;
    pasteState: MarkdownPasteState;
    onInsertHtml: () => void;
    onInsertText: () => void;
    onCloseModal: () => void;
}

const MenuBar = ({
    editor,
    onImageUpload,
    onImageUploadError,
    pasteState,
    onInsertHtml,
    onInsertText,
    onCloseModal
}: MenuBarProps) => {
    const [isYoutubeModalOpen, setIsYoutubeModalOpen] = useState(false);
    const imageInput = useRef<HTMLInputElement>(null);
    const { handleImageUpload } = useImageUpload({
        editor,
        onImageUpload,
        onImageUploadError
    });
    const { isVisible: isSlashMenuVisible, slashPos, closeMenu } = useSlashCommand(editor);

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
                multiple
                className="hidden"
                onChange={handleImageUpload}
            />

            <EditorHelpText />

            <FloatingMenuBar editor={editor} />

            <MediaFloatingMenu editor={editor} />

            <SlashCommandMenu
                editor={editor}
                isVisible={isSlashMenuVisible}
                slashPos={slashPos}
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

            <MarkdownPasteModal
                isOpen={pasteState.isOpen}
                html={pasteState.html}
                onInsertHtml={onInsertHtml}
                onInsertText={onInsertText}
                onClose={onCloseModal}
            />
        </>
    );
};

export default MenuBar;
