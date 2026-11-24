import { renderAuthorPage } from '~/features/authors/author-document';
import { createAuthorAboutEditData } from '~/features/authors/author-page-data';
import type { PageProps } from '@blex/contracts/pages';

export default function renderPage(props: PageProps['@{$username}/about.edit']): string {
    return renderAuthorPage(props.meta, createAuthorAboutEditData(props), {
        html: '',
        markdown: props.author.aboutMarkdown ?? ''
    });
}
