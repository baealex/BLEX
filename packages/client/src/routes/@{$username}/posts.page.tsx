import { renderAuthorPage } from '~/features/authors/author-document';
import { createAuthorPostsData } from '~/features/authors/author-page-data';
import type { PageProps } from '@blex/contracts/pages';

export default function renderPage(props: PageProps['@{$username}/posts']): string {
    return renderAuthorPage(props.meta, createAuthorPostsData(props));
}
