import React from 'react';
import { NodeViewWrapper, NodeViewContent } from '@tiptap/react';
import type { NodeViewProps } from '@tiptap/react';
import CodeBlockLanguageSelector from './CodeBlockLanguageSelector';

export const CodeBlockNodeView: React.FC<NodeViewProps> = ({
    node,
    updateAttributes,
    editor
}) => {
    return (
        <NodeViewWrapper className="code-block-wrapper">
            <div className="code-block-header">
                <CodeBlockLanguageSelector
                    editor={editor}
                    node={node}
                    updateAttributes={updateAttributes}
                />
            </div>
            <pre className={`hljs language-${node.attrs.language || 'plaintext'}`}>
                <NodeViewContent />
            </pre>
        </NodeViewWrapper>
    );
};
