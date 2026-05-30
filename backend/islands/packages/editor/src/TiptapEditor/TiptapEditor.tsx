import { useEffect, useRef, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import MenuBar from './components/menus/MenuBar';
import { getEditorExtensions } from './config/editorConfig';
import { hasProseMirrorSliceData } from './config/mediaUpload';
import { useImageUpload } from './hooks/useImageUpload';
import { normalizeMediaUrlsInHtml } from './utils/mediaUrls';

interface TiptapEditorProps {
    name: string;
    content?: string;
    editable?: boolean;
    onChange?: (value: string) => void;
    height?: string;
    placeholder?: string;
    onImageUpload?: (file: File) => Promise<string | undefined>;
    onImageUploadError?: (errorMessage: string) => void;
    onUploadStateChange?: (isUploading: boolean) => void;
}

interface HandlersRef {
    handleImagePaste: (event: ClipboardEvent) => void;
    handleMediaDrop: (
        event: DragEvent,
        position?: number,
        options?: { invalidPositionMessage?: string }
    ) => boolean;
}

const removeUploadPlaceholders = (html: string) => {
    return html.replace(/<div[^>]*data-upload-placeholder="true"[^>]*>[\s\S]*?<\/div>/g, '');
};

const mayContainExternalMediaReference = (dataTransfer: DataTransfer) => {
    const types = Array.from(dataTransfer.types ?? []);
    return types.includes('text/html')
        || types.includes('text/uri-list')
        || types.includes('text/plain');
};

const TiptapEditor = ({
    name,
    content = '',
    editable = true,
    onChange,
    height = 'auto',
    placeholder = '내용을 입력하세요…',
    onImageUpload,
    onImageUploadError,
    onUploadStateChange
}: TiptapEditorProps) => {
    const handleChange = (html: string) => {
        if (onChange) {
            onChange(normalizeMediaUrlsInHtml(html));
        }
    };

    const handlersRef = useRef<HandlersRef>({
        handleImagePaste: () => {},
        handleMediaDrop: () => false
    });
    const [isMenuUploading, setIsMenuUploading] = useState(false);

    const editor = useEditor({
        extensions: getEditorExtensions(placeholder),
        content,
        editable,
        editorProps: {
            attributes: { class: 'prose prose-lg max-w-none blog-post-content' },
            handleDOMEvents: {
                drop: (view, event) => {
                    const dataTransfer = event.dataTransfer;
                    if (
                        !dataTransfer
                        || dataTransfer.files.length > 0
                        || view.dragging
                        || hasProseMirrorSliceData(dataTransfer)
                        || !mayContainExternalMediaReference(dataTransfer)
                    ) {
                        return false;
                    }

                    const posInfo = view.posAtCoords({
                        left: event.clientX,
                        top: event.clientY
                    });

                    return handlersRef.current.handleMediaDrop(event, posInfo?.pos);
                }
            },
            handleDrop: (view, event, _slice, moved) => {
                const coords = {
                    left: event.clientX,
                    top: event.clientY
                };
                const posInfo = view.posAtCoords(coords);
                const isInternalDrag = Boolean(view.dragging);
                let isColumnsContainerDrop = false;

                if (posInfo) {
                    const $pos = view.state.doc.resolve(posInfo.pos);
                    let isInsideColumn = false;
                    let isInsideColumns = false;

                    // columns 구조 내에서 드롭 위치 확인
                    for (let d = $pos.depth; d >= 0; d--) {
                        // column 안이면 ProseMirror가 정상 처리
                        if ($pos.node(d).type.name === 'column') {
                            isInsideColumn = true;
                            break;
                        }
                        // columns 컨테이너 레벨이면 차단 (새 column 생성 방지)
                        if ($pos.node(d).type.name === 'columns') {
                            isInsideColumns = true;
                            break;
                        }
                    }

                    isColumnsContainerDrop = isInsideColumns && !isInsideColumn;
                }

                if (isColumnsContainerDrop) {
                    if (isInternalDrag || moved) return true;
                    return handlersRef.current.handleMediaDrop(
                        event,
                        posInfo?.pos,
                        { invalidPositionMessage: '컬럼 안쪽에 파일을 내려놓아 주세요.' }
                    );
                }

                if (isInternalDrag || moved) return false;

                if (handlersRef.current.handleMediaDrop(event, posInfo?.pos)) {
                    return true;
                }

                return false;
            },
            handlePaste: (view, event, slice) => {
                void view;
                void slice;
                const items = event.clipboardData?.items;

                if (items) {
                    for (let i = 0; i < items.length; i++) {
                        if (items[i].type.startsWith('image/') || items[i].type.startsWith('video/')) {
                            handlersRef.current.handleImagePaste(event);
                            return true;
                        }
                    }
                }

                return false;
            }
        },
        onUpdate: ({ editor }) => {
            handleChange(removeUploadPlaceholders(editor.getHTML()));
        }
    });

    const {
        handleDrop: handleMediaDrop,
        handlePaste: handleImagePaste,
        isUploading,
        uploadingCount
    } = useImageUpload({
        editor,
        onImageUpload,
        onImageUploadError
    });
    const isEditorUploading = isUploading || isMenuUploading;

    useEffect(() => {
        onUploadStateChange?.(isEditorUploading);
        return () => onUploadStateChange?.(false);
    }, [isEditorUploading, onUploadStateChange]);

    useEffect(() => {
        handlersRef.current = {
            handleImagePaste,
            handleMediaDrop
        };
    }, [handleImagePaste, handleMediaDrop]);

    useEffect(() => {
        if (!editor) return;

        const handleExternalMediaDrop = (event: DragEvent) => {
            const dataTransfer = event.dataTransfer;
            if (
                !dataTransfer
                || dataTransfer.files.length > 0
                || editor.view.dragging
                || hasProseMirrorSliceData(dataTransfer)
                || !mayContainExternalMediaReference(dataTransfer)
            ) {
                return;
            }

            const posInfo = editor.view.posAtCoords({
                left: event.clientX,
                top: event.clientY
            });

            handlersRef.current.handleMediaDrop(event, posInfo?.pos);
        };

        editor.view.dom.addEventListener('drop', handleExternalMediaDrop, { capture: true });

        return () => {
            editor.view.dom.removeEventListener('drop', handleExternalMediaDrop, { capture: true });
        };
    }, [editor]);

    useEffect(() => {
        if (editor && content !== undefined) {
            const currentContent = removeUploadPlaceholders(editor.getHTML());
            if (content !== currentContent && !editor.isFocused) {
                const cleanedContent = normalizeMediaUrlsInHtml(content)
                    .replace(/\.preview\.jpg/g, '')
                    .replace(/data-src="([^"]+)"/g, 'src="$1"')
                    .replace(/class="[^"]*lazy[^"]*"/g, '')
                    .replace(/class="lazy"/g, '');

                editor.commands.setContent(cleanedContent, { emitUpdate: false });
            }
        }
    }, [editor, content]);

    return (
        <div style={{ minHeight: height }}>
            <input
                type="hidden"
                name={name}
                value={normalizeMediaUrlsInHtml(editor ? removeUploadPlaceholders(editor.getHTML()) : content)}
            />

            {editable && (
                <MenuBar
                    editor={editor}
                    onImageUpload={onImageUpload}
                    onImageUploadError={onImageUploadError}
                    onUploadStateChange={setIsMenuUploading}
                />
            )}

            <EditorContent editor={editor} />

            {isEditorUploading && (
                <div
                    role="status"
                    aria-live="polite"
                    className="flex items-center gap-2 px-3 py-2 text-sm text-content-secondary bg-surface-subtle rounded-lg mt-2 animate-pulse border border-line-light">
                    <div className="w-4 h-4 border-2 border-line border-t-content-secondary rounded-full animate-spin" />
                    <span>{uploadingCount > 1 ? `파일 ${uploadingCount}개 업로드 중...` : '파일 업로드 중...'}</span>
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
                .ProseMirror .media-upload-placeholder {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    margin: 16px 0;
                    padding: 14px 16px;
                    border: 1px dashed var(--color-line);
                    border-radius: 8px;
                    color: var(--color-content-secondary);
                    background: var(--color-surface-subtle);
                    font-size: 14px;
                    line-height: 1.4;
                }
                .ProseMirror .media-upload-placeholder__spinner {
                    width: 16px;
                    height: 16px;
                    flex: 0 0 auto;
                    border: 2px solid var(--color-line);
                    border-top-color: var(--color-content-secondary);
                    border-radius: 9999px;
                    animation: media-upload-spin 0.8s linear infinite;
                }
                .ProseMirror .media-upload-placeholder__text {
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }
                @keyframes media-upload-spin {
                    to { transform: rotate(360deg); }
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
