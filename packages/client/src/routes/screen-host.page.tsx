import { SiteHeader, SiteTheme } from '~/appearance/shell';
import { pageDataScript, renderApplicationDocument } from '~/application/document';
import { screenPageDataId } from '~/application/route-data';
import { ScreenLoading, ScreenPage, type ScreenPageData } from '~/application/screen-page';
import { publicBrand } from '~/features/discovery/discovery-page-data';
import type { PageProps } from '@blex/contracts/pages';

function createScreenPageData(props: PageProps['screen-host']): ScreenPageData {
    return {
        screen: props.screen,
        csrf: props.csrf,
        contentClass: props.contentClass,
        footer: props.footer
            ? { brand: publicBrand({ brand: props.brand }), copyrightYear: new Date().getFullYear() }
            : undefined,
        viewer: props.viewer?.username ? { username: props.viewer.username } : null,
        timeZone: props.timeZone
    };
}

export default function renderPage(props: PageProps['screen-host']): string {
    const { lang, robots, title, canonical, faviconUrl, rssUrl, brand, documentStyleHref, captcha } = props;
    const data = createScreenPageData(props);
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
                {captcha && (
                    <script src="https://js.hcaptcha.com/1/api.js" async defer data-blex-trusted-script="hcaptcha" />
                )}
            </head>
            <body className="antialiased bg-surface-page text-content selection:bg-action selection:text-content-inverted">
                <SiteHeader
                    brand={brand}
                    searchPage={props.searchPage}
                    editorPage={props.editorPage}
                    viewer={props.viewer}
                />
                <ScreenPage data={data}>
                    <ScreenLoading name={props.screen.name} text={props.loadingText} />
                </ScreenPage>
                {pageDataScript(screenPageDataId, data)}
                {/* Browsers skip a nomodule script. An application from before screens rendered in its tree imports it
                    on the way here, and the module reloads that tab into this one. */}
                <script noModule src="/assets/blex/screen.js" data-blex-page-module="screen" />
            </body>
        </html>
    );
    return renderApplicationDocument(page);
}
