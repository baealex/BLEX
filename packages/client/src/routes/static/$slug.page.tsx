import { contentPageDataId } from '~/application/route-data';
import { createStaticPageData } from '~/features/discovery/content-page-data';
import { renderTreeDocument } from '~/features/discovery/layout';
import { StaticPage } from '~/features/discovery/static-page';
import type { PageProps } from '@blex/contracts/pages';

export default function renderPage(props: PageProps['static/$slug']): string {
    const data = createStaticPageData(props);
    return renderTreeDocument(
        props.meta,
        <StaticPage data={data} pageHtml={props.pageHtml} />,
        contentPageDataId,
        data
    );
}
