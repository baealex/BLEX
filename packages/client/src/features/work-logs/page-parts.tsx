import type { ReactNode } from 'react';
import { SiteFooter } from '../../appearance/shell.js';
import { ui } from '../../i18n/public-ui.js';
import type { PagerView } from '@blex/contracts/work-logs';
import type { MediaView, WorkLogPageData } from './page-data';

export const pagerButton = 'min-h-11 rounded-lg border border-line px-3 hover:bg-surface-subtle';
export const primaryButton =
    'min-h-11 rounded-lg bg-action px-4 text-sm font-semibold text-content-inverted transition hover:bg-action-hover active:scale-95';
const pagerLink = 'inline-flex min-h-11 items-center rounded-lg border border-line px-3 hover:bg-surface-subtle';

/** The route content every work log page shares: its main column and the site footer. */
export function WorkLogMain({
    data,
    className,
    children
}: {
    data: WorkLogPageData;
    className: string;
    children: ReactNode;
}) {
    return (
        <>
            <main className="min-h-[calc(100vh-10.5rem)]">
                <div className={className}>{children}</div>
            </main>
            <SiteFooter brand={data.brand} year={data.copyrightYear} />
        </>
    );
}

export function CsrfInput({ value }: { value: string }) {
    return <input type="hidden" name="csrfmiddlewaretoken" value={value} />;
}

export function Pager({ links, anchor }: { links: PagerView; anchor?: string }) {
    if (!links.previous && !links.next) return null;
    const suffix = anchor ? `#${anchor}` : '';
    return (
        <nav aria-label={ui('Navigate pages')} className="mt-4 flex flex-wrap gap-2 text-sm">
            {links.previous && (
                <a className={pagerLink} href={`${links.previous}${suffix}`}>
                    {ui('Previous page')}
                </a>
            )}
            {links.next && (
                <a className={pagerLink} href={`${links.next}${suffix}`}>
                    {ui('Next page')}
                </a>
            )}
        </nav>
    );
}

export function WorkLogMedia({ media, label, lazy = false }: { media: MediaView; label: string; lazy?: boolean }) {
    const className = 'block max-h-[34rem] w-full bg-surface-subtle object-contain';
    return media.video ? (
        <video src={media.url} controls playsInline preload="metadata" aria-label={label} className={className} />
    ) : (
        <img src={media.url} alt={label} loading={lazy ? 'lazy' : undefined} className={className} />
    );
}

/** Reads text the writer wrote back from the server markup. Work log text is plain text, so it cannot add elements. */
export function textOf(element: Element | null | undefined): string {
    return element?.textContent ?? '';
}
