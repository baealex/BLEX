import { renderDiscoveryPage } from '~/features/discovery/layout';
import { createTagPageData } from '~/features/discovery/discovery-page-data';
import type { PageProps } from '@blex/contracts/pages';

export default function renderPage(props: PageProps['tag/$name']): string {
    return renderDiscoveryPage(props.meta, createTagPageData(props));
}
