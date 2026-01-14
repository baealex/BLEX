import { useState, useEffect, useRef } from 'react';
import { useSuspenseQuery } from '@tanstack/react-query';

import { getPosts, type Post as ApiPost } from '~/lib/api/posts';
import { getTags, getSeries, type Tag, type Series } from '~/lib/api/settings';

export interface Post extends ApiPost {
    hasTagChanged?: boolean;
    hasSeriesChanged?: boolean;
    isNotice?: boolean;
    isPinned?: boolean;
}

export interface FilterOptions {
    search: string;
    tag: string;
    series: string;
    order: string;
    page: string;
    visibility: string;
    notice: string;
}

export const POSTS_ORDER = [
    {
        name: '최신순',
        order: '-created_date'
    },
    {
        name: '오래된순',
        order: 'created_date'
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
    order: '-created_date',
    page: '1',
    visibility: '',
    notice: ''
};

// URL에서 필터 초기값 읽기
const getFiltersFromURL = (): FilterOptions => {
    if (typeof window === 'undefined') return DEFAULT_FILTERS;

    const params = new URLSearchParams(window.location.search);
    return {
        search: params.get('search') || '',
        tag: params.get('tag') || '',
        series: params.get('series') || '',
        order: params.get('order') || '-created_date',
        page: params.get('page') || '1',
        visibility: params.get('visibility') || '',
        notice: params.get('notice') || ''
    };
};

// 필터를 URL에 동기화
const syncFiltersToURL = (filters: FilterOptions) => {
    if (typeof window === 'undefined') return;

    const params = new URLSearchParams();
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

interface UsePostsDataReturn {
    // Data
    posts: Post[];
    setPosts: React.Dispatch<React.SetStateAction<Post[]>>;
    postsData: {
        posts: Post[];
        username: string;
        lastPage: number;
    } | undefined;
    tags: Tag[] | undefined;
    series: Series[] | undefined;

    // State
    filters: FilterOptions;
    isFilterExpanded: boolean;
    setIsFilterExpanded: React.Dispatch<React.SetStateAction<boolean>>;

    // Actions
    handleFilterChange: (key: keyof FilterOptions, value: string) => void;
    handleSearchChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    clearFilters: () => void;
    refetch: () => void;
}

export const usePostsData = (): UsePostsDataReturn => {
    const [filters, setFilters] = useState<FilterOptions>(getFiltersFromURL());
    const [isFilterExpanded, setIsFilterExpanded] = useState(true);
    const [posts, setPosts] = useState<Post[]>([]);
    const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

    const { data: postsData, refetch } = useSuspenseQuery({
        queryKey: ['posts-setting', JSON.stringify(filters)],
        queryFn: async () => {
            const apiFilters: Record<string, string | number> = {};
            Object.entries(filters).forEach(([key, value]) => {
                if (value) {
                    apiFilters[key] = value;
                }
            });

            const { data } = await getPosts(apiFilters);

            if (data.status === 'DONE') {
                return data.body;
            }
            throw new Error('포스트 목록을 불러오는데 실패했습니다.');
        }
    });

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

    useEffect(() => {
        if (postsData?.posts) {
            setPosts(postsData.posts);
        }
    }, [postsData]);

    // 필터 변경 시 URL 동기화
    useEffect(() => {
        syncFiltersToURL(filters);
    }, [filters]);

    const handleFilterChange = (key: keyof FilterOptions, value: string) => {
        setFilters(prev => ({
            ...prev,
            [key]: value,
            page: key !== 'page' ? '1' : value
        }));
    };

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;

        if (searchDebounce.current) {
            clearTimeout(searchDebounce.current);
        }

        searchDebounce.current = setTimeout(() => {
            handleFilterChange('search', value);
        }, 300);
    };

    const clearFilters = () => {
        setFilters({
            search: '',
            tag: '',
            series: '',
            order: filters.order,
            page: '1',
            visibility: '',
            notice: ''
        });
    };

    return {
        posts,
        setPosts,
        postsData,
        tags,
        series,
        filters,
        isFilterExpanded,
        setIsFilterExpanded,
        handleFilterChange,
        handleSearchChange,
        clearFilters,
        refetch
    };
};
