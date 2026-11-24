import { ui } from '../../i18n/public-ui.js';
import type { WorkLogDeleteData, WorkLogDeleteText } from './page-data';
import { CsrfInput, textOf, WorkLogMain } from './page-parts';

// The child chains start at the route content.
const logTitleSelector = ':scope > main > div > h1 + p';
const excerptSelector = ':scope > main > div > time + p';

export function WorkLogDeletePage({ data, text }: { data: WorkLogDeleteData; text: WorkLogDeleteText }) {
    const { entry } = data;
    const action = entry ? `/work-logs/${data.logId}/entry/${entry.id}/delete/` : `/work-logs/${data.logId}/delete/`;
    const heading = entry ? ui('Delete entry') : ui('Delete work log');
    return (
        <WorkLogMain data={data} className="mx-auto max-w-xl px-5 py-12 sm:px-8 sm:py-20">
            <h1 className="text-3xl font-bold tracking-tight">{heading}</h1>
            <p className="mt-3 break-words text-lg font-medium">{text.logTitle}</p>
            {entry ? (
                <>
                    <time className="mt-2 block text-sm text-content-secondary" dateTime={entry.date.iso}>
                        {entry.date.text}
                    </time>
                    {entry.hasExcerpt && (
                        <p className="mt-2 break-words text-sm text-content-secondary">{text.excerpt}</p>
                    )}
                    <p className="mt-5 leading-relaxed text-content-secondary">
                        {ui(
                            'This entry and its attachments will disappear from every share link. Links containing only this entry will close.'
                        )}
                    </p>
                </>
            ) : (
                <p className="mt-5 leading-relaxed text-content-secondary">
                    {ui('Delete all entries and attachments in this log and close its share links.')}
                </p>
            )}
            <form method="post" action={action} className="mt-7 flex flex-wrap gap-2">
                <CsrfInput value={data.csrfToken} />
                <a
                    className="inline-flex min-h-11 items-center rounded-lg border border-line px-4 text-sm font-semibold hover:bg-surface-subtle"
                    href={`/work-logs/${data.logId}/`}
                >
                    {ui('Cancel')}
                </a>
                <button
                    type="submit"
                    className="min-h-11 rounded-lg border border-danger-line bg-danger-surface px-4 text-sm font-semibold text-danger transition hover:opacity-80 active:scale-95"
                >
                    {heading}
                </button>
            </form>
        </WorkLogMain>
    );
}

/** The log's title and the entry's excerpt come back from the server markup. */
export function mountPage(data: WorkLogDeleteData, content: Element) {
    const logTitle = content.querySelector(logTitleSelector);
    const excerpt = data.entry?.hasExcerpt ? content.querySelector(excerptSelector) : null;
    if (!logTitle || (data.entry?.hasExcerpt && !excerpt)) throw new Error('The work log is missing from the page.');
    return <WorkLogDeletePage data={data} text={{ logTitle: textOf(logTitle), excerpt: textOf(excerpt) }} />;
}
