import { NodeViewWrapper, NodeViewContent } from '@tiptap/react';
import type { NodeViewProps } from '@tiptap/react';
import CodeBlockLanguageSelector from './CodeBlockLanguageSelector';
import CodeBlockCopyButton from './CodeBlockCopyButton';

export const CodeBlockNodeView = ({
    node,
    updateAttributes,
    editor
}: NodeViewProps) => {
    const code = node.textContent;

    return (
        <NodeViewWrapper className="code-block-wrapper">
            <div className="code-block-header">
                <CodeBlockLanguageSelector
                    editor={editor}
                    node={node}
                    updateAttributes={updateAttributes}
                />
                <CodeBlockCopyButton code={code} />
            </div>
            <pre className={`hljs language-${node.attrs.language || 'plaintext'}`}>
                <NodeViewContent />
            </pre>
        </NodeViewWrapper>
    );
};
