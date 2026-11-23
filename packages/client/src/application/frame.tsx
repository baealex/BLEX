import type { ReactNode } from 'react';
import { SiteHeader, type SiteHeaderProps } from '../appearance/shell.js';

export interface ApplicationView {
    header: SiteHeaderProps | null;
    html: string;
    /** Starts a fresh screen even when two URLs share the same server markup. */
    contentKey?: string;
    /** A page that lives in this React tree. Without it, `html` is shown as server markup. */
    content?: ReactNode;
}

export function ApplicationFrame({ view }: { view: ApplicationView }) {
    return (
        <>
            {view.header && <SiteHeader {...view.header} />}
            {view.content === undefined ? (
                <div
                    key={view.contentKey}
                    id="blex-route-content"
                    className="contents"
                    dangerouslySetInnerHTML={{ __html: view.html }}
                />
            ) : (
                <div key={view.contentKey} id="blex-route-content" className="contents">
                    {view.content}
                </div>
            )}
        </>
    );
}
