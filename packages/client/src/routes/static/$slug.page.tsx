import { PageLayout } from '~/features/discovery/layout';
import type { PageProps } from '~/contracts/pages';

export default function renderPage({ meta, pageHtml }: PageProps['static/$slug']): string {
    return PageLayout({
        meta,
        children: (
            <article className="rich-content">
                <div dangerouslySetInnerHTML={{ __html: pageHtml }} />
            </article>
        )
    });
}
