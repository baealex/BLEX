import { lazy, Suspense } from 'react';

const CodeEditorMonaco = lazy(() => import('./CodeEditor.monaco'));

interface CodeEditorProps {
    language?: 'html' | 'javascript' | 'css';
    value: string;
    onChange: (value: string) => void;
    height?: string;
    error?: string;
    readOnly?: boolean;
}

export const CodeEditor = ({ error, ...props }: CodeEditorProps) => {
    const height = props.height ?? '300px';

    return (
        <div>
            <Suspense
                fallback={
                    <div
                        className="rounded-lg border border-gray-200 bg-gray-50 animate-pulse"
                        style={{ height }}
                    />
                }>
                <CodeEditorMonaco {...props} />
            </Suspense>
            {error && (
                <div className="flex items-center gap-1.5 mt-1.5 text-red-600 text-sm">
                    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {error}
                </div>
            )}
        </div>
    );
};
