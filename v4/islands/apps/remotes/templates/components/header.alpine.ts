import type Alpine from 'alpinejs';
import {
    THEME_CHANGE_EVENT,
    getStoredThemePreference,
    resolveTheme,
    subscribeSystemThemeChange,
    toggleThemePreference,
    type ResolvedTheme,
    type ThemePreference
} from '~/scripts/theme';

const RECENT_SEARCHES_KEY = 'blex_recent_searches';
const MAX_RECENT_SEARCHES = 8;
const QUICK_RESULT_LIMIT = 6;
const QUICK_SEARCH_DEBOUNCE_MS = 180;

interface HeaderRefs {
    quickSearchInput?: HTMLInputElement;
}

interface QuickSearchResult {
    url: string;
    title: string;
    author: string;
    description?: string;
    positions?: string[];
}

interface QuickSearchApiResponse {
    status: 'DONE' | 'ERROR';
    body?: {
        results?: QuickSearchResult[];
    };
}

interface State {
    isTop: boolean;
    mobileMenuOpen: boolean;
    themePreference: ThemePreference;
    resolvedTheme: ResolvedTheme;
    quickSearchQuery: string;
    quickSearchDropdownOpen: boolean;
    quickSearchLoading: boolean;
    quickSearchResults: QuickSearchResult[];
    recentSearches: string[];
}

interface Actions {
    init(): void;
    toggleMobileMenu(): void;
    closeMobileMenu(): void;
    toggleTheme(): void;
    focusQuickSearchInput(): void;
    openQuickSearchDropdown(): void;
    closeQuickSearchDropdown(): void;
    onQuickSearchInput(): void;
    fetchQuickSearchResults(query: string, requestId: number): Promise<void>;
    submitQuickSearch(): void;
    applyRecentSearch(search: string): void;
    removeRecentSearch(search: string, event: Event): void;
}

type HeaderState = State & Actions & { $refs: HeaderRefs };

const getRecentSearches = (): string[] => {
    try {
        const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
        return stored ? JSON.parse(stored) : [];
    } catch {
        return [];
    }
};

const persistRecentSearches = (searches: string[]) => {
    localStorage.setItem(
        RECENT_SEARCHES_KEY,
        JSON.stringify(searches.slice(0, MAX_RECENT_SEARCHES))
    );
};

const buildRecentSearches = (query: string, existing: string[]) => {
    return [query, ...existing.filter((item) => item !== query)].slice(0, MAX_RECENT_SEARCHES);
};

const updateBodyOverflow = (state: HeaderState) => {
    document.body.style.overflow = state.mobileMenuOpen ? 'hidden' : '';
};

