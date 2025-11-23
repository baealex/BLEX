import React, { useEffect, useCallback } from 'react';
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
}

const TiptapEditor: React.FC<TiptapEditorProps> = ({
    name,
    content = '',
    editable = true,
    onChange,
    height = '400px',
    placeholder = '내용을 입력하세요… ㅋ'
}) => {
    const handleChange = useCallback((html: string) => {
        if (onChange) {
            onChange(html);
        }
    }, [onChange]);

    const editor = useEditor({
        extensions: getEditorExtensions(placeholder),
        content,
        editable,
        editorProps: { attributes: { class: 'blog-post-content' } },
        onUpdate: ({ editor }) => {
            handleChange(editor.getHTML());
        }
    });

    const { handleDrop, handlePaste } = useImageUpload(editor);

    useEffect(() => {
        if (!editor) return;

        const handlePasteEvent = (event: ClipboardEvent) => {
            handlePaste(event);
        };

        // document에 paste 이벤트 리스너 추가
        document.addEventListener('paste', handlePasteEvent);

        return () => {
            document.removeEventListener('paste', handlePasteEvent);
        };
    }, [editor, handlePaste]);

    useEffect(() => {
        if (editor && content !== undefined) {
            const currentContent = editor.getHTML();
            if (content !== currentContent && !editor.isFocused) {
                // content를 설정하기 전에 lazy 로딩 관련 내용 모두 제거
                const cleanedContent = content
                    // preview.jpg 제거
                    .replace(/\.preview\.jpg/g, '')
                    // data-src를 src로 변경
                    .replace(/data-src="([^"]+)"/g, 'src="$1"')
                    // lazy 클래스 제거
                    .replace(/class="[^"]*lazy[^"]*"/g, '')
                    .replace(/class="lazy"/g, '')
                    // 비디오에 자동재생 속성 추가
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
            <input
                type="hidden"
                name={name}
                value={editor?.getHTML() || content}
            />

            {editable && <MenuBar editor={editor} />}

            <EditorContent editor={editor} />

            <style jsx global>{`
                .ProseMirror {
                    min-height: ${height};
                }

                .ProseMirror-focused {
                    outline: none;
                }

                /* 드래그 중인 요소 스타일 */
                .ProseMirror figure.ProseMirror-selectednode {
                    position: relative;
                    cursor: grab;
                    outline: 2px solid #3b82f6;
                    outline-offset: 2px;
                    transition: opacity 0.2s;

                    &:hover {
                        opacity: 0.9;
                    }

                    &:active {
                        cursor: grabbing;
                    }
                }
            `}</style>
        </div>
    );
};

export default TiptapEditor;
