import type { PageMeta } from '@blex/contracts/public';
import { authorPageDataId } from '../../application/route-data';
import { renderTreeDocument } from '../discovery/layout';
import { AboutEditor } from './about-editor';
import { AuthorAboutEditPage } from './author-about-edit-page';
import { AuthorOverviewPage } from './author-overview-page';
import type { AuthorContent, AuthorPageData } from './author-page-data';
import { AuthorPostsPage } from './author-posts-page';
import { AuthorSeriesDetailPage } from './author-series-detail-page';
import { AuthorSeriesPage } from './author-series-page';

function AuthorDocumentPage({ data, content }: { data: AuthorPageData; content: AuthorContent }) {
    switch (data.page) {
        case 'overview':
            return <AuthorOverviewPage data={data} about={{ ...content, editor: AboutEditor }} />;
        case 'posts':
            return <AuthorPostsPage data={data} />;
        case 'series':
            return <AuthorSeriesPage data={data} />;
        case 'series-detail':
            return <AuthorSeriesDetailPage data={data} descriptionHtml={content.html} />;
        case 'about-edit':
            return <AuthorAboutEditPage data={data} markdown={content.markdown} />;
    }
}

export function renderAuthorPage(
    meta: PageMeta,
    data: AuthorPageData,
    content: AuthorContent = { html: '', markdown: '' }
): string {
    return renderTreeDocument(meta, <AuthorDocumentPage data={data} content={content} />, authorPageDataId, data);
}
