import { DeveloperQuickstart } from '~/features/developer-api/quickstart';
import { developerText } from '~/features/developer-api/messages';
import { SiteFooter, SiteHeader, SiteTheme } from '~/appearance/shell';
import { renderApplicationDocument } from '~/application/document';
import type { PageProps } from '@blex/contracts/pages';

export default function renderPage({
    brand,
    viewer,
    locale,
    commands,
    siteOrigin
}: PageProps['docs/developer-api/quickstart']): string {
    return renderApplicationDocument(
        <html lang={locale}>
            <head>
                <meta charSet="utf-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <meta name="robots" content="noindex" />
                <title>{`${developerText(locale, 'Developer API quickstart')} | ${brand.siteName}`}</title>
                <SiteTheme />
            </head>
            <body className="bg-surface-page text-content antialiased">
                <SiteHeader brand={brand} viewer={viewer} locale={locale} />
                <main className="min-h-[calc(100vh-10.5rem)]">
                    <DeveloperQuickstart locale={locale} commands={commands} siteOrigin={siteOrigin} />
                </main>
                <SiteFooter brand={brand} locale={locale} />
            </body>
        </html>
    );
}
