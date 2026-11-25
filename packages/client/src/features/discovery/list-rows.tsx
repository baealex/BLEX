import type { ReactNode } from 'react';
import { ui } from '../../i18n/public-ui.js';

/** A post as one row of a list. Pages that hydrate publish this in their HTML, so each field is listed by hand. */
export interface PostRowView {
    href: string;
    title: string;
    /** Wide screens show it under the title; narrow ones leave it out. */
    summary: string;
    /** Null when the post has no image of its own, so the row stays text-only. */
    image: string | null;
    date: { iso: string; text: string } | null;
    readTime: number;
    /** Named on the row only when the list mixes authors. */
    author?: string;
}

export function MetaDot(): ReactNode {
    return <span aria-hidden="true" className="size-1 shrink-0 rounded-full bg-content-hint" />;
}

/** Every list of posts or series shares this row, so lists look the same on every page. */
export function ListRow({
    href,
    title,
    summary,
    meta,
    image,
    heading: Heading = 'h3'
}: {
    href: string;
    title: string;
    summary: string;
    meta: ReactNode;
    image: string | null;
    heading?: 'h2' | 'h3';
}): ReactNode {
    return (
        <li className="border-b border-line-light">
            <a href={href} className="group flex items-center gap-4 py-5 sm:gap-8 sm:py-6">
                <div className="min-w-0 flex-1">
                    <Heading className="line-clamp-2 text-base font-semibold leading-snug tracking-tight break-words break-keep text-content transition-colors duration-150 group-hover:text-content-secondary sm:text-lg">
                        {title}
                    </Heading>
                    {summary ? (
                        <p className="mt-1.5 hidden truncate text-sm text-content-secondary sm:block">{summary}</p>
                    ) : null}
                    <p className="mt-2.5 flex flex-wrap items-center gap-x-2 text-[13px] text-content-secondary">
                        {meta}
                    </p>
                </div>
                {image ? (
                    <div className="aspect-[16/10] w-24 shrink-0 overflow-hidden rounded-xl bg-surface-subtle ring-1 ring-line/60 sm:w-36">
                        <img
                            className="h-full w-full object-cover transition-transform duration-500 motion-safe:group-hover:scale-[1.03]"
                            src={image}
                            alt=""
                            loading="lazy"
                        />
                    </div>
                ) : null}
            </a>
        </li>
    );
}

export function ListRows({ children, className = '' }: { children: ReactNode; className?: string }): ReactNode {
    return <ul className={`border-t border-line-light ${className}`.trim()}>{children}</ul>;
}

/** Posts as rows: date and reading time, plus the author when the list mixes authors. */
export function PostRows({
    posts,
    heading,
    className
}: {
    posts: PostRowView[];
    heading?: 'h2' | 'h3';
    className?: string;
}): ReactNode {
    return (
        <ListRows className={className}>
            {posts.map((post) => (
                <ListRow
                    key={post.href}
                    href={post.href}
                    title={post.title}
                    summary={post.summary}
                    image={post.image}
                    heading={heading}
                    meta={
                        <>
                            {post.author ? (
                                <>
                                    <span className="font-semibold text-content">{post.author}</span>
                                    <MetaDot />
                                </>
                            ) : null}
                            {post.date ? (
                                <>
                                    <time dateTime={post.date.iso}>{post.date.text}</time>
                                    <MetaDot />
                                </>
                            ) : null}
                            <span>{ui('{value0} min', { value0: post.readTime })}</span>
                        </>
                    }
                />
            ))}
        </ListRows>
    );
}
