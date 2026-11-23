import { renderToStaticMarkup } from 'react-dom/server';
import type { PageProps } from '~/contracts/pages';
import { featuredPostsSection } from '~/features/authors/profile-ui';

export default function renderPage({
    author,
    featured,
    isOwner
}: PageProps['@{$username}/partials/featured-posts']): string {
    return renderToStaticMarkup(featuredPostsSection(author, featured, isOwner));
}
