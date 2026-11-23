import { getDocumentLocale } from '../../../i18n/locale.js';
import { ui } from '../../../i18n/public-ui.js';
import { renderApplicationDocument } from '~/application/document';
import type { PageProps } from '@blex/contracts/pages';
import { historyPageCss } from '~/features/posts/history-pages-parts';

export default function renderPage(model: PageProps['@{$username}/{$slug}/revisions']): string {
    const postPath = `/@${encodeURIComponent(model.username)}/${encodeURIComponent(model.slug)}`;
    const pagination =
        model.lastPage > 1 ? (
            <nav className="pager" aria-label={ui('Navigate pages')}>
                {model.page > 1 ? <a href={`${postPath}/revisions?page=${model.page - 1}`}>{ui('Previous')}</a> : null}
                <span>{`${model.page} / ${model.lastPage}`}</span>
                {model.page < model.lastPage ? (
                    <a href={`${postPath}/revisions?page=${model.page + 1}`}>{ui('Next')}</a>
                ) : null}
            </nav>
        ) : null;
    const rows = model.revisions.map((revision) => {
        const label =
            revision.changeType === 'restore'
                ? ui('Version before restore')
                : revision.changeType === 'legacy'
                  ? ui('Previous entry')
                  : ui('Version before edit');
        const revisionTitle =
            revision.title === '_NO_CHANGED_' ? ui('No title history') : revision.title || ui('Untitled post');
        const revisionPath = `${postPath}/revisions/${revision.id}`;
        return (
            <details className="revision" key={revision.id}>
                <summary>
                    <strong>{revisionTitle}</strong>
                    <span>{`${label} · ${revision.savedLabel} · ${revision.actor ? `@${revision.actor}` : ui('No author')}`}</span>
                </summary>
                <div className="revision-body">
                    {revision.date ? (
                        <time className="meta" dateTime={revision.date}>
                            {revision.date}
                        </time>
                    ) : null}
                    {revision.contentExcerpt ? <p className="meta">{revision.contentExcerpt}</p> : null}
                    {revision.contentHtml ? (
                        <div dangerouslySetInnerHTML={{ __html: revision.contentHtml }} />
                    ) : (
                        <p className="meta">{ui('The previous content was not retained.')}</p>
                    )}
                    <div className="forms">
                        {revision.changeType !== 'legacy' ? (
                            <form method="post" action={`${revisionPath}/restore`}>
                                <input type="hidden" name="csrfmiddlewaretoken" value={model.csrfToken} />
                                <input type="hidden" name="expectedUpdatedDate" value={model.updatedDate} />
                                <button type="submit">{ui('Restore this version')}</button>
                            </form>
                        ) : null}
                        <form method="post" action={`${revisionPath}/delete`}>
                            <input type="hidden" name="csrfmiddlewaretoken" value={model.csrfToken} />
                            <input type="hidden" name="expectedUpdatedDate" value={model.updatedDate} />
                            <label>
                                <input type="checkbox" name="confirmDelete" value="yes" required={true} />
                                {ui('Confirm entry deletion')}
                            </label>
                            <button className="danger" type="submit">
                                {ui('Delete entry')}
                            </button>
                        </form>
                    </div>
                </div>
            </details>
        );
    });
    return renderApplicationDocument(
        <html lang={getDocumentLocale()}>
            <head>
                <meta charSet="utf-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <meta name="color-scheme" content="light dark" />
                <meta name="robots" content="noindex,nofollow" />
                <title>{ui('Revision history · {value0} · BLEX', { value0: model.title })}</title>
                <style>{historyPageCss}</style>
            </head>
            <body>
                <header>
                    <a href={`${postPath}/edit`}>{ui('Edit post')}</a>
                    <nav>
                        <a href={`${postPath}/timelapse`}>{ui('Writing timeline')}</a>
                        <a href="/settings/posts">{ui('Manage posts')}</a>
                    </nav>
                </header>
                <main>
                    <h1>{ui('Revision history')}</h1>
                    <p className="meta">
                        {ui('{value0} · {value1, plural, one{# revision} other{# revisions}} · Unlimited retention', {
                            value0: model.title,
                            value1: model.totalCount
                        })}
                    </p>
                    {model.notice ? (
                        <p className="notice" role="status">
                            {model.notice}
                        </p>
                    ) : null}
                    {rows.length ? (
                        <section aria-label={ui('Revisions')}>{rows}</section>
                    ) : (
                        <p className="empty">{ui('No saved revisions.')}</p>
                    )}
                    {pagination}
                </main>
            </body>
        </html>
    );
}
