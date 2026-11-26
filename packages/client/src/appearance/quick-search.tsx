import { ui } from '../i18n/public-ui.js';
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { flushSync } from 'react-dom';
import { SiteIcon } from './icons.js';
import { recentSearches, rememberSearch } from './recent-searches.js';

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

const suggestDelayMs = 200;

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
    const list = useRef<HTMLDivElement>(null);
    const delay = useRef<number | undefined>(undefined);
    const request = useRef<AbortController | undefined>(undefined);
    const [open, setOpen] = useState(false);
    const [selected, setSelected] = useState(-1);
    // The box is a combobox: arrows move through the list while focus stays in the box, so the box names the
    // highlighted row for screen readers.
    const listId = useId();
    const headingId = useId();
    const optionId = (index: number) => `${listId}-${index}`;
    const [view, setView] = useState<SearchView>({
        heading: ui('Recent searches'),
        rows: [],
        emptyMessage: ''
    });

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
                show(ui('Quick search results'), resultRows(result.body?.results), ui('No quick search results.'));
        } catch {
            if (!controller.signal.aborted) show(ui('Quick search results'), [], ui('Try again on the search page.'));
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
                ui('Recent searches'),
                recentSearches()
                    .slice(0, 6)
                    .map((entry) => ({ href: `/search?${new URLSearchParams({ q: entry })}`, title: entry })),
                ui('No recent searches.')
            );
            return;
        }
        show(ui('Quick search results'), [], ui('Searching…'));
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
        const close = () => {
            cancel();
            setOpen(false);
        };
        document.addEventListener('click', closeOnOutsideClick);
        // The site script answers Esc and Cmd/Ctrl+K in the box, before and after this code loads. It closes
        // the panel during the key press, so a second Esc right after it sees the panel closed and clears the box.
        const closeNow = () => flushSync(close);
        document.addEventListener('blex:before-page-change', close);
        document.addEventListener('blex:quick-search-close', closeNow);
        // The box can take focus before this code has loaded, and the site script cancels this event
        // when Esc has already closed it.
        const open = document.dispatchEvent(new Event('blex:quick-search-ready', { cancelable: true }));
        if (open && document.activeElement === input.current) suggest();
        return () => {
            cancel();
            document.removeEventListener('click', closeOnOutsideClick);
            document.removeEventListener('blex:before-page-change', close);
            document.removeEventListener('blex:quick-search-close', closeNow);
        };
    }, []);

    const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
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
                className="flex h-11 items-center gap-2 rounded-full border border-line bg-surface-elevated px-3 transition-all focus-within:ring-2 focus-within:ring-content-hint"
                onSubmit={() => rememberSearch(query())}
            >
                <SiteIcon name="search" className="size-4 shrink-0 text-content-hint" />
                <input
                    ref={input}
                    name="q"
                    type="search"
                    placeholder={ui('Search')}
                    aria-label={ui('Search')}
                    autoComplete="off"
                    role="combobox"
                    aria-autocomplete="list"
                    aria-expanded={open}
                    aria-controls={listId}
                    aria-activedescendant={open && selected >= 0 ? optionId(selected) : undefined}
                    className="min-w-0 flex-1 bg-transparent text-sm text-content placeholder:text-content-hint focus:outline-hidden"
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
                    id={headingId}
                    className="border-b border-line-light px-3 py-2 text-[11px] font-semibold tracking-wider text-content-secondary"
                    data-site-search-heading
                >
                    {view.heading}
                </p>
                <div
                    ref={list}
                    id={listId}
                    role="listbox"
                    aria-labelledby={headingId}
                    className="max-h-80 overflow-y-auto p-2 empty:hidden"
                    data-site-search-results
                >
                    {view.rows.map(({ href, title, description }, index) => (
                        <a
                            key={href}
                            href={href}
                            id={optionId(index)}
                            role="option"
                            aria-selected={index === selected}
                            className="blex-quick-search-result block rounded-xl px-3 py-3 text-sm font-semibold text-content hover:bg-surface-subtle"
                            onClick={() => rememberSearch(query())}
                        >
                            {title}
                            {description ? (
                                <span className="mt-0.5 block truncate text-xs font-normal text-content-secondary">
                                    {description}
                                </span>
                            ) : null}
                        </a>
                    ))}
                </div>
                {/* Stays in the page so screen readers hear "Searching…" and the empty result as they change. */}
                <p role="status" className="px-3 py-6 text-center text-sm text-content-secondary empty:hidden">
                    {view.rows.length === 0 ? view.emptyMessage : ''}
                </p>
            </div>
        </div>
    );
}
