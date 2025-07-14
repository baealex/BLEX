import { BlockNoteView } from '@blocknote/mantine';
import { useCreateBlockNote } from '@blocknote/react';
import { useEffect, useState } from 'react';

interface EditorProps {
    content?: string;
    editable?: boolean;
}

const MarkdownEditor = ({ content = '', editable = true }: EditorProps) => {
    const [html, setHtml] = useState('');
    const [markdown, setMarkdown] = useState(content);

    const editor = useCreateBlockNote();

    const handleEditorChange = async () => {
        const markdown = await editor.blocksToMarkdownLossy(editor.document);
        setMarkdown(markdown);

        const html = await editor.blocksToHTMLLossy(editor.document);
        setHtml(html);
    };

    useEffect(() => {
        const loadMarkdown = async () => {
            if (content) {
                try {
                    const blocks = await editor.tryParseMarkdownToBlocks(content);
                    editor.replaceBlocks(editor.document, blocks);
                } catch (error) {
                    console.error('마크다운 파싱 오류:', error);
                }
            }
        };

        loadMarkdown();
    }, [content, editor]);

    return (
        <>
            <BlockNoteView
                theme="light"
                editor={editor}
                editable={editable}
                onChange={handleEditorChange}
            />
            <input type="hidden" name="text_md" value={markdown} />
            <input type="hidden" name="text_html" value={html} />
        </>
    );
};

export default MarkdownEditor;
