import { SiteFooter, SiteHeader, SiteTheme } from '~/appearance/shell';
import { renderApplicationDocument } from '~/application/document';
import type { PageProps } from '~/contracts/pages';

export default function renderPage({ brand, viewer, quickstart }: PageProps['docs/developer-api/quickstart']): string {
    return renderApplicationDocument(
        <html lang="ko">
            <head>
                <meta charSet="utf-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <meta name="robots" content="noindex" />
                <title>{`개발자 API 빠른 시작 | ${brand.siteName}`}</title>
                <SiteTheme />
            </head>
            <body className="bg-surface-page text-content antialiased">
                <SiteHeader brand={brand} viewer={viewer} />
                <main className="min-h-[calc(100vh-10.5rem)]" dangerouslySetInnerHTML={{ __html: quickstart }} />
                <SiteFooter brand={brand} />
            </body>
        </html>
    );
}
