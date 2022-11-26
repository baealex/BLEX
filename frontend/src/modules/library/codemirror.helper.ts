export async function getMode(language: string) {
    try {
        switch (language) {
            case 'shell':
            case 'bash':
            case 'dash':
            case 'zsh':
            case 'sh':
                await import('codemirror/mode/shell/shell'!);
                return 'shell';
            case 'c':
            case 'cpp':
            case 'java':
                await import('codemirror/mode/clike/clike'!);
                return 'clike';
            case 'js':
            case 'ts':
            case 'javascript':
            case 'typescript':
                await import('codemirror/mode/javascript/javascript'!);
                return 'javascript';
            case 'php':
                await import('codemirror/mode/php/php'!);
                return 'php';
            case 'py':
            case 'python':
                await import('codemirror/mode/python/python'!);
                return 'python';
            case 'rs':
            case 'rust':
                await import('codemirror/mode/rust/rust'!);
                return 'rust';
            case 'css':
                await import('codemirror/mode/css/css'!);
                return 'css';
            case 'sass':
            case 'scss':
                await import('codemirror/mode/sass/sass'!);
                return 'sass';
            case 'yml':
            case 'yaml':
                await import('codemirror/mode/yaml/yaml'!);
                return 'yaml';
            case 'docker':
            case 'dockerfile':
                await import('codemirror/mode/dockerfile/dockerfile'!);
                return 'dockerfile';
            case 'sql':
                await import('codemirror/mode/sql/sql'!);
                return 'sql';
            case 'html':
            case 'react':
            case 'vue':
            case 'jsx':
            case 'xml':
                await import('codemirror/mode/jsx/jsx'!);
                return 'jsx';
            default:
                return 'plain';
        }
    } catch (e) {
        return 'plain';
    }
}
