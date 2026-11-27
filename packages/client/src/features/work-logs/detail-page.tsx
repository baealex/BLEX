import { type ChangeEvent, useEffect, useRef, useState } from 'react';
import { SiteIcon } from '../../appearance/icons.js';
import { ui } from '../../i18n/public-ui.js';
import { pageFields } from './fields';
import type { WorkLogDetailData, WorkLogDetailText } from './page-data';
import { CsrfInput, Pager, pagerButton, primaryButton, textOf, WorkLogMain, WorkLogMedia } from './page-parts';

// The child chains start at the route content.
const columns = ':scope > main > div > div';
const logTitleSelector = ':scope > main > div > header > h1';
const timelineSelector = `${columns} > section > ol > li`;
const selectorLabelSelector = `${columns} > section > div > form > fieldset > div > label > span`;
const shareHeadlineSelector = `${columns} > section > ul > li > a`;
const entryFormSelector = `${columns} > section > form`;
const shareFormSelector = `${columns} > section > div > form`;

/** Shows the chosen file's name, including one picked before the page's code arrived. */
function AttachmentField() {
    const input = useRef<HTMLInputElement>(null);
    const [fileName, setFileName] = useState('');
    useEffect(() => {
        setFileName(input.current?.files?.[0]?.name ?? '');
    }, []);
    return (
        <div className="flex flex-wrap items-center gap-3">
            <input
                ref={input}
                id="entry-attachment"
                name="attachment"
                type="file"
                className="peer sr-only"
                aria-describedby="entry-attachment-help"
                accept="image/png,image/jpeg,image/webp,video/mp4,video/webm"
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                    setFileName(event.currentTarget.files?.[0]?.name ?? '')
                }
            />
            <label
                htmlFor="entry-attachment"
                className="inline-flex min-h-11 cursor-pointer items-center rounded-lg bg-surface-subtle px-3 text-sm font-medium transition hover:bg-surface-elevated peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2"
            >
                {ui('Choose file')}
            </label>
            <span role="status" className="min-w-0 break-all text-sm text-content-secondary">
                {fileName}
            </span>
        </div>
    );
}

