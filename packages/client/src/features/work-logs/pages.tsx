import { getDocumentLocale } from '../../i18n/locale.js';
import { ui } from '../../i18n/public-ui.js';
import { SiteIcon } from '../../appearance/icons';
import { SiteFooter, SiteHeader, SiteTheme } from '../../appearance/shell';
import { renderApplicationDocument } from '../../application/document';
import type {
    PageChrome,
    PagerView,
    WorkLogDeleteProps,
    WorkLogDetailProps,
    WorkLogEntryView,
    WorkLogIndexProps,
    WorkLogSharedProps
} from '@blex/contracts/work-logs';
import { koreanDate, koreanDateTime } from '../../lib/date-format';
import { pageFields } from './fields';

interface PageOptions extends PageChrome {
    title: string;
    className: string;
    shareMeta?: {
        title: string;
        description: string;
        url: string;
        imageUrl?: string;
    };
}

const pagerLink = 'inline-flex min-h-11 items-center rounded-lg border border-line px-3 hover:bg-surface-subtle';
const pagerButton = 'min-h-11 rounded-lg border border-line px-3 hover:bg-surface-subtle';
const primaryButton =
    'min-h-11 rounded-lg bg-action px-4 text-sm font-semibold text-content-inverted transition hover:bg-action-hover active:scale-95';

function shell(options: PageOptions, content: React.ReactNode): string {
    return renderApplicationDocument(
        <html lang={getDocumentLocale()}>
            <head>
                <meta charSet="utf-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <meta name="referrer" content="strict-origin" />
                <meta name="robots" content="noindex,nofollow,noarchive" />
                <meta name="color-scheme" content="light dark" />
                <title>{options.title}</title>
                <SiteTheme />
                {options.shareMeta && (
                    <>
                        <meta property="og:type" content="article" />
                        <meta property="og:title" content={options.shareMeta.title} />
                        <meta property="og:description" content={options.shareMeta.description} />
                        <meta property="og:url" content={options.shareMeta.url} />
                        <meta
                            name="twitter:card"
                            content={options.shareMeta.imageUrl ? 'summary_large_image' : 'summary'}
                        />
                        {options.shareMeta.imageUrl && (
                            <meta property="og:image" content={options.shareMeta.imageUrl} />
                        )}
                    </>
                )}
            </head>
            <body className="bg-surface-page text-content antialiased">
                <SiteHeader brand={options.brand} viewer={options.viewer} />
                <main className="min-h-[calc(100vh-10.5rem)]">
                    <div className={options.className}>{content}</div>
                </main>
                <SiteFooter brand={options.brand} />
            </body>
        </html>
    );
}

function csrfInput(value: string) {
    return <input type="hidden" name="csrfmiddlewaretoken" value={value} />;
}

function truncateChars(text: string, limit: number): string {
    const characters = Array.from(text);
    return characters.length > limit ? `${characters.slice(0, limit - 1).join('')}…` : text;
}

function pager(pagerView: PagerView) {
    if (!pagerView.previous && !pagerView.next) return null;
    const suffix = pagerView.anchor ? `#${pagerView.anchor}` : '';
    return (
        <nav aria-label={ui('Navigate pages')} className="mt-4 flex flex-wrap gap-2 text-sm">
            {pagerView.previous && (
                <a className={pagerLink} href={`${pagerView.previous}${suffix}`}>
                    {ui('Previous page')}
                </a>
            )}
            {pagerView.next && (
                <a className={pagerLink} href={`${pagerView.next}${suffix}`}>
                    {ui('Next page')}
                </a>
            )}
        </nav>
    );
}

