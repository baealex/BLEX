import { renderAuthorPage } from '~/features/authors/author-document';
import { createAuthorSeriesListData } from '~/features/authors/author-page-data';
import type { PageProps } from '@blex/contracts/pages';

export default function renderPage(props: PageProps['@{$username}/series/index']): string {
    return renderAuthorPage(props.meta, createAuthorSeriesListData(props));
}
