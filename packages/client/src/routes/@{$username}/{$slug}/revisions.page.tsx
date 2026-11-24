import { getDocumentLocale } from '../../../i18n/locale.js';
import { ui } from '../../../i18n/public-ui.js';
import { pageDataScript, renderApplicationDocument } from '~/application/document';
import { postManagementPageDataId } from '~/application/route-data';
import type { PageProps } from '@blex/contracts/pages';
import { historyPageCss } from '~/features/posts/history-pages-parts';
import { createRevisionsPageData, revisionBodies } from '~/features/posts/management-page-data';
import { RevisionsPage } from '~/features/posts/revisions-page';

export default function renderPage(model: PageProps['@{$username}/{$slug}/revisions']): string {
    const data = createRevisionsPageData(model);
    return renderApplicationDocument(
        <html lang={getDocumentLocale()}>
            <head>
                <meta charSet="utf-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <meta name="color-scheme" content="light dark" />
                <meta name="robots" content="noindex,nofollow" />
                <title>{ui('Revision history · {value0} · BLEX', { value0: model.title })}</title>
                <style>{historyPageCss}</style>
            </head>
            <body>
                <RevisionsPage data={data} bodies={revisionBodies(model)} />
                {pageDataScript(postManagementPageDataId, data)}
            </body>
        </html>,
        'tree'
    );
}
