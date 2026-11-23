import { renderDiscoveryPage } from '~/features/discovery/layout';
import { createHomePageData } from '~/features/discovery/discovery-page-data';
import type { PageProps } from '@blex/contracts/pages';

export default function renderPage(props: PageProps['index']): string {
    return renderDiscoveryPage(props.meta, createHomePageData(props));
}
