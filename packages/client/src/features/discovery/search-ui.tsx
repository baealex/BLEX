import { ui } from '../../i18n/public-ui.js';
import type { ReactNode } from 'react';
import { SiteIcon } from '../../appearance/icons';

export function ReactFragment({ children }: { children: ReactNode }): ReactNode {
    return <div>{children}</div>;
}

function withoutParams(search: URLSearchParams, ...names: string[]): URLSearchParams {
    const next = new URLSearchParams(search);
    for (const name of names) next.delete(name);
    return next;
}

function withQuery(path: string, search: URLSearchParams): string {
    const query = search.toString();
    return query ? `${path}?${query}` : path;
}

export function QueryFilter({
    path,
    search,
    placeholder,
    id
}: {
    path: string;
    search: URLSearchParams;
    placeholder: string;
    id: string;
}): ReactNode {
    const others = withoutParams(search, 'q', 'page');
    const occurrences = new Map<string, number>();
    return (
        <form method="get" action={path} className="relative">
            {[...others].map(([name, value]) => {
                const identity = JSON.stringify([name, value]);
                const occurrence = occurrences.get(identity) ?? 0;
                occurrences.set(identity, occurrence + 1);
                return (
                    <input key={JSON.stringify([name, value, occurrence])} type="hidden" name={name} value={value} />
                );
            })}
            <div className="relative">
                <input
                    id={id}
                    type="text"
                    name="q"
                    defaultValue={search.get('q') ?? ''}
                    placeholder={placeholder}
                    autoComplete="off"
                    className="peer w-full rounded-2xl bg-surface-elevated px-4 py-2.5 pr-10 text-content ring-1 ring-line/60 transition-all placeholder:text-content-hint focus:ring-2 focus:ring-content-hint focus:outline-hidden"
                />
                <a
                    href={withQuery(path, others)}
                    aria-label={ui('Clear search')}
                    className="touch-target absolute top-1/2 right-3 -translate-y-1/2 text-content-hint transition-colors hover:text-content-secondary peer-placeholder-shown:hidden"
                >
                    <SiteIcon name="x" />
                </a>
                <button
                    type="submit"
                    aria-label={ui('Search')}
                    className="touch-target absolute top-1/2 right-3 hidden -translate-y-1/2 text-content-hint peer-placeholder-shown:block"
                >
                    <SiteIcon name="search" />
                </button>
            </div>
        </form>
    );
}

export function DropdownFilter({
    path,
    search,
    param,
    options,
    current
}: {
    path: string;
    search: URLSearchParams;
    param: string;
    options: Array<{ value: string; label: string }>;
    current: string;
}): ReactNode {
    return (
        // The browser can open this menu natively before the page's code arrives. It is a disclosure of links, which
        // Tab walks through, and the current choice is marked with aria-current.
        <details className="group relative w-full" data-account-menu="" suppressHydrationWarning>
            <summary
                className={
                    'flex w-full cursor-pointer list-none items-center justify-between rounded-2xl bg-surface-elevated px-4 py-2.5 text-sm font-medium text-content-secondary ring-1 ring-line/60 hover:bg-surface-subtle [&::-webkit-details-marker]:hidden'
                }
            >
                <span className="truncate">{options.find((option) => option.value === current)?.label ?? ''}</span>
                <SiteIcon
                    name="chevron-down"
                    className="ml-2 text-xs transition-transform duration-150 group-open:rotate-180"
                />
            </summary>
            <div className="absolute left-0 z-50 mt-2 max-h-60 w-full overflow-y-auto rounded-lg bg-surface-elevated py-1 shadow-lg ring-1 ring-line/60 sm:right-0">
                {options.map((option) => {
                    const next = withoutParams(search, param, 'page');
                    if (option.value) next.set(param, option.value);
                    const selected = option.value === current;
                    return (
                        <a
                            key={option.value}
                            href={withQuery(path, next)}
                            aria-current={selected ? 'true' : undefined}
                            className={`block px-4 py-3 text-sm text-content-secondary transition-colors duration-150 hover:bg-surface-subtle ${selected ? 'bg-surface-subtle font-semibold text-content' : ''}`}
                        >
                            {option.label}
                        </a>
                    );
                })}
            </div>
        </details>
    );
}
