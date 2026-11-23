import { ui } from '../../../i18n/public-ui.js';
import { SiteIcon } from '~/appearance/icons';
import { authorPath } from '~/features/authors/profile-ui';
import { PageLayout } from '~/features/discovery/layout';
import { EmptyState, Pagination, postPath } from '~/features/discovery/post-list';
import { avatarUrl, dateLabel, formatPostDate } from '~/features/discovery/view-helpers';
import type { PageProps } from '~/contracts/pages';

export default function renderPage({
    meta,
    series,
    seriesHtml,
    author,
    count,
    viewer,
    posts,
    seriesPath,
    sortOrder,
    checkedPage,
    pages
}: PageProps['@{$username}/series/$seriesSlug']): string {
    return PageLayout({
        meta,
        children: (
            <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
                <header className="mb-12 text-center">
                    <span className="mb-4 inline-block rounded-full bg-surface-subtle px-3 py-1 text-xs font-bold uppercase tracking-wider text-content-secondary">
                        {ui('Series')}
                    </span>
                    <h1 className="mb-4 text-3xl font-bold leading-tight tracking-tight text-content sm:text-4xl">
                        {series.name}
                    </h1>
                    {series.textHtml ? (
                        <div
                            className="mx-auto mb-8 max-w-2xl text-lg leading-relaxed text-content-secondary"
                            dangerouslySetInnerHTML={{ __html: seriesHtml }}
                        />
                    ) : null}
                    <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-content-secondary">
                        <a
                            href={authorPath(author.username)}
                            className="flex items-center gap-2 transition-colors hover:text-content"
                        >
                            <img
                                className="size-6 rounded-full object-cover ring-2 ring-line-light"
                                src={avatarUrl(series.authorAvatar)}
                                alt={author.username}
                            />
                            <span className="font-semibold text-content">{author.username}</span>
                        </a>
                        <span className="size-1 rounded-full bg-content-hint/70" aria-hidden={true} />
                        <span className="flex items-center gap-1.5">
                            <SiteIcon name="file-text" className="text-xs" />
                            {ui('{value0, plural, one{# post} other{# posts}}', { value0: count })}
                        </span>
                        <span className="size-1 rounded-full bg-content-hint/70" aria-hidden={true} />
                        <span className="flex items-center gap-1.5">
                            <SiteIcon name="clock" className="text-xs" />
                            {ui('Updated {value0}', { value0: dateLabel(series.updatedDate) })}
                        </span>
                    </div>
                    {viewer?.id === author.id ? (
                        <div className="mt-8">
                            <a
                                href={`/settings/series/edit/${series.id}`}
                                className="inline-flex items-center gap-2 rounded-full bg-action px-5 py-2.5 text-sm font-medium text-content-inverted transition-all duration-150 hover:bg-action-hover active:scale-[0.98]"
                            >
                                <SiteIcon name="edit" className="text-xs" />
                                <span>{ui('Edit series')}</span>
                            </a>
                        </div>
                    ) : null}
                </header>
                {posts.length ? (
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
                {posts.length ? (
                    <div className="space-y-4">
                        {posts.map((post, index) => {
                            const number =
                                sortOrder === 'desc'
                                    ? count - (checkedPage - 1) * 10 - index
                                    : (checkedPage - 1) * 10 + index + 1;
                            return (
                                <article
                                    className="group relative rounded-2xl border border-line-light bg-surface-elevated p-6 transition-all duration-150 hover:ring-1 hover:ring-line/60 active:scale-[0.98]"
                                    key={post.id}
                                >
                                    <a className="flex items-start gap-5" href={postPath(post)}>
                                        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-surface-subtle font-mono text-sm font-bold text-content-hint transition-colors duration-150 group-hover:bg-action group-hover:text-content-inverted">
                                            {String(number)}
                                        </span>
                                        <div className="min-w-0 flex-1 pt-1">
                                            <h2 className="mb-2 block text-lg font-bold leading-snug text-content transition-colors group-hover:text-content">
                                                {post.title}
                                            </h2>
                                            <span className="flex flex-wrap items-center gap-4 text-xs font-medium text-content-hint">
                                                <span className="flex items-center gap-1.5">
                                                    <SiteIcon name="calendar" />
                                                    {formatPostDate(post)}
                                                </span>
                                                <span className="flex items-center gap-1.5">
                                                    <SiteIcon name="clock" />
                                                    {ui('{value0} min', { value0: post.readTime })}
                                                </span>
                                                <span className="ml-auto flex items-center gap-3">
                                                    <span className="flex items-center gap-1.5 transition-colors hover:text-danger">
                                                        <SiteIcon name="heart" />
                                                        {String(post.likeCount ?? 0)}
                                                    </span>
                                                    <span className="flex items-center gap-1.5 transition-colors hover:text-content">
                                                        <SiteIcon name="message-circle" />
                                                        {String(post.commentCount ?? 0)}
                                                    </span>
                                                </span>
                                            </span>
                                        </div>
                                    </a>
                                </article>
                            );
                        })}
                    </div>
                ) : (
                    <EmptyState
                        title={ui('No posts yet')}
                        message={ui('No posts have been added to this series yet.')}
                        icon="stack-2"
                        framed={true}
                    />
                )}
                {posts.length ? (
                    <div className="mt-12">
                        <Pagination
                            path={seriesPath}
                            search={new URLSearchParams(sortOrder === 'asc' ? 'sort=asc' : '')}
                            preserve={['sort']}
                            page={checkedPage}
                            pages={pages}
                        />
                    </div>
                ) : null}
            </div>
        )
    });
}