export function renderWorkLogIndex(props: WorkLogIndexProps): string {
    return shell(
        {
            title: ui('Work logs · {value0}', { value0: props.brand?.siteName ?? 'BLEX' }),
            className: 'mx-auto max-w-3xl px-5 py-12 sm:px-8 sm:py-20',
            brand: props.brand,
            viewer: props.viewer
        },
        <>
            <h1 className="text-4xl font-bold tracking-tight">{ui('Work logs')}</h1>
            {props.canWrite && (
                <form
                    method="post"
                    action="/work-logs/"
                    className="mt-8 rounded-2xl border border-line bg-surface p-5 sm:p-6"
                >
                    {csrfInput(props.csrfToken)}
                    <label htmlFor="work-log-title" className="text-sm font-semibold">
                        {ui('New work log')}
                    </label>
                    <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                        <input
                            id="work-log-title"
                            name="title"
                            required
                            maxLength={100}
                            defaultValue={props.title}
                            placeholder={ui('What are you working on?')}
                            className="min-h-12 min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 text-content placeholder:text-content-hint"
                        />
                        <button
                            type="submit"
                            className="min-h-12 rounded-lg bg-action px-5 text-sm font-semibold text-content-inverted transition hover:bg-action-hover active:scale-95"
                        >
                            {ui('Create work log')}
                        </button>
                    </div>
                    {props.error && (
                        <div className="mt-2 text-sm text-danger" role="alert">
                            {props.error}
                        </div>
                    )}
                </form>
            )}
            {props.logs.length > 0 ? (
                <>
                    <ul className="mt-8 divide-y divide-line border-y border-line">
                        {props.logs.map((log) => (
                            <li key={log.id}>
                                <a
                                    href={`/work-logs/${log.id}/`}
                                    className="group flex min-h-16 items-center justify-between gap-3 py-4 transition hover:text-content-secondary"
                                >
                                    <div className="min-w-0">
                                        <p className="break-words font-semibold">{log.title}</p>
                                        <p className="mt-1 text-sm text-content-secondary">
                                            {ui('{value0, plural, one{# entry} other{# entries}}', {
                                                value0: log.entryCount ?? 0
                                            })}
                                        </p>
                                    </div>
                                    <SiteIcon
                                        name="arrow-right"
                                        className="text-xs text-content-hint transition group-hover:translate-x-1"
                                    />
                                </a>
                            </li>
                        ))}
                    </ul>
                    {pager(props.links)}
                </>
            ) : (
                <p className="mt-6 text-sm text-content-secondary">{ui('No work logs yet.')}</p>
            )}
        </>
    );
}

function mediaElement(entry: WorkLogEntryView, logTitle: string, url: string, lazy = false) {
    const label = entry.title || logTitle;
    const className = 'block max-h-[34rem] w-full bg-surface-subtle object-contain';
    return entry.mediaType.startsWith('video/') ? (
        <video src={url} controls playsInline preload="metadata" aria-label={label} className={className} />
    ) : (
        <img src={url} alt={label} loading={lazy ? 'lazy' : undefined} className={className} />
    );
}

