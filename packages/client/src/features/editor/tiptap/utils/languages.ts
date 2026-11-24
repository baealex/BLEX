import type { LanguageFn } from 'highlight.js';
import hljs from 'highlight.js/lib/core';

export interface Language {
    value: string;
    label: string;
    /** Other names highlight.js gives the language. Markdown fences often use them, such as `ts` for TypeScript. */
    aliases?: readonly string[];
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
        aliases: ['js', 'jsx', 'mjs', 'cjs'],
        loader: () => import('highlight.js/lib/languages/javascript')
    },
    {
        value: 'typescript',
        label: 'TypeScript',
        aliases: ['ts', 'tsx', 'mts', 'cts'],
        loader: () => import('highlight.js/lib/languages/typescript')
    },
    {
        value: 'python',
        label: 'Python',
        aliases: ['py', 'gyp', 'ipython'],
        loader: () => import('highlight.js/lib/languages/python')
    },
    {
        value: 'java',
        label: 'Java',
        aliases: ['jsp'],
        loader: () => import('highlight.js/lib/languages/java')
    },
    {
        value: 'cpp',
        label: 'C++',
        aliases: ['cc', 'hpp', 'hh', 'hxx', 'cxx'],
        loader: () => import('highlight.js/lib/languages/cpp')
    },
    {
        value: 'c',
        label: 'C',
        aliases: ['h'],
        loader: () => import('highlight.js/lib/languages/c')
    },
    {
        value: 'csharp',
        label: 'C#',
        aliases: ['cs'],
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
        aliases: ['rb', 'gemspec', 'podspec', 'thor', 'irb'],
        loader: () => import('highlight.js/lib/languages/ruby')
    },
    {
        value: 'go',
        label: 'Go',
        aliases: ['golang'],
        loader: () => import('highlight.js/lib/languages/go')
    },
    {
        value: 'rust',
        label: 'Rust',
        aliases: ['rs'],
        loader: () => import('highlight.js/lib/languages/rust')
    },
    {
        value: 'kotlin',
        label: 'Kotlin',
        aliases: ['kt', 'kts'],
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
        aliases: ['jsonc'],
        loader: () => import('highlight.js/lib/languages/json')
    },
    {
        value: 'xml',
        label: 'XML',
        aliases: ['xhtml', 'rss', 'atom', 'xjb', 'xsd', 'xsl', 'plist', 'wsf', 'svg'],
        loader: () => import('highlight.js/lib/languages/xml')
    },
    {
        value: 'yaml',
        label: 'YAML',
        aliases: ['yml'],
        loader: () => import('highlight.js/lib/languages/yaml')
    },
    {
        value: 'markdown',
        label: 'Markdown',
        aliases: ['md', 'mkdown', 'mkd'],
        loader: () => import('highlight.js/lib/languages/markdown')
    },
    {
        value: 'bash',
        label: 'Bash',
        aliases: ['sh', 'zsh'],
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
        aliases: ['docker'],
        loader: () => import('highlight.js/lib/languages/dockerfile')
    }
];

function findLanguage(value: string): Language | undefined {
    return (
        SUPPORTED_LANGUAGES.find((lang) => lang.value === value) ??
        SUPPORTED_LANGUAGES.find((lang) => lang.aliases?.includes(value))
    );
}

export function getLanguageLabel(value: string): string {
    return findLanguage(value)?.label || 'Plain Text';
}

export function getLanguageLoader(value: string): (() => Promise<{ default: LanguageFn }>) | null {
    return findLanguage(value)?.loader || null;
}

export function registerLanguage(name: string, languageFn: LanguageFn): void {
    hljs.registerLanguage(name, languageFn);
}

export function highlightElement(element: HTMLElement): void {
    hljs.highlightElement(element);
}
