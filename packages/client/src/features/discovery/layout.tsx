import { getDocumentLocale } from '../../i18n/locale.js';
import { ui } from '../../i18n/public-ui.js';
import type { ReactNode } from 'react';
import { SiteIcon } from '../../appearance/icons';
import { SiteFooter, SiteHeader, SiteTheme } from '../../appearance/shell';
import { type ContentMode, renderApplicationDocument, scriptJson } from '../../application/document';
import { discoveryPageDataId } from '../../application/route-data';
import type { NoticeRow, PageMeta, SiteBrand } from '@blex/contracts/public';
import { DiscoveryPage } from './discovery-page';
import type { DiscoveryPageData } from './discovery-page-data';
import { noticeLink } from './view-helpers';

export function PublicSiteMark({
    brand,
    siteName,
    imageClass
}: {
    brand?: SiteBrand;
    siteName: string;
    imageClass?: string;
}): ReactNode {
    const customLogo = brand?.logoUrl ?? brand?.darkLogoUrl;
    return (
        <span className="site-mark">
            <picture>
                <source
                    media="(prefers-color-scheme: dark)"
                    srcSet={brand?.darkLogoUrl ?? customLogo ?? '/resources/logow.svg'}
                />
                <img
                    className={imageClass}
                    src={customLogo ?? '/resources/logob.svg'}
                    alt={customLogo ? siteName : ''}
                />
            </picture>
            {customLogo ? null : <span>{siteName}</span>}
        </span>
    );
}

export function PublicFooterLinks({ brand }: { brand?: SiteBrand }): ReactNode {
    return (
        <nav aria-label={ui('About this site')} className="site-footer-links">
            {(brand?.footerPages ?? []).map(({ slug, title }) => (
                <a key={slug} href={`/static/${encodeURIComponent(slug)}`}>
                    {title}
                </a>
            ))}
            <a href="/rss">RSS</a>
        </nav>
    );
}

export function PageLayout({ meta, children }: { meta: PageMeta; children: ReactNode }): string {
    return renderPublicDocument(
        meta,
        <>
            <main>{children}</main>
            <SiteFooter brand={meta.brand} />
        </>
    );
}

export function renderDiscoveryPage(meta: PageMeta, data: DiscoveryPageData): string {
    return renderPublicDocument(
        meta,
        [
            <DiscoveryPage key="page" data={data} />,
            <script
                key="data"
                type="application/json"
                id={discoveryPageDataId}
                dangerouslySetInnerHTML={{ __html: scriptJson(data) }}
            />
        ],
        'tree'
    );
}

function renderPublicDocument(meta: PageMeta, content: ReactNode, mode?: ContentMode): string {
    const robots = meta.brand?.seoEnabled === false ? 'noindex,nofollow' : meta.robots;
    const structuredData = meta.structuredData ? (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: scriptJson(meta.structuredData) }} />
    ) : null;

    return renderApplicationDocument(
        <html lang={getDocumentLocale()}>
            <head>
                <meta charSet="utf-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <meta name="color-scheme" content="light dark" />
                <title>{meta.title}</title>
                <meta name="description" content={meta.description} />
                <meta property="og:type" content="website" />
                <meta property="og:title" content={meta.title} />
                <meta property="og:description" content={meta.description} />
                <meta property="og:url" content={meta.canonical} />
                <meta name="twitter:card" content="summary" />
                <meta name="twitter:title" content={meta.title} />
                <meta name="twitter:description" content={meta.description} />
                <link rel="icon" href={meta.brand?.faviconUrl ?? '/favicon.ico'} />
                <link rel="canonical" href={meta.canonical} />
                {meta.markdownUrl ? <link rel="alternate" type="text/markdown" href={meta.markdownUrl} /> : null}
                {meta.brand?.seoEnabled === false ? null : (
                    <link
                        rel="alternate"
                        type="application/rss+xml"
                        title={`${meta.siteName} RSS`}
                        href={new URL('/rss', meta.canonical).href}
                    />
                )}
                {meta.brand?.seoEnabled !== false && meta.authorFeed ? (
                    <link
                        rel="alternate"
                        type="application/rss+xml"
                        title={meta.authorFeed.title}
                        href={meta.authorFeed.url}
                    />
                ) : null}
                {robots ? <meta name="robots" content={robots} /> : null}
                {robots ? <meta name="googlebot" content={robots} /> : null}
                {meta.previous ? <link rel="prev" href={meta.previous} /> : null}
                {meta.next ? <link rel="next" href={meta.next} /> : null}
                <SiteTheme />
                {structuredData}
            </head>
            <body>
                <SiteHeader brand={meta.brand} viewer={meta.viewer} searchPage={meta.searchPage} />
                {content}
            </body>
        </html>,
        mode
    );
}

export function NoticeSection({ notices }: { notices: NoticeRow[] }): ReactNode {
    if (!notices.length) return null;
    return (
        <section className="mb-14" aria-label={ui('Author notices')}>
            <div className="mb-4 flex items-end justify-between gap-4">
                <h2 className="text-2xl font-bold tracking-tight text-content">{ui('Notices')}</h2>
                {notices.length > 1 ? (
                    <span className="pb-1 text-xs font-medium tabular-nums text-content-hint">
                        {ui('{value0, plural, one{# notice} other{# notices}}', { value0: notices.length })}
                    </span>
                ) : null}
            </div>
            <div className="divide-y divide-line-light border-y border-line-light">
                {notices.map((notice, index) => {
                    const href = noticeLink(notice.url);
                    const content = (
                        <div className="flex items-center justify-between gap-4 px-1">
                            <div className="min-w-0 flex-1">
                                <h3 className="truncate text-base font-semibold leading-snug text-content">
                                    {notice.title}
                                </h3>
                            </div>
                            <div className="flex shrink-0 items-center gap-2 text-content-hint">
                                {notices.length > 1 ? (
                                    <span className="text-[11px] font-medium tabular-nums">{`${index + 1}/${notices.length}`}</span>
                                ) : null}
                                <SiteIcon name="arrow-right" className="text-xs" />
                            </div>
                        </div>
                    );
                    const props = {
                        className:
                            'group block py-3.5 transition-colors duration-150 hover:bg-surface-subtle/50 active:bg-surface-subtle/70'
                    };
                    const Tag = href ? 'a' : 'div';
                    return (
                        <Tag key={notice.id} {...props} {...(href ? { href } : {})}>
                            {content}
                        </Tag>
                    );
                })}
            </div>
        </section>
    );
}
