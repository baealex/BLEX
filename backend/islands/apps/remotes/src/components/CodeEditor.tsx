import { useId } from 'react';
import { AlertCircle } from '@blex/ui/icons';
import { cx } from '~/lib/classnames';

interface CodeEditorProps {
    language?: 'html' | 'javascript' | 'css' | 'plaintext';
    value: string;
    onChange: (value: string) => void;
    height?: string;
    error?: string;
    readOnly?: boolean;
    ariaLabel?: string;
}

export const CodeEditor = ({
    language = 'plaintext',
    value,
    onChange,
    height = '300px',
    error,
    readOnly,
    ariaLabel
}: CodeEditorProps) => {
    const errorId = useId();

    return (
        <div>
            <textarea
                aria-label={ariaLabel}
                aria-describedby={error ? errorId : undefined}
                aria-invalid={error ? 'true' : undefined}
                data-language={language}
                value={value}
                onChange={(event) => onChange(event.target.value)}
                readOnly={readOnly}
                spellCheck={false}
                autoCapitalize="off"
                autoComplete="off"
                className={cx(
                    'block w-full resize-y rounded-lg border bg-surface px-4 py-3 font-mono text-sm leading-6 text-content outline-none transition-colors',
                    'placeholder:text-content-hint focus:border-line-strong focus:ring-2 focus:ring-line/20',
                    'read-only:cursor-default read-only:bg-surface-subtle',
                    error ? 'border-danger-line' : 'border-line'
                )}
                style={{
                    height,
                    minHeight: '160px'
                }}
            />
            {error && (
                <div
                    id={errorId}
                    role="alert"
                    className="mt-1.5 flex items-center gap-1.5 text-sm text-danger">
                    <AlertCircle aria-hidden="true" className="h-4 w-4 shrink-0" />
                    {error}
                </div>
            )}
        </div>
    );
};
