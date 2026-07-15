import { useState, useEffect, useRef } from 'react';
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

export const POSTS_ORDER = [
    {
        name: '최근 발행순',
        order: '-published_date'
    },
    {
        name: '오래된 발행순',
        order: 'published_date'
    },
    {
        name: '최근 수정순',
        order: '-updated_date'
    },
    {
        name: '오래된 수정순',
        order: 'updated_date'
    },
    {
        name: '제목순',
        order: 'title'
    },
    {
        name: '제목 역순',
        order: '-title'
    },
    {
        name: '좋아요 많은순',
        order: '-count_likes'
    },
    {
        name: '좋아요 적은순',
        order: 'count_likes'
    },
    {
        name: '댓글 많은순',
        order: '-count_comments'
    },
    {
        name: '댓글 적은순',
        order: 'count_comments'
    },
    {
        name: '분량 적은순',
        order: 'read_time'
    },
    {
        name: '분량 많은순',
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

// URL에서 필터 초기값 읽기
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

// 필터를 URL에 동기화
const syncFiltersToURL = (filters: FilterOptions) => {
    if (typeof window === 'undefined') return;

    const params = new URLSearchParams(window.location.search);
    FILTER_KEYS.forEach((key) => params.delete(key));

    Object.entries(filters).forEach(([key, value]) => {
        // 기본값이 아닌 경우만 URL에 추가
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
            throw new Error('태그 목록을 불러오는데 실패했습니다.');
        }
    });

    const { data: series } = useSuspenseQuery({
        queryKey: ['setting-series'],
        queryFn: async () => {
            const { data } = await getSeries();
            if (data.status === 'DONE') {
                return data.body.series;
            }
            throw new Error('시리즈 목록을 불러오는데 실패했습니다.');
        }
    });

    // 필터 변경 시 URL 동기화
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
            throw new Error('포스트 목록을 불러오는데 실패했습니다.');
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
