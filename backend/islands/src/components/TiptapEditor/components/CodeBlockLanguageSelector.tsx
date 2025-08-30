import React, { useState } from 'react';
import type { Editor } from '@tiptap/react';
import type { NodeViewProps } from '@tiptap/react';

interface CodeBlockLanguageSelectorProps {
    editor: Editor;
    node: NodeViewProps['node'];
    updateAttributes: (attributes: Record<string, unknown>) => void;
}

const LANGUAGES = [
    {
        value: 'plaintext',
        label: 'Plain Text'
    },
    {
        value: 'javascript',
        label: 'JavaScript'
    },
    {
        value: 'typescript',
        label: 'TypeScript'
    },
    {
        value: 'python',
        label: 'Python'
    },
    {
        value: 'java',
        label: 'Java'
    },
    {
        value: 'cpp',
        label: 'C++'
    },
    {
        value: 'c',
        label: 'C'
    },
    {
        value: 'csharp',
        label: 'C#'
    },
    {
        value: 'php',
        label: 'PHP'
    },
    {
        value: 'ruby',
        label: 'Ruby'
    },
    {
        value: 'go',
        label: 'Go'
    },
    {
        value: 'rust',
        label: 'Rust'
    },
    {
        value: 'kotlin',
        label: 'Kotlin'
    },
    {
        value: 'swift',
        label: 'Swift'
    },
    {
        value: 'html',
        label: 'HTML'
    },
    {
        value: 'css',
        label: 'CSS'
    },
    {
        value: 'scss',
        label: 'SCSS'
    },
    {
        value: 'json',
        label: 'JSON'
    },
    {
        value: 'xml',
        label: 'XML'
    },
    {
        value: 'yaml',
        label: 'YAML'
    },
    {
        value: 'markdown',
        label: 'Markdown'
    },
    {
        value: 'bash',
        label: 'Bash'
    },
    {
        value: 'shell',
        label: 'Shell'
    },
    {
        value: 'sql',
        label: 'SQL'
    },
    {
        value: 'dockerfile',
        label: 'Dockerfile'
    }
];

const CodeBlockLanguageSelector: React.FC<CodeBlockLanguageSelectorProps> = ({
    node,
    updateAttributes
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const currentLanguage = node.attrs.language || 'plaintext';

    const handleLanguageChange = (language: string) => {
        updateAttributes({ language });
        setIsOpen(false);
    };

    const getCurrentLanguageLabel = () => {
        const lang = LANGUAGES.find(l => l.value === currentLanguage);
        return lang ? lang.label : 'Plain Text';
    };

    return (
        <div className="relative inline-block text-left">
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="inline-flex items-center px-2 py-1 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                {getCurrentLanguageLabel()}
                <svg className="w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {isOpen && (
                <div className="absolute left-0 z-50 mt-1 w-48 max-h-60 overflow-auto bg-white border border-gray-300 rounded-md shadow-lg">
                    <div className="py-1">
                        {LANGUAGES.map((language) => (
                            <button
                                key={language.value}
                                onClick={() => handleLanguageChange(language.value)}
                                className={`block w-full px-3 py-2 text-left text-xs hover:bg-gray-100 ${currentLanguage === language.value
                                    ? 'bg-blue-50 text-blue-600 font-medium'
                                    : 'text-gray-700'
                                    }`}>
                                {language.label}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default CodeBlockLanguageSelector;
