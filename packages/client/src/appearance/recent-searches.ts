const recentSearchesKey = 'blex-recent-searches';

export function recentSearches(): string[] {
    try {
        const value: unknown = JSON.parse(localStorage.getItem(recentSearchesKey) ?? '[]');
        return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];
    } catch {
        return [];
    }
}

export function rememberSearch(query: string): void {
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
