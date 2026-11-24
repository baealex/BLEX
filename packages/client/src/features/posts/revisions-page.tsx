import { ui } from '../../i18n/public-ui.js';
import type { RevisionBody, RevisionsPageData } from './management-page-data';

// The child chains start at the route content, so revision HTML inside a row cannot match them.
const revisionRowSelector = ':scope > main > section > details';
const excerptSelector = ':scope > .revision-body > p.meta';
const contentSelector = ':scope > .revision-body > div:not(.forms)';

function changeLabel(changeType: string): string {
    if (changeType === 'restore') return ui('Version before restore');
    if (changeType === 'legacy') return ui('Previous entry');
    return ui('Version before edit');
}

export function RevisionsPage({ data, bodies }: { data: RevisionsPageData; bodies: RevisionBody[] }) {
    const { postPath, pagination } = data;
    return (
        <>
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
                        value0: data.title,
                        value1: data.totalCount
                    })}
                </p>
                {data.notice ? (
                    <p className="notice" role="status">
                        {data.notice}
                    </p>
                ) : null}
                {data.revisions.length ? (
                    <section aria-label={ui('Revisions')}>
                        {data.revisions.map((revision, index) => {
                            const revisionTitle =
                                revision.title === '_NO_CHANGED_'
                                    ? ui('No title history')
                                    : revision.title || ui('Untitled post');
                            const revisionPath = `${postPath}/revisions/${revision.id}`;
                            const body = bodies[index];
                            return (
                                // A reader can open a row before the page's code arrives.
                                <details className="revision" key={revision.id} suppressHydrationWarning>
                                    <summary>
                                        <strong>{revisionTitle}</strong>
                                        <span>{`${changeLabel(revision.changeType)} · ${revision.savedLabel} · ${revision.actor ? `@${revision.actor}` : ui('No author')}`}</span>
                                    </summary>
                                    <div className="revision-body">
                                        {revision.date ? (
                                            <time className="meta" dateTime={revision.date}>
                                                {revision.date}
                                            </time>
                                        ) : null}
                                        {revision.hasExcerpt ? <p className="meta">{body.excerpt}</p> : null}
                                        {revision.hasContent ? (
                                            <div dangerouslySetInnerHTML={{ __html: body.html }} />
                                        ) : (
                                            <p className="meta">{ui('The previous content was not retained.')}</p>
                                        )}
                                        <div className="forms">
                                            {revision.changeType !== 'legacy' ? (
                                                <form method="post" action={`${revisionPath}/restore`}>
                                                    <input
                                                        type="hidden"
                                                        name="csrfmiddlewaretoken"
                                                        value={data.csrfToken}
                                                    />
                                                    <input
                                                        type="hidden"
                                                        name="expectedUpdatedDate"
                                                        value={data.updatedDate}
                                                    />
                                                    <button type="submit">{ui('Restore this version')}</button>
                                                </form>
                                            ) : null}
                                            <form method="post" action={`${revisionPath}/delete`}>
                                                <input
                                                    type="hidden"
                                                    name="csrfmiddlewaretoken"
                                                    value={data.csrfToken}
                                                />
                                                <input
                                                    type="hidden"
                                                    name="expectedUpdatedDate"
                                                    value={data.updatedDate}
                                                />
                                                <label>
                                                    <input
                                                        type="checkbox"
                                                        name="confirmDelete"
                                                        value="yes"
                                                        required={true}
                                                    />
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
                        })}
                    </section>
                ) : (
                    <p className="empty">{ui('No saved revisions.')}</p>
                )}
                {pagination.lastPage > 1 ? (
                    <nav className="pager" aria-label={ui('Navigate pages')}>
                        {pagination.page > 1 ? (
                            <a href={`${postPath}/revisions?page=${pagination.page - 1}`}>{ui('Previous')}</a>
                        ) : null}
                        <span>{`${pagination.page} / ${pagination.lastPage}`}</span>
                        {pagination.page < pagination.lastPage ? (
                            <a href={`${postPath}/revisions?page=${pagination.page + 1}`}>{ui('Next')}</a>
                        ) : null}
                    </nav>
                ) : null}
            </main>
        </>
    );
}

/** Revision text and HTML come back from the server markup rather than the page data. */
export function mountPage(data: RevisionsPageData, content: Element) {
    const rows = content.querySelectorAll(revisionRowSelector);
    if (rows.length !== data.revisions.length) throw new Error('The revision history is missing from the page.');
    const bodies = data.revisions.map((revision, index): RevisionBody => {
        const row = rows[index];
        const excerpt = revision.hasExcerpt ? row.querySelector(excerptSelector) : null;
        const html = revision.hasContent ? row.querySelector(contentSelector) : null;
        if ((revision.hasExcerpt && !excerpt) || (revision.hasContent && !html))
            throw new Error('A revision is missing from the page.');
        return { excerpt: excerpt?.textContent ?? '', html: html?.innerHTML ?? '' };
    });
    return <RevisionsPage data={data} bodies={bodies} />;
}
