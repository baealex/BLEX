import { renderToStaticMarkup } from 'react-dom/server';
import type { PageProps } from '@blex/contracts/pages';
import { featuredPostsView } from '~/features/authors/author-page-data';
import { FeaturedPostsSection } from '~/features/authors/featured-posts';

export default function renderPage({
    author,
    featured,
    isOwner
}: PageProps['@{$username}/partials/featured-posts']): string {
    const view = featuredPostsView(author, featured, isOwner);
    return view ? renderToStaticMarkup(<FeaturedPostsSection view={view} />) : '';
}