export function WorkLogDetailPage({ data, text }: { data: WorkLogDetailData; text: WorkLogDetailText }) {
    const { logId, csrfToken } = data;
    return (
        <WorkLogMain data={data} className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-16">
            <a
                href="/work-logs/"
                className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-content-secondary hover:text-content"
            >
                <SiteIcon name="arrow-left" className="text-xs" /> {ui('Work logs')}
            </a>
            <header className="mt-2 flex flex-wrap items-end justify-between gap-3 border-b border-line pb-6">
                <h1 className="max-w-full break-words text-4xl font-bold tracking-tight sm:text-5xl">
                    {text.logTitle}
                </h1>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                    <p className="inline-flex items-center gap-2 text-content-secondary">
                        <SiteIcon name="lock" className="text-xs" /> {ui('Your private work log')}
                    </p>
                    <a
                        className="inline-flex min-h-11 items-center text-danger hover:underline"
                        href={`/work-logs/${logId}/delete/`}
                    >
                        {ui('Delete work log')}
                    </a>
                </div>
            </header>
            <div className="mt-8 grid items-start gap-9 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
                <section aria-labelledby={data.canWrite ? 'entry-heading' : 'entry-timeline'}>
                    {data.canWrite && (
                        <>
                            <h2 id="entry-heading" className="text-xl font-semibold">
                                {ui('Add entry')}
                            </h2>
                            <form
                                method="post"
                                encType="multipart/form-data"
                                action={`/work-logs/${logId}/entry/`}
                                className="mt-4 space-y-3 rounded-2xl border border-line bg-surface p-4 sm:p-5"
                            >
                                <CsrfInput value={csrfToken} />
                                <label className="sr-only" htmlFor="entry-title">
                                    {ui('Entry title')}
                                </label>
                                <input
                                    id="entry-title"
                                    name="title"
                                    maxLength={100}
                                    placeholder={ui('Title (optional)')}
                                    defaultValue={text.typedEntryTitle}
                                    className="min-h-12 w-full rounded-lg border border-line bg-surface px-3 placeholder:text-content-hint focus:border-content-hint focus:outline-hidden focus:ring-1 focus:ring-content-hint"
                                />
                                <label className="sr-only" htmlFor="entry-text">
                                    {ui('Entry content')}
                                </label>
                                <textarea
                                    id="entry-text"
                                    name="text"
                                    maxLength={5000}
                                    rows={3}
                                    placeholder={ui('Record what you tried or learned today.')}
                                    defaultValue={text.typedEntryText}
                                    className="w-full rounded-lg border border-line bg-surface p-3 placeholder:text-content-hint focus:border-content-hint focus:outline-hidden focus:ring-1 focus:ring-content-hint"
                                />
                                <p id="entry-attachment-help" className="text-sm text-content-secondary">
                                    {ui('Image or video (up to 12 MB)')}
                                </p>
                                <AttachmentField />
                                {data.error && (
                                    <div className="text-sm text-danger" role="alert">
                                        {data.error}
                                    </div>
                                )}
                                <button type="submit" className={primaryButton}>
                                    {ui('Save entry')}
                                </button>
                            </form>
                        </>
                    )}
                    <h2 id="entry-timeline" className={`${data.canWrite ? 'mt-9 ' : ''}text-xl font-semibold`}>
                        {ui('Entries')}
                    </h2>
                    <ol className="mt-3 divide-y divide-line">
                        {data.timeline.length > 0 ? (
                            data.timeline.map((entry, index) => {
                                const { title, text: body } = text.timeline[index];
                                return (
                                    <li className="py-5" key={entry.id}>
                                        <div className="flex flex-wrap items-center justify-between gap-x-3 text-sm">
                                            <time className="text-xs text-content-secondary" dateTime={entry.date.iso}>
                                                {entry.date.text}
                                            </time>
                                            <a
                                                href={`/work-logs/${logId}/entry/${entry.id}/delete/`}
                                                className="inline-flex min-h-11 items-center text-danger hover:underline"
                                            >
                                                {ui('Delete entry')}
                                            </a>
                                        </div>
                                        {title && <h3 className="mt-1 break-words font-semibold">{title}</h3>}
                                        {body && (
                                            <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-content-secondary">
                                                {body}
                                            </p>
                                        )}
                                        {entry.media && (
                                            <div className="mt-3 max-w-sm overflow-hidden rounded-lg border border-line">
                                                <WorkLogMedia media={entry.media} label={title || text.logTitle} lazy />
                                            </div>
                                        )}
                                    </li>
                                );
                            })
                        ) : (
                            <li className="py-4 text-sm text-content-secondary">
                                {ui('Your entries will appear here.')}
                            </li>
                        )}
                    </ol>
                    <Pager links={data.timelineLinks} anchor="entry-timeline" />
                </section>
                {(data.canWrite || data.shares.length > 0) && (
                    <section aria-labelledby={data.canWrite ? 'share-heading' : 'share-links'}>
                        {data.canWrite && (
                            <>
                                <h2 id="share-heading" className="text-xl font-semibold">
                                    {ui('Select entries to share')}
                                </h2>
                                <div className="mt-4 rounded-2xl border border-line bg-surface p-4 sm:p-5">
                                    {data.selector.length > 0 ? (
                                        <form method="post" action={`/work-logs/${logId}/share/#share-heading`}>
                                            <CsrfInput value={csrfToken} />
                                            <input
                                                type="hidden"
                                                name={pageFields.selectedEntries}
                                                value={data.savedSelection}
                                            />
                                            <input
                                                type="hidden"
                                                name={pageFields.timelinePage}
                                                value={String(data.timelinePage)}
                                            />
                                            <input
                                                type="hidden"
                                                name={pageFields.currentSelectionPage}
                                                value={String(data.selectionPage)}
                                            />
                                            <input
                                                type="hidden"
                                                name={pageFields.linksPage}
                                                value={String(data.linksPage)}
                                            />
                                            <label htmlFor="share-headline" className="block text-sm font-medium">
                                                {ui('What changed?')}
                                            </label>
                                            <input
                                                id="share-headline"
                                                name="headline"
                                                required
                                                maxLength={120}
                                                defaultValue={text.typedHeadline}
                                                className="mt-2 min-h-12 w-full rounded-lg border border-line bg-surface px-3 focus:border-content-hint focus:outline-hidden focus:ring-1 focus:ring-content-hint"
                                            />
                                            <fieldset className="mt-5">
                                                <legend className="text-sm font-medium">
                                                    {ui('Entries to share')}
                                                </legend>
                                                <div className="mt-2 max-h-72 divide-y divide-line overflow-y-auto border-y border-line">
                                                    {data.selector.map((entry, index) => (
                                                        <label
                                                            key={entry.id}
                                                            className="flex min-h-11 cursor-pointer items-center gap-3 py-2 text-sm"
                                                        >
                                                            <input
                                                                type="checkbox"
                                                                name="entries"
                                                                value={String(entry.id)}
                                                                defaultChecked={entry.checked}
                                                                className="size-4 shrink-0 accent-current"
                                                            />
                                                            <span className="min-w-0 break-words">
                                                                {text.selectorLabels[index] || ui('Attachments')}
                                                            </span>
                                                        </label>
                                                    ))}
                                                </div>
                                            </fieldset>
                                            {data.shareError && (
                                                <div className="mt-3 text-sm text-danger" role="alert">
                                                    {data.shareError}
                                                </div>
                                            )}
                                            <p className="mt-4 text-sm leading-relaxed text-content-secondary">
                                                {ui('Anyone with the link can view the selected entries.')}
                                            </p>
                                            <button
                                                type="submit"
                                                name="action"
                                                value="preview"
                                                className="mt-4 min-h-11 w-full rounded-lg border border-line px-4 text-sm font-semibold transition hover:bg-surface-subtle active:scale-95"
                                            >
                                                {ui('Preview shared page')}
                                            </button>
                                            {(data.previousSelectionPage || data.nextSelectionPage) && (
                                                <nav
                                                    className="mt-2 flex flex-wrap items-center gap-2 text-sm"
                                                    aria-label={ui('Entries to share')}
                                                >
                                                    {data.previousSelectionPage && (
                                                        <button
                                                            type="submit"
                                                            formNoValidate
                                                            name={pageFields.selectionPage}
                                                            value={data.previousSelectionPage}
                                                            className={pagerButton}
                                                        >
                                                            {ui('Recent entries')}
                                                        </button>
                                                    )}
                                                    {data.nextSelectionPage && (
                                                        <button
                                                            type="submit"
                                                            formNoValidate
                                                            name={pageFields.selectionPage}
                                                            value={data.nextSelectionPage}
                                                            className={pagerButton}
                                                        >
                                                            {ui('Previous entry')}
                                                        </button>
                                                    )}
                                                    {data.selectedCount > 0 && (
                                                        <span className="text-content-secondary">
                                                            {ui(
                                                                '{value0, plural, one{# entry selected} other{# entries selected}}',
                                                                { value0: data.selectedCount }
                                                            )}
                                                        </span>
                                                    )}
                                                </nav>
                                            )}
                                        </form>
                                    ) : (
                                        <p className="text-sm text-content-secondary">
                                            {ui('Add an entry before creating a share link.')}
                                        </p>
                                    )}
                                </div>
                            </>
                        )}
                        {data.shares.length > 0 && (
                            <>
                                <h2 id="share-links" className={`${data.canWrite ? 'mt-9 ' : ''}text-xl font-semibold`}>
                                    {ui('Share links')}
                                </h2>
                                <ul className="mt-3 divide-y divide-line border-y border-line">
                                    {data.shares.map((share, index) => (
                                        <li key={share.token} className="flex items-center justify-between gap-2">
                                            <a
                                                href={`/work-logs/share/${share.token}/`}
                                                className="min-w-0 break-words py-3 text-sm hover:underline"
                                            >
                                                {text.shareHeadlines[index]}
                                            </a>
                                            <form
                                                method="post"
                                                action={`/work-logs/${logId}/share/${share.token}/revoke/`}
                                            >
                                                <CsrfInput value={csrfToken} />
                                                <button
                                                    type="submit"
                                                    className="min-h-11 whitespace-nowrap px-2 text-sm text-danger hover:underline"
                                                >
                                                    {ui('Stop sharing')}
                                                </button>
                                            </form>
                                        </li>
                                    ))}
                                </ul>
                                <Pager links={data.shareLinks} anchor="share-links" />
                            </>
                        )}
                    </section>
                )}
            </div>
        </WorkLogMain>
    );
}

