import { ui } from '../../i18n/public-ui.js';
import type { TimelapsePageData } from './management-page-data';

// The child chain starts at the route content, so a frame's HTML cannot match it.
const frameContentSelector = ':scope > main > section > details > .frame-body > div';

/** `frameHtml` holds each frame's sanitized content, in the order of `data.frames`. */
export function TimelapsePage({ data, frameHtml }: { data: TimelapsePageData; frameHtml: string[] }) {
    const { postPath, frames } = data;
    return (
        <>
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
                        value0: data.title,
                        value1: data.totalCount
                    })}
                </p>
                {data.totalCount > frames.length ? (
                    <p className="notice">
                        {ui('Showing {value1} of {value0} frames, including older history.', {
                            value0: data.totalCount,
                            value1: frames.length
                        })}
                    </p>
                ) : null}
                {frames.length ? (
                    <section aria-label={ui('Writing history')}>
                        {frames.map((frame, index) => (
                            // A reader can open or close a frame before the page's code arrives.
                            <details
                                className="frame"
                                key={`${frame.savedAt}:${index}`}
                                open={index === frames.length - 1}
                                suppressHydrationWarning
                            >
                                <summary>
                                    <strong>{frame.title || ui('Untitled post')}</strong>
                                    <span>{`${frame.draft ? ui('Save draft') : ui('Published post')} · ${frame.savedLabel}`}</span>
                                </summary>
                                <div className="frame-body">
                                    <div dangerouslySetInnerHTML={{ __html: frameHtml[index] }} />
                                </div>
                            </details>
                        ))}
                    </section>
                ) : (
                    <p className="empty">{ui('No writing history to display.')}</p>
                )}
            </main>
        </>
    );
}

/** Each frame's HTML comes back from the server markup rather than the page data. */
export function mountPage(data: TimelapsePageData, content: Element) {
    const frameHtml = Array.from(content.querySelectorAll(frameContentSelector), (frame) => frame.innerHTML);
    if (frameHtml.length !== data.frames.length) throw new Error('The writing timeline is missing from the page.');
    return <TimelapsePage data={data} frameHtml={frameHtml} />;
}
