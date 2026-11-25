import { SiteIcon } from '../../appearance/icons.js';
import { SiteFooter } from '../../appearance/shell.js';
import { ui } from '../../i18n/public-ui.js';
import { EmptyState, PageNavigation } from '../discovery/post-list';
import { seriesDescriptionSelector } from './author-markup';
import type { AuthorSeriesData } from './author-page-data';

const pill =
    'inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold transition-colors duration-150 active:scale-[0.98] sm:w-auto';
const sortLink = 'inline-flex min-h-11 items-center px-2 text-sm transition-colors duration-150';

function MetaDot() {
    return <span aria-hidden="true" className="size-1 shrink-0 rounded-full bg-content-hint" />;
}

/** A series reads like a book's contents page: numbered titles running to their dates. */
export function AuthorSeriesDetailPage({ data, descriptionHtml }: { data: AuthorSeriesData; descriptionHtml: string }) {
    const { author, sortOrder, seriesPath } = data;
    const action = data.editHref ? (
        <a href={data.editHref} className={`${pill} text-content ring-1 ring-line hover:ring-line-strong`}>
            <SiteIcon name="pencil" className="text-xs" />
            {ui('Edit series')}
        </a>
    ) : data.startHref ? (
        <a href={data.startHref} className={`${pill} bg-action text-content-inverted hover:bg-action-hover`}>
            {ui('Start from part 1')}
            <SiteIcon name="arrow-right" className="text-xs" />
        </a>
    ) : null;
    return (
        <>
            <main>
                <div className="mx-auto w-full max-w-3xl px-4 pt-10 pb-20 sm:px-6 sm:pt-14">
                    <header>
                        <p className="flex items-center gap-1.5 text-[13px] font-semibold text-content-secondary">
                            <SiteIcon name="stack-2" className="text-sm" />
                            {ui('Series')}
                        </p>
                        <h1 className="mt-2 text-[1.75rem] font-bold leading-tight tracking-tight break-words break-keep text-content sm:text-4xl">
                            {data.name}
                        </h1>
                        {data.hasDescription ? (
                            <div
                                className="mt-3.5 space-y-3 text-base leading-relaxed break-keep text-content-secondary sm:text-[17px] [&_a]:underline [&_a]:underline-offset-2"
                                dangerouslySetInnerHTML={{ __html: descriptionHtml }}
                            />
                        ) : null}
                        <div className="mt-7 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex min-w-0 items-center gap-3">
                                <a href={author.href} className="group shrink-0">
                                    <img
                                        className="size-10 rounded-full object-cover ring-1 ring-line transition-shadow duration-150 group-hover:ring-line-strong"
                                        src={author.avatar}
                                        alt={author.username}
                                    />
                                </a>
                                <div className="min-w-0">
                                    <a
                                        href={author.href}
                                        className="text-sm font-semibold text-content transition-colors duration-150 hover:text-content-secondary"
                                    >
                                        {author.username}
                                    </a>
                                    <p className="flex flex-wrap items-center gap-x-2 text-[13px] leading-6 text-content-secondary">
                                        <span>
                                            {ui('{value0, plural, one{# post} other{# posts}}', { value0: data.count })}
                                        </span>
                                        <MetaDot />
                                        <span>{ui('Updated {value0}', { value0: data.updated })}</span>
                                    </p>
                                </div>
                            </div>
                            {action}
                        </div>
                    </header>
                    {data.posts.length ? (
                        <section className="mt-14" aria-labelledby="series-contents-heading">
                            <div className="flex items-center justify-between gap-4">
                                <h2
                                    id="series-contents-heading"
                                    className="text-xl font-bold tracking-tight text-content"
                                >
                                    {ui('Table of contents')}
                                </h2>
                                <nav aria-label={ui('Sort posts')} className="-mr-2 flex items-center">
                                    <a
                                        href={`${seriesPath}?sort=asc`}
                                        aria-current={sortOrder === 'asc' ? 'page' : undefined}
                                        className={`${sortLink} ${sortOrder === 'asc' ? 'font-semibold text-content' : 'text-content-secondary hover:text-content'}`}
                                    >
                                        {ui('From part 1')}
                                    </a>
                                    <span aria-hidden="true" className="size-[3px] rounded-full bg-line-strong" />
                                    <a
                                        href={seriesPath}
                                        aria-current={sortOrder === 'desc' ? 'page' : undefined}
                                        className={`${sortLink} ${sortOrder === 'desc' ? 'font-semibold text-content' : 'text-content-secondary hover:text-content'}`}
                                    >
                                        {ui('Latest first')}
                                    </a>
                                </nav>
                            </div>
                            <ol className="mt-3 border-t border-content">
                                {data.posts.map((post) => (
                                    <li key={post.href} className="border-b border-line">
                                        <a
                                            href={post.href}
                                            className="group grid grid-cols-[2rem_minmax(0,1fr)] items-baseline gap-x-3 py-4 sm:grid-cols-[2.5rem_minmax(0,1fr)_auto] sm:py-[1.125rem]"
                                        >
                                            <span className="text-[15px] font-semibold tabular-nums text-content-hint">
                                                {String(post.number)}
                                            </span>
                                            <span className="flex min-w-0 items-baseline gap-3">
                                                <span className="min-w-0 text-base font-semibold leading-normal tracking-tight break-words break-keep text-content transition-colors duration-150 group-hover:text-content-secondary sm:text-[17px]">
                                                    {post.title}
                                                </span>
                                                {/* The dotted leader of a printed contents page. */}
                                                <span
                                                    aria-hidden="true"
                                                    className="hidden min-w-6 flex-1 -translate-y-1 border-b border-dotted border-line-strong sm:block"
                                                />
                                            </span>
                                            {post.date ? (
                                                <time
                                                    dateTime={post.date.iso}
                                                    className="col-start-2 mt-1 text-[13px] tabular-nums text-content-secondary sm:col-start-auto sm:mt-0"
                                                >
                                                    {post.date.text}
                                                </time>
                                            ) : null}
                                            {post.subtitle ? (
                                                <span className="col-start-2 mt-1 hidden truncate text-sm text-content-secondary sm:col-[2/4] sm:block">
                                                    {post.subtitle}
                                                </span>
                                            ) : null}
                                        </a>
                                    </li>
                                ))}
                            </ol>
                            {data.pagination.pages > 1 ? (
                                <div className="mt-10">
                                    <PageNavigation pagination={data.pagination} />
                                </div>
                            ) : null}
                        </section>
                    ) : (
                        <div className="mt-14">
                            <EmptyState
                                title={ui('No posts yet')}
                                message={ui('No posts have been added to this series yet.')}
                                icon="stack-2"
                            />
                        </div>
                    )}
                </div>
            </main>
            <SiteFooter brand={data.brand} year={data.copyrightYear} />
        </>
    );
}

export function mountPage(data: AuthorSeriesData, content: Element) {
    const description = data.hasDescription ? content.querySelector(seriesDescriptionSelector) : null;
    if (data.hasDescription && !description) throw new Error('The series description is missing from the page.');
    return <AuthorSeriesDetailPage data={data} descriptionHtml={description?.innerHTML ?? ''} />;
}
