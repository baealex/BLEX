import type { LanguageFn } from 'highlight.js';

export interface Language {
    value: string;
    label: string;
    loader?: () => Promise<{ default: LanguageFn }>;
}

export const SUPPORTED_LANGUAGES: Language[] = [
    {
        value: 'plaintext',
        label: 'Plain Text'
    },
    {
        value: 'javascript',
        label: 'JavaScript',
        loader: () => import('highlight.js/lib/languages/javascript')
    },
    {
        value: 'typescript',
        label: 'TypeScript',
        loader: () => import('highlight.js/lib/languages/typescript')
    },
    {
        value: 'python',
        label: 'Python',
        loader: () => import('highlight.js/lib/languages/python')
    },
    {
        value: 'java',
        label: 'Java',
        loader: () => import('highlight.js/lib/languages/java')
    },
    {
        value: 'cpp',
        label: 'C++',
        loader: () => import('highlight.js/lib/languages/cpp')
    },
    {
        value: 'c',
        label: 'C',
        loader: () => import('highlight.js/lib/languages/c')
    },
    {
        value: 'csharp',
        label: 'C#',
        loader: () => import('highlight.js/lib/languages/csharp')
    },
    {
        value: 'php',
        label: 'PHP',
        loader: () => import('highlight.js/lib/languages/php')
    },
    {
        value: 'ruby',
        label: 'Ruby',
        loader: () => import('highlight.js/lib/languages/ruby')
    },
    {
        value: 'go',
        label: 'Go',
        loader: () => import('highlight.js/lib/languages/go')
    },
    {
        value: 'rust',
        label: 'Rust',
        loader: () => import('highlight.js/lib/languages/rust')
    },
    {
        value: 'kotlin',
        label: 'Kotlin',
        loader: () => import('highlight.js/lib/languages/kotlin')
    },
    {
        value: 'swift',
        label: 'Swift',
        loader: () => import('highlight.js/lib/languages/swift')
    },
    {
        value: 'html',
        label: 'HTML',
        loader: () => import('highlight.js/lib/languages/xml')
    },
    {
        value: 'css',
        label: 'CSS',
        loader: () => import('highlight.js/lib/languages/css')
    },
    {
        value: 'scss',
        label: 'SCSS',
        loader: () => import('highlight.js/lib/languages/scss')
    },
    {
        value: 'json',
        label: 'JSON',
        loader: () => import('highlight.js/lib/languages/json')
    },
    {
        value: 'xml',
        label: 'XML',
        loader: () => import('highlight.js/lib/languages/xml')
    },
    {
        value: 'yaml',
        label: 'YAML',
        loader: () => import('highlight.js/lib/languages/yaml')
    },
    {
        value: 'markdown',
        label: 'Markdown',
        loader: () => import('highlight.js/lib/languages/markdown')
    },
    {
        value: 'bash',
        label: 'Bash',
        loader: () => import('highlight.js/lib/languages/bash')
    },
    {
        value: 'shell',
        label: 'Shell',
        loader: () => import('highlight.js/lib/languages/bash')
    },
    {
        value: 'sql',
        label: 'SQL',
        loader: () => import('highlight.js/lib/languages/sql')
    },
    {
        value: 'dockerfile',
        label: 'Dockerfile',
        loader: () => import('highlight.js/lib/languages/dockerfile')
    }
];

export function getLanguageLabel(value: string): string {
    const language = SUPPORTED_LANGUAGES.find(lang => lang.value === value);
    return language?.label || 'Plain Text';
}

export function getLanguageLoader(value: string): (() => Promise<{ default: LanguageFn }>) | null {
    const language = SUPPORTED_LANGUAGES.find(lang => lang.value === value);
    return language?.loader || null;
}
