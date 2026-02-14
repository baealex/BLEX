import Editor from '@monaco-editor/react';

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
    return (
        <div className="rounded-lg border border-gray-200 overflow-hidden focus-within:border-black/30 focus-within:ring-2 focus-within:ring-black/5 transition-all">
            <Editor
                height={height}
                language={language}
                value={value}
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
