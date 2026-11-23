import { getDocumentLocale } from '../../../i18n/locale.js';
import { ui } from '../../../i18n/public-ui.js';
import { renderApplicationDocument } from '~/application/document';
import type { PageProps } from '~/contracts/pages';
import { historyPageCss } from '~/features/posts/history-pages-parts';

export default function renderPage({
    username,
    slug,
    title,
    totalCount,
    frames: timelapseFrames
}: PageProps['@{$username}/{$slug}/timelapse']): string {
    const postPath = `/@${encodeURIComponent(username)}/${encodeURIComponent(slug)}`;
    const frames = timelapseFrames.map((frame, index) => (
        <details className="frame" key={`${frame.savedAt}:${index}`} open={index === timelapseFrames.length - 1}>
            <summary>
                <strong>{frame.title || ui('Untitled post')}</strong>
                <span>{`${frame.stage === 'draft' ? ui('Save draft') : ui('Published post')} · ${frame.savedLabel}`}</span>
            </summary>
            <div className="frame-body">
                <div dangerouslySetInnerHTML={{ __html: frame.contentHtml }} />
            </div>
        </details>
    ));
    return renderApplicationDocument(
        <html lang={getDocumentLocale()}>
            <head>
                <meta charSet="utf-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <meta name="color-scheme" content="light dark" />
                <meta name="robots" content="noindex,nofollow" />
                <title>{ui('Writing timeline · {value0} · BLEX', { value0: title })}</title>
                <style>{historyPageCss}</style>
            </head>
            <body>
                <header>
                    <a href={`${postPath}/edit`}>{ui('Edit post')}</a>
                    <nav>
                        <a href={`${postPath}/revisions`}>{ui('Revision history')}</a>
                        <a href="/settings/posts">{ui('Manage posts')}</a>
                    </nav>
                </header>
                <main>
                    <h1>{ui('Writing timeline')}</h1>
                    <p className="meta">
                        {ui('{value0} · {value1, plural, one{# frame} other{# frames}}', {
                            value0: title,
                            value1: totalCount
                        })}
                    </p>
                    {totalCount > timelapseFrames.length ? (
                        <p className="notice">
                            {ui('Showing {value1} of {value0} frames, including older history.', {
                                value0: totalCount,
                                value1: timelapseFrames.length
                            })}
                        </p>
                    ) : null}
                    {frames.length ? (
                        <section aria-label={ui('Writing history')}>{frames}</section>
                    ) : (
                        <p className="empty">{ui('No writing history to display.')}</p>
                    )}
                </main>
            </body>
        </html>
    );
}
