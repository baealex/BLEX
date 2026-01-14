import { useState } from 'react';
import type { Editor } from '@tiptap/react';

interface UseMarkdownPasteProps {
    editor: Editor | null;
}

interface MarkdownPasteState {
    isOpen: boolean;
    markdown: string;
    html: string;
}

export const detectMarkdownPatterns = (text: string): boolean => {
    const patterns = [
        /^#{1,6}\s+.+/m,
        /\*\*[^*]+\*\*/,
        /\*[^*]+\*/,
        /^\s*[-*+]\s+.+/m,
        /^\s*\d+\.\s+.+/m,
        /^\s*>\s+.+/m,
        /```[\s\S]*```/,
        /`[^`]+`/,
        /\[.+\]\(.+\)/,
        /!\[.*\]\(.+\)/,
        /^\s*---\s*$/m,
        /^\|.+\|$/m
    ];

    let score = 0;
    for (const pattern of patterns) {
        if (pattern.test(text)) {
            score++;
        }
    }

    return score >= 2;
};

export const useMarkdownPaste = ({ editor }: UseMarkdownPasteProps) => {
    const [pasteState, setPasteState] = useState<MarkdownPasteState>({
        isOpen: false,
        markdown: '',
        html: ''
    });

    const convertMarkdownToHtml = async (markdown: string): Promise<string | null> => {
        try {
            const response = await fetch('/v1/markdown', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: markdown })
            });

            if (!response.ok) {
                return null;
            }

            const data = await response.json();
            return data.body?.html || null;
        } catch {
            return null;
        }
    };

    const handleMarkdownPaste = async (text: string): Promise<boolean> => {
        if (!editor || !text) return false;

        if (detectMarkdownPatterns(text)) {
            const html = await convertMarkdownToHtml(text);

            if (html) {
                setPasteState({
                    isOpen: true,
                    markdown: text,
                    html
                });
            } else {
                editor.chain().focus().insertContent(text).run();
            }
            return true;
        }

        return false;
    };

    const insertAsHtml = () => {
        if (!editor || !pasteState.html) return;

        editor.chain().focus().insertContent(pasteState.html).run();
        setPasteState({
            isOpen: false,
            markdown: '',
            html: ''
        });
    };

    const insertAsText = () => {
        if (!editor || !pasteState.markdown) return;

        editor.chain().focus().insertContent(pasteState.markdown).run();
        setPasteState({
            isOpen: false,
            markdown: '',
            html: ''
        });
    };

    const closeModal = () => {
        setPasteState({
            isOpen: false,
            markdown: '',
            html: ''
        });
    };

    return {
        pasteState,
        handleMarkdownPaste,
        insertAsHtml,
        insertAsText,
        closeModal
    };
};
