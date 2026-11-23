import { getDocumentLocale } from '../../../i18n/locale.js';
import { ui } from '../../../i18n/public-ui.js';
import { renderApplicationDocument } from '~/application/document';
import type { PageProps } from '@blex/contracts/pages';

const labelLimit = 100;

export default function renderPage({
    title,
    postPath,
    error,
    create,
    action,
    csrf,
    links
}: PageProps['@{$username}/{$slug}/share-links']): string {
    return renderApplicationDocument(
        <html lang={getDocumentLocale()}>
            <head>
                <meta charSet="utf-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <meta name="robots" content="noindex" />
                <title>{ui('Share links · {title}', { title })}</title>
                <style>
                    {
                        'body{margin:3rem auto;max-width:43rem;padding:0 1rem;font:1rem/1.6 system-ui}li{margin:1.25rem 0}a{overflow-wrap:anywhere}input,button{font:inherit;margin:.25rem}'
                    }
                </style>
            </head>
            <body>
                <main>
                    <a href={postPath}>{ui('Back to post')}</a>
                    <h1>{ui('Share links')}</h1>
                    <p>{title}</p>
                    {error && <p role="alert">{error}</p>}
                    {create && (
                        <form method="post" action={action}>
                            <input type="hidden" name="csrfmiddlewaretoken" value={csrf} />
                            <label>
                                {ui('Link name')} <input name="label" maxLength={labelLimit} required />
                            </label>
                            <button type="submit">{ui('Create link')}</button>
                        </form>
                    )}
                    {links.length > 0 && (
                        <ul>
                            {links.map((link) => (
                                <li key={link.id}>
                                    <a href={link.url}>{link.url}</a>
                                    <p>
                                        {ui(
                                            'Last 7 days: {recent, plural, one{# click} other{# clicks}} · Total: {total, plural, one{# click} other{# clicks}}',
                                            { recent: link.recentClicks, total: link.totalClicks }
                                        )}
                                    </p>
                                    <form method="post" action={action}>
                                        <input type="hidden" name="csrfmiddlewaretoken" value={csrf} />
                                        <input type="hidden" name="id" value={link.id} />
                                        <label>
                                            {ui('Link name')}{' '}
                                            <input
                                                name="label"
                                                maxLength={labelLimit}
                                                defaultValue={link.label}
                                                required
                                            />
                                        </label>
                                        <label>
                                            <input
                                                name="isPaused"
                                                type="checkbox"
                                                value="true"
                                                defaultChecked={link.isPaused}
                                            />{' '}
                                            {ui('Pause')}
                                        </label>
                                        <button type="submit">{ui('Save')}</button>
                                    </form>
                                </li>
                            ))}
                        </ul>
                    )}
                </main>
            </body>
        </html>
    );
}
