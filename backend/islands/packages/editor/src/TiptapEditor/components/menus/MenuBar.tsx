import { useRef, useState } from 'react';
import type { Editor } from '@tiptap/react';
import YoutubeModal from '../modals/YoutubeModal';
import MarkdownPasteModal from '../modals/MarkdownPasteModal';
import FloatingMenuBar from './FloatingMenuBar';
import MediaFloatingMenu from './MediaFloatingMenu';
import ColumnsFloatingMenu from './ColumnsFloatingMenu';
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
    const videoInput = useRef<HTMLInputElement>(null);
    const { handleImageUpload, handleVideoUpload } = useImageUpload({
        editor,
        onImageUpload,
        onImageUploadError
    });
    const { isVisible: isSlashMenuVisible, slashPos, closeMenu } = useSlashCommand(editor);

    if (!editor) return null;

    const handleYoutubeUpload = (id: string) => {
        if (id) {
            // iframe 노드로 직접 삽입
            editor.chain()
                .focus()
                .insertContent([
                    {
                        type: 'iframe',
                        attrs: {
                            src: `https://www.youtube.com/embed/${id}`,
                            aspectRatio: '16:9',
                            align: 'center'
                        }
                    },
                    { type: 'paragraph' }
                ])
                .run();
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
            <input
                ref={videoInput}
                type="file"
                accept="video/mp4,video/webm"
                multiple
                className="hidden"
                onChange={handleVideoUpload}
            />

            <EditorHelpText />

            <FloatingMenuBar editor={editor} />

            <MediaFloatingMenu editor={editor} />

            <ColumnsFloatingMenu editor={editor} />

            <SlashCommandMenu
                editor={editor}
                isVisible={isSlashMenuVisible}
                slashPos={slashPos}
                onClose={closeMenu}
                onImageUpload={() => {
                    closeMenu();
                    imageInput.current?.click();
                }}
                onVideoUpload={() => {
                    closeMenu();
                    videoInput.current?.click();
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
