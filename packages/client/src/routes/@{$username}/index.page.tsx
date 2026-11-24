import { renderAuthorPage } from '~/features/authors/author-document';
import { createAuthorOverviewData } from '~/features/authors/author-page-data';
import type { PageProps } from '@blex/contracts/pages';

export default function renderPage(props: PageProps['@{$username}/index']): string {
    return renderAuthorPage(props.meta, createAuthorOverviewData(props), {
        html: props.aboutHtml,
        markdown: props.isOwner ? (props.author.aboutMarkdown ?? '') : ''
    });
}
