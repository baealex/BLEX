import { renderDiscoveryPage } from '~/features/discovery/layout';
import { createTagsPageData } from '~/features/discovery/discovery-page-data';
import type { PageProps } from '@blex/contracts/pages';

export default function renderPage(props: PageProps['tags']): string {
    return renderDiscoveryPage(props.meta, createTagsPageData(props));
}
