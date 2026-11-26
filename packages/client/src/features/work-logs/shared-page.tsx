import { useRef, useState } from 'react';
import { ui } from '../../i18n/public-ui.js';
import { pageFields } from './fields';
import type { WorkLogSharedData, WorkLogSharedText } from './page-data';
import { CsrfInput, Pager, pagerButton, primaryButton, textOf, WorkLogMain, WorkLogMedia } from './page-parts';

// The child chains start at the route content.
const article = ':scope > main > div > article';
const logTitleSelector = `${article} > header > p`;
const headlineSelector = `${article} > header > h1`;
const coverTitleSelector = `${article} > figure > figcaption`;
const entrySelector = `${article} > section > ol > li`;

function NewLink({ url }: { url: string }) {
    const field = useRef<HTMLInputElement>(null);
    const [copied, setCopied] = useState(false);
    const copy = () => {
        field.current?.select();
        void navigator.clipboard
            ?.writeText(url)
            .then(() => setCopied(true))
            .catch(() => undefined);
    };
    return (
        <div className="mt-6 rounded-xl border border-line bg-surface p-4">
            <p className="mb-2 text-sm font-semibold" id="share-url-label">
                {ui('Your share link is ready')}
            </p>
            <div className="flex flex-wrap gap-2">
                <input
                    ref={field}
                    aria-labelledby="share-url-label"
                    readOnly
                    value={url}
                    onFocus={(event) => event.currentTarget.select()}
                    className="min-h-11 min-w-0 flex-[1_1_16rem] rounded-lg border border-line bg-surface px-3 text-sm text-content-secondary focus:border-content-hint focus:outline-hidden focus:ring-1 focus:ring-content-hint"
                />
                <button type="button" onClick={copy} className={primaryButton}>
                    {copied ? ui('Link copied') : ui('Copy link')}
                </button>
            </div>
            <span className="sr-only" role="status">
                {copied ? ui('Link copied') : ''}
            </span>
        </div>
    );
}

