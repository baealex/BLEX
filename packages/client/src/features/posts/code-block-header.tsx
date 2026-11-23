import { useEffect, useRef, useState } from 'react';

const COPIED_RESET_MS = 2000;
const copyPath =
    'M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z';
const checkPath = 'M5 13l4 4L19 7';

export function CodeBlockHeader({ code, label }: { code: HTMLElement; label: string }) {
    const [copied, setCopied] = useState(false);
    const reset = useRef<ReturnType<typeof setTimeout>>(undefined);

    useEffect(() => () => clearTimeout(reset.current), []);

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(code.textContent ?? '');
        } catch (error) {
            console.error('Could not copy the code.', error);
            return;
        }
        setCopied(true);
        clearTimeout(reset.current);
        reset.current = setTimeout(() => setCopied(false), COPIED_RESET_MS);
    };

    return (
        <>
            <span className="code-language">{label}</span>
            <button
                type="button"
                className="code-copy-button"
                title={copied ? 'Copied!' : 'Copy code'}
                aria-label="Copy code"
                onClick={() => void copy()}
            >
                <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d={copied ? checkPath : copyPath}
                    />
                </svg>
            </button>
        </>
    );
}
