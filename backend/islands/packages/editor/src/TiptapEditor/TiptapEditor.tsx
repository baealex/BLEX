import { useEffect, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import MenuBar from './components/menus/MenuBar';
import { getEditorExtensions } from './config/editorConfig';
import { useImageUpload } from './hooks/useImageUpload';

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
    const handleChange = (html: string) => {
        if (onChange) {
            onChange(html);
        }
    };

    const handlersRef = useRef<HandlersRef>({ handleImagePaste: () => {} });

    const editor = useEditor({
        extensions: getEditorExtensions(placeholder),
        content,
        editable,
        editorProps: {
            attributes: { class: 'blog-post-content' },
            handleDrop: (view, event, _slice, moved) => {
                // 외부 파일 드롭은 React onDrop(useImageUpload)에서 처리
                if (!moved) return false;

                const coords = {
                    left: event.clientX,
                    top: event.clientY
                };
                const posInfo = view.posAtCoords(coords);
                if (!posInfo) return false;

                const $pos = view.state.doc.resolve(posInfo.pos);

                // columns 구조 내에서 드롭 위치 확인
                for (let d = $pos.depth; d >= 0; d--) {
                    // column 안이면 ProseMirror가 정상 처리
                    if ($pos.node(d).type.name === 'column') return false;
                    // columns 컨테이너 레벨이면 차단 (새 column 생성 방지)
                    if ($pos.node(d).type.name === 'columns') return true;
                }

                return false;
            },
            handlePaste: (view, event, slice) => {
                void view;
                void slice;
                const items = event.clipboardData?.items;

                if (items) {
                    for (let i = 0; i < items.length; i++) {
                        if (items[i].type.startsWith('image/')) {
                            handlersRef.current.handleImagePaste(event);
                            return true;
                        }
                    }
                }

                return false;
            }
        },
        onUpdate: ({ editor }) => {
            handleChange(editor.getHTML());
        }
    });

    const { handleDrop, handlePaste: handleImagePaste, isUploading } = useImageUpload({
        editor,
        onImageUpload,
        onImageUploadError
    });

    useEffect(() => {
        handlersRef.current = { handleImagePaste };
    }, [handleImagePaste]);

    useEffect(() => {
        if (editor && content !== undefined) {
            const currentContent = editor.getHTML();
            if (content !== currentContent && !editor.isFocused) {
                const cleanedContent = content
                    .replace(/\.preview\.jpg/g, '')
                    .replace(/data-src="([^"]+)"/g, 'src="$1"')
                    .replace(/class="[^"]*lazy[^"]*"/g, '')
                    .replace(/class="lazy"/g, '');

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
                />
            )}

            <EditorContent editor={editor} />

            {isUploading && (
                <div className="flex items-center gap-2 px-3 py-2 text-sm text-content-secondary bg-surface-subtle rounded-lg mt-2 animate-pulse border border-line-light">
                    <div className="w-4 h-4 border-2 border-line border-t-content-secondary rounded-full animate-spin" />
                    <span>파일 업로드 중...</span>
                </div>
            )}

            <style>{`
                .ProseMirror { min-height: ${height}; }
                .ProseMirror-focused { outline: none; }
                .ProseMirror p.is-editor-empty:first-child::before {
                    content: '${placeholder}';
                    float: left;
                    color: var(--color-content-hint);
                    pointer-events: none;
                    height: 0;
                }
                .ProseMirror figure.ProseMirror-selectednode {
                    position: relative;
                    cursor: grab;
                    outline: 2px solid var(--color-mention-content);
                    outline-offset: 2px;
                    transition: opacity 0.2s;
                    &:hover { opacity: 0.9; }
                    &:active { cursor: grabbing; }
                }
                .code-block-wrapper .code-block-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .code-copy-button {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    padding: 4px;
                    background: transparent;
                    border: 1px solid var(--color-line);
                    border-radius: 4px;
                    color: var(--color-content-secondary);
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .code-copy-button:hover {
                    background: var(--color-line-light);
                    color: var(--color-content);
                    border-color: var(--color-line-strong);
                }
                .code-copy-button:active {
                    transform: scale(0.95);
                }
                .code-copy-button svg {
                    width: 16px;
                    height: 16px;
                }
                /* Columns styles */
                .ProseMirror div[data-type="columns"] {
                    margin: 16px 0;
                    border-radius: 8px;
                }
                .ProseMirror div[data-type="columns"] > div[data-type="column"] {
                    padding: 12px;
                    background: var(--color-surface-subtle);
                    border-radius: 8px;
                    border: 1px dashed var(--color-line);
                    min-height: 80px;
                }
                .ProseMirror div[data-type="columns"] > div[data-type="column"]:focus-within {
                    border-color: var(--color-mention-content);
                    background: var(--color-mention-surface);
                }
                .ProseMirror div[data-type="columns"] > div[data-type="column"] > *:first-child {
                    margin-top: 0;
                }
                .ProseMirror div[data-type="columns"] > div[data-type="column"] > *:last-child {
                    margin-bottom: 0;
                }
                /* Responsive columns */
                @media (max-width: 640px) {
                    .ProseMirror div[data-type="columns"] {
                        display: flex !important;
                        flex-direction: column !important;
                    }
                    .ProseMirror div[data-type="columns"] > div[data-type="column"] {
                        width: 100% !important;
                    }
                }
            `}</style>
        </div>
    );
};

export default TiptapEditor;
