import { getDocumentLocale } from '../../../i18n/locale.js';
import { ui } from '../../../i18n/public-ui.js';
import { pageDataScript, renderApplicationDocument } from '~/application/document';
import { postManagementPageDataId } from '~/application/route-data';
import type { PageProps } from '@blex/contracts/pages';
import { createShareLinksPageData } from '~/features/posts/management-page-data';
import { ShareLinksPage } from '~/features/posts/share-links-page';

export default function renderPage(model: PageProps['@{$username}/{$slug}/share-links']): string {
    const data = createShareLinksPageData(model);
    return renderApplicationDocument(
        <html lang={getDocumentLocale()}>
            <head>
                <meta charSet="utf-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <meta name="robots" content="noindex" />
                <title>{ui('Share links · {title}', { title: model.title })}</title>
                <style>
                    {
                        'body{margin:3rem auto;max-width:43rem;padding:0 1rem;font:1rem/1.6 system-ui}li{margin:1.25rem 0}a{overflow-wrap:anywhere}input,button{font:inherit;margin:.25rem}'
                    }
                </style>
            </head>
            <body>
                <ShareLinksPage data={data} />
                {pageDataScript(postManagementPageDataId, data)}
            </body>
        </html>,
        'tree'
    );
}