export function WorkLogSharedPage({ data, text }: { data: WorkLogSharedData; text: WorkLogSharedText }) {
    const { preview, cover } = data;
    return (
        <WorkLogMain data={data} className="mx-auto max-w-5xl px-5 pb-20 sm:px-8">
            {preview && (
                <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-3">
                    <p className="text-sm font-semibold">{ui('Preview shared page')}</p>
                    <form
                        id="work-log-preview-form"
                        method="post"
                        action={`/work-logs/${preview.logId}/share/`}
                        className="flex flex-wrap gap-2"
                    >
                        <CsrfInput value={preview.csrfToken} />
                        <input type="hidden" name="headline" value={text.headline} />
                        <input type="hidden" name={pageFields.selectedEntries} value={preview.selectedIds} />
                        <input type="hidden" name={pageFields.timelinePage} value={String(preview.timelinePage)} />
                        <input
                            type="hidden"
                            name={pageFields.currentSelectionPage}
                            value={String(preview.selectionPage)}
                        />
                        <input type="hidden" name={pageFields.linksPage} value={String(preview.linksPage)} />
                        <button
                            type="submit"
                            name="action"
                            value="edit"
                            className="min-h-11 rounded-lg px-3 text-sm font-semibold text-content-secondary transition hover:bg-surface-subtle active:scale-95"
                        >
                            {ui('Edit share details')}
                        </button>
                        <button type="submit" name="action" value="publish" className={primaryButton}>
                            {ui('Create share link')}
                        </button>
                    </form>
                </div>
            )}
            {data.newLinkUrl && <NewLink url={data.newLinkUrl} />}
            <article>
                <header className="mx-auto max-w-3xl pt-12 pb-8 sm:pt-16 sm:pb-10">
                    <p className="mb-4 break-words text-sm font-semibold text-content-secondary">{text.logTitle}</p>
                    <h1 className="text-balance break-words text-[clamp(2.1rem,5.4vw,4.6rem)] leading-[1.12] font-bold tracking-[-0.05em]">
                        {text.headline}
                    </h1>
                    <div className="mt-5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-content-secondary sm:mt-6">
                        <a
                            href={`/@${encodeURIComponent(data.ownerUsername)}`}
                            className="inline-flex min-h-11 items-center gap-2 font-semibold text-content hover:underline"
                        >
                            <span
                                className="grid size-7 place-items-center rounded-full bg-surface-subtle text-xs"
                                aria-hidden="true"
                            >
                                {data.ownerUsername.slice(0, 1).toUpperCase()}
                            </span>
                            {`@${data.ownerUsername}`}
                        </a>
                        {data.sharedAt && (
                            <>
                                <span aria-hidden="true">·</span>
                                <time dateTime={data.sharedAt.iso}>{data.sharedAt.text}</time>
                            </>
                        )}
                    </div>
                </header>
                {cover && (
                    <figure className="overflow-hidden rounded-2xl border border-line bg-surface">
                        <WorkLogMedia media={cover.media} label={text.coverTitle || text.logTitle} />
                        {cover.hasTitle && (
                            <figcaption className="border-t border-line px-4 py-3 text-sm text-content-secondary sm:px-5">
                                {text.coverTitle}
                            </figcaption>
                        )}
                    </figure>
                )}
                <section
                    aria-labelledby="timeline-heading"
                    className="mx-auto mt-10 max-w-3xl border-t border-line pt-7 sm:mt-14 sm:pt-9"
                >
                    <h2 id="timeline-heading" className="text-2xl font-bold tracking-tight">
                        {ui('How it was made')}
                    </h2>
                    <ol className="ms-1.5 mt-7 border-s border-line">
                        {data.entries.map((entry, index) => {
                            const { title, text: body } = text.entries[index];
                            return (
                                <li key={entry.key} className="relative ps-6 pb-8 last:pb-0 sm:ps-8">
                                    <span
                                        className="absolute start-0 top-1.5 size-2.5 -translate-x-1/2 rounded-full bg-action ring-4 ring-surface-page"
                                        aria-hidden="true"
                                    />
                                    <time
                                        className="block text-xs font-medium text-content-secondary"
                                        dateTime={entry.date.iso}
                                    >
                                        {entry.date.text}
                                    </time>
                                    {title && <h3 className="mt-1.5 break-words text-lg font-semibold">{title}</h3>}
                                    {body && (
                                        <p className="mt-2 whitespace-pre-wrap break-words leading-relaxed text-content-secondary">
                                            {body}
                                        </p>
                                    )}
                                    {entry.media && (
                                        <div className="mt-4 overflow-hidden rounded-xl border border-line">
                                            <WorkLogMedia media={entry.media} label={title || text.logTitle} lazy />
                                        </div>
                                    )}
                                </li>
                            );
                        })}
                    </ol>
                    {preview ? (
                        (preview.previousPage || preview.nextPage) && (
                            <nav aria-label={ui('Navigate pages')} className="mt-4 flex flex-wrap gap-2 text-sm">
                                {preview.previousPage && (
                                    <button
                                        type="submit"
                                        form="work-log-preview-form"
                                        name={pageFields.previewPage}
                                        value={preview.previousPage}
                                        className={pagerButton}
                                    >
                                        {ui('Previous page')}
                                    </button>
                                )}
                                {preview.nextPage && (
                                    <button
                                        type="submit"
                                        form="work-log-preview-form"
                                        name={pageFields.previewPage}
                                        value={preview.nextPage}
                                        className={pagerButton}
                                    >
                                        {ui('Next page')}
                                    </button>
                                )}
                            </nav>
                        )
                    ) : (
                        <Pager links={data.timelineLinks} anchor="timeline-heading" />
                    )}
                </section>
            </article>
        </WorkLogMain>
    );
}

/** The log's title, the headline, and the entries come back from the server markup. */
export function mountPage(data: WorkLogSharedData, content: Element) {
    const logTitle = content.querySelector(logTitleSelector);
    const headline = content.querySelector(headlineSelector);
    const coverTitle = data.cover?.hasTitle ? content.querySelector(coverTitleSelector) : null;
    const rows = Array.from(content.querySelectorAll(entrySelector));
    if (!logTitle || !headline || (data.cover?.hasTitle && !coverTitle) || rows.length !== data.entries.length)
        throw new Error('The shared work log is missing from the page.');
    return (
        <WorkLogSharedPage
            data={data}
            text={{
                logTitle: textOf(logTitle),
                headline: textOf(headline),
                coverTitle: textOf(coverTitle),
                entries: rows.map((row) => ({
                    title: textOf(row.querySelector(':scope > h3')),
                    text: textOf(row.querySelector(':scope > p'))
                }))
            }}
        />
    );
}
