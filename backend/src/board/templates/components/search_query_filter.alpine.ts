
import type Alpine from 'alpinejs';

interface SearchQueryFilterOptions {
    query?: string;
}

interface SearchQueryFilterState {
    query: string;
}

const search_query_filter = (options: SearchQueryFilterOptions = {}): Alpine.AlpineComponent<SearchQueryFilterState> => ({
    query: options.query ?? ''
});

export default search_query_filter;
