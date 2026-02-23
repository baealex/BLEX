import Editor from '@monaco-editor/react';
import { useResolvedTheme } from '~/hooks/useResolvedTheme';

interface CodeEditorMonacoProps {
    language?: 'html' | 'javascript' | 'css';
    value: string;
    onChange: (value: string) => void;
    height?: string;
    readOnly?: boolean;
}

const CodeEditorMonaco = ({
    language = 'html',
    value,
    onChange,
    height = '300px',
    readOnly
}: CodeEditorMonacoProps) => {
    const resolvedTheme = useResolvedTheme();

    return (
        <div className="rounded-lg border border-line overflow-hidden focus-within:border-line-strong/30 focus-within:ring-2 focus-within:ring-line/5 transition-all">
            <Editor
                height={height}
                language={language}
                value={value}
                theme={resolvedTheme === 'dark' ? 'vs-dark' : 'vs'}
                onChange={(v) => onChange(v ?? '')}
                options={{
                    minimap: { enabled: false },
                    wordWrap: 'on',
                    fontSize: 13,
                    tabSize: 2,
                    lineNumbersMinChars: 3,
                    scrollBeyondLastLine: false,
                    automaticLayout: true,
                    readOnly,
                    padding: {
                        top: 8,
                        bottom: 8
                    },
                    renderLineHighlightOnlyWhenFocus: true,
                    overviewRulerLanes: 0,
                    hideCursorInOverviewRuler: true,
                    scrollbar: {
                        verticalScrollbarSize: 8,
                        horizontalScrollbarSize: 8
                    }
                }}
            />
        </div>
    );
};

export default CodeEditorMonaco;
