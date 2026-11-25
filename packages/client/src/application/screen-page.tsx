import type { ReactNode } from 'react';
import { ui } from '../i18n/public-ui.js';
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

/**
 * Says that a screen or settings tab could not load or render; the cause stays in the console. Browsers keep a
 * module that failed to load, so only a new page can try again. The application answers the button, because
 * the server's copy of this message has no handlers.
 */
export function ScreenFailureMessage() {
    return (
        <div role="alert" className="flex min-h-52 flex-col items-center justify-center gap-4 py-12 text-center">
            <p className="text-sm font-medium text-content-secondary">{ui('Could not load this page.')}</p>
            <button
                type="button"
                data-blex-reload
                className="rounded-full border border-line bg-surface-elevated px-5 py-2 text-sm font-semibold text-content transition-colors duration-150 hover:border-line-strong hover:bg-surface-subtle"
            >
                {ui('Reload')}
            </button>
        </div>
    );
}

/** The status the server sends in a screen's place. It already holds the message for a screen that cannot load. */
export function ScreenLoading({ name, text }: { name: string; text: string }) {
    return (
        <div data-screen={name} data-screen-status="pending" className="group">
            <div
                role="status"
                aria-live="polite"
                className="flex min-h-52 items-center justify-center gap-2 py-12 text-sm font-medium text-content-secondary group-data-[screen-status=error]:hidden"
            >
                <span
                    aria-hidden="true"
                    className="h-4 w-4 animate-spin rounded-full border-2 border-line-strong border-t-action motion-reduce:animate-none"
                />
                <span>{text}</span>
            </div>
            <div className="hidden group-data-[screen-status=error]:block">
                <ScreenFailureMessage />
            </div>
        </div>
    );
}
