import { useEffect, useState } from 'react';

const PREVIEW_DELAY_MS = 250;

/**
 * Returns the HTML the server renders for `source` once typing pauses. It never returns the source itself,
 * so a preview cannot insert markup that public pages strip. A failed request keeps the last preview.
 */
export const useSanitizedPreview = (source: string, render: (source: string) => Promise<string>, enabled = true) => {
    const [preview, setPreview] = useState('');
    const hasSource = source.trim().length > 0;

    useEffect(() => {
        if (!enabled || !hasSource) return;

        let cancelled = false;
        const timeoutId = window.setTimeout(() => {
            render(source).then(
                (html) => {
                    if (!cancelled) setPreview(html);
                },
                () => undefined
            );
        }, PREVIEW_DELAY_MS);

        return () => {
            cancelled = true;
            window.clearTimeout(timeoutId);
        };
    }, [enabled, hasSource, render, source]);

    return hasSource ? preview : '';
};
