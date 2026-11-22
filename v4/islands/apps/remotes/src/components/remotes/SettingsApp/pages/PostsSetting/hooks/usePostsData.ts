import { useState, useEffect, useRef } from 'react';
import type { MessageDescriptor } from '@lingui/core';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react/macro';
import { useSuspenseQuery } from '@tanstack/react-query';

import { getPosts, getReservedPosts, type Post as ApiPost } from '~/lib/api/posts';
import { getTags, getSeries } from '~/lib/api/settings';

export interface Post extends ApiPost {
    persistedTag: string;
    persistedSeries: string;
    hasTagChanged?: boolean;
    hasSeriesChanged?: boolean;
    isPinned?: boolean;
}

export interface FilterOptions {
    search: string;
    tag: string;
    series: string;
    order: string;
    page: string;
    visibility: string;
}

export type PostsSource = 'published' | 'scheduled';

interface PostClassificationDraft {
    tag: string;
    series: string;
    hasTagChanged: boolean;
    hasSeriesChanged: boolean;
}

const POST_CLASSIFICATION_DRAFTS_KEY = 'blex:settings-post-classification-drafts';

const getPostClassificationDraftKey = (
    username: string,
    postUrl: string
) => `${username}:${postUrl}`;

const isPostClassificationDraft = (value: unknown): value is PostClassificationDraft => {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;

    const draft = value as Record<string, unknown>;
    return typeof draft.tag === 'string'
        && typeof draft.series === 'string'
        && typeof draft.hasTagChanged === 'boolean'
        && typeof draft.hasSeriesChanged === 'boolean';
};

const readPostClassificationDrafts = (): Record<string, PostClassificationDraft> => {
    if (typeof window === 'undefined') return {};

    try {
        const storedDrafts = window.sessionStorage.getItem(POST_CLASSIFICATION_DRAFTS_KEY);
        if (!storedDrafts) return {};

        const parsedDrafts: unknown = JSON.parse(storedDrafts);
        if (typeof parsedDrafts !== 'object' || parsedDrafts === null || Array.isArray(parsedDrafts)) {
            return {};
        }

        return Object.entries(parsedDrafts).reduce<Record<string, PostClassificationDraft>>(
            (drafts, [key, draft]) => {
                if (isPostClassificationDraft(draft)) drafts[key] = draft;
                return drafts;
            },
            {}
        );
    } catch {
        return {};
    }
};

const writePostClassificationDrafts = (drafts: Record<string, PostClassificationDraft>) => {
    if (typeof window === 'undefined') return;

    try {
        if (Object.keys(drafts).length === 0) {
            window.sessionStorage.removeItem(POST_CLASSIFICATION_DRAFTS_KEY);
            return;
        }
        window.sessionStorage.setItem(POST_CLASSIFICATION_DRAFTS_KEY, JSON.stringify(drafts));
    } catch {
        // Storage can be unavailable in restricted browser contexts. In-memory editing still works.
    }
};

export const getPostClassificationDraft = (
    username: string,
    postUrl: string
) => readPostClassificationDrafts()[getPostClassificationDraftKey(username, postUrl)];

export const syncPostClassificationDraft = (
    username: string,
    post: Post
) => {
    const drafts = readPostClassificationDrafts();
    const draftKey = getPostClassificationDraftKey(username, post.url);

    if (!post.hasTagChanged && !post.hasSeriesChanged) {
        delete drafts[draftKey];
        writePostClassificationDrafts(drafts);
        return;
    }

    drafts[draftKey] = {
        tag: post.tag,
        series: post.series || '',
        hasTagChanged: Boolean(post.hasTagChanged),
        hasSeriesChanged: Boolean(post.hasSeriesChanged)
    };
    writePostClassificationDrafts(drafts);
};

export const clearPostClassificationDraft = (
    username: string,
    postUrl: string
) => {
    const drafts = readPostClassificationDrafts();
    delete drafts[getPostClassificationDraftKey(username, postUrl)];
    writePostClassificationDrafts(drafts);
};

