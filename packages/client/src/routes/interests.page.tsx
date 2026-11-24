import { createInterestsPageData } from '~/features/discovery/discovery-page-data';
import { renderDiscoveryPage } from '~/features/discovery/layout';
import type { PageProps } from '@blex/contracts/pages';

export default function renderPage(props: PageProps['interests']): string {
    return renderDiscoveryPage(props.meta, createInterestsPageData(props));
}
