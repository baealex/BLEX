import { useEffect, useRef, useState } from 'react';
import type { Editor } from '@tiptap/react';
import YoutubeModal from '../modals/YoutubeModal';
import FloatingMenuBar from './FloatingMenuBar';
import MediaFloatingMenu from './MediaFloatingMenu';
import ColumnsFloatingMenu from './ColumnsFloatingMenu';
import SlashCommandMenu from './SlashCommandMenu';
import EditorHelpText from '../ui/EditorHelpText';
import { useImageUpload } from '../../hooks/useImageUpload';
import { useSlashCommand } from '../../hooks/useSlashCommand';
import {
    ACCEPTED_IMAGE_INPUT_TYPES,
    ACCEPTED_VIDEO_INPUT_TYPES
} from '../../config/mediaUpload';

interface MenuBarProps {
    editor: Editor | null;
    onImageUpload?: (file: File) => Promise<string | undefined>;
    onImageUploadError?: (errorMessage: string) => void;
    onUploadStateChange?: (isUploading: boolean) => void;
}

const MenuBar = ({
    editor,
    onImageUpload,
    onImageUploadError,
    onUploadStateChange
}: MenuBarProps) => {
    const [isYoutubeModalOpen, setIsYoutubeModalOpen] = useState(false);
    const imageInput = useRef<HTMLInputElement>(null);
    const videoInput = useRef<HTMLInputElement>(null);
    const { handleImageUpload, handleVideoUpload, isUploading } = useImageUpload({
        editor,
        onImageUpload,
        onImageUploadError
    });
    const { isVisible: isSlashMenuVisible, slashPos, closeMenu } = useSlashCommand(editor);

    useEffect(() => {
        onUploadStateChange?.(isUploading);
        return () => onUploadStateChange?.(false);
    }, [isUploading, onUploadStateChange]);

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
                accept={ACCEPTED_IMAGE_INPUT_TYPES}
                multiple
                className="hidden"
                onChange={handleImageUpload}
            />
            <input
                ref={videoInput}
                type="file"
                accept={ACCEPTED_VIDEO_INPUT_TYPES}
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
        </>
    );
};

export default MenuBar;
