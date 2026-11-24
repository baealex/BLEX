import { SiteIcon } from '../../appearance/icons.js';
import { ui } from '../../i18n/public-ui.js';
import type { WorkLogIndexData, WorkLogIndexText } from './page-data';
import { CsrfInput, Pager, textOf, WorkLogMain } from './page-parts';

// The child chain starts at the route content.
const logTitleSelector = ':scope > main > div > ul > li > a > div > p:first-child';

export function WorkLogIndexPage({ data, text }: { data: WorkLogIndexData; text: WorkLogIndexText }) {
    return (
        <WorkLogMain data={data} className="mx-auto max-w-3xl px-5 py-12 sm:px-8 sm:py-20">
            <h1 className="text-4xl font-bold tracking-tight">{ui('Work logs')}</h1>
            {data.canWrite && (
                <form
                    method="post"
                    action="/work-logs/"
                    className="mt-8 rounded-2xl border border-line bg-surface p-5 sm:p-6"
                >
                    <CsrfInput value={data.csrfToken} />
                    <label htmlFor="work-log-title" className="text-sm font-semibold">
                        {ui('New work log')}
                    </label>
                    <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                        <input
                            id="work-log-title"
                            name="title"
                            required
                            maxLength={100}
                            defaultValue={text.typedTitle}
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
                    {data.error && (
                        <div className="mt-2 text-sm text-danger" role="alert">
                            {data.error}
                        </div>
                    )}
                </form>
            )}
            {data.logs.length > 0 ? (
                <>
                    <ul className="mt-8 divide-y divide-line border-y border-line">
                        {data.logs.map((log, index) => (
                            <li key={log.id}>
                                <a
                                    href={`/work-logs/${log.id}/`}
                                    className="group flex min-h-16 items-center justify-between gap-3 py-4 transition hover:text-content-secondary"
                                >
                                    <div className="min-w-0">
                                        <p className="break-words font-semibold">{text.titles[index]}</p>
                                        <p className="mt-1 text-sm text-content-secondary">
                                            {ui('{value0, plural, one{# entry} other{# entries}}', {
                                                value0: log.entryCount
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
                    <Pager links={data.links} />
                </>
            ) : (
                <p className="mt-6 text-sm text-content-secondary">{ui('No work logs yet.')}</p>
            )}
        </WorkLogMain>
    );
}

/** Log titles and a title typed before a failed save come back from the server markup. */
export function mountPage(data: WorkLogIndexData, content: Element) {
    const titles = Array.from(content.querySelectorAll(logTitleSelector), textOf);
    if (titles.length !== data.logs.length) throw new Error('The work logs are missing from the page.');
    const typed = content.querySelector<HTMLInputElement>(':scope > main > div > form input[name="title"]');
    if (data.canWrite && !typed) throw new Error('The new work log form is missing from the page.');
    return <WorkLogIndexPage data={data} text={{ titles, typedTitle: typed?.getAttribute('value') ?? undefined }} />;
}