/** The log's title, its entries, share headlines, and text typed before a failed save come back from the server markup. */
export function mountPage(data: WorkLogDetailData, content: Element) {
    const logTitle = content.querySelector(logTitleSelector);
    const rows = data.timeline.length ? Array.from(content.querySelectorAll(timelineSelector)) : [];
    const selectorLabels = Array.from(content.querySelectorAll(selectorLabelSelector), textOf);
    const shareHeadlines = Array.from(content.querySelectorAll(shareHeadlineSelector), textOf);
    if (
        !logTitle ||
        rows.length !== data.timeline.length ||
        selectorLabels.length !== (data.canWrite ? data.selector.length : 0) ||
        shareHeadlines.length !== data.shares.length
    )
        throw new Error('The work log is missing from the page.');
    const entryForm = content.querySelector(entryFormSelector);
    const shareForm = content.querySelector(shareFormSelector);
    // A fresh form has no value attribute, and an empty textarea renders the same either way.
    const typed = (form: Element | null, selector: string) =>
        form?.querySelector(selector)?.getAttribute('value') ?? undefined;
    const typedText = entryForm?.querySelector('textarea[name="text"]')?.textContent || undefined;
    return (
        <WorkLogDetailPage
            data={data}
            text={{
                logTitle: textOf(logTitle),
                timeline: rows.map((row) => ({
                    title: textOf(row.querySelector(':scope > h3')),
                    text: textOf(row.querySelector(':scope > p'))
                })),
                selectorLabels,
                shareHeadlines,
                typedEntryTitle: typed(entryForm, 'input[name="title"]'),
                typedEntryText: typedText,
                typedHeadline: typed(shareForm, 'input[name="headline"]')
            }}
        />
    );
}