export function renderWorkLogDetail(props: WorkLogDetailProps): string {
    const selectorIds = new Set(props.selector.map((entry) => entry.id));
    const savedSelection = props.selectedIds
        .filter((id) => !selectorIds.has(id))
        .sort((a, b) => a - b)
        .join(',');
    const previousSelectionPage = props.selectionLinks.previous
        ? new URL(props.selectionLinks.previous, 'https://work-log.invalid').searchParams.get(pageFields.selectionPage)
        : null;
    const nextSelectionPage = props.selectionLinks.next
        ? new URL(props.selectionLinks.next, 'https://work-log.invalid').searchParams.get(pageFields.selectionPage)
        : null;
    return shell(
        {
            title: ui('{value0} · Work log', { value0: props.log.title }),
            className: 'mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-16',
            brand: props.brand,
            viewer: props.viewer
        },
        <>
            <a
                href="/work-logs/"
                className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-content-secondary hover:text-content"
            >
                <SiteIcon name="arrow-left" className="text-xs" /> {ui('Work logs')}
            </a>
            <header className="mt-2 flex flex-wrap items-end justify-between gap-3 border-b border-line pb-6">
                <h1 className="max-w-full break-words text-4xl font-bold tracking-tight sm:text-5xl">
                    {props.log.title}
                </h1>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                    <p className="inline-flex items-center gap-2 text-content-secondary">
                        <SiteIcon name="lock" className="text-xs" /> {ui('Your private work log')}
                    </p>
                    <a
                        className="inline-flex min-h-11 items-center text-danger hover:underline"
                        href={`/work-logs/${props.log.id}/delete/`}
                    >
                        {ui('Delete work log')}
                    </a>
                </div>
            </header>
            <div className="mt-8 grid items-start gap-9 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
                <section aria-labelledby={props.canWrite ? 'entry-heading' : 'entry-timeline'}>
                    {props.canWrite && (
                        <>
                            <h2 id="entry-heading" className="text-xl font-semibold">
                                {ui('Add entry')}
                            </h2>
                            <form
                                method="post"
                                encType="multipart/form-data"
                                action={`/work-logs/${props.log.id}/entry/`}
                                className="mt-4 space-y-3 rounded-2xl border border-line bg-surface p-4 sm:p-5"
                            >
                                {csrfInput(props.csrfToken)}
                                <label className="sr-only" htmlFor="entry-title">
                                    {ui('Entry title')}
                                </label>
                                <input
                                    id="entry-title"
                                    name="title"
                                    maxLength={100}
                                    placeholder={ui('Title (optional)')}
                                    defaultValue={props.entryTitle}
                                    className="min-h-12 w-full rounded-lg border border-line bg-surface px-3 placeholder:text-content-hint"
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
                                    defaultValue={props.entryText}
                                    className="w-full rounded-lg border border-line bg-surface p-3 placeholder:text-content-hint"
                                />
                                <p id="entry-attachment-help" className="text-sm text-content-secondary">
                                    {ui('Image or video (up to 12 MB)')}
                                </p>
                                <div className="flex flex-wrap items-center gap-3">
                                    <input
                                        id="entry-attachment"
                                        name="attachment"
                                        type="file"
                                        className="peer sr-only"
                                        data-work-log-attachment=""
                                        aria-describedby="entry-attachment-help"
                                        accept="image/png,image/jpeg,image/webp,video/mp4,video/webm"
                                    />
                                    <label
                                        htmlFor="entry-attachment"
                                        className="inline-flex min-h-11 cursor-pointer items-center rounded-lg bg-surface-subtle px-3 text-sm font-medium transition hover:bg-surface-elevated peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2"
                                    >
                                        {ui('Choose file')}
                                    </label>
                                    <span
                                        role="status"
                                        data-work-log-filename=""
                                        className="min-w-0 break-all text-sm text-content-secondary"
                                    />
                                </div>
                                {props.error && (
                                    <div className="text-sm text-danger" role="alert">
                                        {props.error}
                                    </div>
                                )}
                                <button type="submit" className={primaryButton}>
                                    {ui('Save entry')}
                                </button>
                            </form>
                        </>
                    )}
                    <h2 id="entry-timeline" className={`${props.canWrite ? 'mt-9 ' : ''}text-xl font-semibold`}>
                        {ui('Entries')}
                    </h2>
                    <ol className="mt-3 divide-y divide-line">
                        {props.timeline.length > 0 ? (
                            props.timeline.map((entry) => (
                                <li className="py-5" key={entry.id}>
                                    <div className="flex flex-wrap items-center justify-between gap-x-3 text-sm">
                                        <time className="text-xs text-content-secondary" dateTime={entry.createdAt}>
                                            {koreanDate(entry.createdAt)}
                                        </time>
                                        <a
                                            href={`/work-logs/${props.log.id}/entry/${entry.id}/delete/`}
                                            className="inline-flex min-h-11 items-center text-danger hover:underline"
                                        >
                                            {ui('Delete entry')}
                                        </a>
                                    </div>
                                    {entry.title && <h3 className="mt-1 break-words font-semibold">{entry.title}</h3>}
                                    {entry.text && (
                                        <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-content-secondary">
                                            {entry.text}
                                        </p>
                                    )}
                                    {entry.attachment && (
                                        <div className="mt-3 max-w-sm overflow-hidden rounded-lg border border-line">
                                            {mediaElement(entry, props.log.title, props.mediaUrl(entry), true)}
                                        </div>
                                    )}
                                </li>
                            ))
                        ) : (
                            <li className="py-4 text-sm text-content-secondary">
                                {ui('Your entries will appear here.')}
                            </li>
                        )}
                    </ol>
                    {pager({
                        ...props.timelineLinks,
                        anchor: 'entry-timeline'
                    })}
                </section>
                {(props.canWrite || props.shares.length > 0) && (
                    <section aria-labelledby={props.canWrite ? 'share-heading' : 'share-links'}>
                        {props.canWrite && (
                            <>
                                <h2 id="share-heading" className="text-xl font-semibold">
                                    {ui('Select entries to share')}
                                </h2>
                                <div className="mt-4 rounded-2xl border border-line bg-surface p-4 sm:p-5">
                                    {props.selector.length > 0 ? (
                                        <form method="post" action={`/work-logs/${props.log.id}/share/#share-heading`}>
                                            {csrfInput(props.csrfToken)}
                                            <input
                                                type="hidden"
                                                name={pageFields.selectedEntries}
                                                value={savedSelection}
                                            />
                                            <input
                                                type="hidden"
                                                name={pageFields.timelinePage}
                                                value={String(props.timelinePage)}
                                            />
                                            <input
                                                type="hidden"
                                                name={pageFields.currentSelectionPage}
                                                value={String(props.selectionPage)}
                                            />
                                            <input
                                                type="hidden"
                                                name={pageFields.linksPage}
                                                value={String(props.linksPage)}
                                            />
                                            <label htmlFor="share-headline" className="block text-sm font-medium">
                                                {ui('What changed?')}
                                            </label>
                                            <input
                                                id="share-headline"
                                                name="headline"
                                                required
                                                maxLength={120}
                                                defaultValue={props.headline}
                                                className="mt-2 min-h-12 w-full rounded-lg border border-line bg-surface px-3"
                                            />
                                            <fieldset className="mt-5">
                                                <legend className="text-sm font-medium">
                                                    {ui('Entries to share')}
                                                </legend>
                                                <div className="mt-2 max-h-72 divide-y divide-line overflow-y-auto border-y border-line">
                                                    {props.selector.map((entry) => (
                                                        <label
                                                            key={entry.id}
                                                            className="flex min-h-11 cursor-pointer items-center gap-3 py-2 text-sm"
                                                        >
                                                            <input
                                                                type="checkbox"
                                                                name="entries"
                                                                value={String(entry.id)}
                                                                defaultChecked={props.selectedIds.includes(entry.id)}
                                                                className="size-4 shrink-0 accent-current"
                                                            />
                                                            <span className="min-w-0 break-words">
                                                                {entry.title ||
                                                                    (entry.text
                                                                        ? truncateChars(entry.text, 52)
                                                                        : ui('Attachments'))}
                                                            </span>
                                                        </label>
                                                    ))}
                                                </div>
                                            </fieldset>
                                            {props.shareError && (
                                                <div className="mt-3 text-sm text-danger" role="alert">
                                                    {props.shareError}
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
                                            {(previousSelectionPage || nextSelectionPage) && (
                                                <nav
                                                    className="mt-2 flex flex-wrap items-center gap-2 text-sm"
                                                    aria-label={ui('Entries to share')}
                                                >
                                                    {previousSelectionPage && (
                                                        <button
                                                            type="submit"
                                                            formNoValidate
                                                            name={pageFields.selectionPage}
                                                            value={previousSelectionPage}
                                                            className={pagerButton}
                                                        >
                                                            {ui('Recent entries')}
                                                        </button>
                                                    )}
                                                    {nextSelectionPage && (
                                                        <button
                                                            type="submit"
                                                            formNoValidate
                                                            name={pageFields.selectionPage}
                                                            value={nextSelectionPage}
                                                            className={pagerButton}
                                                        >
                                                            {ui('Previous entry')}
                                                        </button>
                                                    )}
                                                    {props.selectedIds.length > 0 && (
                                                        <span className="text-content-secondary">
                                                            {ui(
                                                                '{value0, plural, one{# entry selected} other{# entries selected}}',
                                                                { value0: props.selectedIds.length }
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
                        {props.shares.length > 0 && (
                            <>
                                <h2
                                    id="share-links"
                                    className={`${props.canWrite ? 'mt-9 ' : ''}text-xl font-semibold`}
                                >
                                    {ui('Share links')}
                                </h2>
                                <ul className="mt-3 divide-y divide-line border-y border-line">
                                    {props.shares.map((share) => (
                                        <li key={share.id} className="flex items-center justify-between gap-2">
                                            <a
                                                href={`/work-logs/share/${share.token}/`}
                                                className="min-w-0 break-words py-3 text-sm hover:underline"
                                            >
                                                {share.headline}
                                            </a>
                                            <form
                                                method="post"
                                                action={`/work-logs/${props.log.id}/share/${share.token}/revoke/`}
                                            >
                                                {csrfInput(props.csrfToken)}
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
                                {pager({
                                    ...props.shareLinks,
                                    anchor: 'share-links'
                                })}
                            </>
                        )}
                    </section>
                )}
            </div>
        </>
    );
}

export function renderWorkLogDelete(props: WorkLogDeleteProps): string {
    const action = props.entry
        ? `/work-logs/${props.log.id}/entry/${props.entry.id}/delete/`
        : `/work-logs/${props.log.id}/delete/`;
    const heading = props.entry ? ui('Delete entry') : ui('Delete work log');
    return shell(
        {
            title: `${heading} · ${props.log.title}`,
            className: 'mx-auto max-w-xl px-5 py-12 sm:px-8 sm:py-20',
            brand: props.brand,
            viewer: props.viewer
        },
        <>
            <h1 className="text-3xl font-bold tracking-tight">{heading}</h1>
            <p className="mt-3 break-words text-lg font-medium">{props.log.title}</p>
            {props.entry ? (
                <>
                    <time className="mt-2 block text-sm text-content-secondary" dateTime={props.entry.createdAt}>
                        {koreanDateTime(props.entry.createdAt)}
                    </time>
                    {(props.entry.title || props.entry.text) && (
                        <p className="mt-2 break-words text-sm text-content-secondary">
                            {truncateChars(props.entry.title || props.entry.text, 120)}
                        </p>
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
                {csrfInput(props.csrfToken)}
                <a
                    className="inline-flex min-h-11 items-center rounded-lg border border-line px-4 text-sm font-semibold hover:bg-surface-subtle"
                    href={`/work-logs/${props.log.id}/`}
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
        </>
    );
}

export function renderWorkLogShared(props: WorkLogSharedProps): string {
    const previewPage = (link?: string) =>
        link ? new URL(link, 'https://work-log.invalid').searchParams.get('page') : null;
    const previousPage = props.preview ? previewPage(props.timelineLinks.previous) : null;
    const nextPage = props.preview ? previewPage(props.timelineLinks.next) : null;
    return shell(
        {
            title: `${props.headline} · ${props.log.title}`,
            className: 'mx-auto max-w-5xl px-5 pb-20 sm:px-8',
            brand: props.brand,
            viewer: props.viewer,
            shareMeta: props.preview
                ? undefined
                : {
                      title: props.headline,
                      description: `${props.log.title} · ${props.ownerUsername}`,
                      url: props.shareUrl,
                      imageUrl: props.imageUrl ?? undefined
                  }
        },
        <>
            {props.preview && (
                <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-3">
                    <p className="text-sm font-semibold">{ui('Preview shared page')}</p>
                    <form
                        id="work-log-preview-form"
                        method="post"
                        action={`/work-logs/${props.log.id}/share/`}
                        className="flex flex-wrap gap-2"
                    >
                        {csrfInput(props.csrfToken)}
                        <input type="hidden" name="headline" value={props.headline} />
                        <input
                            type="hidden"
                            name={pageFields.selectedEntries}
                            value={(props.selectedIds ?? []).join(',')}
                        />
                        <input type="hidden" name={pageFields.timelinePage} value={String(props.timelinePage ?? 1)} />
                        <input
                            type="hidden"
                            name={pageFields.currentSelectionPage}
                            value={String(props.selectionPage ?? 1)}
                        />
                        <input type="hidden" name={pageFields.linksPage} value={String(props.linksPage ?? 1)} />
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
            {!props.preview && props.newLink && (
                <div className="mt-6 rounded-xl border border-line bg-surface p-4" data-work-log-share-link="">
                    <p className="mb-2 text-sm font-semibold" id="share-url-label">
                        {ui('Your share link is ready')}
                    </p>
                    <div className="flex flex-wrap gap-2">
                        <input
                            aria-labelledby="share-url-label"
                            readOnly
                            value={props.shareUrl}
                            className="min-h-11 min-w-0 flex-[1_1_16rem] rounded-lg border border-line bg-surface px-3 text-sm text-content-secondary"
                        />
                        <button type="button" data-work-log-copy="" className={primaryButton}>
                            {ui('Copy link')}
                        </button>
                    </div>
                    <span className="sr-only" role="status" data-work-log-copied="" />
                </div>
            )}
            <article>
                <header className="mx-auto max-w-3xl pt-12 pb-8 sm:pt-16 sm:pb-10">
                    <p className="mb-4 break-words text-sm font-semibold text-content-secondary">{props.log.title}</p>
                    <h1 className="text-balance break-words text-[clamp(2.1rem,5.4vw,4.6rem)] leading-[1.12] font-bold tracking-[-0.05em]">
                        {props.headline}
                    </h1>
                    <div className="mt-5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-content-secondary sm:mt-6">
                        <a
                            href={`/@${encodeURIComponent(props.ownerUsername)}`}
                            className="inline-flex min-h-11 items-center gap-2 font-semibold text-content hover:underline"
                        >
                            <span
                                className="grid size-7 place-items-center rounded-full bg-surface-subtle text-xs"
                                aria-hidden="true"
                            >
                                {props.ownerUsername.slice(0, 1).toUpperCase()}
                            </span>
                            {`@${props.ownerUsername}`}
                        </a>
                        {props.sharedAt && (
                            <>
                                <span aria-hidden="true">·</span>
                                <time dateTime={props.sharedAt}>{koreanDate(props.sharedAt)}</time>
                            </>
                        )}
                    </div>
                </header>
                {props.cover && (
                    <figure className="overflow-hidden rounded-2xl border border-line bg-surface">
                        {mediaElement(props.cover, props.log.title, props.mediaUrl(props.cover))}
                        {props.cover.title && (
                            <figcaption className="border-t border-line px-4 py-3 text-sm text-content-secondary sm:px-5">
                                {props.cover.title}
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
                        {props.entries.map((entry) => (
                            <li key={entry.id} className="relative ps-6 pb-8 last:pb-0 sm:ps-8">
                                <span
                                    className="absolute start-0 top-1.5 size-2.5 -translate-x-1/2 rounded-full bg-action ring-4 ring-surface-page"
                                    aria-hidden="true"
                                />
                                <time
                                    className="block text-xs font-medium text-content-secondary"
                                    dateTime={entry.createdAt}
                                >
                                    {koreanDate(entry.createdAt)}
                                </time>
                                {entry.title && (
                                    <h3 className="mt-1.5 break-words text-lg font-semibold">{entry.title}</h3>
                                )}
                                {entry.text && (
                                    <p className="mt-2 whitespace-pre-wrap break-words leading-relaxed text-content-secondary">
                                        {entry.text}
                                    </p>
                                )}
                                {entry.attachment && entry.id !== props.cover?.id && (
                                    <div className="mt-4 overflow-hidden rounded-xl border border-line">
                                        {mediaElement(entry, props.log.title, props.mediaUrl(entry), true)}
                                    </div>
                                )}
                            </li>
                        ))}
                    </ol>
                    {props.preview
                        ? (previousPage || nextPage) && (
                              <nav aria-label={ui('Navigate pages')} className="mt-4 flex flex-wrap gap-2 text-sm">
                                  {previousPage && (
                                      <button
                                          type="submit"
                                          form="work-log-preview-form"
                                          name={pageFields.previewPage}
                                          value={previousPage}
                                          className={pagerButton}
                                      >
                                          {ui('Previous page')}
                                      </button>
                                  )}
                                  {nextPage && (
                                      <button
                                          type="submit"
                                          form="work-log-preview-form"
                                          name={pageFields.previewPage}
                                          value={nextPage}
                                          className={pagerButton}
                                      >
                                          {ui('Next page')}
                                      </button>
                                  )}
                              </nav>
                          )
                        : pager({
                              ...props.timelineLinks,
                              anchor: 'timeline-heading'
                          })}
                </section>
            </article>
        </>
    );
}
