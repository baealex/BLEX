import { developerText } from '~/features/developer-api/messages';
import { renderToStaticMarkup } from 'react-dom/server';
import type { PageProps } from '~/contracts/pages';

export default function renderPage({
    assetRoot,
    settingsJson,
    locale
}: PageProps['docs/developer-api/reference']): string {
    return `<!doctype html>${renderToStaticMarkup(
        <html lang={locale}>
            <head>
                <meta charSet="utf-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <meta name="robots" content="noindex" />
                <title>{developerText(locale, 'BLEX Developer API')}</title>
                <link rel="stylesheet" href={`${assetRoot}/swagger-ui.css`} />
            </head>
            <body>
                <div id="swagger-ui" />
                <script
                    type="application/json"
                    id="swagger-settings"
                    dangerouslySetInnerHTML={{ __html: settingsJson }}
                />
                <script src={`${assetRoot}/swagger-ui-bundle.js`} />
                <script src="/assets/blex/swagger-init.js" />
            </body>
        </html>
    )}`;
}
