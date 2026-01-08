import React, { useState } from 'react';
import { NodeViewWrapper, NodeViewContent } from '@tiptap/react';
import type { NodeViewProps } from '@tiptap/react';
import CodeBlockLanguageSelector from './CodeBlockLanguageSelector';

export const CodeBlockNodeView = ({
    node,
    updateAttributes,
    editor
}: NodeViewProps) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        const code = node.textContent;
        try {
            await navigator.clipboard.writeText(code);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy code:', err);
        }
    };

    return (
        <NodeViewWrapper className="code-block-wrapper">
            <div className="code-block-header">
                <CodeBlockLanguageSelector
                    editor={editor}
                    node={node}
                    updateAttributes={updateAttributes}
                />
                <button
                    type="button"
                    onClick={handleCopy}
                    className="copy-code-button"
                    aria-label="코드 복사"
                    title={copied ? '복사됨!' : '코드 복사'}
                >
                    {copied ? (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                        </svg>
                    ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                    )}
                    <span className="copy-text">{copied ? '복사됨!' : '복사'}</span>
                </button>
            </div>
            <pre className={`hljs language-${node.attrs.language || 'plaintext'}`}>
                <NodeViewContent />
            </pre>
        </NodeViewWrapper>
    );
};