export const POSTS_ORDER: {
    label: MessageDescriptor;
    order: string;
}[] = [
    {
        label: msg({
            id: 'settings.posts.order.newest_published',
            message: 'Newest published'
        }),
        order: '-published_date'
    },
    {
        label: msg({
            id: 'settings.posts.order.oldest_published',
            message: 'Oldest published'
        }),
        order: 'published_date'
    },
    {
        label: msg({
            id: 'settings.posts.order.recently_updated',
            message: 'Recently updated'
        }),
        order: '-updated_date'
    },
    {
        label: msg({
            id: 'settings.posts.order.least_recently_updated',
            message: 'Least recently updated'
        }),
        order: 'updated_date'
    },
    {
        label: msg({
            id: 'settings.posts.order.title_ascending',
            message: 'Title A–Z'
        }),
        order: 'title'
    },
    {
        label: msg({
            id: 'settings.posts.order.title_descending',
            message: 'Title Z–A'
        }),
        order: '-title'
    },
    {
        label: msg({
            id: 'settings.posts.order.most_liked',
            message: 'Most liked'
        }),
        order: '-count_likes'
    },
    {
        label: msg({
            id: 'settings.posts.order.least_liked',
            message: 'Least liked'
        }),
        order: 'count_likes'
    },
    {
        label: msg({
            id: 'settings.posts.order.most_commented',
            message: 'Most commented'
        }),
        order: '-count_comments'
    },
    {
        label: msg({
            id: 'settings.posts.order.least_commented',
            message: 'Least commented'
        }),
        order: 'count_comments'
    },
    {
        label: msg({
            id: 'settings.posts.order.shortest',
            message: 'Shortest read'
        }),
        order: 'read_time'
    },
    {
        label: msg({
            id: 'settings.posts.order.longest',
            message: 'Longest read'
        }),
        order: '-read_time'
    }
];

const DEFAULT_FILTERS: FilterOptions = {
    search: '',
    tag: '',
    series: '',
    order: '-published_date',
    page: '1',
    visibility: ''
};

const FILTER_KEYS = Object.keys(DEFAULT_FILTERS) as (keyof FilterOptions)[];
const VALID_ORDERS = new Set(POSTS_ORDER.map(({ order }) => order));
const VALID_VISIBILITY = new Set(['public', 'hidden']);

// Read initial filter values from the URL.
const getFiltersFromURL = (): FilterOptions => {
    if (typeof window === 'undefined') return DEFAULT_FILTERS;

    const params = new URLSearchParams(window.location.search);
    const order = params.get('order') || DEFAULT_FILTERS.order;
    const page = params.get('page') || DEFAULT_FILTERS.page;
    const visibility = params.get('visibility') || DEFAULT_FILTERS.visibility;

    return {
        search: params.get('search') || '',
        tag: params.get('tag') || '',
        series: params.get('series') || '',
        order: VALID_ORDERS.has(order) ? order : DEFAULT_FILTERS.order,
        page: /^[1-9]\d*$/.test(page) ? page : DEFAULT_FILTERS.page,
        visibility: VALID_VISIBILITY.has(visibility) ? visibility : DEFAULT_FILTERS.visibility
    };
};

// Keep filters in sync with the URL.
const syncFiltersToURL = (filters: FilterOptions) => {
    if (typeof window === 'undefined') return;

    const params = new URLSearchParams(window.location.search);
    FILTER_KEYS.forEach((key) => params.delete(key));

    Object.entries(filters).forEach(([key, value]) => {
        // Keep the URL concise by omitting defaults.
        if (value && value !== DEFAULT_FILTERS[key as keyof FilterOptions]) {
            params.set(key, value);
        }
    });

    const newURL = params.toString()
        ? `${window.location.pathname}?${params.toString()}`
        : window.location.pathname;

    window.history.replaceState({}, '', newURL);
};

