import { ReactNodeViewRenderer } from '@tiptap/react';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { CodeBlockNodeView } from '../components/CodeBlockNodeView';

export const CodeBlockWithLanguageSelector = CodeBlockLowlight.extend({
    name: 'codeBlock',

    addNodeView() {
        return ReactNodeViewRenderer(CodeBlockNodeView);
    }
});
