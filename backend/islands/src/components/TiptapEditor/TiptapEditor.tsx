import React, { useEffect, useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import MenuBar from './components/MenuBar';
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
    placeholder = '마크다운으로 작성할 수 있어요...'
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

    const { handleDrop } = useImageUpload(editor);

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

            <EditorContent
                className="overflow-hidden break-words"
                editor={editor}
            />
            <style jsx global>{`
                .ProseMirror {
                    min-height: ${height};
                }

                .ProseMirror-focused {
                    outline: none;
                }

            `}</style>
        </div>
    );
};

export default TiptapEditor;