export const usePostsFilterState = () => {
    const { t } = useLingui();
    const [filters, setFilters] = useState<FilterOptions>(getFiltersFromURL());
    const [searchValue, setSearchValue] = useState(filters.search);
    const [isFilterExpanded, setIsFilterExpanded] = useState(
        () => Boolean(filters.tag || filters.series || filters.visibility)
    );
    const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

    const { data: tags } = useSuspenseQuery({
        queryKey: ['setting-tags'],
        queryFn: async () => {
            const { data } = await getTags();
            if (data.status === 'DONE') {
                return data.body.tags;
            }
            throw new Error(t({
                id: 'settings.posts.load_tags_failed',
                message: 'Could not load tags.'
            }));
        }
    });

    const { data: series } = useSuspenseQuery({
        queryKey: ['setting-series'],
        queryFn: async () => {
            const { data } = await getSeries();
            if (data.status === 'DONE') {
                return data.body.series;
            }
            throw new Error(t({
                id: 'settings.posts.load_series_failed',
                message: 'Could not load series.'
            }));
        }
    });

    // Keep the URL in sync when filters change.
    useEffect(() => {
        syncFiltersToURL(filters);
    }, [filters]);

    useEffect(() => {
        return () => {
            if (searchDebounce.current) {
                clearTimeout(searchDebounce.current);
            }
        };
    }, []);

    const handleFilterChange = (key: keyof FilterOptions, value: string) => {
        if (key === 'search') {
            if (searchDebounce.current) {
                clearTimeout(searchDebounce.current);
                searchDebounce.current = null;
            }
            setSearchValue(value);
        }

        setFilters(prev => ({
            ...prev,
            [key]: value,
            page: key !== 'page' ? '1' : value
        }));
    };

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setSearchValue(value);

        if (searchDebounce.current) {
            clearTimeout(searchDebounce.current);
        }

        searchDebounce.current = setTimeout(() => {
            setFilters(prev => ({
                ...prev,
                search: value,
                page: '1'
            }));
            searchDebounce.current = null;
        }, 300);
    };

    const clearFilters = () => {
        if (searchDebounce.current) {
            clearTimeout(searchDebounce.current);
            searchDebounce.current = null;
        }
        setSearchValue('');
        setFilters({
            search: '',
            tag: '',
            series: '',
            order: filters.order || '-published_date',
            page: '1',
            visibility: ''
        });
    };

    return {
        filters,
        searchValue,
        isFilterExpanded,
        setIsFilterExpanded,
        handleFilterChange,
        handleSearchChange,
        clearFilters,
        tags,
        series
    };
};

export const usePostsQuery = (filters: FilterOptions, source: PostsSource = 'published') => {
    const { t } = useLingui();
    const [posts, setPosts] = useState<Post[]>([]);

    const { data: postsData, refetch } = useSuspenseQuery({
        queryKey: ['posts-setting', source, JSON.stringify(filters)],
        queryFn: async () => {
            const apiFilters: Record<string, string | number> = {};
            Object.entries(filters).forEach(([key, value]) => {
                if (value) {
                    apiFilters[key] = value;
                }
            });

            const { data } = source === 'scheduled'
                ? await getReservedPosts(apiFilters)
                : await getPosts(apiFilters);

            if (data.status === 'DONE') {
                return data.body;
            }
            throw new Error(t({
                id: 'settings.posts.load_failed',
                message: 'Could not load posts.'
            }));
        }
    });

    useEffect(() => {
        if (postsData?.posts) {
            setPosts(postsData.posts.map(post => {
                const persistedTag = post.tag;
                const persistedSeries = post.series || '';
                const draft = getPostClassificationDraft(postsData.username, post.url);
                const tag = draft?.hasTagChanged ? draft.tag : persistedTag;
                const series = draft?.hasSeriesChanged ? draft.series : persistedSeries;
                const nextPost: Post = {
                    ...post,
                    tag,
                    series,
                    persistedTag,
                    persistedSeries,
                    hasTagChanged: tag !== persistedTag,
                    hasSeriesChanged: series !== persistedSeries
                };

                return nextPost;
            }));
        }
    }, [postsData, source]);

    useEffect(() => {
        if (!postsData?.username) return;
        posts.forEach(post => syncPostClassificationDraft(postsData.username, post));
    }, [posts, postsData?.username]);

    return {
        posts,
        setPosts,
        postsData,
        refetch
    };
};
