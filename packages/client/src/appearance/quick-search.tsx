import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { SiteIcon } from './icons.js';

interface SearchRow {
    href: string;
    title: string;
    description?: string;
}

interface SearchView {
    heading: string;
    rows: SearchRow[];
    emptyMessage: string;
}

const recentSearchesKey = 'blex-recent-searches';
const suggestDelayMs = 200;

function recentSearches(): string[] {
    try {
        const value: unknown = JSON.parse(localStorage.getItem(recentSearchesKey) ?? '[]');
        return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];
    } catch {
        return [];
    }
}

function rememberSearch(query: string) {
    if (!query) return;
    try {
        localStorage.setItem(
            recentSearchesKey,
            JSON.stringify([query, ...recentSearches().filter((entry) => entry !== query)].slice(0, 6))
        );
    } catch {
        /* Search works without browser storage. */
    }
}

function resultRows(matches: unknown): SearchRow[] {
    if (!Array.isArray(matches)) return [];
    return matches.slice(0, 5).flatMap((post) => {
        if (typeof post?.author !== 'string' || typeof post?.url !== 'string' || typeof post?.title !== 'string')
            return [];
        const summary = typeof post.description === 'string' && post.description ? ` · ${post.description}` : '';
        return [
            {
                href: `/@${encodeURIComponent(post.author)}/${encodeURIComponent(post.url)}`,
                title: post.title,
                description: `@${post.author}${summary}`
            }
        ];
    });
}

