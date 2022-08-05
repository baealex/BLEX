export async function getMode(language: string) {
    switch (language) {
        case 'shell':
        case 'bash':
        case 'dash':
        case 'zsh':
        case 'sh':
            await import('codemirror/mode/shell/shell' as any);
            return 'shell';
        case 'c':
        case 'cpp':
        case 'java':
            await import('codemirror/mode/clike/clike' as any);
            return 'clike';
        case 'js':
        case 'ts':
        case 'javascript':
        case 'typescript':
            await import('codemirror/mode/javascript/javascript' as any);
            return 'javascript';
        case 'php':
            await import('codemirror/mode/php/php' as any);
            return 'php';
        case 'py':
        case 'python':
            await import('codemirror/mode/python/python' as any);
            return 'python';
        case 'rs':
        case 'rust':
            await import('codemirror/mode/rust/rust' as any);
            return 'rust';
        case 'css':
            await import('codemirror/mode/css/css' as any);
            return 'css';
        case 'sass':
        case 'scss':
            await import('codemirror/mode/sass/sass' as any);
            return 'sass';
        case 'yml':
        case 'yaml':
            await import('codemirror/mode/yaml/yaml' as any);
            return 'yaml';
        case 'docker':
        case 'dockerfile':
            await import('codemirror/mode/dockerfile/dockerfile' as any);
            return 'dockerfile';
        case 'sql':
            await import('codemirror/mode/sql/sql' as any);
            return 'sql';
        case 'jsx':
        case 'react':
        case 'xml':
        case 'html':
        case 'vue':
            await import('codemirror/mode/jsx/jsx' as any);
            return 'jsx';
        default:
            return 'plain';
    }
}
