import { lazy, Suspense } from 'react';
import { useLingui } from '@lingui/react/macro';
import { AlertCircle, Loader2 } from '@blex/ui/icons';

const CodeEditorMonaco = lazy(() => import('./CodeEditor.monaco'));

interface CodeEditorProps {
    language?: 'html' | 'javascript' | 'css' | 'plaintext';
    value: string;
    onChange: (value: string) => void;
    height?: string;
    error?: string;
    readOnly?: boolean;
    ariaLabel?: string;
}

export const CodeEditor = ({ error, ...props }: CodeEditorProps) => {
    const { i18n, t } = useLingui();
    const height = props.height ?? '300px';
    const loadingLabel = props.ariaLabel
        ? i18n._({
            id: 'code_editor.loading.labelled',
            message: 'Loading {label}',
            values: { label: props.ariaLabel }
        })
        : t({
            id: 'code_editor.loading.aria',
            message: 'Loading code editor'
        });

    return (
        <div>
            <Suspense
                fallback={
                    <div
                        role="status"
                        aria-live="polite"
                        aria-label={loadingLabel}
                        className="flex flex-col items-center justify-center gap-4 rounded-lg border border-line bg-surface-subtle px-6 text-content-secondary"
                        style={{ height }}>
                        <span className="flex items-center gap-2 text-sm font-medium">
                            <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin motion-reduce:animate-none" />
                            {t({
                                id: 'code_editor.loading.visible',
                                message: 'Loading code editor...'
                            })}
                        </span>
                        <span aria-hidden="true" className="w-full max-w-md space-y-2">
                            <span className="block h-2 w-full animate-pulse rounded bg-line motion-reduce:animate-none" />
                            <span className="block h-2 w-4/5 animate-pulse rounded bg-line motion-reduce:animate-none" />
                            <span className="block h-2 w-3/5 animate-pulse rounded bg-line motion-reduce:animate-none" />
                        </span>
                    </div>
                }>
                <CodeEditorMonaco {...props} />
            </Suspense>
            {error && (
                <div role="alert" className="mt-1.5 flex items-center gap-1.5 text-sm text-danger">
                    <AlertCircle aria-hidden="true" className="h-4 w-4 shrink-0" />
                    {error}
                </div>
            )}
        </div>
    );
};