export function QuickSearch() {
    const container = useRef<HTMLDivElement>(null);
    const input = useRef<HTMLInputElement>(null);
    const list = useRef<HTMLUListElement>(null);
    const delay = useRef<number | undefined>(undefined);
    const request = useRef<AbortController | undefined>(undefined);
    const [open, setOpen] = useState(false);
    const [selected, setSelected] = useState(-1);
    const [view, setView] = useState<SearchView>({ heading: '최근 검색', rows: [], emptyMessage: '' });

    const query = () => input.current?.value.trim() ?? '';

    const cancel = () => {
        window.clearTimeout(delay.current);
        delay.current = undefined;
        request.current?.abort();
        request.current = undefined;
    };

    const show = (heading: string, rows: SearchRow[], emptyMessage: string) => {
        setSelected(-1);
        setView({ heading, rows, emptyMessage });
    };

    const fetchResults = async (term: string) => {
        const controller = new AbortController();
        request.current = controller;
        try {
            const response = await fetch(`/v1/search?${new URLSearchParams({ q: term })}`, {
                signal: controller.signal
            });
            const result = await response.json();
            if (!controller.signal.aborted)
                show('빠른 검색 결과', resultRows(result.body?.results), '빠른 검색 결과가 없습니다.');
        } catch {
            if (!controller.signal.aborted) show('빠른 검색 결과', [], '검색 화면에서 다시 시도해 주세요.');
        } finally {
            if (request.current === controller) request.current = undefined;
        }
    };

    const suggest = () => {
        cancel();
        setOpen(true);
        const term = query();
        if (!term) {
            show(
                '최근 검색',
                recentSearches()
                    .slice(0, 6)
                    .map((entry) => ({ href: `/search?${new URLSearchParams({ q: entry })}`, title: entry })),
                '최근 검색어가 없습니다.'
            );
            return;
        }
        show('빠른 검색 결과', [], '검색 중…');
        delay.current = window.setTimeout(() => {
            delay.current = undefined;
            void fetchResults(term);
        }, suggestDelayMs);
    };

    // biome-ignore lint/correctness/useExhaustiveDependencies: these listeners live as long as the header and only use refs and state setters.
    useEffect(() => {
        const closeOnOutsideClick = (event: MouseEvent) => {
            if (event.target instanceof Node && !container.current?.contains(event.target)) setOpen(false);
        };
        const focusOnShortcut = (event: globalThis.KeyboardEvent) => {
            if (
                (event.metaKey || event.ctrlKey) &&
                event.key.toLowerCase() === 'k' &&
                container.current?.getClientRects().length
            ) {
                event.preventDefault();
                input.current?.focus();
            }
        };
        const closeOnPageChange = () => {
            cancel();
            setOpen(false);
        };
        document.addEventListener('click', closeOnOutsideClick);
        document.addEventListener('keydown', focusOnShortcut);
        document.addEventListener('blex:before-page-change', closeOnPageChange);
        // The box can take focus before this code has loaded.
        if (document.activeElement === input.current) suggest();
        return () => {
            cancel();
            document.removeEventListener('click', closeOnOutsideClick);
            document.removeEventListener('keydown', focusOnShortcut);
            document.removeEventListener('blex:before-page-change', closeOnPageChange);
        };
    }, []);

    const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Escape') {
            setOpen(false);
            return;
        }
        if (!open) return;
        const links = Array.from(list.current?.querySelectorAll('a') ?? []);
        if (event.key === 'Enter' && selected >= 0 && links[selected]) {
            event.preventDefault();
            links[selected].click();
        }
        if (!links.length || (event.key !== 'ArrowDown' && event.key !== 'ArrowUp')) return;
        event.preventDefault();
        const previous = selected <= 0 ? links.length - 1 : selected - 1;
        const next = event.key === 'ArrowDown' ? (selected + 1) % links.length : previous;
        setSelected(next);
        links[next].scrollIntoView({ block: 'nearest' });
    };

    return (
        <div ref={container} className="relative w-full max-w-xs" data-site-search>
            <form
                action="/search"
                className="flex h-11 items-center gap-2 rounded-full border border-line bg-surface-elevated px-3 transition-all focus-within:ring-2 focus-within:ring-line-strong"
                onSubmit={() => rememberSearch(query())}
            >
                <SiteIcon name="search" className="size-4 shrink-0 text-content-hint" />
                <input
                    ref={input}
                    name="q"
                    type="search"
                    placeholder="검색"
                    aria-label="검색"
                    autoComplete="off"
                    className="min-w-0 flex-1 bg-transparent text-sm text-content placeholder:text-content-hint focus:outline-none"
                    onFocus={suggest}
                    onChange={suggest}
                    onKeyDown={handleKeyDown}
                />
                <kbd className="hidden h-6 items-center gap-1 rounded-md border border-line bg-surface-subtle px-2 font-mono text-[10px] text-content-secondary lg:inline-flex">
                    <span className="text-[8px]">⌘</span>K
                </kbd>
            </form>
            <div
                hidden={!open}
                className="absolute inset-x-0 z-50 mt-2 overflow-hidden rounded-2xl bg-surface-elevated shadow-xl ring-1 ring-line-strong/60"
                data-site-search-panel
            >
                <p
                    className="border-b border-line-light px-3 py-2 text-[11px] font-semibold tracking-wider text-content-secondary"
                    data-site-search-heading
                >
                    {view.heading}
                </p>
                <ul ref={list} className="max-h-80 overflow-y-auto p-2" data-site-search-results>
                    {view.rows.map(({ href, title, description }, index) => (
                        <li key={href}>
                            <a
                                href={href}
                                className="blex-quick-search-result block rounded-xl px-3 py-3 text-sm font-semibold text-content hover:bg-surface-subtle"
                                data-selected={index === selected ? 'true' : undefined}
                                onClick={() => rememberSearch(query())}
                            >
                                {title}
                                {description ? (
                                    <span className="mt-0.5 block truncate text-xs font-normal text-content-secondary">
                                        {description}
                                    </span>
                                ) : null}
                            </a>
                        </li>
                    ))}
                    {view.rows.length === 0 && view.emptyMessage ? (
                        <li className="px-3 py-6 text-center text-sm text-content-secondary">{view.emptyMessage}</li>
                    ) : null}
                </ul>
            </div>
        </div>
    );
}
