import { renderToString } from 'react-dom/server';
import { SiteFooter, SiteHeader, SiteTheme } from '~/appearance/shell';
import { renderApplicationDocument } from '~/application/document';
import type { PageProps } from '~/contracts/pages';

export default function renderPage({
    movesInApplication,
    lang,
    robots,
    title,
    canonical,
    faviconUrl,
    rssUrl,
    brand,
    documentStyleHref,
    configurationJson,
    globalsJson,
    captcha,
    csrf,
    searchPage,
    editorPage,
    viewer,
    contentClass,
    screen,
    footer,
    loaderHref
}: PageProps['screen-host']): string {
    const page = (
        <html lang={lang}>
            <head>
                <meta charSet="utf-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <meta name="color-scheme" content="light dark" />
                <meta name="robots" content={robots} />
                <title>{title}</title>
                {canonical && <link rel="canonical" href={canonical} />}
                <link rel="icon" href={faviconUrl} />
                {rssUrl && (
                    <link rel="alternate" type="application/rss+xml" title={`${brand.siteName} RSS`} href={rssUrl} />
                )}
                <SiteTheme />
                <link rel="stylesheet" href={documentStyleHref} />
                <script
                    type="application/json"
                    id="blex-screen-config"
                    dangerouslySetInnerHTML={{ __html: configurationJson }}
                />
                {globalsJson && (
                    <script
                        type="application/json"
                        id="blex-screen-globals"
                        dangerouslySetInnerHTML={{ __html: globalsJson }}
                    />
                )}
                {captcha && (
                    <script src="https://js.hcaptcha.com/1/api.js" async defer data-blex-trusted-script="hcaptcha" />
                )}
            </head>
            <body className="antialiased bg-surface-page text-content selection:bg-action selection:text-content-inverted">
                <input type="hidden" name="csrfmiddlewaretoken" value={csrf} />
                <SiteHeader brand={brand} searchPage={searchPage} editorPage={editorPage} viewer={viewer} />
                <main className="min-h-[calc(100vh-10.5rem)]">
                    <div className={contentClass} dangerouslySetInnerHTML={{ __html: screen }} />
                </main>
                {footer && <SiteFooter brand={brand} />}
                <script type="module" src="/assets/blex/screen-host.js" />
                <script
                    type="module"
                    src={loaderHref}
                    {...(movesInApplication ? { 'data-blex-page-module': 'screen' } : {})}
                />
            </body>
        </html>
    );
    return movesInApplication ? renderApplicationDocument(page) : `<!doctype html>${renderToString(page)}`;
}
