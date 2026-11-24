import { renderAuthorPage } from '~/features/authors/author-document';
import { createAuthorSeriesData } from '~/features/authors/author-page-data';
import type { PageProps } from '@blex/contracts/pages';

export default function renderPage(props: PageProps['@{$username}/series/$seriesSlug']): string {
    return renderAuthorPage(props.meta, createAuthorSeriesData(props), { html: props.seriesHtml, markdown: '' });
}
