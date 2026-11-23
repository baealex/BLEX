import { PageLayout } from '~/features/discovery/layout';
import { h } from '~/features/discovery/view-helpers';
import type { PageProps } from '~/contracts/pages';

export default function renderPage({ meta, pageHtml }: PageProps['static/$slug']): string {
    return PageLayout({
        meta,
        children: h(
            'article',
            { className: 'rich-content' },
            h('div', { dangerouslySetInnerHTML: { __html: pageHtml } })
        )
    });
}
