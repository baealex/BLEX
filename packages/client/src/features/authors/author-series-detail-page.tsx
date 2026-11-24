import { SiteIcon } from '../../appearance/icons.js';
import { SiteFooter } from '../../appearance/shell.js';
import { ui } from '../../i18n/public-ui.js';
import { EmptyState, PageNavigation } from '../discovery/post-list';
import { seriesDescriptionSelector } from './author-markup';
import type { AuthorSeriesData } from './author-page-data';

export function AuthorSeriesDetailPage({ data, descriptionHtml }: { data: AuthorSeriesData; descriptionHtml: string }) {
    const { author, sortOrder, seriesPath } = data;
    return (
        <>
            <main>
                <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
                    <header className="mb-12 text-center">
                        <span className="mb-4 inline-block rounded-full bg-surface-subtle px-3 py-1 text-xs font-bold uppercase tracking-wider text-content-secondary">
                            {ui('Series')}
                        </span>
                        <h1 className="mb-4 text-3xl font-bold leading-tight tracking-tight text-content sm:text-4xl">
                            {data.name}
                        </h1>
                        {data.hasDescription ? (
                            <div
                                className="mx-auto mb-8 max-w-2xl text-lg leading-relaxed text-content-secondary"
                                dangerouslySetInnerHTML={{ __html: descriptionHtml }}
                            />
                        ) : null}
                        <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-content-secondary">
                            <a
                                href={author.href}
                                className="flex items-center gap-2 transition-colors hover:text-content"
                            >
                                <img
                                    className="size-6 rounded-full object-cover ring-2 ring-line-light"
                                    src={author.avatar}
                                    alt={author.username}
                                />
                                <span className="font-semibold text-content">{author.username}</span>
                            </a>
                            <span className="size-1 rounded-full bg-content-hint/70" aria-hidden={true} />
                            <span className="flex items-center gap-1.5">
                                <SiteIcon name="file-text" className="text-xs" />
                                {ui('{value0, plural, one{# post} other{# posts}}', { value0: data.count })}
                            </span>
                            <span className="size-1 rounded-full bg-content-hint/70" aria-hidden={true} />
                            <span className="flex items-center gap-1.5">
                                <SiteIcon name="clock" className="text-xs" />
                                {ui('Updated {value0}', { value0: data.updated })}
                            </span>
                        </div>
                        {data.editHref ? (
                            <div className="mt-8">
                                <a
                                    href={data.editHref}
                                    className="inline-flex items-center gap-2 rounded-full bg-action px-5 py-2.5 text-sm font-medium text-content-inverted transition-all duration-150 hover:bg-action-hover active:scale-[0.98]"
                                >
                                    <SiteIcon name="edit" className="text-xs" />
                                    <span>{ui('Edit series')}</span>
                                </a>
                            </div>
                        ) : null}
                    </header>
                    {data.posts.length ? (
                        <div className="mb-6 flex justify-end">
                            <nav
                                className="inline-flex rounded-xl bg-surface-subtle/80 p-1 backdrop-blur-sm ring-1 ring-line/60"
                                aria-label={ui('Sort posts')}
                            >
                                <a
                                    href={`${seriesPath}?sort=asc`}
                                    aria-current={sortOrder === 'asc' ? 'page' : undefined}
                                    className={`rounded-lg px-4 py-1.5 text-xs font-bold transition-all duration-150 ${sortOrder === 'asc' ? 'bg-surface-elevated text-content shadow-sm' : 'text-content-secondary hover:text-content'}`}
                                >
                                    {ui('Oldest first')}
                                </a>
                                <a
                                    href={seriesPath}
                                    aria-current={sortOrder === 'desc' ? 'page' : undefined}
                                    className={`rounded-lg px-4 py-1.5 text-xs font-bold transition-all duration-150 ${sortOrder === 'desc' ? 'bg-surface-elevated text-content shadow-sm' : 'text-content-secondary hover:text-content'}`}
                                >
                                    {ui('Newest first')}
                                </a>
                            </nav>
                        </div>
                    ) : null}
                    {data.posts.length ? (
                        <div className="space-y-4">
                            {data.posts.map((post) => (
                                <article
                                    className="group relative rounded-2xl border border-line-light bg-surface-elevated p-6 transition-all duration-150 hover:ring-1 hover:ring-line/60 active:scale-[0.98]"
                                    key={post.href}
                                >
                                    <a className="flex items-start gap-5" href={post.href}>
                                        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-surface-subtle font-mono text-sm font-bold text-content-hint transition-colors duration-150 group-hover:bg-action group-hover:text-content-inverted">
                                            {String(post.number)}
                                        </span>
                                        <div className="min-w-0 flex-1 pt-1">
                                            <h2 className="mb-2 block text-lg font-bold leading-snug text-content transition-colors group-hover:text-content">
                                                {post.title}
                                            </h2>
                                            <span className="flex flex-wrap items-center gap-4 text-xs font-medium text-content-hint">
                                                <span className="flex items-center gap-1.5">
                                                    <SiteIcon name="calendar" />
                                                    {post.date ? (
                                                        <time dateTime={post.date.iso}>{post.date.text}</time>
                                                    ) : null}
                                                </span>
                                                <span className="flex items-center gap-1.5">
                                                    <SiteIcon name="clock" />
                                                    {ui('{value0} min', { value0: post.readTime })}
                                                </span>
                                                <span className="ml-auto flex items-center gap-3">
                                                    <span className="flex items-center gap-1.5 transition-colors hover:text-danger">
                                                        <SiteIcon name="heart" />
                                                        {String(post.likeCount)}
                                                    </span>
                                                    <span className="flex items-center gap-1.5 transition-colors hover:text-content">
                                                        <SiteIcon name="message-circle" />
                                                        {String(post.commentCount)}
                                                    </span>
                                                </span>
                                            </span>
                                        </div>
                                    </a>
                                </article>
                            ))}
                        </div>
                    ) : (
                        <EmptyState
                            title={ui('No posts yet')}
                            message={ui('No posts have been added to this series yet.')}
                            icon="stack-2"
                            framed={true}
                        />
                    )}
                    {data.posts.length ? (
                        <div className="mt-12">
                            <PageNavigation pagination={data.pagination} />
                        </div>
                    ) : null}
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