const header = (): Alpine.AlpineComponent<State & Actions> => {
    let debounceTimer: ReturnType<typeof window.setTimeout> | null = null;
    let activeRequestId = 0;

    return {
        isTop: true,
        mobileMenuOpen: false,
        themePreference: 'system',
        resolvedTheme: 'light',
        quickSearchQuery: '',
        quickSearchDropdownOpen: false,
        quickSearchLoading: false,
        quickSearchResults: [],
        recentSearches: [],

        init() {
            this.isTop = window.scrollY < 10;
            this.recentSearches = getRecentSearches();

            const state = this as HeaderState;
            state.themePreference = getStoredThemePreference();
            state.resolvedTheme = resolveTheme(state.themePreference);

            const updateHeader = () => {
                state.isTop = window.scrollY < 10;
            };

            window.addEventListener('scroll', () => {
                requestAnimationFrame(updateHeader);
            });

            window.addEventListener('keydown', (event: KeyboardEvent) => {
                const key = event.key.toLowerCase();

                if ((event.metaKey || event.ctrlKey) && key === 'k') {
                    event.preventDefault();
                    state.focusQuickSearchInput();
                    return;
                }

                if (event.key === 'Escape' && state.quickSearchDropdownOpen) {
                    state.closeQuickSearchDropdown();
                }
            });

            window.addEventListener(THEME_CHANGE_EVENT, (event: Event) => {
                const customEvent = event as CustomEvent<{ theme: ResolvedTheme; preference: ThemePreference }>;
                state.themePreference = customEvent.detail.preference;
                state.resolvedTheme = customEvent.detail.theme;
            });

            subscribeSystemThemeChange((theme) => {
                state.themePreference = getStoredThemePreference();
                state.resolvedTheme = theme;
            });
        },

        toggleMobileMenu() {
            const state = this as HeaderState;

            state.mobileMenuOpen = !state.mobileMenuOpen;
            if (state.mobileMenuOpen) {
                state.closeQuickSearchDropdown();
            }

            updateBodyOverflow(state);
        },

        closeMobileMenu() {
            const state = this as HeaderState;

            state.mobileMenuOpen = false;
            updateBodyOverflow(state);
        },

        toggleTheme() {
            const state = this as HeaderState;
            const nextTheme = toggleThemePreference();

            state.themePreference = nextTheme.preference;
            state.resolvedTheme = nextTheme.theme;
        },

        focusQuickSearchInput() {
            const state = this as HeaderState;

            state.openQuickSearchDropdown();
            window.requestAnimationFrame(() => {
                state.$refs.quickSearchInput?.focus();
                state.$refs.quickSearchInput?.select();
            });
        },

        openQuickSearchDropdown() {
            const state = this as HeaderState;

            state.quickSearchDropdownOpen = true;
            state.recentSearches = getRecentSearches();
        },

        closeQuickSearchDropdown() {
            const state = this as HeaderState;

            state.quickSearchDropdownOpen = false;
            state.quickSearchLoading = false;

            if (debounceTimer) {
                window.clearTimeout(debounceTimer);
                debounceTimer = null;
            }

            activeRequestId += 1;
        },

        onQuickSearchInput() {
            const state = this as HeaderState;
            const query = state.quickSearchQuery.trim();

            state.quickSearchDropdownOpen = true;

            if (debounceTimer) {
                window.clearTimeout(debounceTimer);
                debounceTimer = null;
            }

            if (!query) {
                state.quickSearchLoading = false;
                state.quickSearchResults = [];
                activeRequestId += 1;
                return;
            }

            state.quickSearchLoading = true;
            const requestId = ++activeRequestId;

            debounceTimer = window.setTimeout(() => {
                void state.fetchQuickSearchResults(query, requestId);
            }, QUICK_SEARCH_DEBOUNCE_MS);
        },

        async fetchQuickSearchResults(query: string, requestId: number) {
            const state = this as HeaderState;

            try {
                const response = await fetch(`/v1/search?q=${encodeURIComponent(query)}&page=1`, {
                    headers: {
                        Accept: 'application/json'
                    }
                });

                if (requestId !== activeRequestId) {
                    return;
                }

                if (!response.ok) {
                    state.quickSearchResults = [];
                    return;
                }

                const payload = await response.json() as QuickSearchApiResponse;
                if (requestId !== activeRequestId) {
                    return;
                }

                if (payload.status === 'DONE') {
                    state.quickSearchResults = (payload.body?.results ?? []).slice(0, QUICK_RESULT_LIMIT);
                } else {
                    state.quickSearchResults = [];
                }
            } catch {
                if (requestId === activeRequestId) {
                    state.quickSearchResults = [];
                }
            } finally {
                if (requestId === activeRequestId) {
                    state.quickSearchLoading = false;
                }
            }
        },

        submitQuickSearch() {
            const state = this as HeaderState;
            const query = state.quickSearchQuery.trim();

            if (!query) {
                state.focusQuickSearchInput();
                return;
            }

            const nextRecentSearches = buildRecentSearches(query, state.recentSearches);
            state.recentSearches = nextRecentSearches;
            persistRecentSearches(nextRecentSearches);

            state.quickSearchDropdownOpen = false;
            window.location.href = `/search?q=${encodeURIComponent(query)}`;
        },

        applyRecentSearch(search: string) {
            const state = this as HeaderState;

            state.quickSearchQuery = search;
            state.onQuickSearchInput();
            state.focusQuickSearchInput();
        },

        removeRecentSearch(search: string, event: Event) {
            event.stopPropagation();

            const state = this as HeaderState;
            const nextRecentSearches = state.recentSearches.filter((item) => item !== search);

            state.recentSearches = nextRecentSearches;
            persistRecentSearches(nextRecentSearches);
        }
    };
};

export default header;
