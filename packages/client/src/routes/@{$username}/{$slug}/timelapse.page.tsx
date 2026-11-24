import { getDocumentLocale } from '../../../i18n/locale.js';
import { ui } from '../../../i18n/public-ui.js';
import { pageDataScript, renderApplicationDocument } from '~/application/document';
import { postManagementPageDataId } from '~/application/route-data';
import type { PageProps } from '@blex/contracts/pages';
import { historyPageCss } from '~/features/posts/history-pages-parts';
import { createTimelapsePageData } from '~/features/posts/management-page-data';
import { TimelapsePage } from '~/features/posts/timelapse-page';

export default function renderPage(model: PageProps['@{$username}/{$slug}/timelapse']): string {
    const data = createTimelapsePageData(model);
    return renderApplicationDocument(
        <html lang={getDocumentLocale()}>
            <head>
                <meta charSet="utf-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <meta name="color-scheme" content="light dark" />
                <meta name="robots" content="noindex,nofollow" />
                <title>{ui('Writing timeline · {value0} · BLEX', { value0: model.title })}</title>
                <style>{historyPageCss}</style>
            </head>
            <body>
                <TimelapsePage data={data} frameHtml={model.frames.map((frame) => frame.contentHtml)} />
                {pageDataScript(postManagementPageDataId, data)}
            </body>
        </html>,
        'tree'
    );
}
