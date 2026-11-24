import type { ReactNode } from 'react';
import { SiteFooter } from '../appearance/shell.js';
import type { publicBrand } from '../features/discovery/discovery-page-data.js';

/**
 * Everything the browser needs to render a screen page. The server sends only a loading status in its place,
 * so the screen renders on the client from this data instead of hydrating. It is public in the HTML.
 */
export interface ScreenPageData {
    /** Checked by the screen before it renders. */
    screen: { name: string; props: unknown };
    /** The visitor's own token, which screens read back from the page's hidden form field. */
    csrf: string;
    contentClass?: string;
    footer?: { brand: ReturnType<typeof publicBrand>; copyrightYear: number };
    /** The signed-in viewer the server rendered the screen for, whose session cache the screen keeps. */
    viewer: { username: string } | null;
    /** The viewer's time zone, or the site's, for the dates screens show. */
    timeZone: string;
}

/** The frame around a screen, the same for the server's loading status and the screen that replaces it. */
export function ScreenPage({ data, children }: { data: ScreenPageData; children: ReactNode }) {
    return (
        <>
            <input type="hidden" name="csrfmiddlewaretoken" value={data.csrf} />
            <main className="min-h-[calc(100vh-10.5rem)]">
                <div className={data.contentClass}>{children}</div>
            </main>
            {data.footer && <SiteFooter brand={data.footer.brand} year={data.footer.copyrightYear} />}
        </>
    );
}

export function ScreenLoading({ name, text }: { name: string; text: string }) {
    return (
        <div data-screen={name} data-screen-status="pending">
            <div
                role="status"
                aria-live="polite"
                className="flex min-h-52 items-center justify-center gap-2 py-12 text-sm font-medium text-content-secondary"
            >
                <span
                    aria-hidden="true"
                    className="h-4 w-4 animate-spin rounded-full border-2 border-line-strong border-t-action motion-reduce:animate-none"
                />
                <span>{text}</span>
            </div>
        </div>
    );
}
