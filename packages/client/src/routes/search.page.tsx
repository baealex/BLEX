import { discoveryPageDataId } from '~/application/route-data';
import { createSearchPageData } from '~/features/discovery/discovery-page-data';
import { renderTreeDocument } from '~/features/discovery/layout';
import { SearchPage } from '~/features/discovery/search-page';
import type { PageProps } from '@blex/contracts/pages';

/** Rendered only when the search screen is not installed; otherwise the screen host answers `/search`. */
export default function renderPage(props: PageProps['search']): string {
    const data = createSearchPageData(props);
    return renderTreeDocument(props.meta, <SearchPage data={data} />, discoveryPageDataId, data);
}
