import { getDocumentLocale } from '../../../i18n/locale.js';
import { ui } from '../../../i18n/public-ui.js';
import { renderApplicationDocument } from '~/application/document';
import { publicPostPath } from '~/features/posts/paths';
import type { PageProps } from '@blex/contracts/pages';

export default function renderPage({
    source,
    username,
    slug,
    items
}: PageProps['@{$username}/{$slug}/related']): string {
    return renderApplicationDocument(
        <html lang={getDocumentLocale()}>
            <head>
                <meta charSet="utf-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <meta name="robots" content="noindex,follow" />
                <title>{ui('Related posts · {title}', { title: source.title })}</title>
                <style>
                    {'body{margin:3rem auto;max-width:44rem;padding:0 1rem;font:1rem/1.65 system-ui}li{margin:1rem 0}'}
                </style>
            </head>
            <body>
                <main>
                    <a href={publicPostPath(username, slug)}>{ui('Back to post')}</a>
                    <h1>{ui('Related posts')}</h1>
                    {items.length ? (
                        <ul>
                            {items.map((item) => (
                                <li key={item.slug}>
                                    <a href={publicPostPath(item.username, item.slug)}>{item.title}</a>
                                    <p>{item.description}</p>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p>{ui('No posts share these tags.')}</p>
                    )}
                </main>
            </body>
        </html>
    );
}
