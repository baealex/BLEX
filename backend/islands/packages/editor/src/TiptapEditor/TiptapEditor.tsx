import { useEffect, useCallback, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import MenuBar from './components/menus/MenuBar';
import { getEditorExtensions } from './config/editorConfig';
import { useImageUpload } from './hooks/useImageUpload';
import { useMarkdownPaste, detectMarkdownPatterns } from './hooks/useMarkdownPaste';

interface TiptapEditorProps {
    name: string;
    content?: string;
    editable?: boolean;
    onChange?: (value: string) => void;
    height?: string;
    placeholder?: string;
    onImageUpload?: (file: File) => Promise<string | undefined>;
    onImageUploadError?: (errorMessage: string) => void;
}

interface HandlersRef {
    handleMarkdownPaste: (text: string) => Promise<boolean>;
    handleImagePaste: (event: ClipboardEvent) => void;
}

const TiptapEditor = ({
    name,
    content = '',
    editable = true,
    onChange,
    height = 'auto',
    placeholder = '내용을 입력하세요…',
    onImageUpload,
    onImageUploadError
}: TiptapEditorProps) => {
    const handleChange = useCallback((html: string) => {
        if (onChange) {
            onChange(html);
        }
    }, [onChange]);

    const handlersRef = useRef<HandlersRef>({
        handleMarkdownPaste: async () => false,
        handleImagePaste: () => {}
    });

    const editor = useEditor({
        extensions: getEditorExtensions(placeholder),
        content,
        editable,
        editorProps: {
            attributes: { class: 'blog-post-content' },
            handlePaste: (view, event, slice) => {
                void view;
                void slice;
                const text = event.clipboardData?.getData('text/plain');
                const items = event.clipboardData?.items;

                if (items) {
                    for (let i = 0; i < items.length; i++) {
                        if (items[i].type.startsWith('image/')) {
                            handlersRef.current.handleImagePaste(event);
                            return true;
                        }
                    }
                }

                if (text && detectMarkdownPatterns(text)) {
                    handlersRef.current.handleMarkdownPaste(text);
                    return true;
                }

                return false;
            }
        },
        onUpdate: ({ editor }) => {
            handleChange(editor.getHTML());
        }
    });

    const { handleDrop, handlePaste: handleImagePaste } = useImageUpload({
        editor,
        onImageUpload,
        onImageUploadError
    });

    const {
        pasteState,
        handleMarkdownPaste,
        insertAsHtml,
        insertAsText,
        closeModal
    } = useMarkdownPaste({ editor });

    useEffect(() => {
        handlersRef.current = {
            handleMarkdownPaste,
            handleImagePaste
        };
    }, [handleMarkdownPaste, handleImagePaste]);

    useEffect(() => {
        if (editor && content !== undefined) {
            const currentContent = editor.getHTML();
            if (content !== currentContent && !editor.isFocused) {
                const cleanedContent = content
                    .replace(/\.preview\.jpg/g, '')
                    .replace(/data-src="([^"]+)"/g, 'src="$1"')
                    .replace(/class="[^"]*lazy[^"]*"/g, '')
                    .replace(/class="lazy"/g, '')
                    .replace(/<video([^>]*)>/g, '<video$1 autoplay muted loop playsinline>');

                editor.commands.setContent(cleanedContent, { emitUpdate: false });
            }
        }
    }, [editor, content]);

    return (
        <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            style={{ minHeight: height }}>
            <input type="hidden" name={name} value={editor?.getHTML() || content} />

            {editable && (
                <MenuBar
                    editor={editor}
                    onImageUpload={onImageUpload}
                    onImageUploadError={onImageUploadError}
                    pasteState={pasteState}
                    onInsertHtml={insertAsHtml}
                    onInsertText={insertAsText}
                    onCloseModal={closeModal}
                />
            )}

            <EditorContent editor={editor} />

            <style>{`
                .ProseMirror { min-height: ${height}; }
                .ProseMirror-focused { outline: none; }
                .ProseMirror p.is-editor-empty:first-child::before {
                    content: '${placeholder}';
                    float: left;
                    color: #adb5bd;
                    pointer-events: none;
                    height: 0;
                }
                .ProseMirror figure.ProseMirror-selectednode {
                    position: relative;
                    cursor: grab;
                    outline: 2px solid #3b82f6;
                    outline-offset: 2px;
                    transition: opacity 0.2s;
                    &:hover { opacity: 0.9; }
                    &:active { cursor: grabbing; }
                }
            `}</style>
        </div>
    );
};

export default TiptapEditor;
